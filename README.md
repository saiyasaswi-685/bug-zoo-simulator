# Bug Zoo Simulator API

A high-performance Bug Zoo Simulation Engine and REST API designed with a strong focus on modern production observability pillars: structured JSON logging, request tracing, and Prometheus metrics. Built using **Node.js**, **TypeScript**, **Express**, and **SQLite**.

---

## Observability Pillars

### 1. Structured JSON Logging
Every log line printed by the application (including startup sequences, simulator ticks, HTTP access logs, and system exceptions) is written strictly to stdout or stderr as a single line of valid, parsable JSON. No plain text output exists. 

Logs follow this baseline structure:
```json
{
  "timestamp": "2026-07-10T20:55:01.498Z",
  "level": "info",
  "message": "Simulated event: Lion - taking a nap in the shade",
  "service": "bug-zoo-simulator",
  "event_id": "8a96d11f-c0c5-419b-a010-85f09623be87",
  "animal": "Lion",
  "severity": "INFO"
}
```

### 2. Request Tracing
Each incoming HTTP request intercepts a newly generated UUID v4 assigned as `trace_id`. The tracing middleware is registered **first**, ahead of the JSON body parser and every other middleware, so this holds even for requests that fail body parsing (e.g. malformed JSON) - those still get a trace ID and an `X-Trace-Id` header on their error response.
* **Header Propagation**: The API returns the trace ID in the `X-Trace-Id` HTTP response header.
* **Context Preservation**: Using Node.js's native `AsyncLocalStorage` API, the trace ID is transparently stored in the execution thread-context. Downstream database layers, handlers, and formatters automatically retrieve and print the request's `trace_id` without manual parameter drilling:
```json
{
  "timestamp": "2026-07-10T20:55:07.500Z",
  "level": "info",
  "message": "HTTP request processed: GET /events -> 200",
  "service": "bug-zoo-simulator",
  "trace_id": "e998a44b-4f91-4cf1-83d8-e3cf14a1a09d",
  "method": "GET",
  "path": "/events",
  "status": 200,
  "duration_ms": 12
}
```

### 3. Prometheus Metrics
The application exposes the standard `/metrics` endpoint with data formatted in the Prometheus plain-text exposition format:
* `http_requests_total` (Counter): Track requests with labels: `method`, `status_code`.
* `events_generated_total` (Counter): Track mock events with labels: `animal`, `severity`.
* `active_animals_gauge` (Gauge): Tracks active number of distinct animals in the database.

---

## Getting Started

### Local Setup
Ensure you have Node.js (v20+ recommended, matching the Docker base image; v18+ also works) and npm installed.

1. **Install Dependencies**:
   ```bash
   npm install
   ```
   This also generates `package-lock.json` if one isn't already present. Commit that
   file so installs are reproducible across machines and CI.

   > **Reproducible installs / `npm ci`:** the Dockerfile intentionally uses
   > `npm install` rather than `npm ci`. `npm ci` *requires* a pre-committed,
   > in-sync `package-lock.json` and hard-fails the build if one is missing —
   > which is exactly what broke the Docker build in the previous review pass.
   > `npm install` works whether or not a lockfile is present (generating one
   > if needed), so the build can never fail for that reason. Once you've run
   > `npm install` locally and committed the resulting `package-lock.json`,
   > you can switch the Dockerfile back to `npm ci` for byte-for-byte
   > reproducible installs if you prefer that guarantee — both are correct,
   > this project just no longer *requires* it to build.

2. **Configure Environment Variables**:
   Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. **Run in Development Mode**:
   ```bash
   npm run dev
   ```

4. **Build and Run in Production Mode**:
   ```bash
   npm run build
   npm start
   ```

5. **Run the Test Suite**:
   ```bash
   npm test
   ```

---

## Docker & Compose Setup
The project comes packaged with a multi-stage Docker build and a Docker Compose file that spins up both the **API application** and a **Prometheus instance** mapped to scrape the app metrics automatically.

1. **Start Services**:
   ```bash
   docker-compose up --build
   ```

