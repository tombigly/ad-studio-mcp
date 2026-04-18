import Replicate from "replicate";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { env, MEDIA_DIR } from "../config.js";

let _replicate: Replicate | null = null;
function replicate(): Replicate {
  if (!_replicate) _replicate = new Replicate({ auth: env.REPLICATE_API_TOKEN });
  return _replicate;
}

// Image-to-video model. Defaults to Wan 2.7 (current at time of writing —
// Kling v2.1 was retired). Override with VIDEO_MODEL env var if needed.
const VIDEO_MODEL =
  (process.env.VIDEO_MODEL as `${string}/${string}` | undefined) ??
  (process.env.KLING_MODEL as `${string}/${string}` | undefined) ??
  "wan-video/wan-2.7-i2v";

export interface VideoResult {
  localPath: string;
  sourceUrl: string;
  byteSize: number;
}

async function extractUrl(output: unknown): Promise<string> {
  // Replicate can return: string URL, string[], FileOutput (ReadableStream with .url())
  if (typeof output === "string") return output;
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === "string") return first;
    return extractUrl(first);
  }
  if (output && typeof output === "object") {
    const anyOut = output as { url?: () => URL | string };
    if (typeof anyOut.url === "function") {
      const u = anyOut.url();
      return u instanceof URL ? u.toString() : String(u);
    }
  }
  throw new Error(`video: unable to extract URL from Kling output: ${JSON.stringify(output).slice(0, 200)}`);
}

export async function generateVideo(
  imagePath: string,
  motionPrompt: string,
  aspect: "9:16" | "1:1" | "16:9",
  adId: string,
  duration: 5 | 10 = 5
): Promise<VideoResult> {
  const imageBuffer = await readFile(imagePath);

  // Replicate's Prefer: wait header maxes at 60 seconds. Video generation
  // typically takes 60–180s, so use the max blocking wait then poll.
  // Wan 2.7 expects `first_frame` (image), `prompt`, `duration`, and derives
  // aspect ratio from the input frame.
  const output = await replicate().run(VIDEO_MODEL, {
    input: {
      first_frame: imageBuffer,
      prompt: motionPrompt,
      duration,
      resolution: "720p",
    },
    wait: { mode: "block", interval: 3000, timeout: 60 },
  });

  const sourceUrl = await extractUrl(output);
  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`video: failed to download Kling output (${res.status})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const localPath = join(MEDIA_DIR, `${adId}.mp4`);
  await writeFile(localPath, buffer);

  return { localPath, sourceUrl, byteSize: buffer.byteLength };
}
