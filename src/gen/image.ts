import { GoogleGenAI } from "@google/genai";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MEDIA_DIR } from "../config.js";
import { getActiveGeminiKey } from "../tier.js";
import { withRetry } from "../gemini-retry.js";

let _ai: GoogleGenAI | null = null;
let _aiKey: string | null = null;
function ai(): GoogleGenAI {
  const key = getActiveGeminiKey();
  if (!_ai || _aiKey !== key) {
    _ai = new GoogleGenAI({ apiKey: key });
    _aiKey = key;
  }
  return _ai;
}

const IMAGE_MODEL = "gemini-2.5-flash-image-preview";

export interface ImageResult {
  localPath: string;
  mimeType: string;
  byteSize: number;
}

export async function generateImage(
  scenePrompt: string,
  aspect: "9:16" | "1:1" | "16:9",
  adId: string
): Promise<ImageResult> {
  const aspectDirective = `Aspect ratio: ${aspect}. Vertical=${aspect === "9:16"}.`;
  const fullPrompt = `${scenePrompt}\n\n${aspectDirective}\nHigh detail, commercial photography quality, clean composition suitable as a video first frame.`;

  const response = await withRetry(
    () =>
      ai().models.generateContent({
        model: IMAGE_MODEL,
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      }),
    { label: "generateImage" }
  );

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p) => p.inlineData?.data);
  if (!imgPart?.inlineData?.data) {
    const textPart = parts.find((p) => p.text)?.text ?? "";
    throw new Error(
      `generateImage: no inline image data returned. Text fallback: ${textPart.slice(0, 200)}`
    );
  }

  const mimeType = imgPart.inlineData.mimeType ?? "image/png";
  const ext = mimeType.split("/")[1] ?? "png";
  const buffer = Buffer.from(imgPart.inlineData.data, "base64");
  const localPath = join(MEDIA_DIR, `${adId}-hero.${ext}`);
  await writeFile(localPath, buffer);

  return { localPath, mimeType, byteSize: buffer.byteLength };
}
