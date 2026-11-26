//! Environment-driven configuration.
//!
//! Every value mirrors an environment variable that the Python server used, so
//! existing `.env` files keep working. New, latency-related knobs are additive.

use std::env;
use std::path::PathBuf;
use std::time::Duration;

/// Same default as the Python server so an existing Pi keeps printing.
pub const DEFAULT_BT_MAC: &str = "02:15:BF:C6:F0:E6";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PrinterType {
    Bluetooth,
    Cups,
    None,
}

impl PrinterType {
    pub fn parse(raw: &str) -> Self {
        match raw.trim().to_ascii_lowercase().as_str() {
            "bluetooth" | "bt" | "rfcomm" => Self::Bluetooth,
            "cups" | "lpr" => Self::Cups,
            _ => Self::None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Bluetooth => "bluetooth",
            Self::Cups => "cups",
            Self::None => "none",
        }
    }
}

#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    /// `["*"]` means any origin (Python's hardcoded behaviour).
    pub allowed_origins: Vec<String>,
    pub bluetooth_mac: Option<String>,
    pub bluetooth_channel: u8,
    pub printer_type: PrinterType,
    pub cups_printer: String,
    /// How long to wait for the RFCOMM handshake before giving up.
    pub connect_timeout: Duration,
    /// Socket send timeout, so a wedged printer cannot block the queue forever.
    pub write_timeout: Duration,
    /// Gap between `ESC @` and the drawer pulse (Python slept 150 ms).
    pub drawer_init_delay: Duration,
    /// Close the idle RFCOMM socket after this long. `None` keeps it open.
    pub idle_timeout: Option<Duration>,
    pub tls: bool,
    pub cert_path: PathBuf,
    pub key_path: PathBuf,
    /// Subject alternative names for the auto-generated certificate.
    pub tls_sans: Vec<String>,
}

impl Config {
    pub fn from_env() -> Self {
        let printer_type =
            PrinterType::parse(&var("PRINTER_TYPE").unwrap_or_else(|| "bluetooth".into()));

        let mac = var("BT_PRINTER_MAC").unwrap_or_else(|| DEFAULT_BT_MAC.to_string());
        let bluetooth_mac = if mac.eq_ignore_ascii_case("none") || mac.is_empty() {
            None
        } else {
            Some(mac)
        };

        let tls = !truthy("TLS_DISABLE")
            && !matches!(
                var("PRINT_SERVER_TLS").as_deref(),
                Some("0" | "false" | "off")
            );

        Self {
            port: parse("PRINT_SERVER_PORT", 9100u16),
            allowed_origins: parse_origins(),
            bluetooth_mac,
            bluetooth_channel: parse("BT_CHANNEL", 1u8),
            printer_type,
            cups_printer: var("CUPS_PRINTER").unwrap_or_else(|| "thermal".into()),
            connect_timeout: Duration::from_millis(parse("BT_CONNECT_TIMEOUT_MS", 8_000u64)),
            write_timeout: Duration::from_millis(parse("BT_WRITE_TIMEOUT_MS", 5_000u64)),
            drawer_init_delay: Duration::from_millis(parse("DRAWER_INIT_DELAY_MS", 50u64)),
            idle_timeout: match parse("BT_IDLE_TIMEOUT_SECS", 0u64) {
                0 => None,
                secs => Some(Duration::from_secs(secs)),
            },
            tls,
            cert_path: PathBuf::from(var("TLS_CERT_FILE").unwrap_or_else(|| "cert.pem".into())),
            key_path: PathBuf::from(var("TLS_KEY_FILE").unwrap_or_else(|| "key.pem".into())),
            tls_sans: parse_sans(),
        }
    }

    /// Same masking the Python `/health` endpoint used: first 12 chars + `****`.
    pub fn masked_mac(&self) -> String {
        match &self.bluetooth_mac {
            Some(mac) => format!("{}****", mac.chars().take(12).collect::<String>()),
            None => "not set".to_string(),
        }
    }

    pub fn allows_any_origin(&self) -> bool {
        self.allowed_origins.iter().any(|o| o == "*")
    }
}

/// Loads `./.env` (or a `.env` next to the executable) without overriding
/// variables that are already set in the real environment.
pub fn load_env_files() {
    if dotenvy::from_filename(".env").is_err() {
        if let Ok(exe) = env::current_exe() {
            if let Some(dir) = exe.parent() {
                let _ = dotenvy::from_path(dir.join(".env"));
            }
        }
    }
}

fn var(name: &str) -> Option<String> {
    env::var(name)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn parse<T: std::str::FromStr>(name: &str, default: T) -> T {
    var(name)
        .and_then(|raw| raw.parse().ok())
        .unwrap_or(default)
}

fn truthy(name: &str) -> bool {
    matches!(
        var(name).as_deref(),
        Some("1" | "true" | "TRUE" | "yes" | "on")
    )
}

fn parse_origins() -> Vec<String> {
    match var("ALLOWED_ORIGINS") {
        None => vec!["*".to_string()],
        Some(raw) => {
            let list: Vec<String> = raw
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            if list.is_empty() {
                vec!["*".to_string()]
            } else {
                list
            }
        }
    }
}

fn parse_sans() -> Vec<String> {
    let mut sans: Vec<String> = vec!["localhost".into(), "127.0.0.1".into()];
    if let Some(raw) = var("TLS_SANS") {
        for entry in raw.split(',') {
            let entry = entry.trim();
            if !entry.is_empty() && !sans.iter().any(|s| s == entry) {
                sans.push(entry.to_string());
            }
        }
    }
    sans
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn printer_type_parsing_matches_python() {
        assert_eq!(PrinterType::parse("bluetooth"), PrinterType::Bluetooth);
        assert_eq!(PrinterType::parse(" CUPS "), PrinterType::Cups);
        assert_eq!(PrinterType::parse("none"), PrinterType::None);
        // Unknown values fall back to log-only, like the Python server.
        assert_eq!(PrinterType::parse("something-else"), PrinterType::None);
    }

    #[test]
    fn mac_is_masked_like_python() {
        let mut cfg = Config::from_env();
        cfg.bluetooth_mac = Some("02:15:BF:C6:F0:E6".into());
        assert_eq!(cfg.masked_mac(), "02:15:BF:C6:****");
        cfg.bluetooth_mac = None;
        assert_eq!(cfg.masked_mac(), "not set");
    }
}
