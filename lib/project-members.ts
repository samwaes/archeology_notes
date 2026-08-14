import { getDatabase } from "@/lib/db";

export async function listProjectMembers(projectId: string) {
  const result = await getDatabase().query(
    `SELECT member_user.id,
            member_user.email,
            member_user.display_name,
            membership.role,
            membership.created_at
     FROM archeology_project_memberships membership
     JOIN archeology_users member_user ON member_user.id = membership.user_id
     WHERE membership.project_id = $1::uuid
     ORDER BY CASE membership.role
       WHEN 'owner' THEN 0
       WHEN 'admin' THEN 1
       WHEN 'contributor' THEN 2
       ELSE 3
     END,
     member_user.email`,
    [projectId]
  );
  return result.rows;
}
