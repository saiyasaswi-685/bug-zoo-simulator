import { generateEvent } from '../../src/engine/simulator/generator';
import { randomProvider } from '../../src/engine/simulator/random';

// Mock the random utility
jest.mock('../../src/engine/simulator/random', () => {
  return {
    randomProvider: {
      random: jest.fn(),
      selectElement: jest.fn((arr) => arr[0]), // Return first item for predictability
    },
  };
});

describe('Event Generator Unit Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should generate an ERROR event when random value is >= 0.90', () => {
    (randomProvider.random as jest.Mock).mockReturnValue(0.95);
    const event = generateEvent();

    expect(event.severity).toBe('ERROR');
    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeDefined();
    expect(event.animal).toBeDefined();
    expect(event.message).toBeDefined();
  });

  it('should generate a WARN event when random value is between 0.70 and 0.90', () => {
    (randomProvider.random as jest.Mock).mockReturnValue(0.80);
    const event = generateEvent();

    expect(event.severity).toBe('WARN');
    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeDefined();
    expect(event.animal).toBeDefined();
    expect(event.message).toBeDefined();
  });

  it('should generate an INFO event when random value is < 0.70', () => {
    (randomProvider.random as jest.Mock).mockReturnValue(0.50);
    const event = generateEvent();

    expect(event.severity).toBe('INFO');
    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeDefined();
    expect(event.animal).toBeDefined();
    expect(event.message).toBeDefined();
  });
});
