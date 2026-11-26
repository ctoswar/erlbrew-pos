# ── Erlbrew POS Print Server Dockerfile (Raspberry Pi 3B+ / ARM64) ──────────
# Build: docker compose build
# Deploy: docker compose up -d
#
# This is a separate deployment target from the main POS app.
# The POS runs on a different server; this runs on the RPi connected to
# the thermal printer via Bluetooth.
#
# The image is a multi-stage Rust build: the compiler only lives in the
# builder stage, the runtime image ships just the static-ish binary plus
# bluez (Bluetooth stack) and cups-client (lpr for PRINTER_TYPE=cups).

# ── Builder ──────────────────────────────────────────────────────────────────
FROM rust:1-slim-bookworm AS builder

ARG DEBIAN_FRONTEND=noninteractive

# gcc is required to compile the `ring` crypto backend.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cache dependencies: build a stub crate first so `cargo build` only
# recompiles the application code when src/ changes.
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs \
    && cargo build --release \
    && rm -rf src

COPY src ./src
RUN touch src/main.rs && cargo build --release

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM debian:bookworm-slim

ARG DEBIAN_FRONTEND=noninteractive

# bluez  — Bluetooth stack (the Rust server talks raw RFCOMM sockets)
# cups-client — `lpr` used when PRINTER_TYPE=cups
# curl — container healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    bluez \
    bluetooth \
    cups-client \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create a non-root user with Bluetooth access (bluetooth/lp groups)
RUN useradd --create-home --shell /bin/bash printsvc \
    && usermod -aG bluetooth,lp printsvc \
    && mkdir -p /app/certs \
    && chown -R printsvc:printsvc /app

COPY --from=builder /app/target/release/erlbrew-print-server /usr/local/bin/erlbrew-print-server

USER printsvc

EXPOSE 9100

# Health check — uses HTTPS since the server auto-generates a self-signed cert.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -kfsS https://localhost:9100/health || exit 1

CMD ["erlbrew-print-server"]
