import { initDatabase, closeDatabase, getLatestEvents } from '../../src/store/database';

describe('Simulation Engine (src/engine/simulator/index.ts)', () => {
  const ORIGINAL_ENV = process.env.SIMULATION_INTERVAL_MS;

  beforeAll(() => {
    initDatabase(':memory:');
  });

  afterAll(() => {
    closeDatabase();
    if (ORIGINAL_ENV === undefined) {
      delete process.env.SIMULATION_INTERVAL_MS;
    } else {
      process.env.SIMULATION_INTERVAL_MS = ORIGINAL_ENV;
    }
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
  });

  describe('getConfiguredIntervalMs', () => {
    it('honors a valid SIMULATION_INTERVAL_MS value', () => {
      process.env.SIMULATION_INTERVAL_MS = '5000';
      const { getConfiguredIntervalMs } = require('../../src/engine/simulator');
      expect(getConfiguredIntervalMs()).toBe(5000);
    });

    it('falls back to 2000ms when SIMULATION_INTERVAL_MS is unset', () => {
      delete process.env.SIMULATION_INTERVAL_MS;
      const { getConfiguredIntervalMs } = require('../../src/engine/simulator');
      expect(getConfiguredIntervalMs()).toBe(2000);
    });

    it('falls back to 2000ms when SIMULATION_INTERVAL_MS is invalid (non-numeric)', () => {
      process.env.SIMULATION_INTERVAL_MS = 'not-a-number';
      const { getConfiguredIntervalMs } = require('../../src/engine/simulator');
      expect(getConfiguredIntervalMs()).toBe(2000);
    });

    it('falls back to 2000ms when SIMULATION_INTERVAL_MS is below the safety floor', () => {
      process.env.SIMULATION_INTERVAL_MS = '10';
      const { getConfiguredIntervalMs } = require('../../src/engine/simulator');
      expect(getConfiguredIntervalMs()).toBe(2000);
    });
  });

  describe('startEngine / stopEngine lifecycle', () => {
    it('generates and persists events on a timer, and stops cleanly', () => {
      jest.useFakeTimers();
      process.env.SIMULATION_INTERVAL_MS = '1000';
      const { startEngine, stopEngine } = require('../../src/engine/simulator');

      startEngine();
      // First tick fires synchronously on startEngine().
      let events = getLatestEvents(10);
      expect(events.length).toBeGreaterThanOrEqual(1);

      // Advance past the configured interval to trigger another tick.
      jest.advanceTimersByTime(1500);
      events = getLatestEvents(10);
      expect(events.length).toBeGreaterThanOrEqual(2);

      stopEngine();
      const countAfterStop = getLatestEvents(10).length;

      // No further events should be generated once stopped.
      jest.advanceTimersByTime(5000);
      expect(getLatestEvents(10).length).toBe(countAfterStop);
    });

    it('is idempotent when started twice in a row', () => {
      jest.useFakeTimers();
      const { startEngine, stopEngine } = require('../../src/engine/simulator');
      startEngine();
      const countAfterFirstStart = getLatestEvents(100).length;
      startEngine(); // second call should be a no-op (isRunning guard)
      expect(getLatestEvents(100).length).toBe(countAfterFirstStart);
      stopEngine();
    });
  });
});
