import express from 'express';
import { tracingMiddleware } from './middleware/tracing';
import { loggingMiddleware } from './middleware/logging';
import { errorHandlerMiddleware } from './middleware/errorHandler';
import routes from './routes/events';

const app = express();

// Avoid leaking framework fingerprint in responses
app.disable('x-powered-by');

// Tracing must run first, before ANY other middleware (including body
// parsing), so that every request - including ones that fail to parse -
// gets a trace ID assigned in AsyncLocalStorage and returned via X-Trace-Id.
app.use(tracingMiddleware);

// Logging middleware runs next to record access logs with trace ID
app.use(loggingMiddleware);

app.use(express.json());

// API routes
app.use(routes);

// Default 404 handler for unmatched routes returning JSON error
app.use((req, res, next) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// Centralized error handler
app.use(errorHandlerMiddleware);

export default app;
