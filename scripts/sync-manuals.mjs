import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID?.trim() || "";
const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || "";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || "";
const bucket = process.env.R2_BUCKET?.trim() || "archeology-notes";
const endpoint = process.env.R2_ENDPOINT?.trim() || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !endpoint) {
  throw new Error("R2 configuration is incomplete; user manuals cannot be synchronized.");
}

const client = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey }
});

const manuals = [
  { file: "Archeology-Notes-Quick-Start.pdf", key: "manuals/Archeology-Notes-Quick-Start.pdf", kind: "quick-start" },
  { file: "Archeology-Notes-User-Manual.pdf", key: "manuals/Archeology-Notes-User-Manual.pdf", kind: "user-manual" }
];

for (const manual of manuals) {
  const bytes = await readFile(join(process.cwd(), "manuals", manual.file));
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: manual.key,
    Body: bytes,
    ContentType: "application/pdf",
    CacheControl: "private, max-age=300",
    Metadata: {
      purpose: "archeology-notes-user-documentation",
      document: manual.kind,
      release: "testing-2026-08-15"
    }
  }));
  console.log(`[manuals] synchronized ${manual.key} (${bytes.byteLength} bytes)`);
}
