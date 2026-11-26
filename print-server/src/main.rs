//! Erlbrew POS print server — low-latency rewrite of `print-server.py`.
//!
//! Runs on the Raspberry Pi next to the Bluetooth thermal printer and exposes
//! the same three endpoints the backend proxies to:
//!
//! * `POST /print`        — ESC/POS receipt
//! * `POST /open-drawer`  — cash drawer kick
//! * `GET  /health`       — status probe
//!
//! Configuration is read from the environment (and `.env`), matching the
//! variables the Python version used.

mod bluetooth;
mod config;
mod cups;
mod escpos;
mod printer;
mod server;
mod tls;

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use axum_server::Handle;

#[tokio::main]
async fn main() -> Result<()> {
    config::load_env_files();
    init_logging();

    let cfg = Arc::new(config::Config::from_env());
    let metrics = Arc::new(printer::Metrics::new());
    let jobs = printer::spawn(cfg.clone(), metrics.clone());

    let app = server::router(server::AppState {
        cfg: cfg.clone(),
        jobs,
        metrics,
    });

    let addr = SocketAddr::from(([0, 0, 0, 0], cfg.port));
    let scheme = if cfg.tls { "https" } else { "http" };
    banner(scheme, &cfg);

    let handle = Handle::new();
    tokio::spawn(shutdown_signal(handle.clone()));

    if cfg.tls {
        let tls = tls::config(&cfg).await?;
        tracing::info!("HTTPS enabled");
        axum_server::bind_rustls(addr, tls)
            .handle(handle)
            .serve(app.into_make_service())
            .await?;
    } else {
        tracing::warn!("running plain HTTP (no TLS) — tablets must allow insecure origins");
        axum_server::bind(addr)
            .handle(handle)
            .serve(app.into_make_service())
            .await?;
    }

    tracing::info!("print server stopped");
    Ok(())
}

fn init_logging() {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .init();
}

fn banner(scheme: &str, cfg: &config::Config) {
    println!(
        r#"
+------------------------------------------------+
|       Erlbrew POS Print Server (Rust)          |
|                                                |
|  Listening on {scheme}://0.0.0.0:{port}/print
|  Printer type : {printer}
|  BT MAC       : {mac}
|  BT channel   : {channel}
|  Version      : {version}
|                                                |
|  Env: BT_PRINTER_MAC, PRINTER_TYPE,
|       PRINT_SERVER_PORT
+------------------------------------------------+
"#,
        scheme = scheme,
        port = cfg.port,
        printer = cfg.printer_type.as_str(),
        mac = cfg.bluetooth_mac.as_deref().unwrap_or("not set"),
        channel = cfg.bluetooth_channel,
        version = env!("CARGO_PKG_VERSION"),
    );
}

async fn shutdown_signal(handle: Handle<SocketAddr>) {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("shutdown signal received, finishing in-flight jobs");
    handle.graceful_shutdown(Some(Duration::from_secs(2)));
}
