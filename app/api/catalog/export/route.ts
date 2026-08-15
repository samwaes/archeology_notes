import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/current-user";
import { getProjectForUser, listCatalogRecords } from "@/lib/records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csv(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const user = await requireCurrentUser();
  const url = new URL(request.url);
  const slug = url.searchParams.get("project") || "casignana";
  const project = await getProjectForUser(slug, user.localUserId);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const records = await listCatalogRecords(String(project.id), user.localUserId);
  const header = ["record_id", "type", "title", "description", "acquisition_at", "author", "visibility", "status", "site", "object", "filename", "filter", "enhancement", "additional_information"];
  const rows = records.map((record) => [
    record.id, record.recordType, record.title || "", record.description || "", record.acquisitionAt,
    record.authorName || record.authorEmail, record.visibility, record.status, record.siteName || "",
    record.objectName || "", record.assetFilename || "", record.filterName || "", record.enhancement || "",
    record.additionalInformation || ""
  ].map(csv).join(","));

  return new Response([header.join(","), ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${String(project.slug)}-catalog.csv"`,
      "Cache-Control": "private, no-store"
    }
  });
}
