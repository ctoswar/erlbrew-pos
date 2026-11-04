# ── Erlbrew Café customer PWA (Flutter Web) Dockerfile ───────────────────────
# Multi-stage: flutter web build → static nginx serve.
# The backend URL is baked at build time via POS_API_URL (compose ARG / --build-arg).
# PWA note: nginx serves over plain HTTP for LAN use — the browser "install" badge
# needs HTTPS, which arrives when the host is published (Cloudflare tunnel/Pages).

# Stage 1: Build the Flutter web bundle
FROM ghcr.io/cirruslabs/flutter:3.44.0 AS builder
WORKDIR /app

# Pub-first for layer caching (build context = repo root, see infra/docker-compose.yml)
COPY erlbrew_app/pubspec.yaml erlbrew_app/pubspec.lock ./
RUN flutter pub get

COPY erlbrew_app/ .

# Backend URL baked into the JS bundle (PosApiService reads POS_API_URL)
ARG POS_API_URL=http://localhost:3001
RUN flutter build web --release --dart-define=POS_API_URL=${POS_API_URL}

# Stage 2: Serve statically
FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
# curl for healthchecks
RUN apk add --no-cache curl

COPY erlbrew_app/nginx.app.conf /etc/nginx/conf.d/erlbrew-app.conf
COPY --from=builder /app/build/web /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
