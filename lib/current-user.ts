import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { upsertApplicationUser } from "@/lib/db";
import { authenticatedAccessEmail, getHuplaAccessDecision } from "@/lib/hupla-access";
import { ensurePilotMembership } from "@/lib/records";

export type CurrentUser = {
  email: string;
  localUserId: string;
  huplaUserId: string | null;
  accessLevel: "user" | "admin";
};

export async function requireCurrentUser(): Promise<CurrentUser> {
  const requestHeaders = await headers();
  const email = authenticatedAccessEmail(requestHeaders);
  if (!email) redirect("/access?reason=identity");

  const decision = await getHuplaAccessDecision(email);
  if (!decision.allowed) redirect("/access?reason=denied");

  const localUserId = await upsertApplicationUser({ huplaUserId: decision.userId, email });
  if (!localUserId) throw new Error("Could not establish the local Archeology Notes user.");

  await ensurePilotMembership(localUserId);

  return {
    email,
    localUserId,
    huplaUserId: decision.userId,
    accessLevel: decision.accessLevel
  };
}
