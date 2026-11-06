// Логотипи сервісів — офіційні SVG з Simple Icons (CC0, simple-icons 16.36): шлях і колір бренду в brandIcons.json.
// Для сервісів, яких там нема (OpenAI, Zadarma, Binotel…), — кружечок з літерою в кольорі бренду.
import ICONS from "./brandIcons.json";

type SI = { t: string; hex: string; path: string };
const SET = ICONS as Record<string, SI>;
const RULES: { re: RegExp; slug?: string; name?: string; bg?: string; t?: string }[] = [
  { re: /supabase/i, slug: "supabase" }, { re: /postgre/i, slug: "postgresql" }, { re: /sqlite/i, slug: "sqlite" },
  { re: /google ads/i, slug: "googleads" }, { re: /google ?drive|гугл ?диск/i, slug: "googledrive" }, { re: /gmail/i, slug: "gmail" },
  { re: /google ?calendar|календар/i, slug: "googlecalendar" }, { re: /google|гугл/i, slug: "google" },
  { re: /instagram|інстаграм/i, slug: "instagram" }, { re: /facebook|фейсбук/i, slug: "facebook" }, { re: /\bmeta\b|lead ads|мета/i, slug: "meta" },
  { re: /telegram|телеграм/i, slug: "telegram" }, { re: /whatsapp/i, slug: "whatsapp" }, { re: /viber|вайбер/i, slug: "viber" }, { re: /tiktok/i, slug: "tiktok" },
  { re: /claude|клод/i, slug: "claude" }, { re: /anthropic/i, slug: "anthropic" },
  { re: /cloudflare/i, slug: "cloudflare" }, { re: /github/i, slug: "github" }, { re: /vercel/i, slug: "vercel" }, { re: /hetzner/i, slug: "hetzner" },
  { re: /next\.?js/i, slug: "nextdotjs" }, { re: /react/i, slug: "react" }, { re: /vite/i, slug: "vite" }, { re: /tailwind/i, slug: "tailwindcss" }, { re: /deno/i, slug: "deno" },
  { re: /elevenlabs/i, slug: "elevenlabs" }, { re: /stripe/i, slug: "stripe" }, { re: /paypal/i, slug: "paypal" }, { re: /\bwise\b/i, slug: "wise" },
  { re: /shopify/i, slug: "shopify" }, { re: /wordpress/i, slug: "wordpress" }, { re: /webflow/i, slug: "webflow" }, { re: /figma/i, slug: "figma" },
  { re: /notion/i, slug: "notion" }, { re: /bitwarden/i, slug: "bitwarden" },
  { re: /openai|gpt[- ]?\d|whisper/i, name: "OpenAI", bg: "#10a37f", t: "AI" },
  { re: /zadarma|задарма/i, name: "Zadarma", bg: "#e4002b", t: "Z" },
  { re: /binotel|бінотел/i, name: "Binotel", bg: "#00a0e3", t: "B" },
  { re: /monobank|монобанк/i, name: "monobank", bg: "#111", t: "m" },
  { re: /privat|приват/i, name: "ПриватБанк", bg: "#7ab72b", t: "П" },
];

export function brandOf(text: string): { name: string } | undefined {
  const r = RULES.find((x) => x.re.test(text));
  if (!r) return undefined;
  return { name: r.slug ? SET[r.slug]?.t ?? r.slug : r.name! };
}

// Темні логотипи (GitHub, Next.js, Notion…) на темному фоні не видно — малюємо їх білим
const dark = (hex: string) => { const n = parseInt(hex, 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 70; };

export function BrandDot({ text, size = 18 }: { text: string; size?: number }) {
  const r = RULES.find((x) => x.re.test(text));
  const ic = r?.slug ? SET[r.slug] : undefined;
  if (ic) return (
    <span className="bd bd-logo" title={ic.t} style={{ width: size + 6, height: size + 6 }} aria-hidden>
      <svg viewBox="0 0 24 24" width={size - 2} height={size - 2} fill={dark(ic.hex) ? "#fff" : `#${ic.hex}`}><path d={ic.path} /></svg>
    </span>
  );
  if (r?.name) return <span className="bd" title={r.name} style={{ width: size + 6, height: size + 6, background: r.bg, color: "#fff", fontSize: size * 0.48 }} aria-hidden>{r.t}</span>;
  return <span className="bd bd-none" style={{ width: size + 6, height: size + 6 }} aria-hidden />;
}

export function BrandChip({ text }: { text: string }) {
  return <span className="bd-chip"><BrandDot text={text} size={14} />{text}</span>;
}
