import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/current-user";
import { createSpatialObservation } from "@/lib/spatial";
import { type Visibility } from "@/lib/records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VISIBILITIES = new Set<Visibility>(["private", "project", "public"]);

export async function POST(request: Request) {
  const user = await requireCurrentUser();
  try {
    const body = await request.json() as Record<string, unknown>;
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const representationId = typeof body.representationId === "string" ? body.representationId : "";
    const siteId = typeof body.siteId === "string" && body.siteId ? body.siteId : null;
    const physicalObjectId = typeof body.physicalObjectId === "string" && body.physicalObjectId ? body.physicalObjectId : null;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const visibility = (typeof body.visibility === "string" ? body.visibility : "project") as Visibility;
    const point = Array.isArray(body.point) ? body.point.map(Number) : [];

    if (!projectId || !representationId) return NextResponse.json({ error: "Project and representation are required." }, { status: 400 });
    if (!VISIBILITIES.has(visibility)) return NextResponse.json({ error: "Invalid visibility." }, { status: 400 });
    if (point.length !== 3 || !point.every(Number.isFinite)) return NextResponse.json({ error: "A valid XYZ point is required." }, { status: 400 });
    if (!title && !description) return NextResponse.json({ error: "Add a title or observation before saving." }, { status: 400 });

    const result = await createSpatialObservation({
      projectId,
      representationId,
      siteId,
      physicalObjectId,
      authorId: user.localUserId,
      title: title || "Spatial observation",
      description: description || null,
      visibility,
      x: point[0],
      y: point[1],
      z: point[2]
    });
    return NextResponse.json({ ...result, recordUrl: `/records/${result.recordId}` }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the spatial observation.";
    console.error("[workspace.annotation]", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
