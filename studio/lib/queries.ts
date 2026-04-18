// Read-only queries over the shared database.
// Every query awaits ensureInit() so the Postgres schema (on Vercel) is
// guaranteed to exist before a SELECT runs — otherwise cold-start requests
// hit "relation does not exist".
import "server-only";
import { db, ensureInit } from "./mcp";

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

export async function listBrands(): Promise<BrandRow[]> {
  await ensureInit();
  return (await db
    .prepare("SELECT * FROM brands ORDER BY created_at DESC")
    .all()) as unknown as BrandRow[];
}

export async function getBrand(id: string): Promise<BrandRow | null> {
  await ensureInit();
  return (
    ((await db.prepare("SELECT * FROM brands WHERE id = ?").get(id)) as
      | BrandRow
      | undefined) ?? null
  );
}

export async function listAds(filters?: {
  brand_id?: string;
  status?: string;
}): Promise<AdRow[]> {
  await ensureInit();
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
  return (await db
    .prepare(`SELECT * FROM ads ${clause} ORDER BY created_at DESC`)
    .all(...args)) as unknown as AdRow[];
}

export async function getAd(id: string): Promise<AdRow | null> {
  await ensureInit();
  return (
    ((await db.prepare("SELECT * FROM ads WHERE id = ?").get(id)) as
      | AdRow
      | undefined) ?? null
  );
}

export async function listPosts(ad_id: string): Promise<PostRow[]> {
  await ensureInit();
  return (await db
    .prepare("SELECT * FROM posts WHERE ad_id = ? ORDER BY platform")
    .all(ad_id)) as unknown as PostRow[];
}

export async function countBy(
  table: "brands" | "ads" | "posts",
  column?: string,
  value?: string
): Promise<number> {
  await ensureInit();
  const row =
    column && value
      ? ((await db
          .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`)
          .get(value)) as { n: number | string } | undefined)
      : ((await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()) as
          | { n: number | string }
          | undefined);
  return Number(row?.n ?? 0);
}

export async function sumCostCents(): Promise<number> {
  await ensureInit();
  const row = (await db
    .prepare("SELECT COALESCE(SUM(cost_cents), 0) AS n FROM ads")
    .get()) as { n: number | string } | undefined;
  return Number(row?.n ?? 0);
}
