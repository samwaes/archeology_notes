import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Archeology Notes | Hupla Labs",
  description: "Spatial field and knowledge workspace for archaeology and conservation.",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
