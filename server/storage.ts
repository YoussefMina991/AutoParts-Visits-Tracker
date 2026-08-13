/**
 * File storage — uses AWS S3 if configured, otherwise saves locally to /uploads.
 * For photos uploaded during branch check-in.
 */
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function appendHashSuffix(relKey: string): string {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(relKey.replace(/^\/+/, ""));

  // Use AWS S3 if configured
  const s3Bucket = process.env.AWS_S3_BUCKET;
  const s3Region = process.env.AWS_REGION ?? "us-east-1";

  if (s3Bucket) {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({ region: s3Region });
    await client.send(new PutObjectCommand({
      Bucket: s3Bucket,
      Key: key,
      Body: data instanceof Uint8Array ? Buffer.from(data) : data,
      ContentType: contentType,
    }));
    const url = `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${key}`;
    return { key, url };
  }

  // Fallback: save locally
  ensureUploadsDir();
  const filePath = path.join(UPLOADS_DIR, key.replace(/\//g, "_"));
  fs.writeFileSync(filePath, data instanceof Uint8Array ? Buffer.from(data) : data);
  const url = `/uploads/${path.basename(filePath)}`;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = relKey.replace(/^\/+/, "");
  return { key, url: `/uploads/${key.replace(/\//g, "_")}` };
}
