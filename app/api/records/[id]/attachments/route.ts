import { createHash, randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/current-user";
import { assertRecordEditor } from "@/lib/record-evidence";
import { attachAssetToRecord, createDigitalAsset, writeAuditEvent } from "@/lib/records";
import { putRecordAsset } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 8;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_TOTAL_SIZE = 100 * 1024 * 1024;
const DOCUMENT_EXTENSIONS = new Set(["pdf", "txt", "csv", "rtf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp"]);

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "attachment";
}

function extension(name: string) {
  const lower = name.toLowerCase();
  return lower.includes(".") ? lower.split(".").pop() || "" : "";
}

function supported(file: File) {
  if (file.type.startsWith("image/") || file.type.startsWith("audio/") || file.type.startsWith("text/")) return true;
  if (file.type === "application/pdf") return true;
  return DOCUMENT_EXTENSIONS.has(extension(file.name));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  try {
    const { id } = await params;
    const context = await assertRecordEditor(id, user.localUserId);
    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
    if (!files.length) return NextResponse.json({ error: "Choose at least one file." }, { status: 400 });
    if (files.length > MAX_FILES) return NextResponse.json({ error: `Add at most ${MAX_FILES} supporting files at a time.` }, { status: 413 });
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (files.some((file) => file.size > MAX_FILE_SIZE) || total > MAX_TOTAL_SIZE) {
      return NextResponse.json({ error: "Keep each supporting file under 25 MB and the upload under 100 MB." }, { status: 413 });
    }
    const unsupported = files.find((file) => !supported(file));
    if (unsupported) return NextResponse.json({ error: `Unsupported attachment type: ${unsupported.name}` }, { status: 400 });

    const created: Array<{ id: string; filename: string; mimeType: string; size: number }> = [];
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const checksum = createHash("sha256").update(bytes).digest("hex");
      const key = `projects/${context.projectSlug}/records/${id}/attachments/${randomUUID()}-${safeFilename(file.name)}`;
      const mimeType = file.type || "application/octet-stream";
      await putRecordAsset({
        key,
        body: bytes,
        contentType: mimeType,
        metadata: { recordId: id, authorId: user.localUserId, originalFilename: file.name, source: "record-edit-attachment" }
      });
      const assetId = await createDigitalAsset({
        projectId: context.projectId,
        originalFilename: file.name,
        mimeType,
        format: extension(file.name) || null,
        r2Key: key,
        checksumSha256: checksum,
        fileSize: file.size,
        createdBy: user.localUserId
      });
      await attachAssetToRecord(id, assetId, "attachment");
      created.push({ id: assetId, filename: file.name, mimeType, size: file.size });
    }

    await writeAuditEvent(context.projectId, user.localUserId, "record.attachments.added", "record", id, {
      count: created.length,
      assetIds: created.map((item) => item.id)
    });
    revalidatePath(`/records/${id}`);
    revalidatePath(`/records/${id}/edit`);
    revalidatePath("/catalog");
    return NextResponse.json({ ok: true, attachments: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not attach files.";
    console.error("[record.attachments]", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
