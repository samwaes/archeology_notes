import { getDatabase } from "@/lib/db";

export async function validateRecordContext(projectId: string, siteId: string | null, physicalObjectId: string | null) {
  if (siteId) {
    const site = await getDatabase().query(
      `SELECT 1 FROM archeology_sites WHERE id = $1::uuid AND project_id = $2::uuid`,
      [siteId, projectId]
    );
    if (!site.rowCount) throw new Error("The selected site does not belong to this project.");
  }

  if (physicalObjectId) {
    const object = await getDatabase().query(
      `SELECT object.site_id
       FROM archeology_physical_objects object
       JOIN archeology_sites site ON site.id = object.site_id
       WHERE object.id = $1::uuid AND site.project_id = $2::uuid`,
      [physicalObjectId, projectId]
    );
    if (!object.rowCount) throw new Error("The selected physical object does not belong to this project.");
    if (siteId && String(object.rows[0].site_id) !== siteId) throw new Error("The selected physical object does not belong to the selected site.");
  }
}
