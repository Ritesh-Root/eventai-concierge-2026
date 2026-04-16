# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────
# EventAI Concierge — production container for Google Cloud Run
#
# Multi-stage build keeps the final image small and free of dev deps.
# Optimised for Cloud Run cold-start latency and Cloud Build pipelines.
#
# Build:  gcloud builds submit --tag gcr.io/PROJECT_ID/event-ai-concierge
# Run:    docker run -p 8080:8080 -e GEMINI_API_KEY=... event-ai-concierge
# ─────────────────────────────────────────────────────────────────────

# ── Stage 1: install production dependencies ────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ── Stage 2: runtime image ──────────────────────────────────────────
FROM node:20-alpine AS runtime

# OCI metadata labels (optional, improves registry UI)
LABEL org.opencontainers.image.title="EventAI Concierge" \
      org.opencontainers.image.description="AI-powered event assistant powered by Gemini 2.5 Flash" \
      org.opencontainers.image.source="https://github.com/Ritesh-Root/eventai-concierge-2026" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    NPM_CONFIG_LOGLEVEL=warn \
    # Optimise V8 for Cloud Run cold-start latency
    NODE_OPTIONS="--max-old-space-size=256"

# Run as non-root for defense-in-depth
RUN addgroup -S app && adduser -S app -G app

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=app:app package.json ./
COPY --chown=app:app server.js ./
COPY --chown=app:app src ./src
COPY --chown=app:app public ./public

USER app

EXPOSE 8080

# Healthcheck hits the lightweight /api/health endpoint
# Cloud Run uses this for liveness probes.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health || exit 1

CMD ["node", "server.js"]
