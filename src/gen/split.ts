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

export interface PromptSplit {
  scene_prompt: string;
  motion_prompt: string;
}

const SYSTEM = `You split a user's ad prompt into two sub-prompts for an image-to-video pipeline.
- scene_prompt: a rich, detailed description of the still hero frame (subject, composition, lighting, palette, product detail). No motion words.
- motion_prompt: a short description of camera and subject motion only (e.g. "slow dolly in, steam rising, product rotates"). No scene details.

Return ONLY a JSON object: {"scene_prompt": "...", "motion_prompt": "..."}. No prose, no markdown fence.`;

export async function splitPrompt(userPrompt: string): Promise<PromptSplit> {
  const response = await withRetry(
    () =>
      ai().models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts: [{ text: `${SYSTEM}\n\nUser prompt:\n${userPrompt}` }] },
        ],
        config: {
          responseMimeType: "application/json",
          temperature: 0.4,
          maxOutputTokens: 1024,
        },
      }),
    { label: "splitPrompt" }
  );

  const text = response.text ?? "";
  let parsed: Partial<PromptSplit> = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {};
  }

  // Gemini sometimes returns empty fields (safety filter, refusal, or just
  // a blank response on edge-case prompts). For a demo flow we never want to
  // hard-fail here — the user already wrote a prompt, fall back to it.
  return {
    scene_prompt: parsed.scene_prompt?.trim() || userPrompt,
    motion_prompt:
      parsed.motion_prompt?.trim() ||
      "subtle ambient motion, gentle camera drift",
  };
}
