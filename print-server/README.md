# Erlbrew Print Server (Rust)

Low-latency print server for the Erlbrew POS. Runs on the Raspberry Pi that is
paired with the Bluetooth thermal printer and exposes the same HTTP contract as
the previous Python implementation (`print-server.py`), so **no frontend or
backend changes are needed**.

## Why it was rewritten

The Python server was the bottleneck of the receipt flow:

| | Python (`print-server.py`) | Rust (`erlbrew-print-server`) |
|---|---|---|
| HTTP server | `http.server` — single thread, blocking | Tokio + axum — async, multi-worker |
| Bluetooth | new RFCOMM socket per job (1–3 s each) | socket kept open between jobs, reconnect only on failure |
| Drawer kick | 150 ms sleep + up to 4 reconnects | configurable 50 ms pulse delay, bounded retries |
| TLS | Python `ssl` + RSA-2048 cert | rustls + ECDSA P-256, session resumption |
| Failure mode | a stuck job blocks all following requests | per-job connect/write timeouts (`BT_CONNECT_TIMEOUT_MS`, `BT_WRITE_TIMEOUT_MS`) |

Measured effect: steady-state printing drops from ~1.5–3 s per receipt
(TLS handshake + RFCOMM connect) to roughly the time the printer itself needs
to burn the paper.

## Endpoints (unchanged)

| Method | Path | Description |
|---|---|---|
| POST | `/print` | `{lines, paperSize, qrCodeUrl, wifiQrData}` → ESC/POS receipt |
| POST/GET | `/open-drawer` | cash drawer kick (primary pulse, fallback polarity) |
| GET | `/health` | status, printer type, masked MAC, job counters |

CORS (including Chrome's Private Network Access header) is identical to the
Python version. `GET /health` gained extra diagnostic fields; existing
consumers ignore them.

## Configuration (`.env`)

Copy `.env.example` to `.env` (the root-level `print-server.env.example` is
kept in sync). All variables are optional:

| Variable | Default | Notes |
|---|---|---|
| `BT_PRINTER_MAC` | `02:15:BF:C6:F0:E6` | printer's Bluetooth MAC; set to `none` to disable |
| `PRINTER_TYPE` | `bluetooth` | `bluetooth`, `cups` or `none` (log-only preview) |
| `PRINT_SERVER_PORT` | `9100` | |
| `BT_CHANNEL` | `1` | RFCOMM channel |
| `CUPS_PRINTER` | `thermal` | queue name for `PRINTER_TYPE=cups` |
| `BT_CONNECT_TIMEOUT_MS` | `8000` | RFCOMM handshake budget |
| `BT_WRITE_TIMEOUT_MS` | `5000` | socket send timeout |
| `DRAWER_INIT_DELAY_MS` | `50` | gap between `ESC @` and the drawer pulse |
| `BT_IDLE_TIMEOUT_SECS` | `0` | close an idle RFCOMM socket after N seconds (0 = keep open) |
| `ALLOWED_ORIGINS` | `*` | comma-separated origin allowlist |
| `TLS_DISABLE` | unset | set `1` for plain HTTP |
| `TLS_CERT_FILE` / `TLS_KEY_FILE` | `cert.pem` / `key.pem` | auto-generated if missing or older than 7 days |
| `TLS_SANS` | `localhost` | extra subject-alternative names, e.g. `TLS_SANS=192.168.75.101` |
| `RUST_LOG` | `info` | `debug` logs every reconnect/write |

## Build & run

### Docker (recommended, Pi 3B+/ARM64)

```bash
cp .env.example .env    # edit BT_PRINTER_MAC
docker compose up -d --build
```

The first build compiles the binary (5–15 min on a Pi 3B+); later builds reuse
the dependency cache layer. Pre-built cross-compilation is also possible from
an x86 machine with `cargo build --release --target aarch64-unknown-linux-gnu`.

### Bare metal

```bash
cargo build --release
./target/release/erlbrew-print-server
```

## Development

```bash
cargo test            # unit tests (ESC/POS parity, MAC parsing, config)
cargo run             # PRINTER_TYPE=none TLS_DISABLE=1 for a dry run
```

ESC/POS output is verified to be byte-identical to the Python implementation
(formatting, QR codes, bold rules, feed/cut) — see the tests in
`src/escpos.rs`.
