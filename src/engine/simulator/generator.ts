import { v4 as uuidv4 } from 'uuid';
import { randomProvider } from './random';
import { ZooEvent } from '../../store/database';

const ANIMALS = ['Lion', 'Zebra', 'Tarantula', 'Penguin', 'Monkey'];

const MESSAGES_BY_SEVERITY: Record<ZooEvent['severity'], Record<string, string[]>> = {
  INFO: {
    Lion: ['taking a nap in the shade', 'grooming its mane', 'roaring softly to mark territory'],
    Zebra: ['grazing peacefully on fresh grass', 'drinking water at the watering hole', 'standing watch for the herd'],
    Tarantula: ['spinning a new web structure', 'burrowing under the peat moss', 'resting quietly in the corner'],
    Penguin: ['diving for krill in the pool', 'waddling around the ice shelf', 'preening its waterproof feathers'],
    Monkey: ['swinging from tree branches', 'grooming a companion monkey', 'munching on fresh apple slices'],
  },
  WARN: {
    Lion: ['pacing restlessly near the perimeter fence', 'growling aggressively at a security patrol vehicle'],
    Zebra: ['spooked by a sudden noise and running frantically', 'biting at the enclosure gate locks'],
    Tarantula: ['climbing high on the ventilation mesh', 'showing defensive posture toward the glass panel'],
    Penguin: ['refusing to join the feed session', 'squawking continuously at the temperature monitors'],
    Monkey: ['snatching a visitor cell phone from the barrier', 'throwing wood chips outside the play zone'],
  },
  ERROR: {
    Lion: ['escaped enclosure! Containment breach declared!', 'attacked and injured another male lion'],
    Zebra: ['broke through a damaged pasture fence', 'collapsed from heat exhaustion'],
    Tarantula: ['glass enclosure panel cracked!', 'escaped and is missing from its enclosure container!'],
    Penguin: ['filtration system failed, pool temperature rising!', 'ingested a foreign plastic wrapper dropped by visitors'],
    Monkey: ['bit a wildlife supervisor during feeding', 'caused an electrical short-circuit by pulling conduit cables'],
  },
};

export function generateEvent(): ZooEvent {
  const rand = randomProvider.random();
  let severity: ZooEvent['severity'] = 'INFO';

  if (rand >= 0.90) {
    severity = 'ERROR';
  } else if (rand >= 0.70) {
    severity = 'WARN';
  }

  const animal = randomProvider.selectElement(ANIMALS);
  const messageList = MESSAGES_BY_SEVERITY[severity][animal] || ['performs default action'];
  const message = randomProvider.selectElement(messageList);

  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    animal,
    message,
    severity,
  };
}
