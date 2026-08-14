import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/current-user";
import { getR2Object } from "@/lib/r2";
import { getRepresentationWebAsset } from "@/lib/spatial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ representationId: string }> }) {
  const { representationId } = await params;
  const user = await requireCurrentUser();
  const asset = await getRepresentationWebAsset(representationId, user.localUserId);
  if (!asset) return NextResponse.json({ error: "Model not found or not accessible." }, { status: 404 });

  try {
    const object = await getR2Object(String(asset.r2_key));
    return new Response(Buffer.from(object.bytes), {
      status: 200,
      headers: {
        "Content-Type": String(asset.mime_type || object.contentType || "model/gltf-binary"),
        "Content-Length": String(object.contentLength),
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": `inline; filename="${String(asset.original_filename || "model.glb").replace(/\"/g, "")}"`,
        ...(object.etag ? { ETag: object.etag } : {})
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read the model asset.";
    console.error("[workspace.model-stream]", { representationId, message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
