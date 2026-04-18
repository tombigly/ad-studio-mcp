import { createReadStream, statSync, existsSync } from "node:fs";
import { resolve, normalize } from "node:path";
import { MEDIA_DIR } from "@/lib/mcp";
import type { Readable } from "node:stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mp4":
      return "video/mp4";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const joined = normalize(path.join("/"));
  if (joined.includes("..") || joined.startsWith("/")) {
    return new Response("Invalid path", { status: 400 });
  }
  const fullPath = resolve(MEDIA_DIR, joined);
  if (!fullPath.startsWith(MEDIA_DIR)) {
    return new Response("Out of bounds", { status: 400 });
  }
  if (!existsSync(fullPath)) {
    return new Response("Not found", { status: 404 });
  }

  const stat = statSync(fullPath);
  const nodeStream = createReadStream(fullPath);
  const webStream = nodeStreamToWeb(nodeStream);

  return new Response(webStream, {
    headers: {
      "content-type": contentTypeFor(fullPath),
      "content-length": String(stat.size),
      "cache-control": "private, max-age=3600",
    },
  });
}

function nodeStreamToWeb(node: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      node.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk)));
      node.on("end", () => controller.close());
      node.on("error", (err) => controller.error(err));
    },
    cancel() {
      node.destroy();
    },
  });
}
