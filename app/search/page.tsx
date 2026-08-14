import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import AppShell from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/current-user";
import { getProjectForUser, listCatalogRecords } from "@/lib/records";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireCurrentUser();
  const { q = "" } = await searchParams;
  const project = await getProjectForUser("casignana", user.localUserId);
  if (!project) throw new Error("Casignana pilot project is unavailable.");
  const records = await listCatalogRecords(String(project.id), user.localUserId);
  const query = q.trim().toLowerCase();
  const results = query ? records.filter((record) => [record.title, record.description, record.additionalInformation, record.filterName, record.enhancement, record.authorName, record.authorEmail, record.siteName, record.objectName, record.recordType].some((value) => value?.toLowerCase().includes(query))) : records;

  return (
    <AppShell user={user} active="Search">
      <header className="workspace-header"><div><p className="eyebrow">Project search</p><h1>Search the evidence</h1><p>Phase 1 searches the structured record catalog. Cross-document and semantic retrieval comes later.</p></div></header>
      <form className="search-form"><SearchIcon size={18} /><input name="q" defaultValue={q} placeholder="Search descriptions, authors, context, filters..." autoFocus /><button type="submit">Search</button></form>
      <section className="search-results"><p>{results.length} result{results.length === 1 ? "" : "s"}{query ? ` for “${q}”` : ""}</p>{results.map((record) => <Link href={`/records/${record.id}`} key={record.id}><span>{record.recordType}</span><strong>{record.title || record.description || "Untitled record"}</strong><small>{record.objectName || record.siteName || "Unlinked"} · {record.authorName || record.authorEmail} · {record.visibility}</small></Link>)}</section>
    </AppShell>
  );
}
