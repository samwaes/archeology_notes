import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/current-user";
import { createDigitalAsset, getProjectForUser } from "@/lib/records";
import { putRecordAsset } from "@/lib/r2";
import { attachWebAssetToRepresentation, getWorkspaceRepresentation } from "@/lib/spatial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MODEL_SIZE = 60 * 1024 * 1024;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "model.glb";
}

export async function POST(request: Request) {
  const user = await requireCurrentUser();
  try {
    const formData = await request.formData();
    const projectSlug = text(formData, "projectSlug");
    const representationId = text(formData, "representationId");
    const project = projectSlug ? await getProjectForUser(projectSlug, user.localUserId) : null;
    if (!project) return NextResponse.json({ error: "You do not have access to this project." }, { status: 403 });
    const representation = await getWorkspaceRepresentation(projectSlug, user.localUserId);
    if (!representation || representation.id !== representationId) return NextResponse.json({ error: "3D representation not found." }, { status: 404 });
    if (!representation.canManage) return NextResponse.json({ error: "Only project owners or admins can replace the web model." }, { status: 403 });

    const upload = formData.get("file");
    const file = upload instanceof File && upload.size > 0 ? upload : null;
    if (!file) return NextResponse.json({ error: "Choose a GLB file first." }, { status: 400 });
    if (file.size > MAX_MODEL_SIZE) return NextResponse.json({ error: "The Phase 3 model uploader currently accepts files up to 60 MB." }, { status: 413 });
    if (!file.name.toLowerCase().endsWith(".glb")) return NextResponse.json({ error: "Upload a browser-ready .glb derivative." }, { status: 400 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const filename = safeFilename(file.name);
    const key = `projects/${project.slug}/representations/${representation.id}/web/${randomUUID()}-${filename}`;
    await putRecordAsset({
      key,
      body: bytes,
      contentType: "model/gltf-binary",
      metadata: {
        representationId: representation.id,
        uploadedBy: user.localUserId,
        role: "web-derivative",
        originalFilename: file.name
      }
    });
    const assetId = await createDigitalAsset({
      projectId: String(project.id),
      originalFilename: file.name,
      mimeType: "model/gltf-binary",
      format: "glb",
      r2Key: key,
      checksumSha256: checksum,
      fileSize: file.size,
      createdBy: user.localUserId
    });
    await attachWebAssetToRepresentation({
      representationId: representation.id,
      projectId: String(project.id),
      assetId,
      actorId: user.localUserId
    });
    return NextResponse.json({ ok: true, assetId, filename: file.name, size: file.size }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not upload the web model.";
    console.error("[workspace.model-upload]", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
