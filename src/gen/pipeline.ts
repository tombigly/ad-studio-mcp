import { nanoid } from "nanoid";
import { db } from "../db.js";
import { splitPrompt } from "./split.js";
import { generateImage } from "./image.js";
import { generateVideo } from "./video.js";
import { generateCaptions } from "./captions.js";
import { preflight } from "./preflight.js";
import { uniqueAspectsFor } from "../platforms.js";
import type { Platform, Aspect } from "../platforms.js";

export type { Platform } from "../platforms.js";

export type CreativeType = "still" | "video" | "both";

export interface GenerateAdArgs {
  brand_id: string;
  prompt: string;
  platforms: Platform[];
  /**
   * still: image only (Gemini) — no Replicate call
   * video: image + video, publish defaults to video
   * both:  image + video, publish modal lets each platform pick
   */
  creative_type?: CreativeType;
  /** @deprecated Aspect is auto-picked per platform now. Ignored if provided. */
  aspect?: Aspect;
  /** @deprecated Use creative_type. */
  include_video?: boolean;
}

export interface GenerateAdResult {
  ad_id: string;
  // Primary (first) aspect's paths — kept for backwards compat with old callers.
  image_path: string;
  video_path: string | null;
  video_source_url: string | null;
  /** All image paths keyed by aspect: {"9:16": "/path", "1:1": "/path", ...} */
  image_variants: Record<string, string>;
  /** All video paths keyed by aspect, only present when creative_type renders video. */
  video_variants: Record<string, string>;
  aspects: Aspect[];
  cost_cents: number;
  duration_ms: number;
}

// Rough fixed-cost estimate (actual billed cost depends on user's plan).
const COST_CENTS_IMAGE = 4;
const COST_CENTS_VIDEO = 25;
const COST_CENTS_CAPTIONS = 1;

export async function runPipeline(args: GenerateAdArgs): Promise<GenerateAdResult> {
  const started = Date.now();
  const creativeType: CreativeType =
    args.creative_type ?? (args.include_video ? "video" : "still");
  const willRenderVideo = creativeType === "video" || creativeType === "both";

  const aspects = uniqueAspectsFor(args.platforms);
  if (aspects.length === 0) {
    throw new Error("runPipeline: at least one platform required");
  }

  const brandRow = (await db
    .prepare("SELECT id, name, brand_json FROM brands WHERE id = ?")
    .get(args.brand_id)) as
    | { id: string; name: string; brand_json: string }
    | undefined;
  if (!brandRow) {
    throw new Error(`runPipeline: brand ${args.brand_id} not found`);
  }

  const failed = await preflight({
    needsGemini: true,
    needsReplicate: willRenderVideo,
  });
  if (failed) {
    throw new Error(`Preflight failed (${failed.provider}): ${failed.hint}`);
  }

  const brandJson = JSON.parse(brandRow.brand_json) as {
    voice?: string;
    audiences?: string[];
  };

  const adId = nanoid(12);

  await db.prepare(
    `INSERT INTO ads (id, brand_id, prompt, platforms, status, creative_type, created_at)
     VALUES (?, ?, ?, ?, 'generating', ?, ?)`
  ).run(
    adId,
    args.brand_id,
    args.prompt,
    args.platforms.join(","),
    creativeType,
    Date.now()
  );

  try {
    const split = await splitPrompt(args.prompt);

    // Generate one image per unique aspect. Platforms that share an aspect
    // share the same asset — no duplicate cost.
    const imageVariants: Record<string, string> = {};
    for (const aspect of aspects) {
      const img = await generateImage(split.scene_prompt, aspect, `${adId}-${aspect.replace(":", "x")}`);
      imageVariants[aspect] = img.localPath;
    }

    // If the user asked for video, render one per unique aspect too.
    const videoVariants: Record<string, string> = {};
    if (willRenderVideo) {
      for (const aspect of aspects) {
        const v = await generateVideo(
          imageVariants[aspect],
          split.motion_prompt,
          aspect,
          `${adId}-${aspect.replace(":", "x")}`
        );
        videoVariants[aspect] = v.localPath;
      }
    }

    const captions = await generateCaptions(
      split.scene_prompt,
      brandJson.voice ?? "",
      args.platforms
    );

    const costCents =
      COST_CENTS_IMAGE * aspects.length +
      (willRenderVideo ? COST_CENTS_VIDEO * aspects.length : 0) +
      COST_CENTS_CAPTIONS;

    // Primary (most common) aspect: 9:16 if present, else the first generated.
    const primaryAspect: Aspect = aspects.includes("9:16") ? "9:16" : aspects[0]!;

    await db.prepare(
      `UPDATE ads
         SET scene_prompt = ?, motion_prompt = ?, image_url = ?, video_url = ?,
             image_variants_json = ?, video_variants_json = ?,
             captions_json = ?, status = 'draft', cost_cents = ?
         WHERE id = ?`
    ).run(
      split.scene_prompt,
      split.motion_prompt,
      imageVariants[primaryAspect]!,
      videoVariants[primaryAspect] ?? null,
      JSON.stringify(imageVariants),
      willRenderVideo ? JSON.stringify(videoVariants) : null,
      JSON.stringify(captions),
      costCents,
      adId
    );

    return {
      ad_id: adId,
      image_path: imageVariants[primaryAspect]!,
      video_path: videoVariants[primaryAspect] ?? null,
      video_source_url: null,
      image_variants: imageVariants,
      video_variants: videoVariants,
      aspects,
      cost_cents: costCents,
      duration_ms: Date.now() - started,
    };
  } catch (err) {
    await db.prepare("UPDATE ads SET status = 'failed' WHERE id = ?").run(adId);
    throw err;
  }
}
