import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/current-user";
import { createDigitalAsset, getProjectForUser } from "@/lib/records";
import { putRecordAsset } from "@/lib/r2";
import {
  attachSourceAssetToRepresentation,
  attachWebAssetToRepresentation,
  getWorkspaceRepresentationById
} from "@/lib/spatial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WEB_SIZE = 140 * 1024 * 1024;
const MAX_SOURCE_SIZE = 220 * 1024 * 1024;
const WEB_EXTENSIONS = new Set(["glb", "copc.laz"]);
const SOURCE_EXTENSIONS = new Set(["obj", "glb", "ply", "e57", "las", "laz", "copc.laz"]);

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "representation.bin";
}

function formatFromFilename(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".copc.laz")) return "copc.laz";
  const extension = lower.includes(".") ? lower.split(".").pop() || "" : "";
  return extension;
}

function mimeFor(format: string, fallback: string) {
  if (format === "glb") return "model/gltf-binary";
  if (format === "copc.laz" || format === "laz") return "application/vnd.laszip";
  if (format === "las") return "application/vnd.las";
  if (format === "e57") return "application/octet-stream";
  return fallback || "application/octet-stream";
}

export async function POST(request: Request) {
  const user = await requireCurrentUser();
  try {
    const formData = await request.formData();
    const projectSlug = text(formData, "projectSlug");
    const representationId = text(formData, "representationId");
    const assetKind = text(formData, "assetKind") === "source" ? "source" : "web";
    const project = projectSlug ? await getProjectForUser(projectSlug, user.localUserId) : null;
    if (!project) return NextResponse.json({ error: "You do not have access to this project." }, { status: 403 });
    const representation = representationId ? await getWorkspaceRepresentationById(representationId, user.localUserId) : null;
    if (!representation || representation.projectId !== String(project.id)) return NextResponse.json({ error: "3D representation not found." }, { status: 404 });
    if (!representation.canManage) return NextResponse.json({ error: "Only project owners or admins can manage survey assets." }, { status: 403 });

    const upload = formData.get("file");
    const file = upload instanceof File && upload.size > 0 ? upload : null;
    if (!file) return NextResponse.json({ error: "Choose a representation file first." }, { status: 400 });
    const format = formatFromFilename(file.name);
    const allowed = assetKind === "web" ? WEB_EXTENSIONS : SOURCE_EXTENSIONS;
    if (!allowed.has(format)) {
      return NextResponse.json({
        error: assetKind === "web"
          ? "Browser derivatives must be GLB or COPC (.copc.laz)."
          : "Preservation sources currently accept OBJ, GLB, PLY, E57, LAS, LAZ or COPC."
      }, { status: 400 });
    }
    const maxSize = assetKind === "web" ? MAX_WEB_SIZE : MAX_SOURCE_SIZE;
    if (file.size > maxSize) {
      return NextResponse.json({
        error: `${assetKind === "web" ? "Browser" : "Source"} uploads above ${Math.round(maxSize / 1024 / 1024)} MB need the later multipart ingestion worker.`
      }, { status: 413 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const filename = safeFilename(file.name);
    const key = `projects/${project.slug}/representations/${representation.id}/${assetKind}/${randomUUID()}-${filename}`;
    const mimeType = mimeFor(format, file.type);
    await putRecordAsset({
      key,
      body: bytes,
      contentType: mimeType,
      metadata: {
        representationId: representation.id,
        uploadedBy: user.localUserId,
        role: assetKind === "source" ? "preservation-source" : "web-derivative",
        originalFilename: file.name,
        format
      }
    });
    const assetId = await createDigitalAsset({
      projectId: String(project.id),
      originalFilename: file.name,
      mimeType,
      format,
      r2Key: key,
      checksumSha256: checksum,
      fileSize: file.size,
      createdBy: user.localUserId
    });

    if (assetKind === "source") {
      await attachSourceAssetToRepresentation({
        representationId: representation.id,
        projectId: String(project.id),
        assetId,
        actorId: user.localUserId,
        sourceFormat: format
      });
      if (format === "copc.laz" && text(formData, "useAsWeb") === "true") {
        await attachWebAssetToRepresentation({
          representationId: representation.id,
          projectId: String(project.id),
          assetId,
          actorId: user.localUserId,
          webFormat: "copc.laz"
        });
      }
    } else {
      const pointCountText = text(formData, "pointCount");
      const pointCount = pointCountText && Number.isFinite(Number(pointCountText)) ? Number(pointCountText) : null;
      await attachWebAssetToRepresentation({
        representationId: representation.id,
        projectId: String(project.id),
        assetId,
        actorId: user.localUserId,
        webFormat: format,
        pointCount
      });
    }

    return NextResponse.json({ ok: true, assetId, filename: file.name, size: file.size, format, assetKind }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not upload the representation asset.";
    console.error("[workspace.model-upload]", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
