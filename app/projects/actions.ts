"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/current-user";
import { addProjectMember, removeProjectMember, updateProjectMemberRole, type ProjectMemberRole } from "@/lib/project-members";
import {
  createPhysicalObject,
  createProject,
  createSite,
  getProjectForUser,
  updateProject
} from "@/lib/records";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function projectFromForm(formData: FormData, userId: string) {
  const slug = text(formData, "slug");
  const project = slug ? await getProjectForUser(slug, userId) : null;
  if (!project) throw new Error("Project not found.");
  return { slug, project };
}

export async function createProjectAction(formData: FormData) {
  const user = await requireCurrentUser();
  const name = text(formData, "name");
  if (!name) throw new Error("Project name is required.");
  const requestedSlug = slugify(text(formData, "slug") || name);
  if (!requestedSlug) throw new Error("A valid project slug is required.");

  const created = await createProject({
    slug: requestedSlug,
    name,
    description: text(formData, "description") || null,
    ownerId: user.localUserId
  });
  revalidatePath("/projects");
  redirect(`/projects/${created.slug}`);
}

export async function updateProjectAction(formData: FormData) {
  const user = await requireCurrentUser();
  const { slug, project } = await projectFromForm(formData, user.localUserId);
  const name = text(formData, "name");
  if (!name) throw new Error("Project name is required.");

  await updateProject({
    projectId: String(project.id),
    actorId: user.localUserId,
    name,
    description: text(formData, "description") || null
  });
  revalidatePath("/projects");
  revalidatePath(`/projects/${slug}`);
}

export async function createSiteAction(formData: FormData) {
  const user = await requireCurrentUser();
  const { slug, project } = await projectFromForm(formData, user.localUserId);
  const name = text(formData, "name");
  if (!name) throw new Error("Site name is required.");

  await createSite({
    projectId: String(project.id),
    actorId: user.localUserId,
    code: text(formData, "code") || null,
    name,
    description: text(formData, "description") || null
  });
  revalidatePath(`/projects/${slug}`);
}

export async function createPhysicalObjectAction(formData: FormData) {
  const user = await requireCurrentUser();
  const { slug, project } = await projectFromForm(formData, user.localUserId);
  const siteId = text(formData, "siteId");
  const name = text(formData, "name");
  if (!siteId || !name) throw new Error("Site and object name are required.");

  await createPhysicalObject({
    projectId: String(project.id),
    siteId,
    actorId: user.localUserId,
    parentObjectId: text(formData, "parentObjectId") || null,
    objectType: text(formData, "objectType") || "feature",
    code: text(formData, "code") || null,
    name,
    description: text(formData, "description") || null
  });
  revalidatePath(`/projects/${slug}`);
}

export async function addProjectMemberAction(formData: FormData) {
  const user = await requireCurrentUser();
  const { slug, project } = await projectFromForm(formData, user.localUserId);
  await addProjectMember({
    projectId: String(project.id),
    actorId: user.localUserId,
    email: text(formData, "email"),
    role: (text(formData, "role") || "contributor") as ProjectMemberRole
  });
  revalidatePath(`/projects/${slug}`);
}

export async function updateProjectMemberRoleAction(formData: FormData) {
  const user = await requireCurrentUser();
  const { slug, project } = await projectFromForm(formData, user.localUserId);
  const memberId = text(formData, "memberId");
  if (!memberId) throw new Error("Project member is required.");
  await updateProjectMemberRole({
    projectId: String(project.id),
    actorId: user.localUserId,
    memberId,
    role: text(formData, "role") as ProjectMemberRole
  });
  revalidatePath(`/projects/${slug}`);
}

export async function removeProjectMemberAction(formData: FormData) {
  const user = await requireCurrentUser();
  const { slug, project } = await projectFromForm(formData, user.localUserId);
  const memberId = text(formData, "memberId");
  if (!memberId) throw new Error("Project member is required.");
  await removeProjectMember({ projectId: String(project.id), actorId: user.localUserId, memberId });
  revalidatePath(`/projects/${slug}`);
}
