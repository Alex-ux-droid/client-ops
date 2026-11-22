// Шаблон «Сторіс «Факт»» 1080×1920 у мові каталогу клієнта (Aqua Vita: смарагд, крем, мідь, хвиляста лінія):
// реальний рендер угорі (≈62% кадру), кремова панель з хвилею, мідний кікер, факт смарагдом, підпис, CTA-пігулка.
// Безпечні зони Instagram — 250 px зверху і знизу. Рендер без LLM: тільки слоти.
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const FONTS = ["Onest-Bold.ttf", "Onest-SemiBold.ttf", "Onest-Regular.ttf"].map((f) => path.join(process.cwd(), "assets", "fonts", f));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Перенос рядків за оцінкою ширини Onest (Bold ≈0.57 em на символ, Regular ≈0.52)
export function wrap(text: string, size: number, maxW: number, k = 0.57): string[] {
  const max = Math.max(4, Math.floor(maxW / (size * k)));
  const out: string[] = [];
  let line = "";
  for (const w of text.trim().split(/\s+/)) {
    if (!line) line = w;
    else if ((line + " " + w).length <= max) line += " " + w;
    else { out.push(line); line = w; }
  }
  if (line) out.push(line);
  return out;
}

export type Palette = { dark: string; accent: string; paper: string; ink: string };
export const PALETTE_DEFAULT: Palette = { dark: "#0f5a3f", accent: "#c27c51", paper: "#f7f3ec", ink: "#33413a" };
export type StoryFact = { image: Buffer; fact: string; kicker?: string; sub?: string; cta?: string; brand: string; logo?: Buffer | null; pal?: Partial<Palette> };

const W = 1080, H = 1920, PAD = 84, PHOTO_H = 1080;

// Хвиля — фірмовий мотив каталогу: м'яка синусоїда по ширині кадру
const wave = (y: number, amp: number, phase = 0) => {
  let d = `M0 ${y}`;
  for (let x = 0; x <= W; x += 30) d += ` L${x} ${(y + Math.sin((x / W) * Math.PI * 2.2 + phase) * amp).toFixed(1)}`;
  return d;
};

export async function renderStoryFact(s: StoryFact): Promise<Buffer> {
  const p = { ...PALETTE_DEFAULT, ...(s.pal ?? {}) };
  // Рендер обрізаємо під верхню частину кадру (по центру) і стискаємо — у SVG іде вже малий JPEG
  const photo = await sharp(s.image).rotate().resize(W, PHOTO_H + 60, { fit: "cover", position: "attention" }).jpeg({ quality: 86 }).toBuffer();
  let size = 80, lines = wrap(s.fact, size, W - PAD * 2);
  while (lines.length > 3 && size > 58) { size -= 6; lines = wrap(s.fact, size, W - PAD * 2); }
  const subSize = 34, sub = s.sub ? wrap(s.sub, subSize, W - PAD * 2, 0.52).slice(0, 3) : [];
  // Усе в потоці зверху вниз: кікер → факт → підпис → CTA; CTA не нижче за безпечну зону (250 px знизу)
  const top = PHOTO_H + 78;
  const kickY = top + 30;
  const factY0 = (s.kicker ? kickY + 30 : top) + size * 0.92;
  const subY0 = factY0 + (lines.length - 1) * size * 1.08 + 30 + subSize;
  const subEnd = sub.length ? subY0 + (sub.length - 1) * subSize * 1.35 + 14 : factY0 + (lines.length - 1) * size * 1.08 + 10;
  const ctaY = Math.min(H - 250 - 104, Math.round(subEnd + 48));
  const ctaW = s.cta ? Math.min(W - PAD * 2, Math.round(s.cta.length * 32 * 0.58 + 112)) : 0;
  const logo = s.logo ? `data:image/png;base64,${(await sharp(s.logo, { density: 300 }).resize({ height: 120, fit: "inside" }).png().toBuffer()).toString("base64")}` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.38"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="${p.paper}"/>
  <image href="data:image/jpeg;base64,${photo.toString("base64")}" x="0" y="0" width="${W}" height="${PHOTO_H + 60}" preserveAspectRatio="xMidYMid slice"/>
  <rect x="0" y="0" width="${W}" height="380" fill="url(#t)"/>
  ${logo ? `<image href="${logo}" x="${PAD}" y="210" height="96" width="420" preserveAspectRatio="xMinYMid meet"/>`
    : `<text x="${PAD}" y="282" font-family="Onest" font-weight="600" font-size="46" letter-spacing="1" fill="#ffffff">${esc(s.brand)}</text>`}
  <path d="${wave(PHOTO_H, 18)} L${W} ${H} L0 ${H} Z" fill="${p.paper}"/>
  <path d="${wave(PHOTO_H - 22, 18, 0.6)}" fill="none" stroke="${p.paper}" stroke-opacity="0.85" stroke-width="3"/>
  <path d="${wave(PHOTO_H + 26, 14, 1.2)}" fill="none" stroke="${p.accent}" stroke-opacity="0.55" stroke-width="2"/>
  ${s.kicker ? `<text x="${PAD}" y="${kickY}" font-family="Onest" font-weight="600" font-size="34" fill="${p.accent}">${esc(s.kicker)}</text>` : ""}
  ${lines.map((l, i) => `<text x="${PAD}" y="${Math.round(factY0 + i * size * 1.08)}" font-family="Onest" font-weight="700" font-size="${size}" fill="${p.dark}">${esc(l)}</text>`).join("\n  ")}
  ${sub.map((l, i) => `<text x="${PAD}" y="${Math.round(subY0 + i * subSize * 1.35)}" font-family="Onest" font-weight="400" font-size="${subSize}" fill="${p.ink}">${esc(l)}</text>`).join("\n  ")}
  ${s.cta ? `<rect x="${PAD}" y="${ctaY}" width="${ctaW}" height="104" rx="52" fill="${p.dark}"/>
  <text x="${PAD + ctaW / 2}" y="${ctaY + 65}" text-anchor="middle" font-family="Onest" font-weight="600" font-size="34" fill="${p.paper}">${esc(s.cta)}</text>` : ""}
</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: "width", value: W }, font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Onest" } }).render().asPng();
  return sharp(png).jpeg({ quality: 90, mozjpeg: true }).toBuffer(); // Instagram приймає тільки JPEG
}
