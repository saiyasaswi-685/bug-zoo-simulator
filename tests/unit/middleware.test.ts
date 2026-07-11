import express from 'express';
import request from 'supertest';
import { tracingMiddleware } from '../../src/api/middleware/tracing';
import { loggingMiddleware } from '../../src/api/middleware/logging';
import { getTraceId } from '../../src/observability/tracing/context';
import { register, httpRequestsTotal } from '../../src/observability/metrics';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('tracingMiddleware', () => {
  it('assigns a UUID v4 trace ID and exposes it via X-Trace-Id header', async () => {
    const app = express();
    app.use(tracingMiddleware);
    app.get('/probe', (req, res) => res.status(200).json({ ok: true }));

    const res = await request(app).get('/probe').expect(200);
    expect(res.headers['x-trace-id']).toMatch(UUID_V4_REGEX);
  });

  it('makes the trace ID available downstream via AsyncLocalStorage (getTraceId)', async () => {
    let capturedFromContext: string | undefined;
    let capturedFromHeader: string | undefined;

    const app = express();
    app.use(tracingMiddleware);
    app.get('/probe', (req, res) => {
      capturedFromContext = getTraceId();
      capturedFromHeader = res.getHeader('X-Trace-Id') as string;
      res.status(200).json({ ok: true });
    });

    await request(app).get('/probe').expect(200);
    expect(capturedFromContext).toBeDefined();
    expect(capturedFromContext).toBe(capturedFromHeader);
  });

  it('assigns a different trace ID per request', async () => {
    const app = express();
    app.use(tracingMiddleware);
    app.get('/probe', (req, res) => res.status(200).json({ ok: true }));

    const res1 = await request(app).get('/probe').expect(200);
    const res2 = await request(app).get('/probe').expect(200);
    expect(res1.headers['x-trace-id']).not.toBe(res2.headers['x-trace-id']);
  });
});

describe('loggingMiddleware', () => {
  it('increments http_requests_total with method and status labels', async () => {
    const app = express();
    app.use(loggingMiddleware);
    app.get('/probe', (req, res) => res.status(200).json({ ok: true }));

    const before = (await register.getSingleMetricAsString('http_requests_total')) || '';
    await request(app).get('/probe').expect(200);
    const after = await register.getSingleMetricAsString('http_requests_total');

    expect(after).toContain('method="GET"');
    expect(after).toContain('status_code="200"');
    expect(after).not.toEqual(before);
  });

  it('still records metrics/logs for non-2xx responses', async () => {
    const app = express();
    app.use(loggingMiddleware);
    app.get('/probe', (req, res) => res.status(404).json({ error: 'not found' }));

    await request(app).get('/probe').expect(404);
    const metrics = await register.getSingleMetricAsString('http_requests_total');
    expect(metrics).toContain('status_code="404"');
  });
});

describe('Middleware ordering (regression test for C3)', () => {
  it('assigns a trace ID even when the JSON body parser throws (malformed body)', async () => {
    // Mirrors the real app's middleware order: tracing must run before
    // express.json() so malformed-body requests still get a trace ID and
    // X-Trace-Id header on their (error) response.
    const app = express();
    app.use(tracingMiddleware);
    app.use(loggingMiddleware);
    app.use(express.json());
    app.post('/probe', (req, res) => res.status(200).json({ ok: true }));
    // Minimal error handler, mirroring errorHandlerMiddleware's contract
    app.use((err: any, req: any, res: any, next: any) => {
      res.status(err.status || 500).json({ error: err.message });
    });

    const res = await request(app)
      .post('/probe')
      .set('Content-Type', 'application/json')
      .send('{invalid-json')
      .expect(400);

    expect(res.headers['x-trace-id']).toMatch(UUID_V4_REGEX);
  });
});
