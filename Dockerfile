# ── Erlbrew POS Frontend Dockerfile ──────────────────────────────────────────
# Multi-stage: build → serve with nginx

# Stage 1: Build the React app
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Pass API URL at build time — leave empty so nginx proxies /api to backend
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2: Serve with nginx + proxy /api to backend
FROM nginx:alpine
# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf
# Install curl for health checks
RUN apk add --no-cache curl

# Copy custom nginx config (proxies /api → erlbw-api:3001)
COPY nginx.conf /etc/nginx/conf.d/erlbrew.conf

# Copy built frontend assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]