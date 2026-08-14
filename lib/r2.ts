import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

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
