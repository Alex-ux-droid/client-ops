// PDF з markdown без браузера: pdfkit + фірмовий шрифт Onest (assets/fonts, ліцензія OFL).
// Вміє: # заголовки, абзаци, списки (- • 1.), чекліст [ ] / [x], **жирне**, --- лінія, таблиці | a | b | (простою сіткою).
import path from "node:path";
import PDFDocument from "pdfkit";

const FONT = (f: string) => path.join(process.cwd(), "assets", "fonts", f);
const ACCENT = "#3d6bff", TEXT = "#14161c", MUTED = "#5b6474", LINE = "#d9dee8";

type Doc = PDFKit.PDFDocument;

// Рядок з **жирним** — шматками через continued
function rich(doc: Doc, text: string, opts: PDFKit.Mixins.TextOptions = {}, at?: { x: number; y: number }, size = 10.5) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== "");
  if (!parts.length) { doc.moveDown(0.3); return; }
  parts.forEach((p, i) => {
    const bold = p.startsWith("**") && p.endsWith("**");
    const t = bold ? p.slice(2, -2) : p.replace(/`/g, "");
    const o = { ...opts, continued: i < parts.length - 1 };
    doc.font(bold ? "B" : "R").fontSize(size).fillColor(TEXT);
    if (i === 0 && at) doc.text(t, at.x, at.y, o); else doc.text(t, o);
  });
}

function table(doc: Doc, rows: string[][]) {
  const left = doc.page.margins.left, width = doc.page.width - left - doc.page.margins.right;
  const cols = Math.max(...rows.map((r) => r.length));
  const w = width / cols;
  rows.forEach((r, ri) => {
    const h = Math.max(...r.map((c) => doc.font(ri ? "R" : "B").fontSize(9.5).heightOfString(c, { width: w - 10 }))) + 8;
    if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const y = doc.y;
    if (ri === 0) doc.rect(left, y, width, h).fill("#eef2fb");
    r.forEach((c, ci) => doc.font(ri ? "R" : "B").fontSize(9.5).fillColor(TEXT).text(c, left + ci * w + 5, y + 4, { width: w - 10 }));
    doc.moveTo(left, y + h).lineTo(left + width, y + h).strokeColor(LINE).lineWidth(0.5).stroke();
    doc.x = left; doc.y = y + h;
  });
  doc.moveDown(0.6);
}

export async function markdownToPdf(title: string, md: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margins: { top: 56, bottom: 56, left: 54, right: 54 }, info: { Title: title, Author: "Client Ops · Джері" }, bufferPages: true });
  doc.registerFont("R", FONT("Onest-Regular.ttf"));
  doc.registerFont("S", FONT("Onest-SemiBold.ttf"));
  doc.registerFont("B", FONT("Onest-Bold.ttf"));
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  // Шапка: дрібно «Client Ops · дата», великий заголовок, синя риска
  const date = new Date().toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv", day: "numeric", month: "long", year: "numeric" });
  doc.font("S").fontSize(8.5).fillColor(MUTED).text(`CLIENT OPS · ${date}`, { characterSpacing: 0.6 });
  doc.moveDown(0.4);
  doc.font("B").fontSize(22).fillColor(TEXT).text(title, { lineGap: 2 });
  doc.moveDown(0.3);
  doc.rect(doc.page.margins.left, doc.y, 46, 3).fill(ACCENT);
  doc.moveDown(1.2);

  const lines = md.replace(/\r/g, "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], l = raw.trim();
    if (!l) { doc.moveDown(0.35); continue; }
    if (/^\|.*\|$/.test(l)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        const cells = lines[i].trim().slice(1, -1).split("|").map((c) => c.trim().replace(/\*\*/g, ""));
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      i--;
      table(doc, rows);
      continue;
    }
    if (/^-{3,}$/.test(l)) {
      doc.moveDown(0.3);
      doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor(LINE).lineWidth(0.8).stroke();
      doc.moveDown(0.6);
      continue;
    }
    const h = l.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const size = h[1].length === 1 ? 16 : h[1].length === 2 ? 13.5 : 11.5;
      doc.moveDown(h[1].length === 1 ? 0.6 : 0.4);
      doc.font("B").fontSize(size).fillColor(h[1].length === 1 ? TEXT : "#1f2a4d").text(h[2].replace(/\*\*/g, ""));
      doc.moveDown(0.25);
      continue;
    }
    const check = l.match(/^[-*•]\s+\[( |x|X)\]\s+(.*)$/);
    const bullet = l.match(/^[-*•]\s+(.*)$/);
    const num = l.match(/^(\d+)[.)]\s+(.*)$/);
    if (check || bullet || num) {
      const indent = doc.page.margins.left + (raw.match(/^\s*/)![0].length >= 2 ? 16 : 0);
      const body = check ? check[2] : num ? num[2] : bullet![1];
      if (doc.y > doc.page.height - doc.page.margins.bottom - 20) doc.addPage();
      const y = doc.y;
      // маркер малюємо самі (не всі символи є в шрифті)
      if (check) {
        doc.roundedRect(indent, y + 2.2, 9, 9, 2).lineWidth(1).strokeColor(ACCENT).stroke();
        if (check[1].trim()) doc.moveTo(indent + 2, y + 6.8).lineTo(indent + 4, y + 9).lineTo(indent + 7.5, y + 4.2).lineWidth(1.4).strokeColor(ACCENT).stroke();
      } else if (num) {
        doc.font("S").fontSize(10.5).fillColor(ACCENT).text(`${num[1]}.`, indent, y, { width: 16, lineBreak: false });
      } else {
        doc.circle(indent + 3.5, y + 6.8, 1.8).fill(MUTED);
      }
      rich(doc, body, { width: doc.page.width - indent - 18 - doc.page.margins.right, lineGap: 1.5 }, { x: indent + 18, y });
      doc.x = doc.page.margins.left;
      doc.moveDown(0.2);
      continue;
    }
    // звичайний абзац; рядок-лише-жирне = підзаголовок
    doc.x = doc.page.margins.left;
    rich(doc, l, { lineGap: 2 });
    doc.moveDown(0.25);
  }

  // Номери сторінок
  const range = doc.bufferedPageRange();
  for (let p = range.start; p < range.start + range.count; p++) {
    doc.switchToPage(p);
    doc.page.margins.bottom = 0; // інакше підпис унизу створює нову сторінку
    const y = doc.page.height - 36;
    doc.font("R").fontSize(8).fillColor(MUTED).text(`Client Ops · ${p + 1}/${range.count}`, doc.page.margins.left, y, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: "right", lineBreak: false });
  }
  doc.end();
  return done;
}
