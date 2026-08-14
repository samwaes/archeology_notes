"use server";

import { createHash, randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/current-user";
import { validateRecordContext } from "@/lib/context-validation";
import {
  attachAssetToRecord,
  createDigitalAsset,
  createRecord,
  getProjectForUser,
  type RecordType,
  type Visibility
} from "@/lib/records";
import { putRecordAsset } from "@/lib/r2";

const RECORD_TYPES = new Set<RecordType>(["note", "photo", "document", "observation", "measurement", "voice"]);
const VISIBILITIES = new Set<Visibility>(["private", "project", "public"]);
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
}

export async function createRecordAction(formData: FormData) {
  const user = await requireCurrentUser();
  const projectSlug = text(formData, "projectSlug") || "casignana";
  const project = await getProjectForUser(projectSlug, user.localUserId);
  if (!project) throw new Error("You do not have access to this project.");

  const recordTypeInput = text(formData, "recordType") as RecordType;
  const visibilityInput = text(formData, "visibility") as Visibility;
  if (!RECORD_TYPES.has(recordTypeInput)) throw new Error("Invalid record type.");
  if (!VISIBILITIES.has(visibilityInput)) throw new Error("Invalid record visibility.");

  const siteId = text(formData, "siteId") || null;
  const physicalObjectId = text(formData, "physicalObjectId") || null;
  await validateRecordContext(String(project.id), siteId, physicalObjectId);

  const recordId = await createRecord({
    projectId: String(project.id),
    siteId,
    physicalObjectId,
    recordType: recordTypeInput,
    title: text(formData, "title") || null,
    description: text(formData, "description") || null,
    filterName: text(formData, "filterName") || null,
    enhancement: text(formData, "enhancement") || null,
    additionalInformation: text(formData, "additionalInformation") || null,
    acquisitionAt: text(formData, "acquisitionAt") || null,
    visibility: visibilityInput,
    authorId: user.localUserId
  });

  const upload = formData.get("file");
  if (upload instanceof File && upload.size > 0) {
    if (upload.size > MAX_FILE_SIZE) throw new Error("Files larger than 20 MB are not supported by the Phase 1 record uploader yet.");

    const bytes = new Uint8Array(await upload.arrayBuffer());
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const filename = safeFilename(upload.name);
    const key = `projects/${project.slug}/records/${recordId}/original/${randomUUID()}-${filename}`;

    await putRecordAsset({
      key,
      body: bytes,
      contentType: upload.type || "application/octet-stream",
      metadata: { recordId, authorId: user.localUserId, originalFilename: upload.name }
    });

    const extension = upload.name.includes(".") ? upload.name.split(".").pop()?.toLowerCase() || null : null;
    const assetId = await createDigitalAsset({
      projectId: String(project.id),
      originalFilename: upload.name,
      mimeType: upload.type || null,
      format: extension,
      r2Key: key,
      checksumSha256: checksum,
      fileSize: upload.size,
      createdBy: user.localUserId
    });
    await attachAssetToRecord(recordId, assetId, "original");
  }

  revalidatePath("/catalog");
  revalidatePath("/projects");
  redirect(`/records/${recordId}`);
}
