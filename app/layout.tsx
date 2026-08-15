import type { Metadata } from "next";
import PwaRegister from "@/components/pwa-register";
import "./globals.css";
import "./phase1.css";
import "./testing-enhancements.css";

export const metadata: Metadata = {
  title: "Archeology Notes | Hupla Labs",
  description: "Spatial field and knowledge workspace for archaeology and conservation.",
  manifest: "/manifest.webmanifest",
  themeColor: "#1f5949",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><PwaRegister />{children}</body>
    </html>
  );
}
