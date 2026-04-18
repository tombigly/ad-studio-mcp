import { basename } from "node:path";

// Given an absolute local media path, return a URL the browser can fetch
// via our /api/media route. Prefers R2 public URL if already uploaded.
export function mediaUrl(opts: {
  localPath: string | null;
  r2Url: string | null;
}): string | null {
  if (opts.r2Url) return opts.r2Url;
  if (!opts.localPath) return null;
  return `/api/media/${basename(opts.localPath)}`;
}
