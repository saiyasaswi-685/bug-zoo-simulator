import { Request, Response, NextFunction } from 'express';
import { logger } from '../../observability/logger';

export function errorHandlerMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Client errors (4xx) are expected/routine (bad input, unknown route) and
  // are logged at 'warn' so error-level alerting stays reserved for genuine
  // server-side failures (5xx). Enumerable properties are spread first so
  // they can never silently clobber the canonical message/stack fields.
  const logPayload = {
    err: {
      ...err,
      message: err.message,
      stack: err.stack,
    },
    path: req.path,
    method: req.method,
    status,
  };
  const logMessage = `Unhandled error occurred during request: ${message}`;

  if (status >= 500) {
    logger.error(logPayload, logMessage);
  } else {
    logger.warn(logPayload, logMessage);
  }

  res.status(status).json({
    error: message,
  });
}
