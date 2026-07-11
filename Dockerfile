# Stage 1: Build TypeScript output + compile native deps once
FROM node:20-slim AS builder

WORKDIR /app

# Build tools needed to compile better-sqlite3's native addon
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json tsconfig.json ./
# npm ci requires a committed package-lock.json (see README "Reproducible
# installs" section). npm install works with or without one, generating a
# lockfile automatically if absent, so the build never breaks on a missing
# lockfile. If package-lock.json IS present and in sync, this is equivalent
# in effect to npm ci.
RUN npm install

COPY src ./src
RUN npm run build

# Drop devDependencies now that TypeScript has been compiled to dist/, so
# only the production node_modules gets copied into the runtime stage below.
RUN npm prune --omit=dev

# Stage 2: Production runtime (no compilers, no dev deps, non-root user)
FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV LOG_LEVEL=info
ENV SIMULATION_INTERVAL_MS=2000
ENV DATABASE_PATH=/app/data/bug_zoo.db

COPY package*.json ./
# Compiled artifacts and the already-built native addon are copied straight
# from the builder stage - no second compile, no compiler toolchain needed
# in the final image (smaller image, smaller attack surface).
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Writable directory for the SQLite database file (mounted as a volume via
# docker-compose so data survives container recreation), owned by the
# unprivileged 'node' user the process runs as.
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/stats',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main/index.js"]
