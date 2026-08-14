import Link from "next/link";
import { Box, Camera, Database, FolderKanban, Search, ShieldCheck } from "lucide-react";
import type { CurrentUser } from "@/lib/current-user";

const navigation = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/catalog", label: "Catalog", icon: Database },
  { href: "/field", label: "Field", icon: Camera },
  { href: "/workspace", label: "3D Workspace", icon: Box },
  { href: "/search", label: "Search", icon: Search }
];

export default function AppShell({ user, active, children }: { user: CurrentUser; active?: string; children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <Link className="app-brand" href="/">hupla_<span>archeology notes</span></Link>
        <nav className="app-nav" aria-label="Application">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={active === label ? "active" : ""}>
              <Icon size={17} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="app-user">
          <ShieldCheck size={16} />
          <div><strong>{user.email}</strong><span>{user.accessLevel}</span></div>
        </div>
      </aside>
      <main className="app-main">{children}</main>
    </div>
  );
}
