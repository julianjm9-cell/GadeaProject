import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function legacyBoard(directory, fallback) {
  try { return JSON.parse(readFileSync(join(directory, 'panel.json'), 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return fallback;
  }
}

export function readMemory(directory) {
  let db;
  try {
    db = new DatabaseSync(join(directory, 'panel.sqlite'), { readOnly: true });
    const stored = db.prepare("SELECT value FROM state WHERE key = 'board'").get();
    return stored ? JSON.parse(stored.value).memory || [] : legacyBoard(directory, {}).memory || [];
  } catch (error) {
    if (error.errcode !== 14) throw error;
    return legacyBoard(directory, {}).memory || [];
  } finally { db?.close(); }
}

export function openPanelStore(directory, defaults) {
  const db = new DatabaseSync(join(directory, 'panel.sqlite'));
  db.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS batches (
      sequence INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE, value TEXT NOT NULL
    );
  `);
  const get = db.prepare('SELECT value FROM state WHERE key = ?');
  const set = db.prepare('INSERT INTO state VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const board = () => JSON.parse(get.get('board').value);
  const batchById = db.prepare('SELECT value FROM batches WHERE id = ?');
  const latestBatch = db.prepare('SELECT value FROM batches ORDER BY sequence DESC LIMIT 1');
  const recentBatches = db.prepare('SELECT value FROM batches ORDER BY sequence DESC LIMIT 12');
  const insertBatch = db.prepare('INSERT INTO batches(id, value) VALUES (?, ?)');
  const updateBatch = db.prepare('UPDATE batches SET value = ? WHERE id = ?');
  const decode = row => row ? JSON.parse(row.value) : null;

  function transaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  transaction(() => {
    if (!get.get('board')) set.run('board', JSON.stringify({ ...defaults, ...legacyBoard(directory, {}) }));
  });
  return {
    board, transaction,
    operation: key => decode(get.get(key)),
    writeOperation: (key, value) => set.run(key, JSON.stringify(value)),
    writeBoard: value => set.run('board', JSON.stringify(value)),
    latest: () => decode(latestBatch.get()),
    recent: () => recentBatches.all().map(decode),
    batch: id => decode(batchById.get(id)),
    insert: batch => insertBatch.run(batch.id, JSON.stringify(batch)),
    update: batch => updateBatch.run(JSON.stringify(batch), batch.id),
    close: () => db.close(),
  };
}
