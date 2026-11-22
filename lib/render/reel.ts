// Шаблон «Reels «Кінетичний текст»» 1080×1920, 30 fps, ~12–16 с: реальні рендери з повільним наїздом камери (Ken Burns),
// на кожному кадрі рядок тексту виїжджає знизу, м'які переходи між кадрами, фінал — смарагдова картка з CTA і лого.
// Нічого не генерується: тільки рух і оформлення реальних кадрів. Кодує ffmpeg (H.264 + AAC, faststart — так хоче Instagram).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { PALETTE_DEFAULT, wrap, type Palette } from "./storyFact";

const FONTS = ["Onest-Bold.ttf", "Onest-SemiBold.ttf", "Onest-Regular.ttf"].map((f) => path.join(process.cwd(), "assets", "fonts", f));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const W = 1080, H = 1920, PAD = 84, FPS = 30, SHOT = 3, END = 3.2, XF = 0.4;
export const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

export type Shot = { image: Buffer; plan?: boolean; line: string; kicker?: string };
export type Reel = { shots: Shot[]; end: { title: string; cta?: string }; brand: string; logo?: Buffer | null; pal?: Partial<Palette>; audio?: Buffer | null };

const wave = (y: number, amp: number, phase = 0) => {
  let d = `M0 ${y}`;
  for (let x = 0; x <= W; x += 30) d += ` L${x} ${(y + Math.sin((x / W) * Math.PI * 2.2 + phase) * amp).toFixed(1)}`;
  return d;
};
const png = (svg: string) => new Resvg(svg, { fitTo: { mode: "width", value: W }, font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Onest" } }).render().asPng();
const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
function fit(text: string, size: number, min: number, maxLines: number) {
  let lines = wrap(text, size, W - PAD * 2);
  while (lines.length > maxLines && size > min) { size -= 4; lines = wrap(text, size, W - PAD * 2); }
  return { size, lines: lines.slice(0, maxLines) };
}

// Прозорий шар з текстом кадру: затемнення знизу, мідна хвиля, кікер, рядок. Низ — над інтерфейсом Reels (≈420 px).
function textLayer(s: Shot, brand: string, first: boolean, p: Palette): Buffer {
  const t = fit(s.line, 78, 54, 3);
  const bottom = H - 430;
  const y0 = bottom - (t.lines.length - 1) * t.size * 1.08;
  const kickY = y0 - t.size - 14;
  return png(`${open}
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.72"/></linearGradient>
  <linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>
  <rect x="0" y="${Math.round(kickY - 260)}" width="${W}" height="${Math.round(H - kickY + 260)}" fill="url(#g)"/>
  ${first ? `<rect width="${W}" height="300" fill="url(#t)"/><text x="${PAD}" y="250" font-family="Onest" font-weight="600" font-size="42" fill="#ffffff">${esc(brand)}</text>` : ""}
  <path d="${wave(Math.round(kickY - (s.kicker ? 70 : 30)), 12)}" fill="none" stroke="${p.accent}" stroke-width="3" stroke-opacity="0.9"/>
  ${s.kicker ? `<text x="${PAD}" y="${Math.round(kickY)}" font-family="Onest" font-weight="600" font-size="36" fill="${p.accent}">${esc(s.kicker)}</text>` : ""}
  ${t.lines.map((l, i) => `<text x="${PAD}" y="${Math.round(y0 + i * t.size * 1.08)}" font-family="Onest" font-weight="700" font-size="${t.size}" fill="#ffffff">${esc(l)}</text>`).join("")}
</svg>`);
}

// Фінал: фон (хвилі) окремо від тексту, щоб текст проявився поверх
function endBg(p: Palette): Buffer {
  return png(`${open}<rect width="${W}" height="${H}" fill="${p.dark}"/>
  ${[0, 1, 2].map((i) => `<path d="${wave(330 + i * 28, 20, i * 0.6)}" fill="none" stroke="${p.accent}" stroke-opacity="${0.6 - i * 0.17}" stroke-width="2.5"/>`).join("")}
  ${[0, 1].map((i) => `<path d="${wave(1560 + i * 28, 16, 2 + i * 0.6)}" fill="none" stroke="${p.paper}" stroke-opacity="${0.3 - i * 0.1}" stroke-width="2"/>`).join("")}</svg>`);
}
async function endText(r: Reel, p: Palette): Promise<Buffer> {
  const t = fit(r.end.title, 86, 56, 4);
  const ctaW = r.end.cta ? Math.min(W - PAD * 2, Math.round(r.end.cta.length * 36 * 0.58 + 130)) : 0;
  const blockH = (t.lines.length - 1) * t.size * 1.08 + t.size + (r.end.cta ? 80 + 116 : 0);
  const y0 = Math.round((H - blockH) / 2 - 60 + t.size * 0.85);
  const ctaY = Math.round(y0 + (t.lines.length - 1) * t.size * 1.08 + 80);
  const logo = r.logo ? `data:image/png;base64,${(await sharp(r.logo, { density: 300 }).resize({ height: 120, fit: "inside" }).png().toBuffer()).toString("base64")}` : "";
  return png(`${open}
  ${t.lines.map((l, i) => `<text x="${W / 2}" y="${Math.round(y0 + i * t.size * 1.08)}" text-anchor="middle" font-family="Onest" font-weight="700" font-size="${t.size}" fill="${p.paper}">${esc(l)}</text>`).join("")}
  ${r.end.cta ? `<rect x="${(W - ctaW) / 2}" y="${ctaY}" width="${ctaW}" height="116" rx="58" fill="${p.accent}"/>
  <text x="${W / 2}" y="${ctaY + 74}" text-anchor="middle" font-family="Onest" font-weight="600" font-size="36" fill="#ffffff">${esc(r.end.cta)}</text>` : ""}
  ${logo ? `<image href="${logo}" x="${(W - 440) / 2}" y="1380" height="100" width="440" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="${W / 2}" y="1450" text-anchor="middle" font-family="Onest" font-weight="600" font-size="46" letter-spacing="1" fill="${p.paper}">${esc(r.brand)}</text>`}
</svg>`);
}

function ff(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const pr = spawn(/*turbopackIgnore: true*/ FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    pr.stderr.on("data", (d) => { err += d; });
    pr.on("error", (e) => reject((e as NodeJS.ErrnoException).code === "ENOENT" ? new Error("На сервері ще нема ffmpeg (ставиться автоматично при оновленні) — спробуй за 5 хв") : e));
    pr.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg: ${err.trim().slice(-300) || `код ${c}`}`))));
  });
}
const ENC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS), "-threads", "2"];

export async function hasFfmpeg(): Promise<boolean> { return ff(["-version"]).then(() => true, () => false); }

// Повертає MP4. Тимчасові файли — у системній tmp, прибираються.
export async function renderReel(r: Reel): Promise<Buffer> {
  const p = { ...PALETTE_DEFAULT, ...(r.pal ?? {}) };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reel-"));
  try {
    const seg: string[] = [];
    const frames = SHOT * FPS;
    for (let i = 0; i < r.shots.length; i++) {
      const s = r.shots[i];
      // Кадр у 2× розмірі — плавний наїзд без «сходинок»; планування — ціле на білому
      const big = s.plan
        ? await sharp({ create: { width: W * 2, height: H * 2, channels: 3, background: "#ffffff" } }).composite([{ input: await sharp(s.image).rotate().resize(W * 2 - 240, H * 2 - 1400, { fit: "inside", background: "#ffffff" }).flatten({ background: "#ffffff" }).toBuffer(), top: 500, left: 120 }]).jpeg({ quality: 90 }).toBuffer()
        : await sharp(s.image).rotate().resize(W * 2, H * 2, { fit: "cover", position: "attention" }).jpeg({ quality: 90 }).toBuffer();
      fs.writeFileSync(path.join(dir, `i${i}.jpg`), big);
      fs.writeFileSync(path.join(dir, `t${i}.png`), textLayer(s, r.brand, i === 0, p));
      // Наїзд по черзі: до центру / з легким зсувом вліво-вправо
      const zoom = i % 2 ? `1.10-0.10*on/${frames}` : `1+0.10*on/${frames}`;
      const x = i % 3 === 2 ? `(iw-iw/zoom)*on/${frames}` : `iw/2-(iw/zoom/2)`;
      const out = path.join(dir, `s${i}.mp4`);
      const st = i === 0 ? 0.1 : 0.35; // перший кадр — хук, видно майже одразу
      await ff([
        "-i", path.join(dir, `i${i}.jpg`), "-loop", "1", "-t", String(SHOT), "-i", path.join(dir, `t${i}.png`),
        "-filter_complex",
        `[0:v]zoompan=z='${zoom}':x='${x}':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS},setsar=1[bg];` +
        `[1:v]format=rgba,fade=in:st=${st}:d=0.45:alpha=1[tx];` +
        `[bg][tx]overlay=0:'if(lt(t,${st}),60,max(0,60*(1-(t-${st})/0.45)))':shortest=1,format=yuv420p[v]`,
        "-map", "[v]", "-t", String(SHOT), ...ENC, out,
      ]);
      seg.push(out);
    }
    fs.writeFileSync(path.join(dir, "eb.png"), endBg(p));
    fs.writeFileSync(path.join(dir, "et.png"), await endText(r, p));
    const endOut = path.join(dir, "end.mp4");
    await ff([
      "-loop", "1", "-t", String(END), "-i", path.join(dir, "eb.png"), "-loop", "1", "-t", String(END), "-i", path.join(dir, "et.png"),
      "-filter_complex", `[1:v]format=rgba,fade=in:st=0.5:d=0.6:alpha=1[tx];[0:v][tx]overlay=0:'if(lt(t,0.5),40,max(0,40*(1-(t-0.5)/0.6)))',format=yuv420p[v]`,
      "-map", "[v]", "-t", String(END), ...ENC, endOut,
    ]);
    seg.push(endOut);
    // Склейка з м'якими переходами (xfade) + звук: свій трек з матеріалів або тиша (Instagram хоче аудіодоріжку)
    const total = seg.length * SHOT - (seg.length - 1) * XF + (END - SHOT);
    let chain = "", last = "[0:v]", off = 0;
    for (let i = 1; i < seg.length; i++) {
      off += SHOT - XF;
      const o = i === seg.length - 1 ? "[v]" : `[x${i}]`;
      chain += `${last}[${i}:v]xfade=transition=${i === seg.length - 1 ? "fade" : "smoothleft"}:duration=${XF}:offset=${off.toFixed(2)}${o};`;
      last = o;
    }
    const audioIn = r.audio ? (fs.writeFileSync(path.join(dir, "a.bin"), r.audio), ["-i", path.join(dir, "a.bin")]) : ["-f", "lavfi", "-t", String(total), "-i", "anullsrc=r=48000:cl=stereo"];
    const ai = seg.length;
    const out = path.join(dir, "reel.mp4");
    await ff([
      ...seg.flatMap((f) => ["-i", f]), ...audioIn,
      "-filter_complex", `${chain}[${ai}:a]atrim=0:${total.toFixed(2)},afade=t=in:d=0.3,afade=t=out:st=${(total - 1.2).toFixed(2)}:d=1.2,aresample=48000[a]`,
      "-map", "[v]", "-map", "[a]", ...ENC, "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-t", total.toFixed(2), "-movflags", "+faststart", out,
    ]);
    return fs.readFileSync(out);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
