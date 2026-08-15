import { requireCurrentUser } from "@/lib/current-user";
import { getR2Object } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const manuals: Record<string, { key: string; filename: string }> = {
  "quick-start.pdf": {
    key: "manuals/Archeology-Notes-Quick-Start.pdf",
    filename: "Archeology-Notes-Quick-Start.pdf"
  },
  "user-manual.pdf": {
    key: "manuals/Archeology-Notes-User-Manual.pdf",
    filename: "Archeology-Notes-User-Manual.pdf"
  }
};

export async function GET(_request: Request, { params }: { params: Promise<{ document: string }> }) {
  await requireCurrentUser();
  const { document } = await params;
  const manual = manuals[document];
  if (!manual) return new Response("Manual not found", { status: 404 });

  try {
    const object = await getR2Object(manual.key);
    const body = object.bytes.buffer.slice(object.bytes.byteOffset, object.bytes.byteOffset + object.bytes.byteLength) as ArrayBuffer;
    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(object.contentLength),
        "Content-Disposition": `attachment; filename="${manual.filename}"`,
        "Cache-Control": "private, max-age=300"
      }
    });
  } catch (error) {
    console.error("[manual.download]", { document, message: error instanceof Error ? error.message : "unknown error" });
    return new Response("The manual is temporarily unavailable.", { status: 503 });
  }
}
