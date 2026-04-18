import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import { DB_PATH } from "./config.js";

export const db: DatabaseType = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  brand_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ads (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  scene_prompt TEXT,
  motion_prompt TEXT,
  image_url TEXT,
  video_url TEXT,
  captions_json TEXT,
  platforms TEXT NOT NULL,
  status TEXT NOT NULL,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ads_brand ON ads(brand_id);
CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  ad_id TEXT NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  external_id TEXT,
  scheduled_at INTEGER,
  published_at INTEGER,
  status TEXT NOT NULL,
  response_json TEXT,
  idempotency_key TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_posts_ad ON posts(ad_id);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

// Additive migrations — safe to re-run.
function addColumnIfMissing(table: string, column: string, type: string): void {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("duplicate column")) throw err;
  }
}
addColumnIfMissing("ads", "r2_image_url", "TEXT");
addColumnIfMissing("ads", "r2_video_url", "TEXT");
addColumnIfMissing("ads", "creative_type", "TEXT NOT NULL DEFAULT 'still'");

export function getConfig(key: string): string | null {
  const row = db
    .prepare("SELECT value FROM config WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setConfig(key: string, value: string): void {
  db.prepare(
    "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}
