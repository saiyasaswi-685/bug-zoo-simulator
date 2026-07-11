import request from 'supertest';
import app from '../../src/api/app';
import * as db from '../../src/store/database';

describe('Error Handling - genuine unexpected 500 (regression test)', () => {
  beforeAll(() => {
    db.initDatabase(':memory:');
  });

  afterAll(() => {
    db.closeDatabase();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a structured 500 JSON error when a route handler throws unexpectedly', async () => {
    jest.spyOn(db, 'getStats').mockImplementation(() => {
      throw new Error('Simulated database failure');
    });

    const res = await request(app)
      .get('/stats')
      .expect('Content-Type', /json/)
      .expect(500);

    expect(res.body).toEqual({ error: 'Simulated database failure' });
    expect(res.headers['x-trace-id']).toBeDefined();
  });

  it('does not leak a stack trace or internal error fields in the response body', async () => {
    jest.spyOn(db, 'getLatestEvents').mockImplementation(() => {
      throw new Error('boom');
    });

    const res = await request(app).get('/events').expect(500);

    expect(Object.keys(res.body)).toEqual(['error']);
  });
});
