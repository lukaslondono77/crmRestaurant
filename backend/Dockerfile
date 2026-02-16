# Build from repo root: docker compose build (or docker build -f backend/Dockerfile .)
FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache sqlite bash gzip

# Copy package files from backend
COPY backend/package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy backend code
COPY backend/ .

# Copy frontend (fila) — server uses path.join(__dirname, '../../fila') = /fila
COPY fila /fila

# Create necessary directories
RUN mkdir -p \
    uploads/invoices \
    uploads/pos \
    uploads/waste \
    database/backups \
    logs

# Set permissions
RUN chmod +x scripts/*.sh || true

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app && \
    chown -R nodejs:nodejs /fila

USER nodejs

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/api/healthz', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "src/server.js"]
