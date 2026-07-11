import { AsyncLocalStorage } from 'async_hooks';

export interface TraceContext {
  traceId: string;
}

export const traceLocalStorage = new AsyncLocalStorage<TraceContext>();

export function getTraceId(): string | undefined {
  return traceLocalStorage.getStore()?.traceId;
}
