import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/current-user";
import { getDatabase } from "@/lib/db";
import { createSpatialObservation } from "@/lib/spatial";
import { writeAuditEvent, type Visibility } from "@/lib/records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VISIBILITIES = new Set<Visibility>(["private", "project", "public"]);
const STATUSES = new Set(["draft", "reviewed", "verified"]);

function optionalId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  const user = await requireCurrentUser();
  try {
    const body = await request.json() as Record<string, unknown>;
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const representationId = typeof body.representationId === "string" ? body.representationId : "";
    const siteId = optionalId(body.siteId);
    const physicalObjectId = optionalId(body.physicalObjectId);
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

export async function PATCH(request: Request) {
  const user = await requireCurrentUser();
  const database = getDatabase();
  try {
    const body = await request.json() as Record<string, unknown>;
    const recordId = typeof body.recordId === "string" ? body.recordId.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const visibility = (typeof body.visibility === "string" ? body.visibility : "project") as Visibility;
    const status = typeof body.status === "string" ? body.status : "draft";
    const siteId = optionalId(body.siteId);
    const physicalObjectId = optionalId(body.physicalObjectId);

    if (!recordId) return NextResponse.json({ error: "Record ID is required." }, { status: 400 });
    if (!title && !description) return NextResponse.json({ error: "Add a title or observation before saving." }, { status: 400 });
    if (!VISIBILITIES.has(visibility)) return NextResponse.json({ error: "Invalid visibility." }, { status: 400 });
    if (!STATUSES.has(status)) return NextResponse.json({ error: "Invalid review status." }, { status: 400 });

    const access = await database.query(
      `SELECT record.project_id, record.author_id, membership.role, annotation.id AS annotation_id
       FROM archeology_records record
       JOIN archeology_spatial_annotations annotation ON annotation.record_id = record.id
       JOIN archeology_project_memberships membership
         ON membership.project_id = record.project_id AND membership.user_id = $2::uuid
       WHERE record.id = $1::uuid
       LIMIT 1`,
      [recordId, user.localUserId]
    );
    const row = access.rows[0];
    if (!row) return NextResponse.json({ error: "Spatial observation not found." }, { status: 404 });
    const projectId = String(row.project_id);
    const canEdit = String(row.author_id) === user.localUserId || ["owner", "admin"].includes(String(row.role));
    if (!canEdit) return NextResponse.json({ error: "You cannot edit this spatial observation." }, { status: 403 });

    if (siteId) {
      const site = await database.query(`SELECT 1 FROM archeology_sites WHERE id = $1::uuid AND project_id = $2::uuid`, [siteId, projectId]);
      if (!site.rowCount) return NextResponse.json({ error: "The selected site does not belong to this project." }, { status: 400 });
    }
    if (physicalObjectId) {
      const object = await database.query(
        `SELECT object.site_id
         FROM archeology_physical_objects object
         JOIN archeology_sites site ON site.id = object.site_id
         WHERE object.id = $1::uuid AND site.project_id = $2::uuid`,
        [physicalObjectId, projectId]
      );
      if (!object.rowCount) return NextResponse.json({ error: "The selected object does not belong to this project." }, { status: 400 });
      if (siteId && String(object.rows[0].site_id) !== siteId) return NextResponse.json({ error: "The selected object does not belong to the selected site." }, { status: 400 });
    }

    await database.query("BEGIN");
    try {
      await database.query(
        `UPDATE archeology_records
         SET title = $1,
             description = $2,
             visibility = $3,
             status = $4,
             site_id = $5::uuid,
             physical_object_id = $6::uuid,
             updated_at = NOW()
         WHERE id = $7::uuid`,
        [title || null, description || null, visibility, status, siteId, physicalObjectId, recordId]
      );
      await database.query(
        `UPDATE archeology_spatial_annotations
         SET site_id = $1::uuid,
             physical_object_id = $2::uuid
         WHERE record_id = $3::uuid`,
        [siteId, physicalObjectId, recordId]
      );
      await database.query("COMMIT");
    } catch (error) {
      await database.query("ROLLBACK");
      throw error;
    }

    await writeAuditEvent(projectId, user.localUserId, "spatial_annotation.review.updated", "spatial_annotation", String(row.annotation_id), {
      recordId,
      visibility,
      status,
      siteId,
      physicalObjectId
    });
    return NextResponse.json({ ok: true, recordId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the spatial observation.";
    console.error("[workspace.annotation.update]", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
