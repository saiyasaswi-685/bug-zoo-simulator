import { generateEvent } from './generator';
import { insertEvent } from '../../store/database';
import { logger } from '../../observability/logger';
import { eventsGeneratedTotal } from '../../observability/metrics';

let isRunning = false;
let timeoutId: NodeJS.Timeout | null = null;

/**
 * Base tick interval, sourced from SIMULATION_INTERVAL_MS (milliseconds).
 * Falls back to 2000ms if unset or invalid, matching .env.example / Docker defaults.
 */
export function getConfiguredIntervalMs(): number {
  const raw = process.env.SIMULATION_INTERVAL_MS;
  const parsed = raw !== undefined ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed >= 100) {
    return parsed;
  }
  if (raw !== undefined) {
    logger.warn(
      { SIMULATION_INTERVAL_MS: raw },
      'Invalid SIMULATION_INTERVAL_MS, falling back to default of 2000ms'
    );
  }
  return 2000;
}

export function startEngine(): void {
  if (isRunning) return;
  isRunning = true;
  const baseInterval = getConfiguredIntervalMs();
  logger.info(
    { simulation_interval_ms: baseInterval },
    'Starting event simulation engine background loop'
  );
  
  function tick() {
    if (!isRunning) return;
    
    try {
      const event = generateEvent();
      insertEvent(event);
      
      // Increment Prometheus Metric
      eventsGeneratedTotal.labels(event.animal, event.severity).inc();
      
      // Log the event with structured attributes matching logger requirements
      logger.info(
        {
          event_id: event.id,
          animal: event.animal,
          severity: event.severity,
          event_timestamp: event.timestamp,
        },
        `Simulated event: ${event.animal} - ${event.message}`
      );
    } catch (error) {
      logger.error({ error }, 'Failed to simulate event in engine tick');
    }
    
    // Tick interval is driven by SIMULATION_INTERVAL_MS (base), with a small
    // +/-20% jitter so events don't fire at perfectly robotic intervals.
    const jitter = Math.floor(baseInterval * 0.2 * (Math.random() * 2 - 1));
    const interval = Math.max(100, baseInterval + jitter);
    timeoutId = setTimeout(tick, interval);
  }
  
  tick();
}

export function stopEngine(): void {
  isRunning = false;
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  logger.info('Stopped event simulation engine background loop');
}
