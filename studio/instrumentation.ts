// Runs once when the Next server boots (dev or prod).
// We use it to auto-start a localtunnel so publishing works without R2.
export async function register() {
  // Next calls this in edge + node runtimes. Only start in node.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Skip when R2 is already configured — no tunnel needed in that mode.
  if (
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET &&
    process.env.R2_PUBLIC_BASE_URL
  ) {
    return;
  }

  const port = Number(process.env.PORT ?? 3000);
  try {
    const { startTunnel } = await import("./lib/tunnel");
    const url = await startTunnel(port);
    if (url) {
      console.log(`\n  Public media URL → ${url}\n`);
    }
  } catch (err) {
    console.error("[instrumentation] tunnel startup failed:", err);
  }
}
