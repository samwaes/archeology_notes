import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await requireCurrentUser();
  redirect("/projects");
}
