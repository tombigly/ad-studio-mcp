import { GoogleGenAI } from "@google/genai";
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

export interface PlatformCaptions {
  x: string;
  instagram: string;
  tiktok: string;
  facebook: string;
  youtube: { title: string; description: string };
}

const SYSTEM = `You write native social-ad captions. Given a scene prompt and brand voice, return ONE caption per platform, respecting these rules:

- x: <= 280 chars, hook-first, punchy. 1-3 hashtags max.
- instagram: <= 2200 chars, engaging first line hook, line breaks ok, 3-6 hashtags at end.
- tiktok: <= 2200 chars, strong opening hook, 3-5 trending-style hashtags at end.
- facebook: feed-friendly, 1-3 paragraphs, conversational.
- youtube: object with "title" (<= 100 chars, clickable) and "description" (SEO-friendly, 2-3 paragraphs, include a CTA).

Always append " #ad" or equivalent native disclosure where platform requires. Never output markdown fences.
Return ONLY this JSON shape:
{"x":"...","instagram":"...","tiktok":"...","facebook":"...","youtube":{"title":"...","description":"..."}}`;

export async function generateCaptions(
  scenePrompt: string,
  brandVoice: string,
  platforms: string[]
): Promise<PlatformCaptions> {
  const userMsg = `Scene: ${scenePrompt}\n\nBrand voice: ${brandVoice || "professional, friendly"}\n\nTarget platforms: ${platforms.join(", ")}\n\nReturn captions for ALL five platforms regardless.`;

  const response = await withRetry(
    () =>
      ai().models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: `${SYSTEM}\n\n${userMsg}` }] }],
        config: {
          responseMimeType: "application/json",
          temperature: 0.8,
        },
      }),
    { label: "generateCaptions" }
  );

  const text = response.text ?? "";
  let parsed: PlatformCaptions;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`captions: Gemini did not return JSON. Got: ${text.slice(0, 200)}`);
  }

  for (const key of ["x", "instagram", "tiktok", "facebook", "youtube"] as const) {
    if (!(key in parsed)) {
      throw new Error(`captions: missing ${key} in response`);
    }
  }
  if (!parsed.youtube?.title || !parsed.youtube?.description) {
    throw new Error(`captions: youtube.title/description missing`);
  }

  // Hard-enforce X limit; truncate with ellipsis if the model overshot.
  if (parsed.x.length > 280) parsed.x = parsed.x.slice(0, 277) + "...";
  if (parsed.youtube.title.length > 100)
    parsed.youtube.title = parsed.youtube.title.slice(0, 97) + "...";

  return parsed;
}
