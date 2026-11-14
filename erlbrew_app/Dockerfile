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

# Backend URL baked into the JS bundle (PosApiService reads POS_API_URL).
# --no-tree-shake-icons: the icon font subsetter silently DROPPED the glyphs
# referenced through the RewardIconChoice const-class indirection (reward
# icons / scan FAB rendered blank on web while the rest of the app was fine).
# Shipping the full MaterialIcons font (~1.6MB) guarantees every Icons.*
# glyph exists; worth it for a LAN café PWA.
ARG POS_API_URL=http://localhost:3001
RUN flutter build web --release --no-tree-shake-icons --dart-define=POS_API_URL=${POS_API_URL}

# Cache-bust the entry chain. main.dart.js / flutter_bootstrap.js keep the same
# filename on every build, so CDNs and browsers can serve a stale copy for hours
# after a rebuild (seen live: mixed-content errors from an old baked-in URL,
# even after the origin was fixed). Stamp references with a content hash of
# main.dart.js: identical build -> identical URL (cache-friendly), any change ->
# a URL no cache has ever seen (always fresh, no purge needed).
RUN STAMP=$(md5sum build/web/main.dart.js | cut -c1-10) && \
    sed -i "s/main\.dart\.js/main.dart.js?v=$STAMP/g" build/web/flutter_bootstrap.js && \
    sed -i "s/flutter_bootstrap\.js/flutter_bootstrap.js?v=$STAMP/g" build/web/index.html

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
