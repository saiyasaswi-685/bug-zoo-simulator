import pino from 'pino';
import { getTraceId } from '../tracing/context';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  messageKey: 'message',
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  base: {
    service: 'bug-zoo-simulator',
  },
  mixin() {
    const traceId = getTraceId();
    return traceId ? { trace_id: traceId } : {};
  },
});
