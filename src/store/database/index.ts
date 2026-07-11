import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { logger } from '../../observability/logger';
import { activeAnimalsGauge } from '../../observability/metrics';

export interface ZooEvent {
  id: string;
  timestamp: string;
  animal: string;
  message: string;
  severity: 'INFO' | 'WARN' | 'ERROR';
}

let db: Database.Database;

export function initDatabase(dbPath = process.env.DATABASE_PATH || 'bug_zoo.db') {
  logger.info({ database_path: dbPath }, 'Initializing SQLite Database');

  // Ensure the parent directory exists (relevant for mounted volume paths
  // such as /app/data/bug_zoo.db in Docker).
  const dir = path.dirname(dbPath);
  if (dir && dir !== '.' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  
  // Enable WAL mode for concurrency
  db.pragma('journal_mode = WAL');
  
  // Create table (CHECK constraint enforces severity domain at the DB layer
  // as defense-in-depth, in addition to application-level validation)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      animal TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARN', 'ERROR'))
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events (timestamp DESC)
  `).run();
  
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_events_animal ON events (animal)
  `).run();
  
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_events_severity ON events (severity)
  `).run();

  updateActiveAnimalsGauge();
}

export function insertEvent(event: ZooEvent): void {
  const stmt = db.prepare(`
    INSERT INTO events (id, timestamp, animal, message, severity)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(event.id, event.timestamp, event.animal, event.message, event.severity);
  updateActiveAnimalsGauge();
}

export function getLatestEvents(
  limit = 100,
  animalFilter?: string,
  severityFilter?: string
): ZooEvent[] {
  let query = 'SELECT id, timestamp, animal, message, severity FROM events';
  const conditions: string[] = [];
  const params: any[] = [];

  if (animalFilter) {
    conditions.push('animal = ?');
    params.push(animalFilter);
  }

  if (severityFilter) {
    conditions.push('severity = ?');
    params.push(severityFilter);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as ZooEvent[];
  return rows;
}

export function getStats(): {
  animal_counts: Record<string, number>;
  severity_counts: Record<string, number>;
} {
  const animalCountsStmt = db.prepare(`
    SELECT animal, COUNT(*) as count FROM events GROUP BY animal
  `);
  const animalRows = animalCountsStmt.all() as { animal: string; count: number }[];

  const severityCountsStmt = db.prepare(`
    SELECT severity, COUNT(*) as count FROM events GROUP BY severity
  `);
  const severityRows = severityCountsStmt.all() as { severity: string; count: number }[];

  const animal_counts: Record<string, number> = {};
  for (const row of animalRows) {
    animal_counts[row.animal] = row.count;
  }

  const severity_counts: Record<string, number> = {
    INFO: 0,
    WARN: 0,
    ERROR: 0
  };
  for (const row of severityRows) {
    severity_counts[row.severity] = row.count;
  }

  return { animal_counts, severity_counts };
}

export function updateActiveAnimalsGauge(): void {
  try {
    if (!db) return;
    const stmt = db.prepare('SELECT COUNT(DISTINCT animal) as count FROM events');
    const result = stmt.get() as { count: number } | undefined;
    if (result) {
      activeAnimalsGauge.set(result.count);
    }
  } catch (error) {
    logger.error({ error }, 'Failed to update active animals gauge');
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
