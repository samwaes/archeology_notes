import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/current-user";
import { getProjectForUser, listObjectsForProject, listSitesForProject } from "@/lib/records";
import {
  createRepresentation,
  getWorkspaceRepresentationById,
  updateRepresentationRegistration,
  type RegistrationStatus
} from "@/lib/spatial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = new Set(["photogrammetry", "mesh", "point_cloud", "other"]);
const REGISTRATION = new Set<RegistrationStatus>(["unregistered", "approximate", "registered", "verified"]);

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  const user = await requireCurrentUser();
  try {
    const body = await request.json() as Record<string, unknown>;
    const projectSlug = optionalString(body.projectSlug);
    const project = projectSlug ? await getProjectForUser(projectSlug, user.localUserId) : null;
    if (!project) return NextResponse.json({ error: "You do not have access to this project." }, { status: 403 });
    const name = optionalString(body.name);
    const representationType = optionalString(body.representationType) || "point_cloud";
    if (!name) return NextResponse.json({ error: "Representation name is required." }, { status: 400 });
    if (!TYPES.has(representationType)) return NextResponse.json({ error: "Unsupported representation type." }, { status: 400 });
    const registrationStatus = (optionalString(body.registrationStatus) || "unregistered") as RegistrationStatus;
    if (!REGISTRATION.has(registrationStatus)) return NextResponse.json({ error: "Invalid registration status." }, { status: 400 });

    const projectId = String(project.id);
    const siteId = optionalString(body.siteId);
    const physicalObjectId = optionalString(body.physicalObjectId);
    const parentRepresentationId = optionalString(body.parentRepresentationId);
    const [sites, objects, parentRepresentation] = await Promise.all([
      siteId ? listSitesForProject(projectId) : Promise.resolve([]),
      physicalObjectId ? listObjectsForProject(projectId) : Promise.resolve([]),
      parentRepresentationId ? getWorkspaceRepresentationById(parentRepresentationId, user.localUserId) : Promise.resolve(null)
    ]);
    if (siteId && !sites.some((site) => String(site.id) === siteId)) return NextResponse.json({ error: "The selected site does not belong to this project." }, { status: 400 });
    const selectedObject = physicalObjectId ? objects.find((object) => String(object.id) === physicalObjectId) : null;
    if (physicalObjectId && !selectedObject) return NextResponse.json({ error: "The selected physical object does not belong to this project." }, { status: 400 });
    if (selectedObject && siteId && String(selectedObject.site_id) !== siteId) return NextResponse.json({ error: "The selected physical object does not belong to the selected site." }, { status: 400 });
    if (parentRepresentationId && (!parentRepresentation || parentRepresentation.projectId !== projectId)) return NextResponse.json({ error: "The parent representation does not belong to this project." }, { status: 400 });

    const id = await createRepresentation({
      projectId,
      actorId: user.localUserId,
      name,
      representationType,
      siteId,
      physicalObjectId,
      parentRepresentationId,
      acquisitionAt: optionalString(body.acquisitionAt),
      coordinateSystem: optionalString(body.coordinateSystem),
      sourceFormat: optionalString(body.sourceFormat),
      webFormat: optionalString(body.webFormat),
      pointCount: optionalNumber(body.pointCount),
      nominalResolutionMm: optionalNumber(body.nominalResolutionMm),
      registrationRmseMm: optionalNumber(body.registrationRmseMm),
      registrationUncertaintyMm: optionalNumber(body.registrationUncertaintyMm),
      registrationStatus,
      registrationNotes: optionalString(body.registrationNotes)
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the representation.";
    console.error("[workspace.representation-create]", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await requireCurrentUser();
  try {
    const body = await request.json() as Record<string, unknown>;
    const representationId = optionalString(body.representationId);
    if (!representationId) return NextResponse.json({ error: "Representation ID is required." }, { status: 400 });
    const registrationStatus = (optionalString(body.registrationStatus) || "unregistered") as RegistrationStatus;
    if (!REGISTRATION.has(registrationStatus)) return NextResponse.json({ error: "Invalid registration status." }, { status: 400 });
    const matrix = Array.isArray(body.transformMatrix) ? body.transformMatrix.map(Number) : [];
    await updateRepresentationRegistration({
      representationId,
      actorId: user.localUserId,
      transformMatrix: matrix,
      registrationStatus,
      registrationRmseMm: optionalNumber(body.registrationRmseMm),
      registrationUncertaintyMm: optionalNumber(body.registrationUncertaintyMm),
      registrationNotes: optionalString(body.registrationNotes),
      nominalResolutionMm: optionalNumber(body.nominalResolutionMm)
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update registration.";
    console.error("[workspace.registration-update]", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
