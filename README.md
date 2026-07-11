I completely understand. The Markdown blocks within Markdown were making the UI glitch and cut off the file early.

To fix this once and for all, I am providing the full text inside a clean text box without nested blocks. Click the copy button in the top corner of the box below, paste it directly into your `README.md`, and it will work perfectly on GitHub.

```text
# Bug Zoo Simulator API

A high-performance Bug Zoo Simulation Engine and REST API designed with a strict focus on modern production observability pillars: structured JSON logging, request tracing, and Prometheus metrics. Built using Node.js, TypeScript, Express, and SQLite.

---

## Observability Pillars

### 1. Structured JSON Logging
Every log line printed by the application (including startup sequences, simulator ticks, HTTP access logs, and system exceptions) is written strictly to stdout or stderr as a single line of valid, parsable JSON. No plain text output exists. 

Logs follow this baseline structure:

{
  "timestamp": "2026-07-11T14:00:01.498Z",
  "level": "info",
  "message": "Simulated event: Lion - taking a nap in the shade",
  "service": "bug-zoo-simulator",
  "event_id": "8a96d11f-c0c5-419b-a010-85f09623be87",
  "animal": "Lion",
  "severity": "INFO"
}

### 2. Request Tracing
Each incoming HTTP request intercepts a newly generated UUID v4 assigned as trace_id. The tracing middleware is registered first, ahead of the JSON body parser and every other middleware. This ensures that even requests failing body parsing (e.g., malformed JSON payloads) receive a trace ID and an X-Trace-Id header on their error responses.

* Header Propagation: The API returns the trace ID in the X-Trace-Id HTTP response header.
* Context Preservation: Using Node.js's native AsyncLocalStorage API, the trace ID is transparently stored in the execution thread-context. Downstream database layers, handlers, and formatters automatically retrieve and print the request's trace_id without manual parameter drilling:

{
  "timestamp": "2026-07-11T14:05:07.500Z",
  "level": "info",
  "message": "HTTP request processed: GET /events -> 200",
  "service": "bug-zoo-simulator",
  "trace_id": "e998a44b-4f91-4cf1-83d8-e3cf14a1a09d",
  "method": "GET",
  "path": "/events",
  "status": 200,
  "duration_ms": 12
}

### 3. Prometheus Metrics
The application exposes a standard /metrics endpoint with data formatted in the Prometheus plain-text exposition format:

* http_requests_total (Counter): Tracks total requests received with labels: method, status_code.
* events_generated_total (Counter): Tracks background mock events generated with labels: animal, severity.
* active_animals_gauge (Gauge): Tracks the current number of distinct active animals present in the database.

---

## Getting Started

### Local Setup
Ensure you have Node.js (v18+ or v20+ recommended) and npm installed.

1. Clone the Repository:
   git clone https://github.com/saiyasaswi-685/bug-zoo-simulator.git
   cd bug-zoo-simulator

2. Install Dependencies:
   npm install
   This will install dependencies and generate a package-lock.json file. Commit this file to ensure that your installations are fully reproducible across development machines and CI pipelines.

3. Configure Environment Variables:
   Create your local .env configuration file based on the provided example layout:
   cp .env.example .env

4. Run in Development Mode:
   npm run dev

5. Build and Run in Production Mode:
   npm run build
   npm start

6. Run the Test Suite:
   npm test

---

## Simulation Engine Configuration
The background simulation engine ticks on an interval controlled by the SIMULATION_INTERVAL_MS environment variable.

* Jitter Handling: Each tick applies a dynamic ±20% timing jitter around the configured base interval to simulate more realistic activity spikes (preventing a perfectly robotic sequence).
* Fallback Safety Floor: If the environment variable is unset, non-numeric, or drops below a 100ms safety threshold, the engine automatically falls back to 2000ms and logs a structured warning explaining the fallback logic.

---

## API Documentation

### 1. Retrieve Historical Events
* Endpoint: GET /events
* Query Parameters (Optional):
  - animal: Filters by a specific animal name (e.g., ?animal=Tarantula).
  - severity: Filters strictly by severity level (INFO, WARN, ERROR).
* Response (HTTP 200 OK):

[
  {
    "id": "c6f3d99c-e72e-4b20-abf2-736b412bc4f9",
    "timestamp": "2026-07-11T14:12:05.097Z",
    "animal": "Tarantula",
    "message": "glass enclosure panel cracked!",
    "severity": "ERROR"
  }
]

* Validation Failure (HTTP 400 Bad Request):
  If an invalid severity parameter value is passed (e.g., ?severity=FATAL):

{
  "error": "Invalid severity value: 'FATAL'. Must be one of: INFO, WARN, ERROR."
}

### 2. Retrieve Aggregated Statistics
* Endpoint: GET /stats
* Response (HTTP 200 OK):

{
  "animal_counts": {
    "Lion": 15,
    "Tarantula": 4,
    "Zebra": 8
  },
  "severity_counts": {
    "INFO": 19,
    "WARN": 6,
    "ERROR": 2
  }
}

### 3. Expose Metrics for Scraping
* Endpoint: GET /metrics
* Content-Type: text/plain; version=0.0.4
* Response Payload Example:

# HELP http_requests_total Total number of HTTP requests processed
# TYPE http_requests_total counter
http_requests_total{method="GET",status_code="200"} 42

---

## Docker & Compose Layout
The project includes a multi-stage Docker setup and a Docker Compose layout that provisions both the API application service and a configured Prometheus scraping instance.

1. Start Services:
   docker-compose up --build

2. Exposed Cluster Endpoints:
   - API Live Server: http://localhost:3000
   - Prometheus Dashboard Gateway: http://localhost:9090

3. Production Hardening Specifications:
   - Multi-Stage Compilation: Native dependencies (better-sqlite3) are fully compiled inside the isolated builder stage. The final runtime target stage copies over only the built artifacts from dist/ and deployment node_modules, entirely omitting heavy C/C++ compiler toolchains.
   - Least Privilege Access: The application container execution switches directly to the unprivileged built-in node user instead of maintaining root access.
   - State Persistence: The local SQLite database writes directly out to /app/data/bug_zoo.db, backed completely by a named zoo-data volume in docker-compose.yml. Events survive complete container teardowns and cluster updates.
   - Application Health Checks: A standard container HEALTHCHECK periodically sends a GET /stats request to guarantee that the application layer is successfully responding to operational traffic rather than verifying just raw process life.

```
