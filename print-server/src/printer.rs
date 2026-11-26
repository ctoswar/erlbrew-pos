//! Serialised print queue.
//!
//! One background task owns the printer connection, so receipts are printed in
//! arrival order and can never interleave. The socket stays open between jobs;
//! a failed write drops it and reconnects once before reporting an error.

use std::io;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use tokio::sync::{mpsc, oneshot};

use crate::bluetooth::BtConnection;
use crate::config::{Config, PrinterType};
use crate::cups;
use crate::escpos;

/// Pause before retrying a failed Bluetooth connect/write.
const RETRY_DELAY: Duration = Duration::from_millis(300);
/// How many times a drawer kick is attempted with the primary polarity.
const DRAWER_ATTEMPTS: usize = 3;

#[derive(Debug)]
pub enum Command {
    /// Pre-built ESC/POS payload.
    Print(Vec<u8>),
    /// Cash drawer kick; `delay` is the gap between `ESC @` and the pulse.
    Drawer { delay: Duration },
}

pub struct Job {
    pub command: Command,
    pub reply: oneshot::Sender<Result<(), String>>,
}

/// Counters exposed on `/health`.
#[derive(Debug)]
pub struct Metrics {
    started: Instant,
    jobs_printed: AtomicU64,
    jobs_failed: AtomicU64,
    bluetooth_connected: AtomicBool,
    last_job_at: AtomicU64,
    last_error: Mutex<Option<String>>,
}

impl Default for Metrics {
    fn default() -> Self {
        Self::new()
    }
}

impl Metrics {
    pub fn new() -> Self {
        Self {
            started: Instant::now(),
            jobs_printed: AtomicU64::new(0),
            jobs_failed: AtomicU64::new(0),
            bluetooth_connected: AtomicBool::new(false),
            last_job_at: AtomicU64::new(0),
            last_error: Mutex::new(None),
        }
    }

    pub fn uptime_secs(&self) -> u64 {
        self.started.elapsed().as_secs()
    }

    pub fn jobs_printed(&self) -> u64 {
        self.jobs_printed.load(Ordering::Relaxed)
    }

    pub fn jobs_failed(&self) -> u64 {
        self.jobs_failed.load(Ordering::Relaxed)
    }

    pub fn bluetooth_connected(&self) -> bool {
        self.bluetooth_connected.load(Ordering::Relaxed)
    }

    pub fn last_job_at(&self) -> Option<u64> {
        match self.last_job_at.load(Ordering::Relaxed) {
            0 => None,
            ts => Some(ts),
        }
    }

    pub fn last_error(&self) -> Option<String> {
        self.last_error.lock().ok().and_then(|e| e.clone())
    }

    fn set_connected(&self, connected: bool) {
        self.bluetooth_connected.store(connected, Ordering::Relaxed);
    }

    fn record(&self, outcome: &Result<(), String>) {
        self.last_job_at.store(
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0),
            Ordering::Relaxed,
        );
        match outcome {
            Ok(()) => {
                self.jobs_printed.fetch_add(1, Ordering::Relaxed);
            }
            Err(err) => {
                self.jobs_failed.fetch_add(1, Ordering::Relaxed);
                tracing::error!("print job failed: {err}");
                if let Ok(mut slot) = self.last_error.lock() {
                    *slot = Some(err.clone());
                }
            }
        }
    }
}

/// Starts the printer task and returns the queue handle.
pub fn spawn(cfg: Arc<Config>, metrics: Arc<Metrics>) -> mpsc::Sender<Job> {
    let (tx, rx) = mpsc::channel(64);
    tokio::spawn(run(cfg, metrics, rx));
    tx
}

async fn run(cfg: Arc<Config>, metrics: Arc<Metrics>, mut jobs: mpsc::Receiver<Job>) {
    let mut conn: Option<BtConnection> = None;

    loop {
        let next = match cfg.idle_timeout {
            Some(idle) => match tokio::time::timeout(idle, jobs.recv()).await {
                Ok(job) => job,
                Err(_) => {
                    if conn.take().is_some() {
                        metrics.set_connected(false);
                        tracing::info!("closing idle Bluetooth connection");
                    }
                    continue;
                }
            },
            None => jobs.recv().await,
        };

        let Some(Job { command, reply }) = next else {
            break;
        };

        let outcome = execute(&cfg, &metrics, &mut conn, command).await;
        metrics.record(&outcome);
        let _ = reply.send(outcome);
    }

    metrics.set_connected(false);
}

