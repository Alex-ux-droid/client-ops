import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Unbounded } from "next/font/google";
import { cookies } from "next/headers";
import Shell from "@/components/Shell";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { clientOptions, navCounts } from "@/lib/repo/counts";
import "./globals.css";

const display = Unbounded({ subsets: ["latin", "cyrillic"], variable: "--f-display", weight: ["400", "500", "600"] });
const body = Inter({ subsets: ["latin", "cyrillic"], variable: "--f-body" });
const mono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--f-mono" });

export const metadata: Metadata = {
  title: "Client Ops",
  description: "Центр управління клієнтами",
  appleWebApp: { capable: true, title: "Client Ops", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#04060a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Без входу — жодних даних у розмітці (сторінка логіну)
  const authed = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  const counts = authed ? navCounts() : { tasks: 0, leads: 0, debts: 0, ideas: 0 };
  const clients = authed ? clientOptions() : [];
  return (
    <html lang="uk" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <Shell counts={counts} clients={clients}>{children}</Shell>
      </body>
    </html>
  );
}
