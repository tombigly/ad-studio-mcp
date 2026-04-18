// Read-only queries over the shared SQLite database.
// The MCP's db.ts initializes the connection lazily; importing db from here
// triggers that init on first use.
import "server-only";
import { db } from "./mcp";

export interface BrandRow {
  id: string;
  name: string;
  url: string | null;
  brand_json: string;
  created_at: number;
}

export interface AdRow {
  id: string;
  brand_id: string;
  prompt: string;
  scene_prompt: string | null;
  motion_prompt: string | null;
  image_url: string | null;
  video_url: string | null;
  r2_image_url: string | null;
  r2_video_url: string | null;
  captions_json: string | null;
  platforms: string;
  status: string;
  cost_cents: number;
  created_at: number;
}

export interface PostRow {
  id: string;
  ad_id: string;
  platform: string;
  webhook_url: string;
  external_id: string | null;
  scheduled_at: number | null;
  published_at: number | null;
  status: string;
  response_json: string | null;
}

export function listBrands(): BrandRow[] {
  return db
    .prepare("SELECT * FROM brands ORDER BY created_at DESC")
    .all() as BrandRow[];
}

export function getBrand(id: string): BrandRow | null {
  return (
    (db.prepare("SELECT * FROM brands WHERE id = ?").get(id) as BrandRow | undefined) ??
    null
  );
}

export function listAds(filters?: {
  brand_id?: string;
  status?: string;
}): AdRow[] {
  const where: string[] = [];
  const args: unknown[] = [];
  if (filters?.brand_id) {
    where.push("brand_id = ?");
    args.push(filters.brand_id);
  }
  if (filters?.status) {
    where.push("status = ?");
    args.push(filters.status);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return db
    .prepare(`SELECT * FROM ads ${clause} ORDER BY created_at DESC`)
    .all(...args) as AdRow[];
}

export function getAd(id: string): AdRow | null {
  return (
    (db.prepare("SELECT * FROM ads WHERE id = ?").get(id) as AdRow | undefined) ?? null
  );
}

export function listPosts(ad_id: string): PostRow[] {
  return db
    .prepare("SELECT * FROM posts WHERE ad_id = ? ORDER BY platform")
    .all(ad_id) as PostRow[];
}

export function countBy(
  table: "brands" | "ads" | "posts",
  column?: string,
  value?: string
): number {
  const row =
    column && value
      ? (db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`).get(value) as {
          n: number;
        })
      : (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number });
  return row.n;
}

export function sumCostCents(): number {
  const row = db.prepare("SELECT COALESCE(SUM(cost_cents), 0) AS n FROM ads").get() as {
    n: number;
  };
  return row.n;
}
