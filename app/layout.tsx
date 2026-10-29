import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Unbounded } from "next/font/google";
import Nav from "@/components/Nav";
import "./globals.css";

const display = Unbounded({ subsets: ["latin", "cyrillic"], variable: "--f-display", weight: ["400", "500", "600"] });
const body = Inter({ subsets: ["latin", "cyrillic"], variable: "--f-body" });
const mono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--f-mono" });

export const metadata: Metadata = {
  title: "Client Ops",
  description: "Центр управління клієнтами",
};

export const viewport: Viewport = {
  themeColor: "#04060a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <div className="shell">
          <Nav />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
