// Шаблон «Карусель «Фішка»» 1080×1350 (4:5) у мові каталогу клієнта: смарагд, крем, мідь, хвиля.
// Слайди: обкладинка (рендер на весь кадр + заголовок) → 2–6 слайдів «рендер/планування + теза» → фінал з CTA і «збережіть».
// Планування (kind=plan) показується цілим на білому, без обрізки. Рендер без LLM: тільки слоти.
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import path from "node:path";
import { PALETTE_DEFAULT, wrap, type Palette } from "./storyFact";

const FONTS = ["Onest-Bold.ttf", "Onest-SemiBold.ttf", "Onest-Regular.ttf"].map((f) => path.join(process.cwd(), "assets", "fonts", f));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const W = 1080, H = 1350, PAD = 80;

export type Slide = { image: Buffer; plan?: boolean; title: string; text?: string };
export type Carousel = {
  cover: { image: Buffer; kicker?: string; title: string; sub?: string };
  slides: Slide[];
  end: { title: string; text?: string; cta?: string };
  brand: string; logo?: Buffer | null; pal?: Partial<Palette>;
};

const wave = (y: number, amp: number, phase = 0) => {
  let d = `M0 ${y}`;
  for (let x = 0; x <= W; x += 30) d += ` L${x} ${(y + Math.sin((x / W) * Math.PI * 2.2 + phase) * amp).toFixed(1)}`;
  return d;
};
const txt = (lines: string[], x: number, y0: number, size: number, lh: number, weight: number, fill: string, anchor = "start") =>
  lines.map((l, i) => `<text x="${x}" y="${Math.round(y0 + i * size * lh)}" text-anchor="${anchor}" font-family="Onest" font-weight="${weight}" font-size="${size}" fill="${fill}">${esc(l)}</text>`).join("");
// Підбір розміру заголовка: не більше maxLines рядків
function fit(text: string, size: number, min: number, maxW: number, maxLines: number) {
  let lines = wrap(text, size, maxW);
  while (lines.length > maxLines && size > min) { size -= 4; lines = wrap(text, size, maxW); }
  return { size, lines: lines.slice(0, maxLines) };
}
const jpeg = async (buf: Buffer, w: number, h: number, fit: "cover" | "contain" = "cover") =>
  `data:image/jpeg;base64,${(await sharp(buf).rotate().resize(w, h, { fit, position: "attention", background: "#ffffff" }).flatten({ background: "#ffffff" }).jpeg({ quality: 86 }).toBuffer()).toString("base64")}`;
async function logoHref(logo?: Buffer | null) {
  return logo ? `data:image/png;base64,${(await sharp(logo, { density: 300 }).resize({ height: 110, fit: "inside" }).png().toBuffer()).toString("base64")}` : "";
}
const brandMark = (logo: string, brand: string, fill: string, x: number, y: number) =>
  logo ? `<image href="${logo}" x="${x}" y="${y - 52}" height="72" width="360" preserveAspectRatio="xMinYMid meet"/>`
    : `<text x="${x}" y="${y}" font-family="Onest" font-weight="600" font-size="38" letter-spacing="1" fill="${fill}">${esc(brand)}</text>`;
const svgOpen = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;

async function toJpeg(svg: string): Promise<Buffer> {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: W }, font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Onest" } }).render().asPng();
  return sharp(png).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}

// Обкладинка: рендер на весь кадр, знизу смарагдова підкладка з хвилею, кікер міддю, великий заголовок, «гортайте →»
async function cover(c: Carousel, p: Palette, logo: string, total: number): Promise<Buffer> {
  const img = await jpeg(c.cover.image, W, H);
  const t = fit(c.cover.title, 84, 56, W - PAD * 2, 3);
  const sub = c.cover.sub ? wrap(c.cover.sub, 34, W - PAD * 2, 0.52).slice(0, 2) : [];
  const subH = sub.length ? sub.length * 34 * 1.35 + 18 : 0;
  const titleY = H - 150 - subH - (t.lines.length - 1) * t.size * 1.06;
  const panelY = titleY - t.size - (c.cover.kicker ? 90 : 50);
  return toJpeg(`${svgOpen}
  <defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>
  <image href="${img}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
  <rect width="${W}" height="260" fill="url(#t)"/>
  ${brandMark(logo, c.brand, "#ffffff", PAD, 120)}
  <path d="${wave(panelY, 20)} L${W} ${H} L0 ${H} Z" fill="${p.dark}" fill-opacity="0.94"/>
  <path d="${wave(panelY - 18, 20, 0.6)}" fill="none" stroke="${p.paper}" stroke-opacity="0.8" stroke-width="3"/>
  ${c.cover.kicker ? `<text x="${PAD}" y="${panelY + 82}" font-family="Onest" font-weight="600" font-size="34" fill="${p.accent}">${esc(c.cover.kicker)}</text>` : ""}
  ${txt(t.lines, PAD, titleY, t.size, 1.06, 700, p.paper)}
  ${txt(sub, PAD, H - 150 - subH + 34 + 18, 34, 1.35, 400, p.paper)}
  <text x="${W - PAD}" y="${H - 70}" text-anchor="end" font-family="Onest" font-weight="600" font-size="30" fill="${p.accent}">гортайте →  1/${total}</text>
</svg>`);
}

