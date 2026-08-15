import { getDatabase } from "@/lib/db";
import { writeAuditEvent } from "@/lib/records";

export type ProjectMemberRole = "owner" | "admin" | "contributor" | "viewer";

const ROLES = new Set<ProjectMemberRole>(["owner", "admin", "contributor", "viewer"]);

export async function ensureCasignanaPilotMembership(userId: string) {
  await getDatabase().query(
    `INSERT INTO archeology_project_memberships (project_id, user_id, role)
     SELECT project.id, $1::uuid, 'contributor'
     FROM archeology_projects project
     WHERE project.slug = 'casignana'
       AND NOT EXISTS (
         SELECT 1
         FROM archeology_project_memberships membership
         WHERE membership.project_id = project.id AND membership.user_id = $1::uuid
       )
       AND NOT EXISTS (
         SELECT 1
         FROM archeology_audit_events event
         WHERE event.project_id = project.id
           AND event.entity_type = 'user'
           AND event.entity_id = $1::uuid
           AND event.action = 'project.member.removed'
       )
     ON CONFLICT (project_id, user_id) DO NOTHING`,
    [userId]
  );
}

export async function listProjectMembers(projectId: string) {
  const result = await getDatabase().query(
    `SELECT member_user.id,
            member_user.email,
            member_user.display_name,
            member_user.hupla_user_id,
            member_user.last_seen_at,
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

async function actorRole(projectId: string, actorId: string): Promise<ProjectMemberRole | null> {
  const result = await getDatabase().query(
    `SELECT role
     FROM archeology_project_memberships
     WHERE project_id = $1::uuid AND user_id = $2::uuid
     LIMIT 1`,
    [projectId, actorId]
  );
  const role = String(result.rows[0]?.role || "") as ProjectMemberRole;
  return ROLES.has(role) ? role : null;
}

function assertRole(value: string): asserts value is ProjectMemberRole {
  if (!ROLES.has(value as ProjectMemberRole)) throw new Error("Invalid project role.");
}

function assertCanAssign(actor: ProjectMemberRole, requested: ProjectMemberRole) {
  if (!["owner", "admin"].includes(actor)) throw new Error("Only project owners or admins can manage members.");
  if (actor === "admin" && ["owner", "admin"].includes(requested)) {
    throw new Error("Only a project owner can assign owner or admin roles.");
  }
}

async function ensureLocalUser(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new Error("Enter a valid email address.");
  const result = await getDatabase().query(
    `INSERT INTO archeology_users (email)
     VALUES ($1)
     ON CONFLICT (email) DO UPDATE SET updated_at = archeology_users.updated_at
     RETURNING id, email, hupla_user_id`,
    [normalized]
  );
  return result.rows[0];
}

export async function addProjectMember(input: {
  projectId: string;
  actorId: string;
  email: string;
  role: ProjectMemberRole;
}) {
  assertRole(input.role);
  const actor = await actorRole(input.projectId, input.actorId);
  if (!actor) throw new Error("Project membership not found.");
  assertCanAssign(actor, input.role);

  const member = await ensureLocalUser(input.email);
  const existing = await getDatabase().query(
    `SELECT role FROM archeology_project_memberships WHERE project_id = $1::uuid AND user_id = $2::uuid`,
    [input.projectId, String(member.id)]
  );
  const existingRole = existing.rows[0]?.role ? String(existing.rows[0].role) as ProjectMemberRole : null;
  if (actor === "admin" && existingRole && ["owner", "admin"].includes(existingRole)) {
    throw new Error("Only a project owner can change an owner or admin membership.");
  }

  await getDatabase().query(
    `INSERT INTO archeology_project_memberships (project_id, user_id, role)
     VALUES ($1::uuid, $2::uuid, $3)
     ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [input.projectId, String(member.id), input.role]
  );
  await writeAuditEvent(input.projectId, input.actorId, existing.rowCount ? "project.member.role.updated" : "project.member.added", "user", String(member.id), {
    email: String(member.email), role: input.role
  });
  return { userId: String(member.id), email: String(member.email), activated: Boolean(member.hupla_user_id) };
}

export async function updateProjectMemberRole(input: {
  projectId: string;
  actorId: string;
  memberId: string;
  role: ProjectMemberRole;
}) {
  assertRole(input.role);
  const actor = await actorRole(input.projectId, input.actorId);
  if (!actor) throw new Error("Project membership not found.");
  assertCanAssign(actor, input.role);

  const target = await getDatabase().query(
    `SELECT membership.role, member_user.email
     FROM archeology_project_memberships membership
     JOIN archeology_users member_user ON member_user.id = membership.user_id
     WHERE membership.project_id = $1::uuid AND membership.user_id = $2::uuid
     LIMIT 1`,
    [input.projectId, input.memberId]
  );
  if (!target.rowCount) throw new Error("Project member not found.");
  const previousRole = String(target.rows[0].role) as ProjectMemberRole;
  if (actor === "admin" && ["owner", "admin"].includes(previousRole)) {
    throw new Error("Only a project owner can change an owner or admin membership.");
  }

  if (previousRole === "owner" && input.role !== "owner") {
    const owners = await getDatabase().query(
      `SELECT COUNT(*)::int AS count FROM archeology_project_memberships WHERE project_id = $1::uuid AND role = 'owner'`,
      [input.projectId]
    );
    if (Number(owners.rows[0]?.count || 0) <= 1) throw new Error("A project must keep at least one owner.");
  }

  await getDatabase().query(
    `UPDATE archeology_project_memberships SET role = $1 WHERE project_id = $2::uuid AND user_id = $3::uuid`,
    [input.role, input.projectId, input.memberId]
  );
  await writeAuditEvent(input.projectId, input.actorId, "project.member.role.updated", "user", input.memberId, {
    email: String(target.rows[0].email), from: previousRole, to: input.role
  });
}

export async function removeProjectMember(input: { projectId: string; actorId: string; memberId: string }) {
  const actor = await actorRole(input.projectId, input.actorId);
  if (!actor || !["owner", "admin"].includes(actor)) throw new Error("Only project owners or admins can remove members.");

  const target = await getDatabase().query(
    `SELECT membership.role, member_user.email
     FROM archeology_project_memberships membership
     JOIN archeology_users member_user ON member_user.id = membership.user_id
     WHERE membership.project_id = $1::uuid AND membership.user_id = $2::uuid
     LIMIT 1`,
    [input.projectId, input.memberId]
  );
  if (!target.rowCount) return;
  const targetRole = String(target.rows[0].role) as ProjectMemberRole;
  if (actor === "admin" && ["owner", "admin"].includes(targetRole)) throw new Error("Only a project owner can remove an owner or admin.");
  if (targetRole === "owner") {
    const owners = await getDatabase().query(
      `SELECT COUNT(*)::int AS count FROM archeology_project_memberships WHERE project_id = $1::uuid AND role = 'owner'`,
      [input.projectId]
    );
    if (Number(owners.rows[0]?.count || 0) <= 1) throw new Error("The last project owner cannot be removed.");
  }

  await getDatabase().query(
    `DELETE FROM archeology_project_memberships WHERE project_id = $1::uuid AND user_id = $2::uuid`,
    [input.projectId, input.memberId]
  );
  await writeAuditEvent(input.projectId, input.actorId, "project.member.removed", "user", input.memberId, {
    email: String(target.rows[0].email), role: targetRole
  });
}
