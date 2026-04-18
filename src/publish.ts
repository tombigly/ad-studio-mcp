import { createHash } from "node:crypto";
import { basename } from "node:path";
import { nanoid } from "nanoid";
import { db, getConfig } from "./db.js";
import { uploadFile } from "./storage/r2.js";
import { isR2Configured } from "./config.js";
import { aspectFor } from "./platforms.js";
import type { PlatformCaptions } from "./gen/captions.js";

export type Platform = "x" | "instagram" | "tiktok" | "facebook" | "youtube";
const ALL_PLATFORMS: Platform[] = ["x", "instagram", "tiktok", "facebook", "youtube"];

export interface PublishArgs {
  ad_id: string;
  when?: string; // ISO timestamp; omit for now
}

export interface PerPlatformResult {
  platform: Platform;
  post_id: string;
  status: "sent" | "failed" | "skipped";
  reason?: string;
  response?: unknown;
}

export interface PublishResult {
  ad_id: string;
  scheduled_at: number | null;
  /** Per-platform resolved media URLs, keyed by platform name. */
  media_urls: Record<string, string>;
  results: PerPlatformResult[];
  ad_status: string;
}

function idempotencyKey(adId: string, platform: Platform, when: number | null): string {
  return createHash("sha256")
    .update(`${adId}|${platform}|${when ?? 0}`)
    .digest("hex")
    .slice(0, 32);
}

function buildPayload(
  adRow: AdRow,
  brandRow: { id: string; name: string },
  platform: Platform,
  captions: PlatformCaptions,
  mediaUrl: string,
  mediaType: "image" | "video",
  scheduledAt: number | null
) {
  if (platform === "youtube") {
    return {
      ad_id: adRow.id,
      brand_id: brandRow.id,
      brand_name: brandRow.name,
      platform,
      title: captions.youtube.title,
      caption: captions.youtube.description,
      media_url: mediaUrl,
      media_type: mediaType,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    };
  }
  return {
    ad_id: adRow.id,
    brand_id: brandRow.id,
    brand_name: brandRow.name,
    platform,
    caption: captions[platform],
    media_url: mediaUrl,
    media_type: mediaType,
    scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
  };
}

interface AdRow {
  id: string;
  brand_id: string;
  status: string;
  image_url: string | null;
  video_url: string | null;
  r2_image_url: string | null;
  r2_video_url: string | null;
  image_variants_json: string | null;
  video_variants_json: string | null;
  r2_image_variants_json: string | null;
  r2_video_variants_json: string | null;
  creative_type: string | null;
  captions_json: string | null;
  platforms: string;
}

