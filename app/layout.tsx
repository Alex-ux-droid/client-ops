import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Onest } from "next/font/google";
import { cookies, headers } from "next/headers";
import RegisterSW from "@/components/RegisterSW";
import Shell from "@/components/Shell";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";
import { clientOptions, navCounts } from "@/lib/repo/counts";
import "./globals.css";

const body = Onest({ subsets: ["latin", "cyrillic"], variable: "--f-body", weight: ["400", "500", "600", "700"] });
const mono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--f-mono" });

export const metadata: Metadata = {
  title: "Client Ops",
  description: "Центр управління клієнтами",
  appleWebApp: { capable: true, title: "Client Ops", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Без входу — жодних даних у розмітці (сторінка логіну)
  const authed = isAuthed((await cookies()).get(SESSION_COOKIE)?.value, (await headers()).get("authorization"));
  const counts = authed ? navCounts() : { tasks: 0, leads: 0, debts: 0, ideas: 0, journal: 0 };
  const clients = authed ? clientOptions() : [];
  return (
    <html lang="uk" className={`${body.variable} ${mono.variable}`}>
      <body>
        <Shell counts={counts} clients={clients}>{children}</Shell>
        <RegisterSW />
      </body>
    </html>
  );
}
