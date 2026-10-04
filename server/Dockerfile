# ── Erlbrew POS Backend Dockerfile ──────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security (before installing deps so we can chown)
RUN addgroup -g 1001 -S nodejs && adduser -S nodeapp -u 1001

# Copy package files first for layer caching
COPY package*.json ./

# Install production dependencies deterministically and ensure nodeapp owns them
RUN npm ci --omit=dev && npm cache clean --force && chown -R nodeapp:nodejs /app/node_modules

# Copy application code
COPY . .

USER nodeapp

EXPOSE 3001

# Use dumb-init as PID 1 to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
