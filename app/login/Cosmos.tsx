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
      const n = w < 760 ? 700 : 1300;
      dust = Array.from({ length: n }, () => {
        const r = Math.pow(Math.random(), 1.6);
        // ближче до центру — гарячіше: біло-жовте → помаранчеве → червоне
        return { a: rnd(0, TAU), r, speed: 0.55 / Math.pow(0.35 + r, 1.5), size: rnd(0.6, 1.9), hue: 48 - r * 38, bright: rnd(0.45, 1) };
      });
      paintNebula();
    };

    const onMove = (e: PointerEvent) => { mouse.tx = (e.clientX / w - 0.5) * 2; mouse.ty = (e.clientY / h - 0.5) * 2; };
    const onTilt = (e: DeviceOrientationEvent) => { if (e.gamma == null || e.beta == null) return; mouse.tx = Math.max(-1, Math.min(1, e.gamma / 30)); mouse.ty = Math.max(-1, Math.min(1, (e.beta - 45) / 30)); };

    // ---- Чорна діра: задня половина диска → лінзоване кільце → горизонт → фотонне кільце → передня половина
    const blackHole = (cx: number, cy: number, R: number, dt: number) => {
      const tilt = 0.28; // наскільки диск сплюснутий (вид збоку)
      const inner = R * 1.55, outer = R * 4.2;
      // гало
      const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, outer * 1.25);
      halo.addColorStop(0, "rgba(255,170,90,0.20)");
      halo.addColorStop(0.35, "rgba(255,120,60,0.07)");
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, outer * 1.25, 0, TAU); ctx.fill();

      const drawDust = (front: boolean) => {
        ctx.globalCompositeOperation = "lighter";
        for (const d of dust) {
          if (!front) d.a += d.speed * dt * (1 + warp * 2);
          const s = Math.sin(d.a);
          if (front ? s < 0 : s >= 0) continue;
          const rr = inner + d.r * (outer - inner);
          const x = cx + Math.cos(d.a) * rr;
          const y = cy + s * rr * tilt;
          // допплер: частинки, що летять до нас (ліва сторона), яскравіші
          const dop = 0.55 + 0.45 * Math.cos(d.a + Math.PI / 2 + Math.PI);
          const fade = 1 - d.r * 0.75;
          const l = 58 + 32 * (1 - d.r);
          ctx.fillStyle = `hsla(${d.hue},100%,${l}%,${Math.min(1, d.bright * dop * fade)})`;
          ctx.fillRect(x, y, d.size, d.size);
        }
        ctx.globalCompositeOperation = "source-over";
      };

      drawDust(false);
      // задня частина диска, яку гравітація «загинає» над діркою (лінзування) — суцільне світіння зверху і тонке знизу
      ctx.globalCompositeOperation = "lighter";
      const lens = (start: number, end: number, width: number, alpha: number) => {
        const g = ctx.createRadialGradient(cx, cy, R * 1.05, cx, cy, R * (1.1 + width));
        g.addColorStop(0, `rgba(255,236,200,${alpha})`);
        g.addColorStop(0.35, `rgba(255,170,95,${alpha * 0.75})`);
        g.addColorStop(1, "rgba(255,110,60,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(cx, cy, R * (1.1 + width), R * (1.05 + width * 0.92), 0, start, end);
        ctx.ellipse(cx, cy, R * 1.05, R * 1.02, 0, end, start, true);
        ctx.closePath(); ctx.fill();
      };
      lens(Math.PI * 1.0, Math.PI * 2.0, 0.85, 0.7);
      lens(0, Math.PI, 0.35, 0.35);
      ctx.globalCompositeOperation = "source-over";
      // горизонт подій
      const core = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.12);
      core.addColorStop(0, "#000"); core.addColorStop(0.85, "#000"); core.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, TAU); ctx.fill();
      // фотонне кільце, ледь «дихає»
      const pulse = 0.85 + 0.15 * Math.sin(t * 1.3);
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = "rgba(255,190,120,0.9)"; ctx.shadowBlur = R * 0.5 * pulse;
      ctx.strokeStyle = `rgba(255,225,185,${0.85 * pulse})`; ctx.lineWidth = Math.max(1.2, R * 0.045);
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.04, 0, TAU); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";
      drawDust(true);
      // яскрава смуга диска спереду
      ctx.globalCompositeOperation = "lighter";
      const band = ctx.createLinearGradient(cx - outer, cy, cx + outer, cy);
      band.addColorStop(0, "rgba(255,120,80,0)"); band.addColorStop(0.3, "rgba(255,190,130,0.35)");
      band.addColorStop(0.5, "rgba(255,230,190,0.5)"); band.addColorStop(0.7, "rgba(255,150,100,0.25)"); band.addColorStop(1, "rgba(255,120,80,0)");
      ctx.strokeStyle = band; ctx.lineWidth = R * 0.12;
      ctx.beginPath(); ctx.ellipse(cx, cy, inner * 1.15, inner * 1.15 * tilt, 0, 0, Math.PI); ctx.stroke();
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
