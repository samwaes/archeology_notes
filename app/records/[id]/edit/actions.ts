"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/current-user";
import { updateRecord, type RecordStatus, type RecordType, type Visibility } from "@/lib/records";

const RECORD_TYPES = new Set(["note", "photo", "document", "observation", "measurement", "voice", "condition", "intervention"]);
const VISIBILITIES = new Set<Visibility>(["private", "project", "public"]);
const STATUSES = new Set<RecordStatus>(["draft", "reviewed", "verified"]);
function text(formData: FormData, key: string) { const value = formData.get(key); return typeof value === "string" ? value.trim() : ""; }

export async function updateRecordAction(formData: FormData) {
  const user = await requireCurrentUser();const recordId = text(formData, "recordId");const recordTypeInput = text(formData, "recordType");const visibility = text(formData, "visibility") as Visibility;const status = text(formData, "status") as RecordStatus;const acquisitionAt = text(formData, "acquisitionAt");
  if (!recordId) throw new Error("Record ID is required.");if (!RECORD_TYPES.has(recordTypeInput)) throw new Error("Invalid record type.");if (!VISIBILITIES.has(visibility)) throw new Error("Invalid visibility.");if (!STATUSES.has(status)) throw new Error("Invalid record status.");if (!acquisitionAt) throw new Error("Acquisition date is required.");
  await updateRecord({recordId,actorId:user.localUserId,siteId:text(formData,"siteId")||null,physicalObjectId:text(formData,"physicalObjectId")||null,recordType:recordTypeInput as RecordType,title:text(formData,"title")||null,description:text(formData,"description")||null,filterName:text(formData,"filterName")||null,enhancement:text(formData,"enhancement")||null,additionalInformation:text(formData,"additionalInformation")||null,acquisitionAt,visibility,status});
  revalidatePath("/catalog");revalidatePath("/conservation");revalidatePath(`/records/${recordId}`);revalidatePath(`/records/${recordId}/edit`);redirect(`/records/${recordId}`);
}
