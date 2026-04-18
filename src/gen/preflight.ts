// Lightweight reachability checks for AI providers. Runs before any expensive
// pipeline stage so credit-depleted accounts fail fast with a clear message,
// instead of silently burning tokens on partial runs.
import { env } from "../config.js";

export interface PreflightResult {
  ok: boolean;
  provider: "gemini" | "replicate";
  hint?: string;
}

const GEMINI_TEST_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export async function pingGemini(): Promise<PreflightResult> {
  try {
    const res = await fetch(`${GEMINI_TEST_URL}?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "ok" }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true, provider: "gemini" };
    const body = await res.text();
    let hint = `HTTP ${res.status}`;
    if (body.includes("prepayment credits")) {
      hint = "Gemini project is out of prepayment credits. Top up at ai.studio/projects, or swap GEMINI_API_KEY for a new key on a free-tier project (aistudio.google.com/apikey).";
    } else if (res.status === 401 || res.status === 403) {
      hint = "Gemini key is invalid or revoked. Rotate it in Settings.";
    } else if (res.status === 429) {
      hint = "Gemini rate limit hit. Wait a minute or top up billing.";
    } else {
      hint = `Gemini error: ${body.slice(0, 160)}`;
    }
    return { ok: false, provider: "gemini", hint };
  } catch (err) {
    return {
      ok: false,
      provider: "gemini",
      hint: `Could not reach Gemini: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function pingReplicate(): Promise<PreflightResult> {
  try {
    const res = await fetch("https://api.replicate.com/v1/account", {
      headers: { Authorization: `Bearer ${env.REPLICATE_API_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true, provider: "replicate" };
    const body = await res.text();
    let hint = `HTTP ${res.status}`;
    if (res.status === 401) {
      hint = "Replicate token invalid. Rotate in Settings.";
    } else if (res.status === 402 || body.includes("billing")) {
      hint = "Replicate out of credits. Top up at replicate.com/account/billing.";
    } else {
      hint = `Replicate error: ${body.slice(0, 160)}`;
    }
    return { ok: false, provider: "replicate", hint };
  } catch (err) {
    return {
      ok: false,
      provider: "replicate",
      hint: `Could not reach Replicate: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Run all the checks needed for a given creative type. Returns the first
 * failure with a crisp user-facing hint, or null if everything is reachable.
 */
export async function preflight(opts: { needsGemini: boolean; needsReplicate: boolean }): Promise<PreflightResult | null> {
  if (opts.needsGemini) {
    const g = await pingGemini();
    if (!g.ok) return g;
  }
  if (opts.needsReplicate) {
    const r = await pingReplicate();
    if (!r.ok) return r;
  }
  return null;
}
