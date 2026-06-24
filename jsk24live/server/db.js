const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'jsk24live.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  size INTEGER,
  duration REAL,
  width INTEGER,
  height INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS streams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  rtmp_url TEXT NOT NULL,
  stream_key TEXT NOT NULL,
  quality TEXT NOT NULL DEFAULT 'copy',
  video_ids TEXT NOT NULL DEFAULT '[]',
  loop_hours INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'idle',
  started_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

module.exports = db;
