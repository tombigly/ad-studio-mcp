# Pipedream Setup

This guide wires Pipedream as the last-mile publisher for Ad Studio MCP. You create one workflow per platform. Each workflow starts with an HTTP webhook, then calls the native social-media action. Ad Studio MCP POSTs to these webhooks from `publish_ad`.

## Payload shape

All workflows receive this JSON body:

```json
{
  "ad_id": "abc123",
  "brand_id": "xyz789",
  "brand_name": "Acme Coffee",
  "platform": "instagram",
  "caption": "Cold brew hits different at 7am. #ad",
  "media_url": "https://pub-XXXX.r2.dev/ads/abc123/abc123.mp4",
  "media_type": "video",
  "scheduled_at": null
}
```

YouTube additionally receives `title`:

```json
{
  "platform": "youtube",
  "title": "Meet our new Cold Brew",
  "caption": "Full description with SEO keywords and a CTA. #ad",
  "media_url": "https://pub-XXXX.r2.dev/ads/abc123/abc123.mp4"
}
```

If `scheduled_at` is a timestamp, insert a **Delay Until** step before the post action.

---

## Per-Platform Workflow

Create five separate workflows — one for each platform you want to publish to. Start with only the ones you need.

### Instagram

1. New workflow → Trigger: **HTTP / Webhook Requests**. Copy the generated URL.
2. Add step → App: **Instagram for Business** (connect your account).
3. Action: **Create a Media Container** or **Publish Reel**.
   - `media_url` → `{{steps.trigger.event.body.media_url}}`
   - `caption` → `{{steps.trigger.event.body.caption}}`
4. Deploy.
5. Back in Claude Code:
   > `configure_webhook platform=instagram url=<paste>`

### TikTok

1. HTTP trigger.
2. **TikTok for Business** → **Publish Video** (direct post requires an approved TikTok developer app; if you don't have one, use **Share to TikTok** instead).
3. Map `media_url` + `caption`.

### Facebook

1. HTTP trigger.
2. **Facebook Pages** → **Create Page Post** (or **Publish Reel**).
3. Map `media_url` + `caption`.

### YouTube

1. HTTP trigger.
2. **YouTube (Data API)** → **Upload Video**.
3. Map:
   - `title` → `{{steps.trigger.event.body.title}}`
   - `description` → `{{steps.trigger.event.body.caption}}`
   - `video_file` / `media_url` → `{{steps.trigger.event.body.media_url}}`
   - `tags` → optional
   - For Shorts, ensure the video is ≤60 s and 9:16 (Kling default).

### X (Twitter)

1. HTTP trigger.
2. **X (Twitter)** → **Post Tweet with Media**.
3. Map `media_url` → upload then attach; `caption` → tweet text.
4. Note: X's free API tier no longer supports media upload — you may need X Basic ($200/mo). If that's a blocker, defer X and publish to the other four platforms.

---

## Optional: single dispatcher workflow

If you'd rather keep one URL for all platforms, use a **Code** step with a switch:

```js
// Pipedream Node.js step
export default defineComponent({
  async run({ steps, $ }) {
    const { platform } = steps.trigger.event.body;
    return { route: platform };
  },
});
```

Then add an **If/Else** (or Router) step that branches on `{{steps.dispatch.$return_value.route}}` and calls the right platform action in each branch. You set the same URL for every platform via `configure_webhook`.

This is simpler to manage but slower to debug and harder to monitor per platform. Start with one-per-platform.

---

## Scheduling

Pipedream's built-in **Delay Until** action accepts an ISO timestamp. Place it between the trigger and the post action:

```
Trigger (HTTP)
  → Delay Until {{steps.trigger.event.body.scheduled_at}}
  → Post to platform
```

If `scheduled_at` is `null`, the Delay step is a no-op.

---

## Testing a Workflow

Before wiring real social accounts, point the webhook at Pipedream's own **HTTP Response** preview so you can see what Ad Studio sends. Once the payload looks right, swap in the real action.

You can also test locally:

```bash
curl -X POST https://eo...m.pipedream.net \
  -H 'content-type: application/json' \
  -d '{"ad_id":"test","platform":"instagram","caption":"hello","media_url":"https://example.com/test.mp4"}'
```

---

## Limits to know

- Pipedream free tier: 100k invocations/month.
- Social APIs have their own rate limits (IG: ~25 posts/24h/account, YouTube: 6 uploads/day by default, etc.). Ad Studio doesn't throttle — stay below these yourself.
- Pipedream's HTTP trigger has a 5 MB body limit. Our payloads are tiny (just URLs); no issue.
