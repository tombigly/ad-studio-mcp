// Dual-mode storage: SQLite for local dev, Postgres for serverless (Vercel).
// The public API is intentionally Promise-returning in BOTH modes so callsites
// can `await` uniformly. SQLite returns synchronously under the hood; we just
// wrap the result.
//
// Schema is identical across both backends — SQLite syntax used here is also
// valid Postgres (CREATE TABLE IF NOT EXISTS, REFERENCES … ON DELETE CASCADE,
// ON CONFLICT (key) DO UPDATE SET value = excluded.value).

import { DB_PATH } from "./config.js";

type Row = Record<string, unknown>;
type Args = unknown[];

interface Statement {
  run(...args: Args): Promise<void>;
  get(...args: Args): Promise<Row | undefined>;
  all(...args: Args): Promise<Row[]>;
}

interface DB {
  prepare(sql: string): Statement;
  exec(sql: string): Promise<void>;
  pragma(_p: string): void;
}

const PG_URL = process.env.DATABASE_URL;

// --- SQLite implementation (local dev) ---
function makeSqliteDb(): DB {
  // Lazy require so Vercel doesn't try to load native module when unused
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const sdb = new Database(DB_PATH);
  sdb.pragma("journal_mode = WAL");
  sdb.pragma("foreign_keys = ON");
  return {
    prepare(sql) {
      const stmt = sdb.prepare(sql);
      return {
        async run(...args: Args) {
          stmt.run(...args);
        },
        async get(...args: Args) {
          return stmt.get(...args) as Row | undefined;
        },
        async all(...args: Args) {
          return stmt.all(...args) as Row[];
        },
      };
    },
    async exec(sql) {
      sdb.exec(sql);
    },
    pragma(p) {
      sdb.pragma(p);
    },
  };
}

// --- Postgres implementation (production) ---
function makePgDb(): DB {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const postgres = require("postgres");
  const sql = postgres(PG_URL!, {
    ssl: "require",
    max: 1, // serverless — single connection per invocation
    idle_timeout: 20,
    connect_timeout: 10,
  });

  // Translate `?` placeholders → `$1, $2, …`
  function translate(sqlStr: string): string {
    let i = 0;
    return sqlStr.replace(/\?/g, () => `$${++i}`);
  }

  return {
    prepare(sqlStr) {
      const translated = translate(sqlStr);
      return {
        async run(...args: Args) {
          await sql.unsafe(translated, args as unknown[]);
        },
        async get(...args: Args) {
          const rows = await sql.unsafe(translated, args as unknown[]);
          return (rows[0] as Row | undefined) ?? undefined;
        },
        async all(...args: Args) {
          const rows = await sql.unsafe(translated, args as unknown[]);
          return rows as unknown as Row[];
        },
      };
    },
    async exec(sqlStr) {
      // Postgres can run multiple statements via simple query protocol
      await sql.unsafe(sqlStr);
    },
    pragma() {
      /* no-op on Postgres */
    },
  };
}

export const db: DB = PG_URL ? makePgDb() : makeSqliteDb();

// --- Schema bootstrap. Runs once at module load. ---
// Use INTEGER which works for both SQLite and Postgres for our timestamp/cost fields.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  brand_json TEXT NOT NULL,
  created_at BIGINT NOT NULL
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
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ads_brand ON ads(brand_id);
CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  ad_id TEXT NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  external_id TEXT,
  scheduled_at BIGINT,
  published_at BIGINT,
  status TEXT NOT NULL,
  response_json TEXT,
  idempotency_key TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_posts_ad ON posts(ad_id);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// Additive migrations — safe to re-run on both backends.
const MIGRATIONS: Array<{ table: string; column: string; type: string }> = [
  { table: "ads", column: "r2_image_url", type: "TEXT" },
  { table: "ads", column: "r2_video_url", type: "TEXT" },
  { table: "ads", column: "creative_type", type: "TEXT NOT NULL DEFAULT 'still'" },
  { table: "ads", column: "image_variants_json", type: "TEXT" },
  { table: "ads", column: "video_variants_json", type: "TEXT" },
  { table: "ads", column: "r2_image_variants_json", type: "TEXT" },
  { table: "ads", column: "r2_video_variants_json", type: "TEXT" },
];

let _initPromise: Promise<void> | null = null;
export function ensureInit(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    await db.exec(SCHEMA);
    for (const m of MIGRATIONS) {
      try {
        await db.exec(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.type}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          !msg.includes("duplicate column") &&
          !msg.includes("already exists")
        ) {
          throw err;
        }
      }
    }
  })();
  return _initPromise;
}

// Eagerly kick off init; callers can also `await ensureInit()` if they need
// to be sure the schema exists before reading.
ensureInit().catch((err) => {
  console.error("[db] schema init failed:", err);
});

export async function getConfig(key: string): Promise<string | null> {
  await ensureInit();
  const row = (await db
    .prepare("SELECT value FROM config WHERE key = ?")
    .get(key)) as { value: string } | undefined;
  return row?.value ?? null;
}

export async function setConfig(key: string, value: string): Promise<void> {
  await ensureInit();
  await db
    .prepare(
      "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(key, value);
}
