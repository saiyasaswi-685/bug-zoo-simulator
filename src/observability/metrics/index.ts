import client from 'prom-client';

// Create a custom registry
export const register = new client.Registry();

// Standard default system metrics
client.collectDefaultMetrics({ register });

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'status_code'],
  registers: [register],
});

export const eventsGeneratedTotal = new client.Counter({
  name: 'events_generated_total',
  help: 'Total events simulated by the engine',
  labelNames: ['animal', 'severity'],
  registers: [register],
});

export const activeAnimalsGauge = new client.Gauge({
  name: 'active_animals_gauge',
  help: 'Current number of unique animals',
  registers: [register],
});
