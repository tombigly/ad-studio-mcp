import { createHash } from "node:crypto";
import { basename } from "node:path";
import { nanoid } from "nanoid";
import { db, getConfig } from "./db.js";
import { uploadFile } from "./storage/r2.js";
import { isR2Configured } from "./config.js";
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
  media_url: string;
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
  captions_json: string | null;
  platforms: string;
}

export async function publishAd(args: PublishArgs): Promise<PublishResult> {
  const scheduledAt = args.when ? Date.parse(args.when) : null;
  if (scheduledAt !== null && Number.isNaN(scheduledAt)) {
    throw new Error(`publishAd: invalid when timestamp: ${args.when}`);
  }

  const adRow = db
    .prepare(
      `SELECT id, brand_id, status, image_url, video_url, r2_image_url, r2_video_url, captions_json, platforms FROM ads WHERE id = ?`
    )
    .get(args.ad_id) as AdRow | undefined;
  if (!adRow) throw new Error(`publishAd: ad ${args.ad_id} not found`);
  if (adRow.status !== "approved") {
    throw new Error(
      `publishAd: ad ${args.ad_id} is ${adRow.status}, must be 'approved' to publish`
    );
  }
  if (!adRow.video_url && !adRow.image_url)
    throw new Error(`publishAd: ad ${args.ad_id} has no media`);
  if (!adRow.captions_json) throw new Error(`publishAd: ad ${args.ad_id} has no captions`);

  const hasVideo = Boolean(adRow.video_url);
  const mediaType: "video" | "image" = hasVideo ? "video" : "image";

  const brandRow = db
    .prepare(`SELECT id, name FROM brands WHERE id = ?`)
    .get(adRow.brand_id) as { id: string; name: string } | undefined;
  if (!brandRow) throw new Error(`publishAd: brand ${adRow.brand_id} not found`);

  // Resolve a publicly-fetchable URL for whichever media we have.
  // Preferred: R2 (persistent). Fallback: the studio's localtunnel.
  const localPath = hasVideo ? adRow.video_url! : adRow.image_url!;
  const cachedR2 = hasVideo ? adRow.r2_video_url : adRow.r2_image_url;
  const r2Column = hasVideo ? "r2_video_url" : "r2_image_url";

  let mediaUrl: string | null = cachedR2;
  if (!mediaUrl) {
    if (isR2Configured()) {
      const uploaded = await uploadFile(localPath, `ads/${adRow.id}`);
      mediaUrl = uploaded.url;
      db.prepare(`UPDATE ads SET ${r2Column} = ? WHERE id = ?`).run(mediaUrl, adRow.id);
    } else {
      const tunnelUrl = getConfig("tunnel.url");
      if (!tunnelUrl) {
        throw new Error(
          "publishAd: no public media URL available. R2 is not configured and no tunnel is running. Start the studio (`ad-studio`) so the tunnel auto-starts, or configure R2."
        );
      }
      mediaUrl = `${tunnelUrl.replace(/\/$/, "")}/api/media/${basename(localPath)}`;
    }
  }

  const captions = JSON.parse(adRow.captions_json) as PlatformCaptions;
  const platforms = adRow.platforms
    .split(",")
    .map((p) => p.trim())
    .filter((p): p is Platform => ALL_PLATFORMS.includes(p as Platform));

  db.prepare(`UPDATE ads SET status = 'publishing' WHERE id = ?`).run(adRow.id);

  const results = await Promise.all(
    platforms.map(async (platform): Promise<PerPlatformResult> => {
      const webhookUrl = getConfig(`webhook.${platform}`);
      const postId = nanoid(12);
      const idemKey = idempotencyKey(adRow.id, platform, scheduledAt);

      if (!webhookUrl) {
        db.prepare(
          `INSERT OR IGNORE INTO posts
             (id, ad_id, platform, webhook_url, scheduled_at, status, response_json, idempotency_key)
             VALUES (?, ?, ?, ?, ?, 'failed', ?, ?)`
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

      const payload = buildPayload(
        adRow,
        brandRow,
        platform,
        captions,
        mediaUrl!,
        mediaType,
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

        db.prepare(
          `INSERT OR IGNORE INTO posts
             (id, ad_id, platform, webhook_url, scheduled_at, published_at, status, response_json, idempotency_key)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        db.prepare(
          `INSERT OR IGNORE INTO posts
             (id, ad_id, platform, webhook_url, scheduled_at, status, response_json, idempotency_key)
             VALUES (?, ?, ?, ?, ?, 'failed', ?, ?)`
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
  db.prepare(`UPDATE ads SET status = ? WHERE id = ?`).run(finalStatus, adRow.id);

  return {
    ad_id: adRow.id,
    scheduled_at: scheduledAt,
    media_url: mediaUrl!,
    results,
    ad_status: finalStatus,
  };
}

export function getPostStatus(ad_id: string) {
  const rows = db
    .prepare(
      `SELECT id, platform, status, published_at, scheduled_at, response_json
         FROM posts WHERE ad_id = ?
         ORDER BY platform`
    )
    .all(ad_id) as Array<{
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