export async function publishAd(args: PublishArgs): Promise<PublishResult> {
  const scheduledAt = args.when ? Date.parse(args.when) : null;
  if (scheduledAt !== null && Number.isNaN(scheduledAt)) {
    throw new Error(`publishAd: invalid when timestamp: ${args.when}`);
  }

  const adRow = (await db
    .prepare(
      `SELECT id, brand_id, status, image_url, video_url, r2_image_url, r2_video_url,
              image_variants_json, video_variants_json,
              r2_image_variants_json, r2_video_variants_json,
              creative_type, captions_json, platforms FROM ads WHERE id = ?`
    )
    .get(args.ad_id)) as AdRow | undefined;
  if (!adRow) throw new Error(`publishAd: ad ${args.ad_id} not found`);
  if (adRow.status !== "approved") {
    throw new Error(
      `publishAd: ad ${args.ad_id} is ${adRow.status}, must be 'approved' to publish`
    );
  }
  if (!adRow.video_url && !adRow.image_url)
    throw new Error(`publishAd: ad ${args.ad_id} has no media`);
  if (!adRow.captions_json) throw new Error(`publishAd: ad ${args.ad_id} has no captions`);

  const creativeType = adRow.creative_type ?? "still";
  const hasVideoAsset = Boolean(adRow.video_url);
  // Per-platform resolution: which variant do we use for which platform?
  const imageVariants: Record<string, string> = adRow.image_variants_json
    ? (JSON.parse(adRow.image_variants_json) as Record<string, string>)
    : adRow.image_url
    ? { default: adRow.image_url }
    : {};
  const videoVariants: Record<string, string> = adRow.video_variants_json
    ? (JSON.parse(adRow.video_variants_json) as Record<string, string>)
    : adRow.video_url
    ? { default: adRow.video_url }
    : {};
  const r2ImageVariants: Record<string, string> = adRow.r2_image_variants_json
    ? (JSON.parse(adRow.r2_image_variants_json) as Record<string, string>)
    : adRow.r2_image_url
    ? { default: adRow.r2_image_url }
    : {};
  const r2VideoVariants: Record<string, string> = adRow.r2_video_variants_json
    ? (JSON.parse(adRow.r2_video_variants_json) as Record<string, string>)
    : adRow.r2_video_url
    ? { default: adRow.r2_video_url }
    : {};

  const brandRow = (await db
    .prepare(`SELECT id, name FROM brands WHERE id = ?`)
    .get(adRow.brand_id)) as { id: string; name: string } | undefined;
  if (!brandRow) throw new Error(`publishAd: brand ${adRow.brand_id} not found`);

  // Bind to locals so nested closures don't re-widen the type.
  const ad = adRow;

  // Resolve the right media URL for a given platform. We prefer video when
  // creative_type says so, fall back to image if video is missing for that
  // aspect. R2 if configured (persistent); else studio's localtunnel.
  async function resolveMediaUrlForPlatform(platform: Platform): Promise<{
    url: string;
    mediaType: "image" | "video";
  }> {
    const aspect = aspectFor(platform);
    const wantVideo =
      (creativeType === "video" || creativeType === "both") && hasVideoAsset;

    // Choose image or video local path for this aspect.
    const chooseLocal = (variants: Record<string, string>): string | null =>
      variants[aspect] ?? variants[Object.keys(variants)[0] ?? ""] ?? null;

    let mediaType: "image" | "video" = "image";
    let localPath: string | null = null;
    let cachedR2: string | null = null;
    let saveToVariantColumn: "r2_image_variants_json" | "r2_video_variants_json" =
      "r2_image_variants_json";
    let cache: Record<string, string> = r2ImageVariants;

    if (wantVideo) {
      const v = chooseLocal(videoVariants);
      if (v) {
        mediaType = "video";
        localPath = v;
        cachedR2 = r2VideoVariants[aspect] ?? null;
        saveToVariantColumn = "r2_video_variants_json";
        cache = r2VideoVariants;
      }
    }
    if (!localPath) {
      localPath = chooseLocal(imageVariants);
      if (!localPath) throw new Error(`no media for platform ${platform}`);
      cachedR2 = r2ImageVariants[aspect] ?? null;
    }

    if (cachedR2) return { url: cachedR2, mediaType };

    if (isR2Configured()) {
      const uploaded = await uploadFile(localPath, `ads/${ad.id}/${aspect.replace(":", "x")}`);
      cache[aspect] = uploaded.url;
      await db.prepare(`UPDATE ads SET ${saveToVariantColumn} = ? WHERE id = ?`).run(
        JSON.stringify(cache),
        ad.id
      );
      return { url: uploaded.url, mediaType };
    }

    const tunnelUrl = await getConfig("tunnel.url");
    if (!tunnelUrl) {
      throw new Error(
        "publishAd: no public media URL available. R2 is not configured and no tunnel is running."
      );
    }
    return {
      url: `${tunnelUrl.replace(/\/$/, "")}/api/media/${basename(localPath)}`,
      mediaType,
    };
  }

  const captions = JSON.parse(adRow.captions_json) as PlatformCaptions;
  const platforms = adRow.platforms
    .split(",")
    .map((p) => p.trim())
    .filter((p): p is Platform => ALL_PLATFORMS.includes(p as Platform));

  await db.prepare(`UPDATE ads SET status = 'publishing' WHERE id = ?`).run(adRow.id);

  const mediaUrlByPlatform: Record<string, string> = {};
  const results = await Promise.all(
    platforms.map(async (platform): Promise<PerPlatformResult> => {
      const webhookUrl = await getConfig(`webhook.${platform}`);
      const postId = nanoid(12);
      const idemKey = idempotencyKey(adRow.id, platform, scheduledAt);

      if (!webhookUrl) {
        await db.prepare(
          `INSERT INTO posts
             (id, ad_id, platform, webhook_url, scheduled_at, status, response_json, idempotency_key)
             VALUES (?, ?, ?, ?, ?, 'failed', ?, ?)
           ON CONFLICT (idempotency_key) DO NOTHING`
        ).run(
          postId,
          adRow.id,
          platform,
          "",
          scheduledAt,
          JSON.stringify({ error: "no webhook configured" }),
          idemKey
        );
        return { platform, post_id: postId, status: "skipped", reason: "no webhook configured" };
      }

      let resolved;
      try {
        resolved = await resolveMediaUrlForPlatform(platform);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db.prepare(
          `INSERT INTO posts
             (id, ad_id, platform, webhook_url, scheduled_at, status, response_json, idempotency_key)
             VALUES (?, ?, ?, ?, ?, 'failed', ?, ?)
           ON CONFLICT (idempotency_key) DO NOTHING`
        ).run(
          postId,
          adRow.id,
          platform,
          webhookUrl,
          scheduledAt,
          JSON.stringify({ error: message }),
          idemKey
        );
        return { platform, post_id: postId, status: "failed", reason: message };
      }

      mediaUrlByPlatform[platform] = resolved.url;
      const payload = buildPayload(
        adRow,
        brandRow,
        platform,
        captions,
        resolved.url,
        resolved.mediaType,
        scheduledAt
      );

      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30_000),
        });
        const responseText = await res.text();
        const ok = res.ok;

        await db.prepare(
          `INSERT INTO posts
             (id, ad_id, platform, webhook_url, scheduled_at, published_at, status, response_json, idempotency_key)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (idempotency_key) DO NOTHING`
        ).run(
          postId,
          adRow.id,
          platform,
          webhookUrl,
          scheduledAt,
          ok ? Date.now() : null,
          ok ? "sent" : "failed",
          JSON.stringify({ status: res.status, body: responseText.slice(0, 1000) }),
          idemKey
        );

        return {
          platform,
          post_id: postId,
          status: ok ? "sent" : "failed",
          reason: ok ? undefined : `HTTP ${res.status}`,
          response: { status: res.status, body: responseText.slice(0, 200) },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db.prepare(
          `INSERT INTO posts
             (id, ad_id, platform, webhook_url, scheduled_at, status, response_json, idempotency_key)
             VALUES (?, ?, ?, ?, ?, 'failed', ?, ?)
           ON CONFLICT (idempotency_key) DO NOTHING`
        ).run(
          postId,
          adRow.id,
          platform,
          webhookUrl,
          scheduledAt,
          JSON.stringify({ error: message }),
          idemKey
        );
        return { platform, post_id: postId, status: "failed", reason: message };
      }
    })
  );

  const anyFailed = results.some((r) => r.status !== "sent");
  const allSent = results.every((r) => r.status === "sent");
  const finalStatus = allSent ? "published" : anyFailed ? "failed" : "publishing";
  await db.prepare(`UPDATE ads SET status = ? WHERE id = ?`).run(finalStatus, adRow.id);

  return {
    ad_id: adRow.id,
    scheduled_at: scheduledAt,
    media_urls: mediaUrlByPlatform,
    results,
    ad_status: finalStatus,
  };
}

export async function getPostStatus(ad_id: string) {
  const rows = (await db
    .prepare(
      `SELECT id, platform, status, published_at, scheduled_at, response_json
         FROM posts WHERE ad_id = ?
         ORDER BY platform`
    )
    .all(ad_id)) as unknown as Array<{
    id: string;
    platform: string;
    status: string;
    published_at: number | null;
    scheduled_at: number | null;
    response_json: string | null;
  }>;
  return rows.map((r) => ({
    ...r,
    response: r.response_json ? JSON.parse(r.response_json) : null,
  }));
}
