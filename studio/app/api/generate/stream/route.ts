import { nanoid } from "nanoid";
import { db, ensureInit } from "@/lib/mcp";
import { splitPrompt } from "../../../../../dist/gen/split.js";
import { generateImage } from "../../../../../dist/gen/image.js";
import { generateVideo } from "../../../../../dist/gen/video.js";
import { generateCaptions } from "../../../../../dist/gen/captions.js";
import { preflight } from "../../../../../dist/gen/preflight.js";
import { uploadFile } from "../../../../../dist/storage/r2.js";
import { isR2Configured } from "../../../../../dist/config.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface Body {
  brand_id: string;
  prompt: string;
  platforms: ("x" | "instagram" | "tiktok" | "facebook" | "youtube")[];
  aspect?: "9:16" | "1:1" | "16:9";
  creative_type?: "still" | "video" | "both";
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const aspect = body.aspect ?? "9:16";
  const creativeType = body.creative_type ?? "still";
  const willRenderVideo = creativeType === "video" || creativeType === "both";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };
      const close = () => controller.close();

      try {
        await ensureInit();
        // Fetch brand row inside the stream so any DB error surfaces to the
        // client as a normal event, not a 500 on the fetch itself.
        const brandRow = (await db
          .prepare("SELECT id, brand_json FROM brands WHERE id = ?")
          .get(body.brand_id)) as { id: string; brand_json: string } | undefined;
        if (!brandRow) throw new Error(`brand ${body.brand_id} not found`);
        if (!body.prompt) throw new Error("prompt is required");
        if (!body.platforms?.length) throw new Error("at least one platform required");

        // Preflight: check Gemini (always) and Replicate (if rendering video)
        // before any retry-spam. Converts credit errors into a single clean
        // "here's what to fix" message and costs ~2 fast HTTP calls.
        send("stage", { stage: "preflight", status: "start" });
        const pf = await preflight({
          needsGemini: true,
          needsReplicate: willRenderVideo,
        });
        if (pf) {
          throw new Error(`${pf.provider} unreachable — ${pf.hint}`);
        }
        send("stage", { stage: "preflight", status: "done" });

        const adId = nanoid(12);
        const brand = JSON.parse(brandRow.brand_json) as {
          voice?: string;
          audiences?: string[];
        };

        await db.prepare(
          `INSERT INTO ads (id, brand_id, prompt, platforms, status, creative_type, created_at)
           VALUES (?, ?, ?, ?, 'generating', ?, ?)`
        ).run(
          adId,
          brandRow.id,
          body.prompt,
          body.platforms.join(","),
          creativeType,
          Date.now()
        );

        send("stage", { stage: "split", status: "start", ad_id: adId });
        const split = await splitPrompt(body.prompt);
        send("stage", { stage: "split", status: "done", preview: split });

        send("stage", { stage: "image", status: "start" });
        const image = await generateImage(split.scene_prompt, aspect, adId);
        // Upload to R2 immediately. /tmp doesn't survive across Vercel
        // serverless invocations, so the only durable URL is R2.
        let r2ImageUrl: string | null = null;
        if (isR2Configured()) {
          try {
            const uploaded = await uploadFile(image.localPath, `ads/${adId}`);
            r2ImageUrl = uploaded.url;
          } catch (uploadErr) {
            console.error("[stream] image R2 upload failed:", uploadErr);
          }
        }
        send("stage", {
          stage: "image",
          status: "done",
          bytes: image.byteSize,
          path: r2ImageUrl ?? image.localPath,
        });

        let video: { localPath: string; sourceUrl: string; byteSize: number } | null =
          null;
        let r2VideoUrl: string | null = null;
        if (willRenderVideo) {
          send("stage", { stage: "video", status: "start" });
          video = await generateVideo(
            image.localPath,
            split.motion_prompt,
            aspect,
            adId
          );
          if (isR2Configured()) {
            try {
              const uploaded = await uploadFile(video.localPath, `ads/${adId}`);
              r2VideoUrl = uploaded.url;
            } catch (uploadErr) {
              console.error("[stream] video R2 upload failed:", uploadErr);
            }
          }
          send("stage", { stage: "video", status: "done", bytes: video.byteSize });
        } else {
          send("stage", { stage: "video", status: "skipped" });
        }

        send("stage", { stage: "captions", status: "start" });
        const captions = await generateCaptions(
          split.scene_prompt,
          brand.voice ?? "",
          body.platforms
        );
        send("stage", { stage: "captions", status: "done" });

        const costCents = video ? 30 : 5;
        await db.prepare(
          `UPDATE ads
             SET scene_prompt = ?, motion_prompt = ?, image_url = ?, video_url = ?,
                 r2_image_url = ?, r2_video_url = ?,
                 captions_json = ?, status = 'draft', cost_cents = ?
             WHERE id = ?`
        ).run(
          split.scene_prompt,
          split.motion_prompt,
          image.localPath,
          video?.localPath ?? null,
          r2ImageUrl,
          r2VideoUrl,
          JSON.stringify(captions),
          costCents,
          adId
        );

        send("done", { ad_id: adId, cost_cents: costCents, has_video: Boolean(video) });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send("error", { message });
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
