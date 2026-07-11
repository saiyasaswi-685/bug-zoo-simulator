import request from 'supertest';
import app from '../../src/api/app';
import { initDatabase, insertEvent, closeDatabase } from '../../src/store/database';

describe('Bug Zoo API Integration Tests', () => {
  beforeAll(() => {
    // Initialize in-memory database for testing
    initDatabase(':memory:');

    // Pre-populate with test events
    insertEvent({
      id: 'test-uuid-1',
      timestamp: '2026-07-10T12:00:00.000Z',
      animal: 'Lion',
      message: 'took a nap',
      severity: 'INFO',
    });

    insertEvent({
      id: 'test-uuid-2',
      timestamp: '2026-07-10T12:01:00.000Z',
      animal: 'Lion',
      message: 'growled at patrol',
      severity: 'WARN',
    });

    insertEvent({
      id: 'test-uuid-3',
      timestamp: '2026-07-10T12:02:00.000Z',
      animal: 'Zebra',
      message: 'containment breach!',
      severity: 'ERROR',
    });
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('GET /events', () => {
    it('should return a list of latest events in descending order', async () => {
      const res = await request(app)
        .get('/events')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(3);
      // Descending order assertion based on pre-populated timestamp order
      expect(res.body[0].id).toBe('test-uuid-3'); // Latest
      expect(res.body[1].id).toBe('test-uuid-2');
      expect(res.body[2].id).toBe('test-uuid-1');
      expect(res.headers['x-trace-id']).toBeDefined();
    });

    it('should filter by animal', async () => {
      const res = await request(app)
        .get('/events?animal=Lion')
        .expect(200);

      expect(res.body.length).toBe(2);
      expect(res.body.every((e: any) => e.animal === 'Lion')).toBe(true);
    });

    it('should filter by severity', async () => {
      const res = await request(app)
        .get('/events?severity=ERROR')
        .expect(200);

      expect(res.body.length).toBe(1);
      expect(res.body[0].severity).toBe('ERROR');
    });

    it('should filter by both animal and severity', async () => {
      const res = await request(app)
        .get('/events?animal=Lion&severity=WARN')
        .expect(200);

      expect(res.body.length).toBe(1);
      expect(res.body[0].animal).toBe('Lion');
      expect(res.body[0].severity).toBe('WARN');
    });

    it('should return 400 Bad Request for invalid severity parameter', async () => {
      const res = await request(app)
        .get('/events?severity=FATAL')
        .expect(400);

      expect(res.body.error).toBeDefined();
      expect(res.body.error).toContain('Invalid severity value');
    });
  });

  describe('GET /stats', () => {
    it('should return correct aggregations for animals and severity', async () => {
      const res = await request(app)
        .get('/stats')
        .expect(200);

      expect(res.body.animal_counts).toEqual({
        Lion: 2,
        Zebra: 1,
      });

      expect(res.body.severity_counts).toEqual({
        INFO: 1,
        WARN: 1,
        ERROR: 1,
      });
    });
  });

  describe('GET /metrics', () => {
    it('should return Prometheus metrics containing required keys', async () => {
      const res = await request(app)
        .get('/metrics')
        .expect('Content-Type', /text\/plain/)
        .expect(200);

      // Verify that http_requests_total, events_generated_total, and active_animals_gauge exist
      expect(res.text).toContain('http_requests_total');
      expect(res.text).toContain('events_generated_total');
      expect(res.text).toContain('active_animals_gauge');
    });
  });

  describe('Error Handling and Headers', () => {
    it('should return standard JSON error response for page not found (404)', async () => {
      const res = await request(app)
        .get('/invalid-route-name')
        .expect(404);

      expect(res.body).toEqual({
        error: 'Route not found: GET /invalid-route-name',
      });
      expect(res.headers['x-trace-id']).toBeDefined();
    });
  });
});
