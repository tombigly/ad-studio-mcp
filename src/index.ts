#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { db, setConfig } from "./db.js";
import { runPipeline } from "./gen/pipeline.js";
import { createBrand, enrichBrandFromUrl } from "./brands.js";
import { publishAd, getPostStatus } from "./publish.js";

const server = new McpServer({
  name: "ad-studio",
  version: "0.1.0",
});

const notYet = (tool: string) => ({
  content: [
    {
      type: "text" as const,
      text: `${tool} is scaffolded but not yet implemented. Wired up in Hour 2.`,
    },
  ],
});

server.registerTool(
  "create_brand",
  {
    title: "Create brand",
    description:
      "Create a brand profile from plain input. Never calls AI — always works. Use enrich_brand afterwards if you want Gemini to fill in pillars / do-list / don't-list automatically.",
    inputSchema: {
      name: z.string().min(1).describe("Brand display name"),
      url: z.string().url().optional().describe("Brand website URL"),
      voice: z.string().optional().describe("Optional voice description"),
      audiences: z
        .array(z.string())
        .optional()
        .describe("Optional list of target audiences"),
      pillars: z
        .array(z.string())
        .optional()
        .describe("Optional list of brand pillars"),
      do_list: z
        .array(z.string())
        .optional()
        .describe("Optional list of things to always do"),
      dont_list: z
        .array(z.string())
        .optional()
        .describe("Optional list of things to never do"),
    },
  },
  async ({ name, url, voice, audiences, pillars, do_list, dont_list }) => {
    try {
      const result = await createBrand({
        name,
        url,
        voice,
        audiences,
        pillars,
        do_list,
        dont_list,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `create_brand failed: ${message}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "enrich_brand",
  {
    title: "Enrich brand with AI",
    description:
      "Optional. Uses Gemini to fill in missing BrandSystem fields by reading the brand's URL. Costs one Gemini call. User-provided values (voice / audiences / etc.) are preserved; only empty slots are filled.",
    inputSchema: {
      brand_id: z.string().describe("ID of an existing brand"),
      url: z
        .string()
        .url()
        .optional()
        .describe("Optional override for the brand's stored URL"),
    },
  },
  async ({ brand_id, url }) => {
    try {
      const result = await enrichBrandFromUrl({ brand_id, url });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `enrich_brand failed: ${message}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "list_brands",
  {
    title: "List brands",
    description: "Return every saved brand.",
    inputSchema: {},
  },
  async () => {
    const rows = db.prepare("SELECT id, name, url, created_at FROM brands").all();
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
    };
  }
);

server.registerTool(
  "generate_ad",
  {
    title: "Generate ad",
    description:
      "Run the full pipeline: prompt split, Nano Banana hero frame, Kling I2V clip, per-platform captions. Blocks 60-120 seconds. Returns ad_id.",
    inputSchema: {
      brand_id: z.string().describe("Brand to generate for"),
      prompt: z.string().min(1).describe("What the ad should show and say"),
      platforms: z
        .array(
          z.enum(["x", "instagram", "tiktok", "facebook", "youtube"])
        )
        .min(1)
        .describe("Which platforms to target"),
      aspect: z
        .enum(["9:16", "1:1", "16:9"])
        .default("9:16")
        .describe("Aspect ratio; 9:16 is the safe default"),
      creative_type: z
        .enum(["still", "video", "both"])
        .default("still")
        .describe(
          "still: image only (free-ish on Gemini). video: Kling motion, ~$0.25 Replicate. both: image AND video, publish either per platform."
        ),
    },
  },
  async ({ brand_id, prompt, platforms, aspect, creative_type }) => {
    try {
      const result = await runPipeline({
        brand_id,
        prompt,
        platforms,
        aspect,
        creative_type,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `generate_ad failed: ${message}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "list_ads",
  {
    title: "List ads",
    description: "Browse generated ads, optionally filtered by brand or status.",
    inputSchema: {
      brand_id: z.string().optional(),
      status: z
        .enum(["draft", "approved", "publishing", "published", "failed"])
        .optional(),
    },
  },
  async ({ brand_id, status }) => {
    const clauses: string[] = [];
    const args: unknown[] = [];
    if (brand_id) {
      clauses.push("brand_id = ?");
      args.push(brand_id);
    }
    if (status) {
      clauses.push("status = ?");
      args.push(status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = db
      .prepare(
        `SELECT id, brand_id, prompt, status, platforms, created_at FROM ads ${where} ORDER BY created_at DESC`
      )
      .all(...args);
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
    };
  }
);

server.registerTool(
  "approve_ad",
  {
    title: "Approve ad",
    description: "Mark an ad as approved and ready to publish.",
    inputSchema: {
      ad_id: z.string().describe("The ad to approve"),
    },
  },
  async ({ ad_id }) => {
    const row = db
      .prepare("SELECT id, status FROM ads WHERE id = ?")
      .get(ad_id) as { id: string; status: string } | undefined;
    if (!row) {
      return {
        content: [{ type: "text", text: `ad ${ad_id} not found` }],
        isError: true,
      };
    }
    if (row.status !== "draft") {
      return {
        content: [
          { type: "text", text: `ad ${ad_id} is ${row.status}, cannot approve` },
        ],
        isError: true,
      };
    }
    db.prepare("UPDATE ads SET status = 'approved' WHERE id = ?").run(ad_id);
    return {
      content: [{ type: "text", text: JSON.stringify({ ad_id, status: "approved" }) }],
    };
  }
);

server.registerTool(
  "publish_ad",
  {
    title: "Publish ad",
    description:
      "POST an approved ad to every configured platform webhook. Optionally schedule for later.",
    inputSchema: {
      ad_id: z.string(),
      when: z
        .string()
        .datetime()
        .optional()
        .describe("ISO timestamp; omit to publish now"),
    },
  },
  async ({ ad_id, when }) => {
    try {
      const result = await publishAd({ ad_id, when });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `publish_ad failed: ${message}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_post_status",
  {
    title: "Get post status",
    description: "Return the per-platform publish status for an ad.",
    inputSchema: {
      ad_id: z.string(),
    },
  },
  async ({ ad_id }) => {
    const rows = getPostStatus(ad_id);
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
    };
  }
);

server.registerTool(
  "configure_webhook",
  {
    title: "Configure platform webhook",
    description:
      "Save the Pipedream webhook URL for a given platform. Called once per platform during setup.",
    inputSchema: {
      platform: z.enum(["x", "instagram", "tiktok", "facebook", "youtube"]),
      url: z.string().url(),
    },
  },
  async ({ platform, url }) => {
    setConfig(`webhook.${platform}`, url);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ platform, url, saved: true }),
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
