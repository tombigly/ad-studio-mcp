import { nanoid } from "nanoid";
import { db } from "../db.js";
import { splitPrompt } from "./split.js";
import { generateImage } from "./image.js";
import { generateVideo } from "./video.js";
import { generateCaptions } from "./captions.js";
import { preflight } from "./preflight.js";

export type Platform = "x" | "instagram" | "tiktok" | "facebook" | "youtube";

export type CreativeType = "still" | "video" | "both";

export interface GenerateAdArgs {
  brand_id: string;
  prompt: string;
  platforms: Platform[];
  aspect?: "9:16" | "1:1" | "16:9";
  /**
   * still: image only (Gemini) — no Replicate call
   * video: image + video, publish defaults to video
   * both:  image + video, publish modal lets each platform pick
   */
  creative_type?: CreativeType;
  /** @deprecated Use creative_type. Kept for backwards compatibility with older callers. */
  include_video?: boolean;
}

export interface GenerateAdResult {
  ad_id: string;
  image_path: string;
  video_path: string | null;
  video_source_url: string | null;
  cost_cents: number;
  duration_ms: number;
}

// Rough fixed-cost estimate (actual billed cost depends on user's plan).
// Nano Banana ~ $0.04, Kling v2.1 standard 5s ~ $0.25, Flash captions negligible.
const COST_CENTS_IMAGE = 4;
const COST_CENTS_VIDEO = 25;
const COST_CENTS_CAPTIONS = 1;

export async function runPipeline(args: GenerateAdArgs): Promise<GenerateAdResult> {
  const started = Date.now();
  const aspect = args.aspect ?? "9:16";
  // Resolve creative_type: explicit arg wins, else fall back to legacy include_video flag.
  const creativeType: CreativeType =
    args.creative_type ?? (args.include_video ? "video" : "still");
  const willRenderVideo = creativeType === "video" || creativeType === "both";

  const brandRow = db
    .prepare("SELECT id, name, brand_json FROM brands WHERE id = ?")
    .get(args.brand_id) as
    | { id: string; name: string; brand_json: string }
    | undefined;
  if (!brandRow) {
    throw new Error(`runPipeline: brand ${args.brand_id} not found`);
  }

  // Preflight: confirm each provider we'll need is reachable before we burn
  // any expensive calls. Image + captions always need Gemini; video needs
  // Replicate. If a check fails we surface the exact reason + next step.
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

  // Insert early so failures are diagnosable via list_ads.
  db.prepare(
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

    const image = await generateImage(split.scene_prompt, aspect, adId);

    let video: { localPath: string; sourceUrl: string } | null = null;
    if (willRenderVideo) {
      video = await generateVideo(image.localPath, split.motion_prompt, aspect, adId);
    }

    const captions = await generateCaptions(
      split.scene_prompt,
      brandJson.voice ?? "",
      args.platforms
    );

    const costCents =
      COST_CENTS_IMAGE +
      (video ? COST_CENTS_VIDEO : 0) +
      COST_CENTS_CAPTIONS;

    db.prepare(
      `UPDATE ads
         SET scene_prompt = ?, motion_prompt = ?, image_url = ?, video_url = ?,
             captions_json = ?, status = 'draft', cost_cents = ?
         WHERE id = ?`
    ).run(
      split.scene_prompt,
      split.motion_prompt,
      image.localPath,
      video?.localPath ?? null,
      JSON.stringify(captions),
      costCents,
      adId
    );

    return {
      ad_id: adId,
      image_path: image.localPath,
      video_path: video?.localPath ?? null,
      video_source_url: video?.sourceUrl ?? null,
      cost_cents: costCents,
      duration_ms: Date.now() - started,
    };
  } catch (err) {
    db.prepare("UPDATE ads SET status = 'failed' WHERE id = ?").run(adId);
    throw err;
  }
}
