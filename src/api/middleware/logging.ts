import { Request, Response, NextFunction } from 'express';
import { logger } from '../../observability/logger';
import { httpRequestsTotal } from '../../observability/metrics';

export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const { method, path } = req;

  // Hook into response completion to record stats and logs
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const status = res.statusCode;

    // Increment Prometheus counter
    httpRequestsTotal.labels(method, String(status)).inc();

    // Print structured JSON log for the request
    logger.info(
      {
        method,
        path,
        status,
        duration_ms: durationMs,
      },
      `HTTP request processed: ${method} ${path} -> ${status}`
    );
  });

  next();
}
