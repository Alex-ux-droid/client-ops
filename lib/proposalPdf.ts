// Комерційна пропозиція клієнту — ОДИН фірмовий шаблон (A4 вертикально, темний, як alexbentsa.com).
// Однаковий для всіх клієнтів: обкладинка → проблема → чому це болить → що дамо → що входить → як робимо (етапи)
// → пакети → чому вигідно → рахунок → підтримка і бонуси → наступний крок. Порожні розділи пропускаються.
import path from "node:path";
import PDFDocument from "pdfkit";
import { money } from "./config";
import { includesList, packageCalc, labFinance, type LabFull, type LabProduct } from "./repo/lab";

const FONT = (f: string) => path.join(process.cwd(), "assets", "fonts", f);
const C = { bg: "#070a14", panel: "#10162a", panel2: "#141c34", text: "#f2f4fa", muted: "#a3acc2", dim: "#6f7a94", line: "#24304f", accent: "#3d6bff", ok: "#2fd0a7" };
const W = 595.28, H = 841.89, M = 44, CW = W - M * 2, BOTTOM = H - 64;

type Doc = PDFKit.PDFDocument;

export async function proposalPdf(l: LabFull, opts: { from?: string } = {}): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false, bufferPages: true, info: { Title: l.proposal.title || "Комерційна пропозиція", Author: opts.from || "" } });
  doc.registerFont("R", FONT("Onest-Regular.ttf"));
  doc.registerFont("S", FONT("Onest-SemiBold.ttf"));
  doc.registerFont("B", FONT("Onest-Bold.ttf"));
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  const p = l.proposal;
  const chosen = l.packages.find((pk) => pk.id === l.chosen_package_id) ?? null;
  const cc = chosen ? packageCalc(chosen, l.products) : null;
  const fin = labFinance(l.products);
  const shown: LabProduct[] = cc ? cc.items : l.products;
  let y = 0;
  let sec = 0;

  // ── примітиви
  const bg = (glow = true) => {
    doc.rect(0, 0, W, H).fill(C.bg);
    if (glow) { const g = doc.radialGradient(W * 0.9, -60, 0, W * 0.9, -60, 460); g.stop(0, C.accent, 0.32).stop(1, C.bg, 0); doc.rect(0, 0, W, H).fill(g); }
  };
  const page = () => { doc.addPage(); bg(); y = M + 6; };
  const need = (h: number) => { if (y + h > BOTTOM) page(); };
  const plain = (s: string) => s.replace(/\*\*/g, "").replace(/`/g, "");
  const height = (s: string, size: number, width: number, font = "R") => { doc.font(font).fontSize(size); return doc.heightOfString(plain(s) || " ", { width, lineGap: 3 }); };
  // текст з **жирним**
  const rich = (s: string, x: number, yy: number, width: number, size: number, color = C.muted) => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g).filter((t) => t !== "");
    if (!parts.length) return;
    parts.forEach((t, i) => {
      const b = t.startsWith("**") && t.endsWith("**");
      doc.font(b ? "S" : "R").fontSize(size).fillColor(b ? C.text : color);
      const o = { width, lineGap: 3, continued: i < parts.length - 1 };
      const tx = b ? t.slice(2, -2) : t.replace(/`/g, "");
      if (i === 0) doc.text(tx, x, yy, o); else doc.text(tx, o);
    });
  };
  const card = (x: number, yy: number, w: number, h: number, fill = C.panel, stroke = C.line) => doc.roundedRect(x, yy, w, h, 12).lineWidth(1).fillAndStroke(fill, stroke);
  const heading = (title: string, lead?: string) => {
    need(90);
    sec++;
    doc.font("S").fontSize(10).fillColor(C.accent).text(String(sec).padStart(2, "0"), M, y, { characterSpacing: 1.5 });
    doc.font("B").fontSize(21).fillColor(C.text).text(title, M, y + 16, { width: CW, lineGap: 2 });
    y = doc.y + 6;
    doc.rect(M, y, 36, 3).fill(C.accent);
    y += 14;
    if (lead) { const h = height(lead, 10.5, CW); rich(lead, M, y, CW, 10.5, C.dim); y += h + 10; }
  };
  // markdown-ish текст поля: «- » і «1. » — список, решта — абзаци
  const body = (s: string, width = CW, x = M) => {
    for (const raw of s.replace(/\r/g, "").split("\n")) {
      const line = raw.trim();
      if (!line) { y += 4; continue; }
      const li = line.match(/^([-*•]|\d+[.)])\s+(.*)$/);
      if (li) {
        const t = li[2];
        const h = height(t, 11, width - 18);
        need(h + 6);
        doc.circle(x + 4, y + 7, 2.6).fill(C.accent);
        rich(t, x + 16, y, width - 18, 11, C.text);
        y += h + 6;
      } else {
        const h = height(line.replace(/^#+\s*/, ""), 11.5, width);
        need(h + 8);
        rich(line.replace(/^#+\s*/, ""), x, y, width, 11.5, C.muted);
        y += h + 8;
      }
    }
  };
  // та сама логіка, що в body — щоб картка точно вмістила текст
  const measureBody = (s: string, width: number) => s.replace(/\r/g, "").split("\n").reduce((a, raw) => {
    const line = raw.trim();
    if (!line) return a + 4;
    const li = line.match(/^([-*•]|\d+[.)])\s+(.*)$/);
    return a + (li ? height(li[2], 11, width - 18) + 6 : height(line.replace(/^#+\s*/, ""), 11.5, width) + 8);
  }, 0);
  const check = (t: string, x: number, yy: number, width: number, size = 10, color = C.muted) => {
    const cy = yy + size * 0.62; // галочка лінією — у шрифті може не бути символу ✓
    doc.save().moveTo(x + 1, cy - 1).lineTo(x + 4, cy + 2.5).lineTo(x + 9.5, cy - 4).lineWidth(1.6).lineCap("round").lineJoin("round").stroke(C.ok).restore();
    rich(t, x + 14, yy, width - 14, size, color);
    return height(t, size, width - 14);
  };

  // ── 1. Обкладинка
  doc.addPage(); bg();
  const glow2 = doc.radialGradient(-40, H + 40, 0, -40, H + 40, 420); glow2.stop(0, C.accent, 0.18).stop(1, C.bg, 0); doc.rect(0, 0, W, H).fill(glow2);
  if (opts.from) doc.font("S").fontSize(10).fillColor(C.muted).text(opts.from, M, M, { width: CW, characterSpacing: 0.5 });
  const date = new Date().toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv", day: "numeric", month: "long", year: "numeric" });
  doc.font("S").fontSize(10).fillColor(C.accent).text(`КОМЕРЦІЙНА ПРОПОЗИЦІЯ · ${date.toUpperCase()}`, M, H * 0.3, { width: CW, characterSpacing: 1.2 });
  doc.font("B").fontSize(34).fillColor(C.text).text(p.title?.trim() || l.title, M, H * 0.3 + 24, { width: CW, lineGap: 4 });
  y = doc.y + 16;
  doc.rect(M, y, 56, 4).fill(C.accent);
  y += 22;
  if (p.subtitle?.trim()) { rich(p.subtitle.trim(), M, y, CW * 0.86, 14, C.muted); y += height(p.subtitle, 14, CW * 0.86) + 14; }
  if (l.client_name) doc.font("R").fontSize(11).fillColor(C.dim).text(`Для: ${l.client_name}`, M, y, { width: CW });
  if (chosen && cc) {
    const cy = H - 190;
    card(M, cy, CW, 110, C.panel2, C.accent);
    doc.font("S").fontSize(10).fillColor(C.accent).text("РЕКОМЕНДУЄМО", M + 22, cy + 20, { characterSpacing: 1.2 });
    doc.font("B").fontSize(20).fillColor(C.text).text(`Пакет «${chosen.name}»`, M + 22, cy + 38, { width: CW * 0.55 });
    if (chosen.tagline) doc.font("R").fontSize(10.5).fillColor(C.muted).text(chosen.tagline, M + 22, cy + 66, { width: CW * 0.55 });
    doc.font("B").fontSize(26).fillColor(C.text).text(money(cc.month), M + CW * 0.58, cy + 30, { width: CW * 0.42 - 22, align: "right" });
    doc.font("R").fontSize(10).fillColor(C.muted).text(cc.setup ? `на місяць · запуск ${money(cc.setup)}` : "на місяць", M + CW * 0.58, cy + 64, { width: CW * 0.42 - 22, align: "right" });
  }

  // ── 2. Проблема і чому болить
  if (p.problem?.trim() || p.why?.trim()) {
    page();
    heading("Яку проблему вирішуємо");
    if (p.problem?.trim()) body(p.problem.trim());
    if (p.why?.trim()) {
      y += 8;
      const txt = p.why.trim();
      const h = measureBody(txt, CW - 44) + 52;
      need(h);
      const top = y;
      card(M, top, CW, h, C.panel2, C.line);
      doc.rect(M, top + 14, 3, h - 28).fill(C.accent);
      doc.font("S").fontSize(10).fillColor(C.accent).text("ЧОМУ ЦЕ ВАЖЛИВО САМЕ ДЛЯ ВАС", M + 22, top + 16, { characterSpacing: 1 });
      y = top + 36;
      body(txt, CW - 44, M + 22);
      y = top + h + 12;
    }
  }

  // ── 3. Що ми дамо
  if (p.offer?.trim()) { need(140); if (y > M + 20) y += 18; heading("Що ви отримаєте"); body(p.offer.trim()); }

  // ── 4. Що входить у послуги
  if (shown.length) {
    page();
    heading("Що входить", chosen ? `Пакет «${chosen.name}»` : undefined);
    for (const pr of shown) {
      const inc = includesList(pr.includes);
      const colW = (CW - 44) / 2;
      const rows = Math.ceil(inc.length / 2);
      const incH = inc.length ? Array.from({ length: rows }, (_, r) => Math.max(height(inc[r * 2] ?? "", 10, colW - 14), height(inc[r * 2 + 1] ?? "", 10, colW - 14)) + 5).reduce((a, b) => a + b, 0) + 6 : 0;
      const aboutH = pr.about ? height(pr.about, 10.5, CW - 44) + 4 : 0;
      const h = 22 + 18 + aboutH + incH + 14;
      need(h + 10);
      const top = y;
      card(M, top, CW, h);
      doc.font("B").fontSize(13).fillColor(C.text).text(pr.name, M + 22, top + 18, { width: CW - 44 });
      let iy = top + 40;
      if (pr.about) { rich(pr.about, M + 22, iy, CW - 44, 10.5, C.muted); iy += aboutH; }
      if (inc.length) {
        iy += 4;
        for (let r = 0; r < rows; r++) {
          const a = inc[r * 2], b = inc[r * 2 + 1];
          const h1 = a ? check(a, M + 22, iy, colW, 10, C.text) : 0;
          const h2 = b ? check(b, M + 22 + colW + 8, iy, colW, 10, C.text) : 0;
          iy += Math.max(h1, h2) + 5;
        }
      }
      y = top + h + 10;
    }
  }

  // ── 5. Як ми це зробимо
  if (l.stages.length) {
    need(160); y += 14;
    heading("Як ми це зробимо");
    l.stages.forEach((st, i) => {
      const h = 18 + (st.result ? height(`Результат: ${st.result}`, 10, CW - 64) + 4 : 0) + 10;
      need(h + 6);
      const top = y;
      doc.circle(M + 12, top + 10, 12).fill(C.panel2).circle(M + 12, top + 10, 12).lineWidth(1).stroke(C.accent);
      doc.font("B").fontSize(10).fillColor(C.text).text(String(i + 1), M, top + 5, { width: 24, align: "center" });
      if (i < l.stages.length - 1) doc.moveTo(M + 12, top + 24).lineTo(M + 12, top + h + 4).lineWidth(1).stroke(C.line);
      doc.font("S").fontSize(12).fillColor(C.text).text(st.title, M + 36, top + 2, { width: CW - 150 });
      if (st.duration) doc.font("R").fontSize(10).fillColor(C.accent).text(st.duration, M + CW - 110, top + 4, { width: 110, align: "right" });
      if (st.result) rich(`**Результат:** ${st.result}`, M + 36, top + 20, CW - 64, 10, C.muted);
      y = top + h + 6;
    });
  }

  // ── 6. Пакети
  if (l.packages.length) {
    page();
    heading("Пакети", "Оберіть рівень — усе можна розширити пізніше.");
    const calcs = l.packages.map((pk) => ({ pk, c: packageCalc(pk, l.products) }));
    for (let i = 0; i < calcs.length; i += 3) {
      const row = calcs.slice(i, i + 3);
      const gap = 12, cw = (CW - gap * (row.length - 1)) / row.length;
      const hOf = ({ pk, c }: (typeof calcs)[number]) => 26 + 26 + (pk.tagline ? height(pk.tagline, 9.5, cw - 32) + 6 : 0) + 34 + (c.setup ? 16 : 0) + 10
        + c.items.reduce((a, it) => a + height(it.name, 10, cw - 46) + 6, 0) + (c.hasMarket && c.saveYear > 0 ? 40 : 0) + 16;
      const h = Math.max(...row.map(hOf));
      need(h + 16);
      const top = y + 8;
      row.forEach(({ pk, c }, j) => {
        const x = M + j * (cw + gap);
        card(x, top, cw, h, pk.highlight ? C.panel2 : C.panel, pk.highlight ? C.accent : C.line);
        if (pk.highlight) {
          doc.roundedRect(x + cw - 112, top - 9, 96, 18, 9).fill(C.accent);
          doc.font("S").fontSize(8.5).fillColor("#fff").text("РЕКОМЕНДУЄМО", x + cw - 112, top - 4, { width: 96, align: "center", characterSpacing: 0.6 });
        }
        let cy = top + 22;
        doc.font("B").fontSize(15).fillColor(C.text).text(pk.name, x + 16, cy, { width: cw - 32 }); cy += 24;
        if (pk.tagline) { doc.font("R").fontSize(9.5).fillColor(C.muted).text(pk.tagline, x + 16, cy, { width: cw - 32, lineGap: 2 }); cy = doc.y + 8; }
        doc.font("B").fontSize(22).fillColor(C.text).text(money(c.month), x + 16, cy, { width: cw - 32, continued: true }).font("R").fontSize(10).fillColor(C.muted).text(" /міс");
        cy += 30;
        if (c.setup) { doc.font("R").fontSize(9.5).fillColor(C.dim).text(`+ запуск ${money(c.setup)}`, x + 16, cy, { width: cw - 32 }); cy += 16; }
        doc.moveTo(x + 16, cy + 2).lineTo(x + cw - 16, cy + 2).lineWidth(0.6).stroke(C.line); cy += 12;
        for (const it of c.items) cy += check(it.name, x + 16, cy, cw - 32, 10, C.text) + 6;
        if (c.hasMarket && c.saveYear > 0) {
          doc.font("S").fontSize(9.5).fillColor(C.ok).text(`Економія ${money(c.saveYear)} за рік`, x + 16, top + h - 44, { width: cw - 32 });
          doc.font("R").fontSize(8.5).fillColor(C.dim).text(`окремо ≈ ${money(c.marketMonth)}/міс`, x + 16, top + h - 30, { width: cw - 32 });
        }
      });
      y = top + h + 16;
    }
  }

  // ── 7. Чому вигідно
  const sv = cc ?? (l.packages.length === 1 ? packageCalc(l.packages[0], l.products) : null);
  const mm = l.products.reduce((a, x) => a + (x.market_month ?? x.price_month ?? 0), 0), ms = l.products.reduce((a, x) => a + (x.market_setup ?? x.price_setup ?? 0), 0);
  const hasM = sv ? sv.hasMarket && sv.saveYear > 0 : !l.packages.length && l.products.some((x) => x.market_month != null || x.market_setup != null) && ms + mm * 12 > fin.clientYear;
  if (hasM) {
    const market = sv ? sv.marketYear : ms + mm * 12, ours = sv ? sv.year : fin.clientYear;
    need(200); y += 14;
    heading("Чому це вигідно", "Порівняння за перший рік: те саме окремо в агенцій і фрилансерів — і у нас.");
    const kw = (CW - 24) / 3, top = y;
    const kpi = (i: number, label: string, val: string, color: string, sub: string) => {
      const x = M + i * (kw + 12);
      card(x, top, kw, 92, i === 2 ? C.panel2 : C.panel, i === 2 ? C.ok : C.line);
      doc.font("R").fontSize(9.5).fillColor(C.muted).text(label, x + 16, top + 16, { width: kw - 32 });
      doc.font("B").fontSize(20).fillColor(color).text(val, x + 16, top + 36, { width: kw - 32 });
      doc.font("R").fontSize(8.5).fillColor(C.dim).text(sub, x + 16, top + 66, { width: kw - 32 });
    };
    kpi(0, "Окремо на ринку", money(market), C.text, "агенція + фрилансери");
    kpi(1, "У нас", money(ours), C.text, "все в одних руках");
    kpi(2, "Ваша економія", money(market - ours), C.ok, `${Math.round(((market - ours) / market) * 100)}% за перший рік`);
    y = top + 92 + 14;
    body("І все в одних руках: реклама, заявки, CRM і звіти — без перекидання відповідальності між підрядниками.");
  }

  // ── 8. Рахунок
  if (shown.length) {
    const setup = cc ? cc.setup : fin.clientSetup, month = cc ? cc.month : fin.clientMonth;
    const rowH = (pr: LabProduct) => height(pr.name, 10.5, CW * 0.55 - 20) + 14;
    const h = 34 + shown.reduce((a, pr) => a + rowH(pr), 0) + 10;
    need(h + 190); y += 14;
    heading(chosen ? `Рахунок — пакет «${chosen.name}»` : "Рахунок");
    const top = y;
    card(M, top, CW, h);
    const c1 = M + 18, c2 = M + CW * 0.58, c3 = M + CW * 0.79, cw2 = CW * 0.21 - 18;
    doc.font("S").fontSize(9).fillColor(C.dim);
    doc.text("ПОСЛУГА", c1, top + 14, { characterSpacing: 0.8 }); doc.text("РАЗОВО", c2, top + 14, { width: cw2, align: "right", characterSpacing: 0.8 }); doc.text("ЩОМІСЯЦЯ", c3, top + 14, { width: cw2, align: "right", characterSpacing: 0.8 });
    let ry = top + 34;
    for (const pr of shown) {
      doc.moveTo(M + 14, ry - 4).lineTo(M + CW - 14, ry - 4).lineWidth(0.5).stroke(C.line);
      doc.font("R").fontSize(10.5).fillColor(C.text).text(pr.name, c1, ry + 2, { width: CW * 0.55 - 20 });
      doc.font("R").fontSize(10.5).fillColor(C.muted).text(pr.price_setup != null ? money(pr.price_setup) : "—", c2, ry + 2, { width: cw2, align: "right" });
      doc.text(pr.price_month != null ? money(pr.price_month) : "—", c3, ry + 2, { width: cw2, align: "right" });
      ry += rowH(pr);
    }
    y = top + h + 12;
    const tw = (CW - 12) / 2;
    card(M, y, tw, 78, C.panel2, C.accent);
    doc.font("R").fontSize(10).fillColor(C.muted).text("Перший платіж", M + 18, y + 16);
    doc.font("B").fontSize(22).fillColor(C.text).text(money(setup + month), M + 18, y + 32, { width: tw - 36 });
    doc.font("R").fontSize(8.5).fillColor(C.dim).text(setup ? "запуск + перший місяць" : "перший місяць", M + 18, y + 60, { width: tw - 36 });
    card(M + tw + 12, y, tw, 78);
    doc.font("R").fontSize(10).fillColor(C.muted).text("Далі щомісяця", M + tw + 30, y + 16);
    doc.font("B").fontSize(22).fillColor(C.text).text(money(month), M + tw + 30, y + 32, { width: tw - 36 });
    doc.font("R").fontSize(8.5).fillColor(C.dim).text("ведення і підтримка", M + tw + 30, y + 60, { width: tw - 36 });
    y += 78 + 10;
  }

  // ── 9. Підтримка і бонуси
  if (p.price?.trim()) { need(120); y += 14; heading("Ціна і підтримка"); body(p.price.trim()); }
  if (p.bonuses?.trim()) { need(120); y += 14; heading("Бонуси на підтримці"); body(p.bonuses.trim()); }

  // ── 10. Наступний крок
  need(130); y += 18;
  const top = y;
  card(M, top, CW, 96, C.panel2, C.accent);
  doc.font("B").fontSize(16).fillColor(C.text).text("Наступний крок", M + 22, top + 20, { width: CW - 44 });
  doc.font("R").fontSize(11).fillColor(C.muted).text(chosen ? `Підтвердьте пакет «${chosen.name}» — і ми надішлемо рахунок та план старту.` : "Оберіть пакет — і ми надішлемо рахунок та план старту.", M + 22, top + 46, { width: CW - 44, lineGap: 3 });

  // ── колонтитули
  const range = doc.bufferedPageRange();
  for (let i = 1; i < range.count; i++) {
    doc.switchToPage(i);
    doc.font("R").fontSize(8.5).fillColor(C.dim);
    if (opts.from) doc.text(opts.from, M, H - 36, { width: CW * 0.7, lineBreak: false });
    doc.text(`${i + 1} / ${range.count}`, M + CW - 60, H - 36, { width: 60, align: "right", lineBreak: false });
  }
  doc.end();
  return done;
}
