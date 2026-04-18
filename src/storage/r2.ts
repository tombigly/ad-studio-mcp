import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { env, getR2Endpoint, getR2PublicUrlBase } from "../config.js";

let _s3: S3Client | null = null;
function s3(): S3Client {
  if (_s3) return _s3;
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 credentials are not configured (ACCESS_KEY_ID / SECRET_ACCESS_KEY missing)");
  }
  _s3 = new S3Client({
    region: "auto",
    endpoint: getR2Endpoint(),
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return _s3;
}

function guessContentType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
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

export interface UploadResult {
  key: string;
  url: string;
  bytes: number;
}

export async function uploadFile(
  localPath: string,
  keyPrefix: string
): Promise<UploadResult> {
  const file = basename(localPath);
  const key = `${keyPrefix.replace(/\/$/, "")}/${file}`;
  const info = await stat(localPath);

  if (!env.R2_BUCKET) throw new Error("R2_BUCKET is not configured");
  await s3().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: createReadStream(localPath),
      ContentType: guessContentType(localPath),
      ContentLength: info.size,
    })
  );

  return {
    key,
    url: `${getR2PublicUrlBase()}/${key}`,
    bytes: info.size,
  };
}
