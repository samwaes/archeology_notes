import { createHash, randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/current-user";
import { validateRecordContext } from "@/lib/context-validation";
import { createFieldRecord, updateFieldTranscription } from "@/lib/field-records";
import {
  attachAssetToRecord,
  createDigitalAsset,
  getProjectForUser,
  type RecordType,
  type Visibility
} from "@/lib/records";
import { putRecordAsset } from "@/lib/r2";
import { transcribeAudio, transcriptionConfiguration } from "@/lib/transcription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELD_TYPES = new Set<RecordType>(["photo", "voice", "note", "measurement", "observation"]);
const VISIBILITIES = new Set<Visibility>(["private", "project", "public"]);
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalNumber(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
}

function defaultTitle(recordType: RecordType) {
  switch (recordType) {
    case "photo": return "Field photo";
    case "voice": return "Voice note";
    case "measurement": return "Measurement";
    case "observation": return "Observation";
    default: return "Field note";
  }
}

export async function POST(request: Request) {
  const user = await requireCurrentUser();

  try {
    const formData = await request.formData();
    const projectSlug = text(formData, "projectSlug");
    const project = projectSlug ? await getProjectForUser(projectSlug, user.localUserId) : null;
    if (!project) return NextResponse.json({ error: "You do not have access to this project." }, { status: 403 });

    const recordType = text(formData, "recordType") as RecordType;
    const visibility = (text(formData, "visibility") || "project") as Visibility;
    if (!FIELD_TYPES.has(recordType)) return NextResponse.json({ error: "Invalid field record type." }, { status: 400 });
    if (!VISIBILITIES.has(visibility)) return NextResponse.json({ error: "Invalid visibility." }, { status: 400 });

    const siteId = text(formData, "siteId") || null;
    const physicalObjectId = text(formData, "physicalObjectId") || null;
    await validateRecordContext(String(project.id), siteId, physicalObjectId);

    const upload = formData.get("file");
    const file = upload instanceof File && upload.size > 0 ? upload : null;
    if ((recordType === "photo" || recordType === "voice") && !file) {
      return NextResponse.json({ error: recordType === "photo" ? "A photo is required." : "An audio recording is required." }, { status: 400 });
    }
    if (file && file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Field files larger than 20 MB are not supported yet." }, { status: 413 });
    }
    if (recordType === "photo" && file && !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "The selected field photo is not an image." }, { status: 400 });
    }
    if (recordType === "voice" && file && !file.type.startsWith("audio/")) {
      return NextResponse.json({ error: "The voice note is not a supported audio file." }, { status: 400 });
    }

    const latitude = optionalNumber(formData, "latitude");
    const longitude = optionalNumber(formData, "longitude");
    const accuracyMeters = optionalNumber(formData, "accuracyMeters");
    const location = latitude !== null && longitude !== null && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
      ? { latitude, longitude, accuracyMeters }
      : null;

    const measurementValue = text(formData, "measurementValue");
    const measurementUnit = text(formData, "measurementUnit");
    const note = text(formData, "description");
    const description = recordType === "measurement" && measurementValue
      ? `${measurementValue}${measurementUnit ? ` ${measurementUnit}` : ""}${note ? ` · ${note}` : ""}`
      : note || null;

    const capturedAtInput = text(formData, "capturedAt");
    const capturedAt = capturedAtInput && !Number.isNaN(Date.parse(capturedAtInput))
      ? new Date(capturedAtInput).toISOString()
      : new Date().toISOString();

    const transcription = transcriptionConfiguration();
    const initialTranscriptionStatus = recordType === "voice"
      ? (transcription.configured ? "pending" : "disabled")
      : "not_requested";

    const recordId = await createFieldRecord({
      projectId: String(project.id),
      projectSlug: String(project.slug),
      siteId,
      physicalObjectId,
      recordType,
      title: text(formData, "title") || defaultTitle(recordType),
      description,
      acquisitionAt: capturedAt,
      visibility,
      authorId: user.localUserId,
      location,
      transcriptionStatus: initialTranscriptionStatus,
      metadata: recordType === "measurement" ? {
        measurement: { value: measurementValue || null, unit: measurementUnit || null }
      } : undefined
    });

    let bytes: Uint8Array | null = null;
    if (file) {
      bytes = new Uint8Array(await file.arrayBuffer());
      const checksum = createHash("sha256").update(bytes).digest("hex");
      const filename = safeFilename(file.name);
      const key = `projects/${project.slug}/records/${recordId}/original/${randomUUID()}-${filename}`;

      await putRecordAsset({
        key,
        body: bytes,
        contentType: file.type || "application/octet-stream",
        metadata: { recordId, authorId: user.localUserId, originalFilename: file.name, source: "field" }
      });

      const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() || null : null;
      const assetId = await createDigitalAsset({
        projectId: String(project.id),
        originalFilename: file.name,
        mimeType: file.type || null,
        format: extension,
        r2Key: key,
        checksumSha256: checksum,
        fileSize: file.size,
        createdBy: user.localUserId
      });
      await attachAssetToRecord(recordId, assetId, "original");
    }

    let transcript: string | null = null;
    let transcriptionStatus = initialTranscriptionStatus;
    if (recordType === "voice" && file && bytes && transcription.configured) {
      try {
        const result = await transcribeAudio({ bytes, filename: file.name, mimeType: file.type });
        transcript = result.text;
        transcriptionStatus = "completed";
        await updateFieldTranscription({
          recordId,
          projectId: String(project.id),
          actorId: user.localUserId,
          status: "completed",
          transcription: result.text,
          provider: result.provider,
          model: result.model
        });
      } catch (error) {
        transcriptionStatus = "failed";
        const message = error instanceof Error ? error.message : "Transcription failed.";
        console.error("[field.transcription]", { recordId, message });
        await updateFieldTranscription({
          recordId,
          projectId: String(project.id),
          actorId: user.localUserId,
          status: "failed",
          provider: transcription.provider,
          model: transcription.model,
          error: message
        });
      }
    }

    revalidatePath("/field");
    revalidatePath("/catalog");
    revalidatePath(`/projects/${project.slug}`);

    return NextResponse.json({
      recordId,
      recordUrl: `/records/${recordId}`,
      transcriptionStatus,
      transcript,
      locationCaptured: Boolean(location)
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Field capture failed.";
    console.error("[field.capture]", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
