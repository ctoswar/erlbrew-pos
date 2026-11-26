//! Self-signed TLS for the LAN print server.
//!
//! Certificates are generated with `rcgen` (ECDSA P-256, so the handshake is
//! much cheaper than the RSA-2048 key the Python server generated) and
//! regenerated weekly, mirroring the previous 7-day refresh.

use std::fs;
use std::time::Duration;

use anyhow::{Context, Result};
use axum_server::tls_rustls::RustlsConfig;

use crate::config::Config;

const REGENERATE_AFTER: Duration = Duration::from_secs(7 * 24 * 60 * 60);

/// Builds the rustls configuration, creating `cert.pem`/`key.pem` if needed.
pub async fn config(cfg: &Config) -> Result<RustlsConfig> {
    if needs_regeneration(cfg) {
        generate(cfg).context("generating self-signed certificate")?;
    }

    RustlsConfig::from_pem_file(&cfg.cert_path, &cfg.key_path)
        .await
        .with_context(|| {
            format!(
                "loading TLS certificate {} / {}",
                cfg.cert_path.display(),
                cfg.key_path.display()
            )
        })
}

fn needs_regeneration(cfg: &Config) -> bool {
    let cert_ok = fs::metadata(&cfg.cert_path)
        .and_then(|meta| meta.modified())
        .map(|modified| {
            modified
                .elapsed()
                .map(|age| age < REGENERATE_AFTER)
                .unwrap_or(false)
        })
        .unwrap_or(false);
    let key_ok = fs::metadata(&cfg.key_path)
        .map(|meta| meta.len() > 0)
        .unwrap_or(false);
    !(cert_ok && key_ok)
}

fn generate(cfg: &Config) -> Result<()> {
    tracing::info!("generating self-signed TLS certificate");

    let key_pair = rcgen::KeyPair::generate()?;
    let mut params = rcgen::CertificateParams::new(cfg.tls_sans.clone())?;
    params
        .distinguished_name
        .push(rcgen::DnType::CommonName, "erlbrew-cafe");
    let cert = params.self_signed(&key_pair)?;

    fs::write(&cfg.cert_path, cert.pem())
        .with_context(|| format!("writing {}", cfg.cert_path.display()))?;
    fs::write(&cfg.key_path, key_pair.serialize_pem())
        .with_context(|| format!("writing {}", cfg.key_path.display()))?;

    // Keep the private key readable by the service user only.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&cfg.key_path, fs::Permissions::from_mode(0o600))?;
    }

    tracing::info!(
        "TLS certificate generated for [{}]",
        cfg.tls_sans.join(", ")
    );
    Ok(())
}