async fn execute(
    cfg: &Config,
    metrics: &Metrics,
    conn: &mut Option<BtConnection>,
    command: Command,
) -> Result<(), String> {
    match command {
        // Drawer kicks always go over Bluetooth, exactly like the Python server,
        // regardless of PRINTER_TYPE.
        Command::Drawer { delay } => {
            let mac = cfg
                .bluetooth_mac
                .as_deref()
                .ok_or_else(|| "No BLUETOOTH_MAC configured".to_string())?;
            open_drawer(cfg, metrics, conn, mac, delay).await
        }
        Command::Print(payload) => match cfg.printer_type {
            PrinterType::None => Ok(()),
            PrinterType::Cups => {
                let printer = cfg.cups_printer.clone();
                tokio::task::spawn_blocking(move || cups::send(&printer, &payload))
                    .await
                    .map_err(|e| format!("CUPS worker failed: {e}"))?
                    .map_err(|e| format!("CUPS send failed: {e}"))
            }
            PrinterType::Bluetooth => {
                let mac = cfg
                    .bluetooth_mac
                    .as_deref()
                    .ok_or_else(|| "No BLUETOOTH_MAC configured".to_string())?;
                with_connection(cfg, metrics, conn, mac, 2, move |socket| {
                    socket.write_all(&payload)
                })
                .await
            }
        },
    }
}

async fn open_drawer(
    cfg: &Config,
    metrics: &Metrics,
    conn: &mut Option<BtConnection>,
    mac: &str,
    delay: Duration,
) -> Result<(), String> {
    let mut last_error = String::from("drawer kick failed");

    for attempt in 1..=DRAWER_ATTEMPTS {
        let kick = move |socket: &mut BtConnection| {
            socket.write_all(escpos::INIT)?;
            std::thread::sleep(delay);
            socket.write_all(escpos::CASH_DRAWER_PRIMARY)
        };

        match with_connection(cfg, metrics, conn, mac, 1, kick).await {
            Ok(()) => return Ok(()),
            Err(err) => {
                tracing::warn!("drawer attempt {attempt}/{DRAWER_ATTEMPTS} failed: {err}");
                last_error = err;
                tokio::time::sleep(RETRY_DELAY).await;
            }
        }
    }

    tracing::info!("trying fallback drawer polarity");
    let kick = move |socket: &mut BtConnection| {
        socket.write_all(escpos::INIT)?;
        std::thread::sleep(delay);
        socket.write_all(escpos::CASH_DRAWER_FALLBACK)
    };

    with_connection(cfg, metrics, conn, mac, 1, kick)
        .await
        .map_err(|err| format!("{last_error}; fallback: {err}"))
}

/// Runs `op` on the (re)connected socket, retrying `attempts` times.
async fn with_connection<F>(
    cfg: &Config,
    metrics: &Metrics,
    conn: &mut Option<BtConnection>,
    mac: &str,
    attempts: usize,
    op: F,
) -> Result<(), String>
where
    F: Fn(&mut BtConnection) -> io::Result<()> + Clone + Send + 'static,
{
    let attempts = attempts.max(1);
    let mut last_error = String::from("Bluetooth send failed");

    for attempt in 1..=attempts {
        if conn.is_none() {
            match connect(cfg, mac).await {
                Ok(socket) => {
                    *conn = Some(socket);
                    metrics.set_connected(true);
                    tracing::info!("connected to Bluetooth printer at {mac}");
                }
                Err(err) => {
                    metrics.set_connected(false);
                    tracing::warn!("Bluetooth connect {attempt}/{attempts} failed: {err}");
                    last_error = format!("connect failed: {err}");
                    if attempt < attempts {
                        tokio::time::sleep(RETRY_DELAY).await;
                    }
                    continue;
                }
            }
        }

        // Move the socket into the blocking worker and hand it back afterwards,
        // so a wedged write cannot block the async runtime.
        let socket = conn.take();
        let op = op.clone();
        let result = tokio::task::spawn_blocking(move || {
            let mut socket = socket;
            let outcome = match socket.as_mut() {
                Some(socket) => op(socket),
                None => Err(io::Error::new(
                    io::ErrorKind::NotConnected,
                    "no Bluetooth connection",
                )),
            };
            (socket, outcome)
        })
        .await;

        match result {
            Ok((socket, Ok(()))) => {
                *conn = socket;
                return Ok(());
            }
            Ok((_socket, Err(err))) => {
                metrics.set_connected(false);
                tracing::warn!("Bluetooth write {attempt}/{attempts} failed: {err}");
                last_error = err.to_string();
            }
            Err(err) => {
                metrics.set_connected(false);
                tracing::warn!("Bluetooth worker {attempt}/{attempts} failed: {err}");
                last_error = err.to_string();
            }
        }

        if attempt < attempts {
            tokio::time::sleep(RETRY_DELAY).await;
        }
    }

    Err(last_error)
}

async fn connect(cfg: &Config, mac: &str) -> io::Result<BtConnection> {
    let mac = mac.to_string();
    let channel = cfg.bluetooth_channel;
    let connect_timeout = cfg.connect_timeout;
    let write_timeout = cfg.write_timeout;

    tokio::task::spawn_blocking(move || {
        BtConnection::connect(&mac, channel, connect_timeout, write_timeout)
    })
    .await
    .map_err(|e| io::Error::other(format!("Bluetooth worker failed: {e}")))?
}
