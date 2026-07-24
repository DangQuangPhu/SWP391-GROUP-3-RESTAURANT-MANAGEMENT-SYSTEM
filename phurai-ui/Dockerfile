# =============================================================================
# Stage 1: Build Frontend (Vite/React)
#
# KEY: --platform=$BUILDPLATFORM forces this stage to run on the NATIVE
# architecture of the CI runner (x86_64), regardless of the target platform.
# This avoids QEMU emulation for the heavy npm ci + Vite build steps,
# preventing the "Illegal instruction" crash seen with arm64 cross-compilation.
# The compiled JS/CSS output is architecture-independent, so it's safe to
# build on x86 and copy the result into an arm64 runner image.
# =============================================================================
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (layer caching - only re-install if deps change)
COPY package*.json ./

# Install ALL dependencies (devDeps needed for Vite build)
RUN npm ci --frozen-lockfile

# Copy source code
COPY . .

# ---
# Build-time variables for Vite (baked into the JS bundle at build time).
# These are the VITE_* vars — they are embedded into the static assets,
# NOT available at runtime via process.env.
# Pass them via: docker build --build-arg VITE_API_BASE_URL=/api ...
# Or define them in docker-compose.yml under build.args.
# ---
ARG VITE_API_BASE_URL=/api
ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=""
ARG VITE_GOOGLE_CLIENT_ID=909445481908-0773rhu0gq39sbhf5mkriin0di4h9pnp.apps.googleusercontent.com

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# Build frontend → outputs to /app/dist
RUN npm run build

# =============================================================================
# Stage 2: Production Runner (Express serves API + static frontend)
#
# This stage uses the TARGET platform (arm64 / amd64) — no QEMU needed here
# because npm ci only installs production deps (small, fast) and Node.js
# runtime operations do not trigger the V8/QEMU illegal instruction bug.
# =============================================================================
FROM node:20-alpine AS runner

# Add non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Set production mode
ENV NODE_ENV=production

# Copy package files and install ONLY production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --frozen-lockfile

# Copy backend source code
COPY backend/ ./backend/

# Copy built frontend assets from builder stage (immutable static files)
COPY --from=builder /app/dist ./dist

# Create uploads folder and set ownership to non-root user
RUN mkdir -p /app/backend/src/uploads/dishes /app/backend/src/uploads/reservations && \
    chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose the Express server port
EXPOSE 5001

# Health check — verifies the container is alive
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5001/health || exit 1

# Start the Express server.
# Runtime env vars (DB_SERVER, JWT_SECRET, etc.) are injected by
# docker-compose via env_file or -e flags — they are NOT baked into the image.
CMD ["node", "backend/src/index.js"]
