//! HTTP surface — identical contract to the Python server.
//!
//! `POST /print`, `POST|GET /open-drawer`, `GET /health`, CORS preflight and a
//! JSON 404 for everything else.

use std::sync::Arc;

use axum::body::Bytes;
use axum::extract::{Request, State};
use axum::http::{header, HeaderMap, HeaderValue, Method, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::sync::{mpsc, oneshot};

use crate::config::{Config, PrinterType};
use crate::escpos::{self, PaperSize};
use crate::printer::{Command, Job, Metrics};

#[derive(Clone)]
pub struct AppState {
    pub cfg: Arc<Config>,
    pub jobs: mpsc::Sender<Job>,
    pub metrics: Arc<Metrics>,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/print", post(print))
        .route("/open-drawer", post(open_drawer).get(open_drawer))
        .fallback(not_found)
        .layer(middleware::from_fn_with_state(state.clone(), cors))
        .with_state(state)
}

#[derive(Debug, Deserialize)]
struct PrintRequest {
    #[serde(default)]
    lines: Vec<String>,
    #[serde(default, rename = "paperSize")]
    paper_size: Option<String>,
    #[serde(default, rename = "qrCodeUrl")]
    qr_code_url: Option<String>,
    #[serde(default, rename = "wifiQrData")]
    wifi_qr_data: Option<String>,
}

async fn health(State(state): State<AppState>) -> Json<Value> {
    let cfg = &state.cfg;
    let metrics = &state.metrics;

    Json(json!({
        "status": "ok",
        "printer_type": cfg.printer_type.as_str(),
        "bluetooth_mac": cfg.masked_mac(),
        "bluetooth_connected": metrics.bluetooth_connected(),
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_secs": metrics.uptime_secs(),
        "jobs_printed": metrics.jobs_printed(),
        "jobs_failed": metrics.jobs_failed(),
        "last_job_at": metrics.last_job_at(),
        "last_error": metrics.last_error(),
    }))
}

async fn print(State(state): State<AppState>, body: Bytes) -> Response {
    let payload: PrintRequest = match serde_json::from_slice(&body) {
        Ok(payload) => payload,
        Err(_) => {
            return json_response(StatusCode::BAD_REQUEST, json!({ "error": "Invalid JSON" }))
        }
    };

    let paper = PaperSize::parse(payload.paper_size.as_deref().unwrap_or("80mm"));
    let qr_code_url = payload.qr_code_url.filter(|url| !url.is_empty());
    let wifi_qr_data = payload.wifi_qr_data.filter(|data| !data.is_empty());

    tracing::info!(
        lines = payload.lines.len(),
        paper = paper.as_str(),
        qr = qr_code_url.is_some(),
        wifi_qr = wifi_qr_data.is_some(),
        "received print job"
    );

    // Log-only mode keeps the Python behaviour (preview in the log, 200 OK).
    if state.cfg.printer_type == PrinterType::None {
        tracing::info!("=== RECEIPT PREVIEW ===");
        for line in &payload.lines {
            tracing::info!("{line}");
        }
        tracing::info!("=== END RECEIPT ===");
        return json_response(StatusCode::OK, json!({ "ok": true }));
    }

    let raw = escpos::receipt(
        &payload.lines,
        paper,
        qr_code_url.as_deref(),
        wifi_qr_data.as_deref(),
    );

    match enqueue(&state, Command::Print(raw)).await {
        Ok(()) => json_response(StatusCode::OK, json!({ "ok": true })),
        Err(err) => {
            tracing::error!("print failed: {err}");
            json_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                json!({ "error": "Print failed" }),
            )
        }
    }
}

/// The drawer endpoint always answers 200 with a boolean result, like the
/// Python implementation — the POS uses `ok` to show a toast.
async fn open_drawer(State(state): State<AppState>) -> Response {
    if state.cfg.bluetooth_mac.is_none() {
        return json_response(
            StatusCode::OK,
            json!({ "error": "No BLUETOOTH_MAC configured" }),
        );
    }

    tracing::info!("=== CASH DRAWER REQUEST RECEIVED ===");
    let delay = state.cfg.drawer_init_delay;
    let opened = enqueue(&state, Command::Drawer { delay }).await.is_ok();
    tracing::info!("cash drawer result: {opened}");

    json_response(
        StatusCode::OK,
        json!({
            "ok": opened,
            "drawer": if opened { "opened" } else { "failed" },
        }),
    )
}

async fn enqueue(state: &AppState, command: Command) -> Result<(), String> {
    let (reply, response) = oneshot::channel();

    state
        .jobs
        .send(Job { command, reply })
        .await
        .map_err(|_| "print queue unavailable".to_string())?;

    response
        .await
        .map_err(|_| "print worker stopped".to_string())?
}

async fn not_found() -> Response {
    json_response(StatusCode::NOT_FOUND, json!({ "error": "Not found" }))
}

fn json_response(status: StatusCode, body: Value) -> Response {
    (
        status,
        [(
            header::CONTENT_TYPE,
            HeaderValue::from_static("application/json"),
        )],
        body.to_string(),
    )
        .into_response()
}

/// Adds CORS (including Chrome's Private Network Access header) to every
/// response and short-circuits preflight requests.
async fn cors(State(state): State<AppState>, request: Request, next: Next) -> Response {
    let origin = request.headers().get(header::ORIGIN).cloned();

    if request.method() == Method::OPTIONS {
        let mut response = StatusCode::OK.into_response();
        apply_cors(response.headers_mut(), &state.cfg, origin.as_ref());
        return response;
    }

    let mut response = next.run(request).await;
    apply_cors(response.headers_mut(), &state.cfg, origin.as_ref());
    response
}

fn apply_cors(headers: &mut HeaderMap, cfg: &Config, origin: Option<&HeaderValue>) {
    let allowed = if cfg.allows_any_origin() {
        "*".to_string()
    } else {
        origin
            .and_then(|value| value.to_str().ok())
            .filter(|value| cfg.allowed_origins.iter().any(|allowed| allowed == value))
            .map(|value| value.to_string())
            .unwrap_or_else(|| {
                cfg.allowed_origins
                    .first()
                    .cloned()
                    .unwrap_or_else(|| "*".to_string())
            })
    };

    if let Ok(value) = HeaderValue::from_str(&allowed) {
        headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, value);
    }
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET, POST, OPTIONS"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static("Content-Type, Authorization"),
    );
    headers.insert(
        header::ACCESS_CONTROL_MAX_AGE,
        HeaderValue::from_static("600"),
    );
    // Required for Chrome to allow a public page (POS) to reach the Pi's LAN IP.
    headers.insert(
        "access-control-allow-private-network",
        HeaderValue::from_static("true"),
    );
    headers.append(header::VARY, HeaderValue::from_static("Origin"));
}