2. **Endpoints Exposed**:
   - **API Server**: [http://localhost:3000](http://localhost:3000)
   - **Prometheus Dashboard**: [http://localhost:9090](http://localhost:9090)

3. **Production-hardening in the image**:
   - Multi-stage build: native dependencies (`better-sqlite3`) are compiled once in the builder stage; the runtime stage copies the built `dist/` and `node_modules` straight over, so **no C/C++ compiler toolchain ships in the final image**.
   - Runs as the unprivileged `node` user, not root.
   - `SQLite` data is written to `/app/data/bug_zoo.db`, which is backed by the named `zoo-data` volume in `docker-compose.yml`, so events **survive container restarts/recreation**.
   - A `HEALTHCHECK` (Docker) / `healthcheck:` (Compose) hits `GET /stats` to verify the app is actually serving traffic, not just that the process is alive.

---

## API Documentation

### 1. Retrieve Historical Events
* **Endpoint**: `GET /events`
* **Query Parameters (Optional)**:
  - `animal`: Filters by animal (e.g. `Lion`).
  - `severity`: Filters strictly by severity (`INFO`, `WARN`, `ERROR`).
* **Response (HTTP 200 OK)**:
  ```json
  [
    {
      "id": "c6f3d99c-e72e-4b20-abf2-736b412bc4f9",
      "timestamp": "2026-07-10T20:55:05.097Z",
      "animal": "Tarantula",
      "message": "glass enclosure panel cracked!",
      "severity": "ERROR"
    }
  ]
  ```
* **Validation (HTTP 400 Bad Request)**:
  If an invalid severity parameter is provided (e.g., `?severity=FATAL`):
  ```json
  {
    "error": "Invalid severity value: 'FATAL'. Must be one of: INFO, WARN, ERROR."
  }
  ```

### 2. Retrieve Aggregated Statistics
* **Endpoint**: `GET /stats`
* **Response (HTTP 200 OK)**:
  ```json
  {
    "animal_counts": {
      "Lion": 15,
      "Zebra": 8
    },
    "severity_counts": {
      "INFO": 19,
      "WARN": 2,
      "ERROR": 2
    }
  }
  ```

### Simulation Engine Configuration
The background engine ticks on an interval controlled by the `SIMULATION_INTERVAL_MS`
environment variable (see `.env.example`). Each tick generates one event, applies
a small ±20% jitter around the configured base interval (so ticks aren't
perfectly robotic), inserts it into SQLite, increments `events_generated_total`,
and logs it. If the variable is unset or invalid (non-numeric or below a 100ms
safety floor), it falls back to 2000ms and logs a warning explaining why.

### 3. Expose Metrics
* **Endpoint**: `GET /metrics`
* **Content-Type**: `text/plain`
* **Response**:
  ```text
  # HELP http_requests_total Total number of HTTP requests processed
  # TYPE http_requests_total counter
  http_requests_total{method="GET",status_code="200"} 42
  ...
  ```

---

## Verification Evidence
The `evidence/` directory holds real captured output from actually running the
app — not hand-written samples. Generate it yourself with:
```bash
npm install
npm run build
npm run capture-evidence
```
See [`evidence/README.md`](./evidence/README.md) for exactly what this
captures (real JSON logs, real `/metrics` output, real response headers
including `X-Trace-Id`, and real 400/404 responses) and why the previous
version of this section — which linked to local, machine-specific,
hand-authored files — was removed.

---

## Known Limitations of This Fix Pass
This round of fixes was produced in a sandboxed environment with **no network
access** (npm registry unreachable) and **no Docker binary available**. As a
result, the following could not be executed directly and should be run once
in a normal environment before treating this as fully verified:

| Step | Status | Command to run yourself |
|---|---|---|
| Generate real `package-lock.json` | Not generated (no registry access) | `npm install` (then commit the generated file) |
| `npm test` | Not run (deps not installed) | `npm install && npm test` |
| `docker-compose up --build` | Not run (no Docker in sandbox) | `docker-compose up --build` |
| Real `evidence/` capture | Not run (app can't start without deps) | `npm run capture-evidence` (after install + build) |

All source-level fixes (middleware ordering, `SIMULATION_INTERVAL_MS` wiring,
Dockerfile/compose changes, new tests, error-handling changes) are complete
and self-contained; they just haven't been exercised against a live install
in this environment. Nothing was fabricated to appear otherwise.
