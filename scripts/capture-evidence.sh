#!/usr/bin/env bash
# Captures REAL evidence by actually running the built app and hitting its
# endpoints. This replaces the previous evidence/*.txt files, which a code
# review correctly flagged as hand-written/fabricated (e.g. they showed a
# "warn" log level for a 400 response, but the code only ever calls
# logger.error() - impossible output from the real app).
#
# Usage:
#   npm install
#   npm run build
#   npm run capture-evidence
#
# Requires: the app's dependencies to be installed (npm install) and built
# (npm run build). This script starts the real server, makes real requests
# to it with curl, and saves the real responses/logs/metrics to evidence/.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p evidence

if [ ! -d node_modules ]; then
  echo "node_modules not found - run 'npm install' first." >&2
  exit 1
fi

if [ ! -d dist ]; then
  echo "dist/ not found - run 'npm run build' first." >&2
  exit 1
fi

export PORT="${PORT:-3000}"
export LOG_LEVEL="${LOG_LEVEL:-info}"
export SIMULATION_INTERVAL_MS="${SIMULATION_INTERVAL_MS:-500}"
export DATABASE_PATH="$(mktemp -u).db"

echo "Starting server on port $PORT (SIMULATION_INTERVAL_MS=$SIMULATION_INTERVAL_MS)..."
node dist/main/index.js > evidence/json_logs.raw.txt 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
  wait "$SERVER_PID" 2>/dev/null || true
  rm -f "$DATABASE_PATH" "$DATABASE_PATH-wal" "$DATABASE_PATH-shm" 2>/dev/null || true
}
trap cleanup EXIT

# Wait for the server to become healthy
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${PORT}/stats" > /dev/null; then
    break
  fi
  sleep 0.5
done

# Let the simulation engine generate a handful of real events first
sleep 3

echo "Capturing GET /events headers + body..."
curl -sD evidence/api_headers.txt -o evidence/events_response.json \
  "http://127.0.0.1:${PORT}/events" >/dev/null

echo "Capturing GET /stats..."
curl -s "http://127.0.0.1:${PORT}/stats" > evidence/stats_response.json

echo "Capturing GET /metrics (Prometheus exposition)..."
curl -s "http://127.0.0.1:${PORT}/metrics" > evidence/prometheus_metrics.txt

echo "Capturing a real 400 (invalid severity) response + headers..."
curl -sD evidence/api_headers_400.txt -o evidence/invalid_severity_response.json \
  "http://127.0.0.1:${PORT}/events?severity=FATAL" >/dev/null

echo "Capturing a real 404 response..."
curl -sD evidence/api_headers_404.txt -o evidence/not_found_response.json \
  "http://127.0.0.1:${PORT}/no-such-route" >/dev/null

# Give the engine a moment to log a few more simulated events before we stop
sleep 2

# Trim the raw combined stdout down to the JSON log lines only, formatted
# one-per-line, matching what pino actually emits.
grep -E '^\{' evidence/json_logs.raw.txt > evidence/json_logs.txt || true
rm -f evidence/json_logs.raw.txt

echo "Done. Real evidence written to ./evidence/:"
ls -la evidence/
