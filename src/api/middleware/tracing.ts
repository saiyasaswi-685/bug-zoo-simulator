import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { traceLocalStorage } from '../../observability/tracing/context';

export function tracingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Generate trace ID
  const traceId = uuidv4();
  
  // Expose it to the client via response header
  res.setHeader('X-Trace-Id', traceId);
  
  // Wrap downstream execution inside AsyncLocalStorage context
  traceLocalStorage.run({ traceId }, () => {
    next();
  });
}
