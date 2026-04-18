import { GoogleGenAI } from "@google/genai";
import { nanoid } from "nanoid";
import { db } from "./db.js";
import { getActiveGeminiKey } from "./tier.js";
import { withRetry } from "./gemini-retry.js";

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

export interface BrandSystem {
  voice: string;
  pillars: string[];
  audiences: string[];
  do_list: string[];
  dont_list: string[];
  palette_hints?: string[];
  offers?: string[];
}

const DEFAULT_VOICE = "clear, friendly, honest";

const SYSTEM = `You build a BrandSystem JSON from website text and/or user hints.

Return ONLY this JSON shape:
{
  "voice": "short description of tone and voice",
  "pillars": ["3-5 brand pillars"],
  "audiences": ["3 audience personas, one line each"],
  "do_list": ["3-5 things to always do in copy"],
  "dont_list": ["3-5 things to never do in copy"],
  "palette_hints": ["optional color palette hints"],
  "offers": ["optional core offers or products"]
}`;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchSiteText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "ad-studio-mcp/0.1" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    return stripHtml(html).slice(0, 20_000);
  } catch {
    return "";
  }
}

export interface CreateBrandArgs {
  name: string;
  url?: string;
  voice?: string;
  audiences?: string[];
  pillars?: string[];
  do_list?: string[];
  dont_list?: string[];
}

/**
 * AI-free brand creation. Never calls Gemini, never fetches the URL.
 * Whatever the user typed becomes the BrandSystem. Missing optional fields
 * get sensible empty defaults so the shape is consistent.
 */
export async function createBrand(args: CreateBrandArgs): Promise<{
  brand_id: string;
  brand: BrandSystem;
}> {
  if (!args.name?.trim()) throw new Error("createBrand: name is required");

  const brand: BrandSystem = {
    voice: args.voice?.trim() || DEFAULT_VOICE,
    pillars: args.pillars ?? [],
    audiences: args.audiences ?? [],
    do_list: args.do_list ?? [],
    dont_list: args.dont_list ?? [],
  };

  const id = nanoid(10);
  await db.prepare(
    `INSERT INTO brands (id, name, url, brand_json, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(id, args.name.trim(), args.url ?? null, JSON.stringify(brand), Date.now());

  return { brand_id: id, brand };
}

export interface EnrichBrandArgs {
  brand_id: string;
  /** Override the brand's stored URL if you want to pull from a different site. */
  url?: string;
}

/**
 * Optional AI enrichment. Merges Gemini-generated BrandSystem fields over the
 * existing brand row. On failure, the existing row is untouched — so a failed
 * Gemini call never loses what the user already has.
 */
export async function enrichBrandFromUrl(args: EnrichBrandArgs): Promise<{
  brand_id: string;
  brand: BrandSystem;
  used_site_text: boolean;
}> {
  const row = (await db
    .prepare("SELECT id, name, url, brand_json FROM brands WHERE id = ?")
    .get(args.brand_id)) as
    | { id: string; name: string; url: string | null; brand_json: string }
    | undefined;
  if (!row) throw new Error(`enrichBrand: brand ${args.brand_id} not found`);

  const existing = JSON.parse(row.brand_json) as BrandSystem;
  const sourceUrl = args.url ?? row.url ?? undefined;
  const siteText = sourceUrl ? await fetchSiteText(sourceUrl) : "";
  const hints = [
    existing.voice ? `Current voice: ${existing.voice}` : "",
    existing.audiences?.length
      ? `Current audiences: ${existing.audiences.join("; ")}`
      : "",
    siteText ? `Website text:\n${siteText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const userMsg = `Brand name: ${row.name}\n${sourceUrl ? `Website: ${sourceUrl}\n` : ""}\n${hints || "No hints — infer a reasonable BrandSystem from the name."}`;

  const response = await withRetry(
    () =>
      ai().models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: `${SYSTEM}\n\n${userMsg}` }] }],
        config: {
          responseMimeType: "application/json",
          temperature: 0.5,
        },
      }),
    { label: "enrichBrand" }
  );

  const text = response.text ?? "";
  let generated: BrandSystem;
  try {
    generated = JSON.parse(text);
  } catch {
    throw new Error(`enrichBrand: Gemini did not return JSON. Got: ${text.slice(0, 200)}`);
  }

  // Merge: Gemini fills in everything, but user-typed non-default values win.
  const merged: BrandSystem = {
    voice:
      existing.voice && existing.voice !== DEFAULT_VOICE
        ? existing.voice
        : generated.voice ?? existing.voice ?? DEFAULT_VOICE,
    pillars: existing.pillars?.length ? existing.pillars : generated.pillars ?? [],
    audiences: existing.audiences?.length ? existing.audiences : generated.audiences ?? [],
    do_list: existing.do_list?.length ? existing.do_list : generated.do_list ?? [],
    dont_list: existing.dont_list?.length ? existing.dont_list : generated.dont_list ?? [],
    palette_hints: generated.palette_hints ?? existing.palette_hints,
    offers: generated.offers ?? existing.offers,
  };

  await db.prepare("UPDATE brands SET brand_json = ? WHERE id = ?").run(
    JSON.stringify(merged),
    row.id
  );

  return {
    brand_id: row.id,
    brand: merged,
    used_site_text: siteText.length > 0,
  };
}
