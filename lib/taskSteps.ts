// Інструкція задачі → кроки: кожен «## …» — окрема вкладка. Галочки «- [ ] …» всередині кроку — його прогрес.
// Чисті функції: і для вікна задачі, і для контексту Джері.
export type Step = { title: string; md: string; start: number; total: number; done: number; name: string; time: string };
// «Крок 2. Набір Україна (15 хв)» → name «Набір Україна», time «15 хв» (номер показує кружечок)
const nameOf = (t: string) => t.replace(/^крок\s*\d+[.:)]?\s*/i, "").replace(/\s*\(([^)]*(хв|год|min|h)[^)]*)\)\s*$/i, "").trim() || t;
const timeOf = (t: string) => t.match(/\(([^)]*(хв|год|min|h)[^)]*)\)\s*$/i)?.[1] ?? "";
export type Steps = { intro: { md: string; start: number }; steps: Step[] };

const CHECK = /^\s*[-*]\s+\[([ xX])\]\s+/;

export function splitSteps(md: string): Steps {
  const lines = (md || "").replace(/\r/g, "").split("\n");
  const steps: Step[] = [];
  let intro: string[] = [];
  let cur: Step | null = null;
  let buf: string[] = [];
  let inFence = false;
  const flush = () => { if (cur) { cur.md = buf.join("\n"); steps.push(cur); } };
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const h = !inFence && line.match(/^##\s+(.*)$/);
    if (h) { flush(); const title = h[1].trim(); cur = { title, name: nameOf(title), time: timeOf(title), md: "", start: i + 1, total: 0, done: 0 }; buf = []; return; }
    if (cur) {
      buf.push(line);
      const c = !inFence && line.match(CHECK);
      if (c) { cur.total++; if (c[1] !== " ") cur.done++; }
    } else intro.push(line);
  });
  flush();
  // «## Огляд / Коротко / Підсумок» першим — це не крок, а частина вкладки «Огляд»
  let introMd = intro.join("\n").trim();
  if (steps[0] && /^(огляд|коротко|підсумок|суть|загальне)/i.test(steps[0].title) && steps[0].total === 0) {
    introMd = [introMd, steps[0].md.trim()].filter(Boolean).join("\n\n");
    steps.shift();
  }
  return { intro: { md: introMd, start: 0 }, steps };
}

// Перемкнути галочку в рядку line (номер рядка в усій інструкції)
export function toggleLine(md: string, line: number, value?: boolean): string {
  const lines = md.replace(/\r/g, "").split("\n");
  const l = lines[line];
  if (l == null || !CHECK.test(l)) return md;
  const now = /\[[xX]\]/.test(l);
  const next = value ?? !now;
  lines[line] = l.replace(/\[([ xX])\]/, next ? "[x]" : "[ ]");
  return lines.join("\n");
}

// Відмітити всі галочки кроку
export function setStepDone(md: string, step: Step, value: boolean): string {
  let out = md;
  const n = step.md.split("\n").length;
  for (let i = step.start; i < step.start + n; i++) out = toggleLine(out, i, value);
  return out;
}

// Короткий підсумок для Джері: які кроки і скільки відмічено
export function stepsSummary(md: string): string {
  const { steps } = splitSteps(md);
  if (!steps.length) return "";
  return steps.map((s, i) => `${i + 1}. ${s.title}${s.total ? ` — ${s.done}/${s.total}${s.done === s.total ? " ✓" : ""}` : ""}`).join("\n");
}
