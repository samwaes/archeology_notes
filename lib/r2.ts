import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | null = null;

export function r2Configuration() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() || "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || "";
  const bucket = process.env.R2_BUCKET?.trim() || "archeology-notes";
  const endpoint = process.env.R2_ENDPOINT?.trim() || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint,
    configured: Boolean(accountId && accessKeyId && secretAccessKey && bucket && endpoint)
  };
}

function getR2Client() {
  const config = r2Configuration();
  if (!config.configured) throw new Error("Cloudflare R2 is not configured for Archeology Notes.");

  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
    });
  }
  return client;
}

export async function validateR2Connection() {
  const config = r2Configuration();
  await getR2Client().send(new ListObjectsV2Command({ Bucket: config.bucket, MaxKeys: 1 }));
  return { bucket: config.bucket };
}

export async function putRecordAsset(input: {
  key: string;
  body: Uint8Array;
  contentType?: string | null;
  metadata?: Record<string, string>;
}) {
  const config = r2Configuration();
  await getR2Client().send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType || undefined,
    Metadata: input.metadata
  }));
  return input.key;
}

export async function getR2Object(key: string, range?: string | null) {
  const config = r2Configuration();
  const result = await getR2Client().send(new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Range: range || undefined
  }));
  if (!result.Body) throw new Error("The R2 object has no response body.");
  const bytes = await result.Body.transformToByteArray();
  return {
    bytes,
    contentType: result.ContentType || "application/octet-stream",
    contentLength: result.ContentLength ? Number(result.ContentLength) : bytes.byteLength,
    contentRange: result.ContentRange || null,
    acceptRanges: result.AcceptRanges || "bytes",
    etag: result.ETag || null,
    lastModified: result.LastModified || null
  };
}

export async function signedAssetUrl(key: string, expiresInSeconds = 900) {
  const config = r2Configuration();
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    { expiresIn: expiresInSeconds }
  );
}
