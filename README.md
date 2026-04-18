# Ad Studio MCP

Generate and publish AI video ads to X, Instagram, TikTok, Facebook, and YouTube — directly from Claude Code.

Pipeline: **Gemini Nano Banana** (hero frame) → **Replicate Kling v2.1** (image-to-video) → **Gemini Flash** (per-platform captions) → **Cloudflare R2** (public media URL) → **Pipedream webhooks** (publish).

Built for Emerge Hackathon 2026.

---

## Install

```jsonc
// ~/.claude/mcp.json
{
  "mcpServers": {
    "ad-studio": {
      "command": "npx",
      "args": ["-y", "@adnowmarketing/mcp"],
      "env": {
        "GEMINI_API_KEY": "...",
        "REPLICATE_API_TOKEN": "...",
        "R2_ACCOUNT_ID": "...",
        "R2_ACCESS_KEY_ID": "...",
        "R2_SECRET_ACCESS_KEY": "...",
        "R2_BUCKET": "ad-studio-media",
        "R2_PUBLIC_BASE_URL": "https://pub-XXXX.r2.dev"
      }
    }
  }
}
```

Restart Claude Code — 8 tools appear under the `ad-studio` server.

---

## One-Time Setup

### 1. API keys

| Service | Where to get | Why |
|---|---|---|
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) | Image gen (Nano Banana) + captions |
| `REPLICATE_API_TOKEN` | [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens) | Kling image-to-video |

### 2. Cloudflare R2 bucket

```bash
# Install wrangler once
npm i -g wrangler
wrangler login

# Create the bucket
wrangler r2 bucket create ad-studio-media

# Enable the public r2.dev URL so Pipedream can fetch your media
wrangler r2 bucket dev-url enable ad-studio-media
# -> prints https://pub-<hash>.r2.dev  — copy that into R2_PUBLIC_BASE_URL

# Generate an S3 API token (Dashboard → R2 → Manage API Tokens)
# Scope: Object Read & Write on this one bucket.
# Copy the Access Key ID + Secret Access Key.
```

Find your `R2_ACCOUNT_ID` in the Cloudflare dashboard (top-right of the R2 page).

### 3. Pipedream workflows

See [`pipedream-setup.md`](./pipedream-setup.md) for the complete guide. Short version:

1. Create one Pipedream workflow per platform you want to post to.
2. Trigger: **HTTP / Webhook** (generates a URL like `https://eo...m.pipedream.net`).
3. Second step: the native social action for that platform (Instagram, TikTok, Facebook, YouTube, X).
4. Copy each webhook URL back into Claude Code:

   > *"configure_webhook for instagram: https://eo...m.pipedream.net"*

You only have to do this once per platform.

---

## Usage

In Claude Code, just talk to it:

> *"Create a brand for Acme Coffee from acmecoffee.com"*
>
> *"Generate a 9:16 ad for their cold brew launch on all platforms"*
>
> *"Show me the ad, then approve it and publish to Instagram and TikTok now"*
>
> *"Check the post status"*

---

## Tool Reference

| Tool | Purpose |
|---|---|
| `create_brand(name, url?, voice?, audiences?)` | Fetch the site, extract voice + audiences into a BrandSystem JSON, store locally |
| `list_brands()` | Return all saved brands |
| `generate_ad(brand_id, prompt, platforms[], aspect?)` | Full pipeline: split → image → Kling → captions. Blocks 60–120s. Returns `ad_id`. |
| `list_ads(brand_id?, status?)` | Browse generated ads |
| `approve_ad(ad_id)` | Flip status `draft → approved` |
| `publish_ad(ad_id, when?)` | Upload to R2, POST to every configured platform webhook in parallel |
| `get_post_status(ad_id)` | Read per-platform publish status and webhook responses |
| `configure_webhook(platform, url)` | Save a Pipedream webhook URL for a platform |

---

## Cost Per Generated Ad

| Item | Cost |
|---|---|
| Gemini 2.5 Flash Image (Nano Banana) | ~$0.04 (free tier covers most dev) |
| Replicate Kling v2.1 standard, 5s @ 720p | ~$0.25 |
| Gemini Flash captions + prompt split | <$0.001 |
| R2 storage | ~$0.015 per GB-month |
| Pipedream free tier | 100k invocations/month free |
| **Total per ad** | **~$0.30** |

No recurring subscription from us. You bring your own keys and pay your own inference.

---

## Local Development

```bash
git clone <your fork>
cd ad-studio-mcp
npm install
npm run build
npm run dev   # hot-reload via tsx
```

Point Claude Code at your local build:

```jsonc
{
  "mcpServers": {
    "ad-studio": {
      "command": "node",
      "args": ["/absolute/path/to/ad-studio-mcp/dist/index.js"],
      "env": { "GEMINI_API_KEY": "...", "...": "..." }
    }
  }
}
```

Local state lives at `~/.ad-studio/`:
- `db.sqlite` — brands, ads, posts, config
- `media/` — generated images and videos (pre-upload)

Override the home directory with `AD_STUDIO_HOME`.

---

## Troubleshooting

- **"no webhook configured"** — call `configure_webhook` once per platform you want to publish to.
- **Media URL 403s** — your R2 bucket's public r2.dev URL isn't enabled. Run `wrangler r2 bucket dev-url enable ad-studio-media`.
- **Kling rejects a prompt** — loosen the language in your prompt (Kling refuses some realistic-person / brand-likeness prompts).
- **`generate_ad` times out** — Kling can take 60–180s. The server's internal timeout is 5 minutes; if a job exceeds that, it fails cleanly.

---

## Roadmap

Not in v0.1 — planned:

- Scheduling beyond Pipedream's native delay
- Multi-variant generation and A/B batching
- Analytics read-back from Pipedream
- Burned-in captions via Remotion
- Local ComfyUI fallback for power users

---

## License

MIT