// Слайд: зображення зверху (рендер — обрізка, планування — ціле на білому), хвиля, номер міддю, теза смарагдом, текст
async function slide(s: Slide, n: number, total: number, p: Palette, brand: string): Promise<Buffer> {
  const IMG_H = 840;
  // Планування — ціле, з полями, щоб хвиля не зрізала балкон
  const img = s.plan ? await jpeg(s.image, W - PAD * 2, IMG_H - 110, "contain") : await jpeg(s.image, W, IMG_H + 40);
  const t = fit(s.title, 60, 44, W - PAD * 2, 3);
  const body = s.text ? wrap(s.text, 32, W - PAD * 2, 0.52).slice(0, 4) : [];
  const top = IMG_H + 70;
  const titleY = top + 52 + t.size * 0.9;
  const bodyY = titleY + (t.lines.length - 1) * t.size * 1.1 + 30 + 32;
  return toJpeg(`${svgOpen}
  <rect width="${W}" height="${H}" fill="${p.paper}"/>
  ${s.plan ? `<rect width="${W}" height="${IMG_H + 40}" fill="#ffffff"/>` : ""}
  ${s.plan ? `<image href="${img}" x="${PAD}" y="50" width="${W - PAD * 2}" height="${IMG_H - 110}" preserveAspectRatio="xMidYMid meet"/>`
    : `<image href="${img}" x="0" y="0" width="${W}" height="${IMG_H + 40}" preserveAspectRatio="xMidYMid slice"/>`}
  <path d="${wave(IMG_H, 16)} L${W} ${H} L0 ${H} Z" fill="${p.paper}"/>
  <path d="${wave(IMG_H + 24, 12, 1.2)}" fill="none" stroke="${p.accent}" stroke-opacity="0.55" stroke-width="2"/>
  <text x="${PAD}" y="${top + 34}" font-family="Onest" font-weight="600" font-size="30" fill="${p.accent}">${String(n).padStart(2, "0")} / ${String(total).padStart(2, "0")}</text>
  <text x="${W - PAD}" y="${top + 34}" text-anchor="end" font-family="Onest" font-weight="600" font-size="28" fill="${p.ink}" fill-opacity="0.55">${esc(brand)}</text>
  ${txt(t.lines, PAD, titleY, t.size, 1.1, 700, p.dark)}
  ${txt(body, PAD, bodyY, 32, 1.4, 400, p.ink)}
</svg>`);
}

// Фінал: смарагдовий фон, хвилі міддю, заголовок кремом, текст, CTA-пігулка, «збережіть, щоб не загубити»
async function end(c: Carousel, p: Palette, logo: string, total: number): Promise<Buffer> {
  const t = fit(c.end.title, 76, 52, W - PAD * 2, 4);
  const body = c.end.text ? wrap(c.end.text, 34, W - PAD * 2, 0.52).slice(0, 4) : [];
  // Блок (заголовок → текст → CTA) по центру між хвилями зверху і підписом знизу
  const blockH = t.size * 0.8 + (t.lines.length - 1) * t.size * 1.08 + (body.length ? 74 + (body.length - 1) * 34 * 1.4 : 0) + (c.end.cta ? 70 + 108 : 0);
  const y0 = Math.round(260 + (H - 260 - 260 - blockH) / 2 + t.size * 0.8);
  const bodyY = y0 + (t.lines.length - 1) * t.size * 1.08 + 40 + 34;
  const ctaY = Math.round(bodyY + (body.length ? (body.length - 1) * 34 * 1.4 + 70 : 40));
  const ctaW = c.end.cta ? Math.min(W - PAD * 2, Math.round(c.end.cta.length * 34 * 0.58 + 120)) : 0;
  return toJpeg(`${svgOpen}
  <rect width="${W}" height="${H}" fill="${p.dark}"/>
  ${[0, 1, 2].map((i) => `<path d="${wave(170 + i * 26, 18, i * 0.6)}" fill="none" stroke="${p.accent}" stroke-opacity="${0.55 - i * 0.15}" stroke-width="2"/>`).join("")}
  ${txt(t.lines, PAD, y0, t.size, 1.08, 700, p.paper)}
  ${txt(body, PAD, bodyY, 34, 1.4, 400, p.paper)}
  ${c.end.cta ? `<rect x="${PAD}" y="${ctaY}" width="${ctaW}" height="108" rx="54" fill="${p.accent}"/>
  <text x="${PAD + ctaW / 2}" y="${ctaY + 68}" text-anchor="middle" font-family="Onest" font-weight="600" font-size="34" fill="#ffffff">${esc(c.end.cta)}</text>` : ""}
  <text x="${PAD}" y="${H - 190}" font-family="Onest" font-weight="400" font-size="30" fill="${p.paper}" fill-opacity="0.75">Збережіть, щоб не загубити  ·  ${total}/${total}</text>
  <path d="${wave(H - 140, 14, 2)}" fill="none" stroke="${p.paper}" stroke-opacity="0.35" stroke-width="2"/>
  ${brandMark(logo, c.brand, p.paper, PAD, H - 60)}
</svg>`);
}

export async function renderCarousel(c: Carousel): Promise<Buffer[]> {
  const p = { ...PALETTE_DEFAULT, ...(c.pal ?? {}) };
  const logo = await logoHref(c.logo);
  const total = c.slides.length + 2;
  const out = [await cover(c, p, logo, total)];
  for (let i = 0; i < c.slides.length; i++) out.push(await slide(c.slides[i], i + 2, total, p, c.brand));
  out.push(await end(c, p, logo, total));
  return out;
}
