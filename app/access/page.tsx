import { Mail, ShieldAlert } from "lucide-react";
import { huplaAccessConfiguration } from "@/lib/hupla-access";

export const dynamic = "force-dynamic";

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const params = await searchParams;
  const reason = params.reason === "identity"
    ? "No authenticated Hupla identity was supplied to the application."
    : "Your Hupla account does not currently have access to Archeology Notes.";
  const accountUrl = huplaAccessConfiguration().accountUrl;

  return (
    <main className="access-page">
      <section className="access-card">
        <ShieldAlert size={30} />
        <p className="eyebrow">Archeology Notes · user testing</p>
        <h1>Access required</h1>
        <p>{reason}</p>
        <a className="primary-action" href={accountUrl}>Open Hupla account</a>
        <p className="small-note">Want to join the pilot or have an access question?</p>
        <a className="secondary-button" href="mailto:samwaes@gmail.com?subject=Archeology%20Notes%20test%20user%20request"><Mail size={14} /> samwaes@gmail.com</a>
      </section>
    </main>
  );
}
