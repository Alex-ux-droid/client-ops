"use client";
import { useEffect, useRef } from "react";

// Космос на сторінці входу: глибоке зоряне небо (зорі летять назустріч), туманності, падаючі зорі,
// чорна діра з акреційним диском і світловим кільцем, Марс з орбітою і супутником. Canvas, без бібліотек.
// Мишка (або нахил телефона) зсуває шари — відчуття глибини. window.__warp = true → «гіперстрибок» при вході.

type Star = { x: number; y: number; z: number; tw: number; hue: number };
type Shot = { x: number; y: number; vx: number; vy: number; life: number; max: number };
type Dust = { a: number; r: number; speed: number; size: number; hue: number; bright: number };

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export default function Cosmos() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, dpr = 1, raf = 0, last = performance.now(), t = 0;
    let stars: Star[] = [], dust: Dust[] = [];
    const shots: Shot[] = [];
    let nextShot = 1.5;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let warp = 0; // 0..1 плавно
    let nebula: HTMLCanvasElement | null = null;

    const layout = () => {
      const mobile = w < 760;
      return {
        bh: { x: mobile ? w * 0.5 : w * 0.76, y: mobile ? h * 0.12 : h * 0.34, r: Math.min(w, h) * (mobile ? 0.075 : 0.075) },
        planet: { x: mobile ? w * 0.2 : w * 0.17, y: mobile ? h * 0.86 : h * 0.74, r: Math.min(w, h) * (mobile ? 0.07 : 0.06) },
        station: { x: mobile ? w * 0.73 : w * 0.15, y: mobile ? h * 0.85 : h * 0.3, s: Math.min(w, h) * (mobile ? 0.045 : 0.056) },
      };
    };

    // Туманності малюємо один раз в окремий canvas — далі тільки зсуваємо
    const paintNebula = () => {
      const c = document.createElement("canvas");
      c.width = Math.ceil(w * 1.2); c.height = Math.ceil(h * 1.2);
      const n = c.getContext("2d")!;
      const blob = (x: number, y: number, r: number, color: string) => {
        const g = n.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)");
        n.fillStyle = g; n.fillRect(0, 0, c.width, c.height);
      };
      blob(c.width * 0.78, c.height * 0.3, Math.max(w, h) * 0.45, "rgba(61,107,255,0.16)");
      blob(c.width * 0.15, c.height * 0.15, Math.max(w, h) * 0.35, "rgba(120,60,200,0.10)");
      blob(c.width * 0.3, c.height * 0.85, Math.max(w, h) * 0.4, "rgba(255,110,60,0.06)");
      blob(c.width * 0.62, c.height * 0.65, Math.max(w, h) * 0.3, "rgba(40,180,220,0.06)");
      // далекий пил зірок — нерухомий фон для густоти неба
      for (let i = 0; i < (c.width * c.height) / 900; i++) {
        const a = Math.pow(Math.random(), 3) * 0.8 + 0.08;
        n.fillStyle = Math.random() < 0.12 ? `rgba(170,200,255,${a})` : `rgba(255,255,255,${a})`;
        const sz = Math.random() < 0.97 ? 0.8 : 1.6;
        n.fillRect(Math.random() * c.width, Math.random() * c.height, sz, sz);
      }
      nebula = c;
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(1400, Math.floor((w * h) / 1100));
      stars = Array.from({ length: count }, () => ({ x: rnd(-1, 1), y: rnd(-1, 1), z: rnd(0.05, 1), tw: rnd(0, TAU), hue: Math.random() < 0.15 ? rnd(190, 230) : Math.random() < 0.1 ? rnd(20, 40) : 0 }));
      const n = w < 760 ? 350 : 650;
      dust = Array.from({ length: n }, () => {
        const r = Math.pow(Math.random(), 1.6);
        // ближче до центру — гарячіше: біло-жовте → помаранчеве → червоне
        return { a: rnd(0, TAU), r, speed: 0.55 / Math.pow(0.35 + r, 1.5), size: rnd(0.6, 1.9), hue: 48 - r * 38, bright: rnd(0.45, 1) };
      });
      paintNebula();
    };

    const onMove = (e: PointerEvent) => { mouse.tx = (e.clientX / w - 0.5) * 2; mouse.ty = (e.clientY / h - 0.5) * 2; };
    const onTilt = (e: DeviceOrientationEvent) => { if (e.gamma == null || e.beta == null) return; mouse.tx = Math.max(-1, Math.min(1, e.gamma / 30)); mouse.ty = Math.max(-1, Math.min(1, (e.beta - 45) / 30)); };

    // ---- Чорна діра в стилі «Інтерстеллара».
    // Диск малюємо в окремому квадратному canvas як суцільне кільце (радіальний градієнт + текстура потоків, що крутиться),
    // потім стискаємо по вертикалі в еліпс: задня половина — до горизонту, передня — поверх. Лінза (світло задньої
    // частини диска, загнуте над і під діркою) — теж суцільне кільце з плавним затуханням по куту. Жодних смуг і обрізів.
    const conic = (c: CanvasRenderingContext2D, start: number, x: number, y: number) =>
      (c as CanvasRenderingContext2D & { createConicGradient?: (a: number, x: number, y: number) => CanvasGradient }).createConicGradient?.(start, x, y) ?? null;
    const TILT = 0.12, IN = 1.04, OUT = 4.4;
    let disk: HTMLCanvasElement | null = null, streaks: HTMLCanvasElement | null = null, lensC: HTMLCanvasElement | null = null;
    const DS = 640; // роздільність текстури диска

    const prepareHole = (R: number) => {
      // текстура «потоків»: сотні тонких дуг різної яскравості
      streaks = document.createElement("canvas"); streaks.width = streaks.height = DS;
      const s = streaks.getContext("2d")!;
      s.globalCompositeOperation = "lighter";
      const c = DS / 2;
      s.filter = "blur(1.6px)";
      for (let i = 0; i < 1400; i++) {
        const r = c * (IN / OUT + Math.pow(Math.random(), 0.9) * (1 - IN / OUT));
        const a0 = Math.random() * TAU, len = rnd(0.3, 2.2);
        s.strokeStyle = `rgba(255,${rnd(170, 240) | 0},${rnd(110, 190) | 0},${rnd(0.03, 0.14)})`;
        s.lineWidth = rnd(1, 4);
        s.beginPath(); s.arc(c, c, r, a0, a0 + len); s.stroke();
      }
      disk = document.createElement("canvas"); disk.width = disk.height = DS;
      // лінза: кільце навколо горизонту, яскраве зверху, тане до боків, ледь видне знизу
      const LS = Math.ceil(R * 2 * 1.9 * dpr), lc = LS / 2, Rp = R * dpr;
      lensC = document.createElement("canvas"); lensC.width = lensC.height = LS;
      const l = lensC.getContext("2d")!;
      const rg = l.createRadialGradient(lc, lc, Rp * 1.0, lc, lc, Rp * 1.85);
      rg.addColorStop(0, "rgba(255,240,215,0)");
      rg.addColorStop(0.05, "rgba(255,240,210,1)");
      rg.addColorStop(0.18, "rgba(255,215,150,0.85)");
      rg.addColorStop(0.42, "rgba(250,160,80,0.45)");
      rg.addColorStop(0.72, "rgba(220,110,50,0.14)");
      rg.addColorStop(1, "rgba(200,90,40,0)");
      l.fillStyle = rg; l.fillRect(0, 0, LS, LS);
      const ang = conic(l, 0, lc, lc);
      if (ang) {
        // 0 = праворуч, π/2 = низ, π = ліворуч, 3π/2 = верх
        ang.addColorStop(0, "rgba(0,0,0,0.25)");
        ang.addColorStop(0.08, "rgba(0,0,0,0.25)");
        ang.addColorStop(0.25, "rgba(0,0,0,0.45)");
        ang.addColorStop(0.42, "rgba(0,0,0,0.25)");
        ang.addColorStop(0.5, "rgba(0,0,0,0.2)");
        ang.addColorStop(0.62, "rgba(0,0,0,0.85)");
        ang.addColorStop(0.75, "rgba(0,0,0,1)");
        ang.addColorStop(0.88, "rgba(0,0,0,0.85)");
        ang.addColorStop(1, "rgba(0,0,0,0.25)");
        l.globalCompositeOperation = "destination-in"; l.fillStyle = ang; l.fillRect(0, 0, LS, LS);
      }
    };

    const renderDisk = () => {
      const d = disk!.getContext("2d")!, c = DS / 2;
      d.globalCompositeOperation = "source-over"; d.clearRect(0, 0, DS, DS);
      // потоки, що крутяться
      d.save(); d.translate(c, c); d.rotate(t * 0.22); d.drawImage(streaks!, -c, -c); d.restore();
      d.save(); d.translate(c, c); d.rotate(-t * 0.13 + 1.7); d.globalAlpha = 0.6; d.drawImage(streaks!, -c, -c); d.restore();
      // профіль яскравості по радіусу: всередині гаряче, назовні тане
      d.globalCompositeOperation = "destination-in";
      const mask = d.createRadialGradient(c, c, c * (IN / OUT) * 0.96, c, c, c);
      mask.addColorStop(0, "rgba(0,0,0,0)"); mask.addColorStop(0.04, "rgba(0,0,0,1)"); mask.addColorStop(0.35, "rgba(0,0,0,0.75)"); mask.addColorStop(1, "rgba(0,0,0,0)");
      d.fillStyle = mask; d.fillRect(0, 0, DS, DS);
      // базове світіння під потоками
      d.globalCompositeOperation = "destination-over";
      const base = d.createRadialGradient(c, c, c * (IN / OUT) * 0.96, c, c, c);
      base.addColorStop(0, "rgba(255,245,225,0)");
      base.addColorStop(0.03, "rgba(255,240,210,0.95)");
      base.addColorStop(0.12, "rgba(255,205,140,0.75)");
      base.addColorStop(0.35, "rgba(245,145,70,0.38)");
      base.addColorStop(0.7, "rgba(190,80,35,0.12)");
      base.addColorStop(1, "rgba(120,40,20,0)");
      d.fillStyle = base; d.fillRect(0, 0, DS, DS);
      // допплер: лівий бік летить до нас — яскравий, правий тьмяніший
      const dop = conic(d, 0, c, c);
      if (dop) {
        d.globalCompositeOperation = "destination-out";
        dop.addColorStop(0, "rgba(0,0,0,0.55)"); dop.addColorStop(0.25, "rgba(0,0,0,0.3)"); dop.addColorStop(0.5, "rgba(0,0,0,0)");
        dop.addColorStop(0.75, "rgba(0,0,0,0.3)"); dop.addColorStop(1, "rgba(0,0,0,0.55)");
        d.fillStyle = dop; d.fillRect(0, 0, DS, DS);
      }
      d.globalCompositeOperation = "source-over";
    };

    let holeR = 0;
    const blackHole = (cx: number, cy: number, R: number, dt: number) => {
      if (R !== holeR || !disk) { holeR = R; prepareHole(R); }
      const tilt = TILT, inner = R * IN, outer = R * OUT;
      renderDisk();
      const half = (top: boolean, alpha: number) => {
        ctx.save(); ctx.beginPath();
        if (top) ctx.rect(cx - outer, cy - outer * tilt - 2, outer * 2, outer * tilt + 2);
        else ctx.rect(cx - outer, cy, outer * 2, outer * tilt + 2);
        ctx.clip(); ctx.globalAlpha = alpha;
        ctx.drawImage(disk!, cx - outer, cy - outer * tilt, outer * 2, outer * 2 * tilt);
        ctx.restore();
      };

      // м'яке гало
      const halo = ctx.createRadialGradient(cx, cy, R, cx, cy, outer * 1.1);
      halo.addColorStop(0, "rgba(255,180,110,0.2)");
      halo.addColorStop(0.3, "rgba(255,140,70,0.07)");
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo; ctx.fillRect(cx - outer * 1.2, cy - outer * 1.2, outer * 2.4, outer * 2.4);

      ctx.globalCompositeOperation = "lighter";
      half(true, 0.9);                       // задня половина диска
      const breathe = 0.9 + 0.1 * Math.sin(t * 0.9);
      ctx.globalAlpha = breathe;
      const lr = R * 1.9;
      ctx.drawImage(lensC!, cx - lr, cy - lr, lr * 2, lr * 2); // лінза (двічі — яскравіше)
      ctx.drawImage(lensC!, cx - lr, cy - lr, lr * 2, lr * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      // горизонт подій
      const core = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.03);
      core.addColorStop(0, "#000"); core.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, R * 1.03, 0, TAU); ctx.fill();

      // фотонне кільце — тонке, яскраве, ледь дихає
      const pulse = 0.85 + 0.15 * Math.sin(t * 1.3);
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = "rgba(255,200,140,0.9)"; ctx.shadowBlur = R * 0.3 * pulse;
      ctx.strokeStyle = `rgba(255,236,205,${0.7 * pulse})`; ctx.lineWidth = Math.max(1, R * 0.02);
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.0, 0, TAU); ctx.stroke();
      ctx.shadowBlur = 0;

      // передня половина диска — поверх горизонту
      ctx.globalCompositeOperation = "source-over";
      half(false, 1);
      ctx.globalCompositeOperation = "lighter";
      half(false, 0.35);

      // іскри, що летять по диску
      for (const d of dust) {
        d.a += d.speed * dt * 0.6 * (1 + warp * 2);
        const sa = Math.sin(d.a);
        const rr = inner + d.r * (outer - inner);
        const x = cx + Math.cos(d.a) * rr, y = cy + sa * rr * tilt;
        if (sa < 0 && Math.hypot(x - cx, y - cy) < R * 1.05) continue; // ховаються за горизонтом
        const dop = 0.5 + 0.5 * Math.cos(d.a - Math.PI);
        ctx.fillStyle = `hsla(${d.hue},100%,${70 + 20 * (1 - d.r)}%,${Math.min(0.9, d.bright * dop * (1 - d.r * 0.8) * 0.8)})`;
        ctx.fillRect(x, y, d.size, d.size);
      }
      ctx.globalCompositeOperation = "source-over";
    };

    // ---- Марс з орбітою і супутником (як іконка системи)
    const planet = (cx: number, cy: number, r: number) => {
      const ringA = -0.35;
      const orbit = (front: boolean) => {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(ringA);
        ctx.strokeStyle = "rgba(111,200,255,0.55)"; ctx.lineWidth = Math.max(1.5, r * 0.07);
        ctx.shadowColor = "rgba(111,200,255,0.8)"; ctx.shadowBlur = r * 0.3;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.9, r * 0.55, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); ctx.stroke();
        ctx.restore();
      };
      orbit(false);
      const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
      g.addColorStop(0, "#ff9a6b"); g.addColorStop(0.55, "#e2552b"); g.addColorStop(1, "#5a1b10");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      // поверхня, що повертається
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
      ctx.fillStyle = "rgba(120,30,15,0.35)";
      for (let i = 0; i < 6; i++) {
        const ox = ((t * 6 + i * r * 0.7) % (r * 3.4)) - r * 1.7;
        ctx.beginPath(); ctx.ellipse(cx + ox, cy + Math.sin(i * 2.1) * r * 0.5, r * (0.18 + (i % 3) * 0.06), r * 0.1, 0.3, 0, TAU); ctx.fill();
      }
      const shade = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      shade.addColorStop(0.45, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(5,8,20,0.75)");
      ctx.fillStyle = shade; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
      // атмосфера
      const atm = ctx.createRadialGradient(cx, cy, r * 0.95, cx, cy, r * 1.35);
      atm.addColorStop(0, "rgba(255,120,80,0.25)"); atm.addColorStop(1, "rgba(255,120,80,0)");
      ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(cx, cy, r * 1.35, 0, TAU); ctx.fill();
      orbit(true);
      // супутник по орбіті
      const ma = t * 0.5;
      const mx = Math.cos(ma) * r * 1.9, my = Math.sin(ma) * r * 0.55;
      const sx = cx + mx * Math.cos(ringA) - my * Math.sin(ringA), sy = cy + mx * Math.sin(ringA) + my * Math.cos(ringA);
      if (Math.sin(ma) > 0 || Math.hypot(sx - cx, sy - cy) > r) {
        ctx.fillStyle = "#eef3ff"; ctx.shadowColor = "#bcd4ff"; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(sx, sy, Math.max(2, r * 0.09), 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      }
    };


    // ---- Станція «OPS»: ферма, сонячні панелі, кільце, що обертається, модуль з написом, вогники
    const station = (cx: number, cy: number, s: number) => {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.18 + Math.sin(t * 0.2) * 0.04);
      const spinR = t * 0.6;
      // задня половина кільця
      const ringPart = (front: boolean) => {
        ctx.strokeStyle = "rgba(170,190,225,0.85)"; ctx.lineWidth = s * 0.16;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 1.55, s * 0.5, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); ctx.stroke();
        ctx.strokeStyle = "rgba(40,50,80,0.9)"; ctx.lineWidth = s * 0.05; ctx.setLineDash([s * 0.12, s * 0.22]); ctx.lineDashOffset = -spinR * s;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 1.55, s * 0.5, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); ctx.stroke();
        ctx.setLineDash([]);
        if (front) { // вогники на кільці
          for (let k = 0; k < 6; k++) {
            const a = spinR + (k / 6) * TAU;
            if (Math.sin(a) <= 0) continue;
            ctx.fillStyle = "rgba(160,220,255,0.95)";
            ctx.beginPath(); ctx.arc(Math.cos(a) * s * 1.55, Math.sin(a) * s * 0.5, s * 0.04, 0, TAU); ctx.fill();
          }
        }
      };
      ringPart(false);
      // спиці
      ctx.strokeStyle = "rgba(150,165,200,0.7)"; ctx.lineWidth = s * 0.04;
      for (let k = 0; k < 4; k++) { const a = spinR * 0.999 + (k / 4) * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * s * 1.5, Math.sin(a) * s * 0.48); ctx.stroke(); }
      // ферма
      ctx.fillStyle = "#5d6884"; ctx.fillRect(-s * 3.1, -s * 0.06, s * 6.2, s * 0.12);
      ctx.strokeStyle = "rgba(200,210,235,0.35)"; ctx.lineWidth = 1;
      for (let x = -3.1; x < 3.1; x += 0.3) { ctx.beginPath(); ctx.moveTo(x * s, -s * 0.06); ctx.lineTo((x + 0.3) * s, s * 0.06); ctx.stroke(); }
      // сонячні панелі
      const panel = (px: number, py: number) => {
        const pw = s * 0.95, ph = s * 0.62;
        const g = ctx.createLinearGradient(px, py, px + pw, py + ph);
        g.addColorStop(0, "#2f5bff"); g.addColorStop(0.5, "#16328f"); g.addColorStop(1, "#0b1a52");
        ctx.fillStyle = g; ctx.fillRect(px, py, pw, ph);
        ctx.strokeStyle = "rgba(140,175,255,0.35)"; ctx.lineWidth = 0.8;
        for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(px + (pw * i) / 4, py); ctx.lineTo(px + (pw * i) / 4, py + ph); ctx.stroke(); }
        for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(px, py + (ph * i) / 3); ctx.lineTo(px + pw, py + (ph * i) / 3); ctx.stroke(); }
        ctx.strokeStyle = "rgba(230,190,110,0.8)"; ctx.lineWidth = 1.2; ctx.strokeRect(px, py, pw, ph);
        // відблиск, що повільно пробігає
        const sh = ((t * 0.25) % 1.6) - 0.3;
        const gl = ctx.createLinearGradient(px + pw * sh - pw * 0.3, py, px + pw * sh + pw * 0.3, py + ph);
        gl.addColorStop(0, "rgba(255,255,255,0)"); gl.addColorStop(0.5, "rgba(190,215,255,0.28)"); gl.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gl; ctx.fillRect(px, py, pw, ph);
      };
      for (const px of [-s * 3.1, s * 2.15]) for (const py of [-s * 0.72, s * 0.1]) panel(px, py);
      // модуль-капсула
      const hw = s * 0.95, hh = s * 0.42;
      const body = ctx.createLinearGradient(0, -hh, 0, hh);
      body.addColorStop(0, "#e9eefb"); body.addColorStop(0.45, "#a9b4cf"); body.addColorStop(1, "#3c4562");
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.roundRect(-hw, -hh, hw * 2, hh * 2, hh); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1; ctx.stroke();
      // ілюмінатори
      for (let i = 0; i < 4; i++) {
        const on = 0.6 + 0.4 * Math.sin(t * 1.7 + i * 1.3);
        ctx.fillStyle = `rgba(255,214,140,${on})`;
        ctx.beginPath(); ctx.arc(-hw * 0.72 + i * hw * 0.16, -hh * 0.05, s * 0.045, 0, TAU); ctx.fill();
      }
      // напис OPS
      ctx.font = `700 ${Math.round(s * 0.42)}px Onest, system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#3d6bff"; ctx.shadowColor = "rgba(61,107,255,0.9)"; ctx.shadowBlur = s * 0.25;
      ctx.fillText("OPS", hw * 0.36, hh * 0.04);
      ctx.shadowBlur = 0;
      // антена з червоним вогником
      ctx.strokeStyle = "#9aa6c4"; ctx.lineWidth = Math.max(1, s * 0.035);
      ctx.beginPath(); ctx.moveTo(hw * 0.5, -hh); ctx.lineTo(hw * 0.62, -hh - s * 0.7); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(hw * 0.62, -hh - s * 0.7, s * 0.16, s * 0.06, -0.3, 0, Math.PI); ctx.stroke();
      const blink = Math.sin(t * 3) > 0.6 ? 1 : 0.15;
      ctx.fillStyle = `rgba(255,70,70,${blink})`; ctx.shadowColor = "rgba(255,60,60,1)"; ctx.shadowBlur = s * 0.4 * blink;
      ctx.beginPath(); ctx.arc(hw * 0.62, -hh - s * 0.74, s * 0.05, 0, TAU); ctx.fill();
      const blink2 = Math.sin(t * 2.2 + 1) > 0.7 ? 1 : 0.1;
      ctx.fillStyle = `rgba(80,255,150,${blink2})`; ctx.shadowColor = "rgba(80,255,150,1)"; ctx.shadowBlur = s * 0.3 * blink2;
      ctx.beginPath(); ctx.arc(-hw, 0, s * 0.045, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ringPart(true);
      ctx.restore();
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; t += dt;
      const want = (window as unknown as { __warp?: boolean }).__warp ? 1 : 0;
      warp += (want - warp) * Math.min(1, dt * 2.5);
      mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 2);
      mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 2);

      ctx.fillStyle = "#03050c"; ctx.fillRect(0, 0, w, h);
      if (nebula) ctx.drawImage(nebula, -w * 0.1 - mouse.x * 12 + Math.sin(t * 0.05) * 10, -h * 0.1 - mouse.y * 12);

      // зорі: летять назустріч з центру, ближчі — швидші і більші
      const cx = w / 2 + mouse.x * -30, cy = h / 2 + mouse.y * -30;
      const speed = 0.018 + warp * 0.9;
      const scale = Math.max(w, h) * 0.6;
      for (const s of stars) {
        const pz = s.z;
        s.z -= dt * speed;
        if (s.z <= 0.02) { s.x = rnd(-1, 1); s.y = rnd(-1, 1); s.z = 1; continue; }
        const px = cx + (s.x / s.z) * scale, py = cy + (s.y / s.z) * scale;
        if (px < -50 || px > w + 50 || py < -50 || py > h + 50) { s.x = rnd(-1, 1); s.y = rnd(-1, 1); s.z = 1; continue; }
        const near = 1 - s.z;
        const tw = reduce ? 1 : 0.65 + 0.35 * Math.sin(t * (1.5 + near * 2) + s.tw);
        const a = Math.min(1, (0.4 + near * 0.75) * tw);
        const size = 0.8 + near * near * 2.4;
        ctx.fillStyle = s.hue ? `hsla(${s.hue},90%,80%,${a})` : `rgba(235,240,255,${a})`;
        if (warp > 0.05) {
          const ox = cx + (s.x / pz) * scale, oy = cy + (s.y / pz) * scale;
          ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = size;
          ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(px, py); ctx.stroke();
        } else {
          ctx.fillRect(px, py, size, size);
        }
      }

      // падаючі зорі
      if (!reduce) {
        nextShot -= dt;
        if (nextShot <= 0) {
          nextShot = rnd(2.2, 6);
          const fromLeft = Math.random() < 0.5;
          shots.push({ x: fromLeft ? rnd(-0.1, 0.5) * w : rnd(0.5, 1.1) * w, y: rnd(-0.05, 0.35) * h, vx: (fromLeft ? 1 : -1) * rnd(500, 900), vy: rnd(180, 380), life: 0, max: rnd(0.7, 1.2) });
        }
        for (let i = shots.length - 1; i >= 0; i--) {
          const sh = shots[i];
          sh.life += dt; sh.x += sh.vx * dt; sh.y += sh.vy * dt;
          const k = 1 - sh.life / sh.max;
          if (k <= 0) { shots.splice(i, 1); continue; }
          const tail = 0.12;
          const g = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * tail, sh.y - sh.vy * tail);
          g.addColorStop(0, `rgba(255,255,255,${0.9 * k})`); g.addColorStop(1, "rgba(160,190,255,0)");
          ctx.strokeStyle = g; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(sh.x - sh.vx * tail, sh.y - sh.vy * tail); ctx.stroke();
        }
      }

      const L = layout();
      blackHole(L.bh.x + mouse.x * -18, L.bh.y + mouse.y * -14, L.bh.r, reduce ? 0 : dt);
      planet(L.planet.x + mouse.x * -40, L.planet.y + mouse.y * -30, L.planet.r);
      station(L.station.x + mouse.x * -55 + Math.sin(t * 0.3) * 6, L.station.y + mouse.y * -40 + Math.sin(t * 0.45) * 5, L.station.s);

      // віньєтка — глибина
      const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.8);
      v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);

      if (!reduce) raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("deviceorientation", onTilt);
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden && !reduce) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("deviceorientation", onTilt);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} className="cosmos" aria-hidden="true" />;
}
