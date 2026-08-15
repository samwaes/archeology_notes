import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/current-user";
import { getR2Object } from "@/lib/r2";
import { getRepresentationWebAsset } from "@/lib/spatial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ representationId: string }> }) {
  const { representationId } = await params;
  const user = await requireCurrentUser();
  const asset = await getRepresentationWebAsset(representationId, user.localUserId);
  if (!asset) return NextResponse.json({ error: "Model not found or not accessible." }, { status: 404 });

  try {
    const requestedRange = request.headers.get("range");
    const object = await getR2Object(String(asset.r2_key), requestedRange);
    const isPartial = Boolean(requestedRange && object.contentRange);
    return new Response(Buffer.from(object.bytes), {
      status: isPartial ? 206 : 200,
      headers: {
        "Content-Type": String(asset.mime_type || object.contentType || "application/octet-stream"),
        "Content-Length": String(object.contentLength),
        "Accept-Ranges": "bytes",
        ...(object.contentRange ? { "Content-Range": object.contentRange } : {}),
        // Representation assets can be replaced during the pilot. The URL is stable, so browser caching
        // would otherwise keep serving the previous GLB/COPC after a successful replacement upload.
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `inline; filename="${String(asset.original_filename || "representation.bin").replace(/\"/g, "")}"`,
        ...(object.etag ? { ETag: object.etag } : {}),
        ...(object.lastModified ? { "Last-Modified": object.lastModified.toUTCString() } : {})
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read the model asset.";
    console.error("[workspace.model-stream]", { representationId, message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
