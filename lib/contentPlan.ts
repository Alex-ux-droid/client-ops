// Автоплан місяця: слоти рахує код (частота з Налаштувань студії, дні й час публікацій, рубрики за частками),
// Джері дає теми тижнів, тему і хук кожного поста і підбирає кадри з матеріалів (тільки реальні файли клієнта).
// Далі «Підготувати»: у фоні тексти + збірка кожної ідеї → «Готується», Саша переглядає і шле на апрув.
import { db } from "./db";
import { fillPostTexts } from "./contentCopy";
import { renderPost } from "./contentPipeline";
import { askJson } from "./llmJson";
import { logError } from "./log";
import { addPost, listAssets, listPillars, setWeekTheme, updatePost, weekThemes, type Post } from "./repo/content";
import { getSetting, setSetting } from "./repo/settings";
import { FORMATS, cadenceOf, getSocial, slotsOf, type Format } from "./repo/social";
import { getAnalysis } from "./socialAnalysis";
import { getReview } from "./contentReview";

const day = (s: string, n: number) => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const wd = (s: string) => ((new Date(`${s}T12:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1 = Пн … 7 = Нд
const kyivToday = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 10);
const TEMPLATE: Partial<Record<Format, string>> = { story: "story-fact", carousel: "carousel-feature", reel: "reel-kinetic" };
const FRAMES: Record<Format, [number, number]> = { story: [1, 1], post: [1, 1], carousel: [4, 6], reel: [3, 5] };
export const AUTO_NOTE = "Автоплан";

type Slot = { n: number; date: string; time: string; format: Format; pillar_id: number | null; pillar: string };

// Слоти на місяць: від завтра (або 1-го) до кінця місяця, по тижнях; стрічка (Reels/карусель/пост) — не більше 1 на день,
// спершу дні з часом публікації; сторіс — у дні без стрічки, потім будь-які. Вже заплановане в тижні враховується.
export function monthSlots(clientId: number, month: string): Slot[] {
  const sp = getSocial(clientId), cad = cadenceOf(sp), times = slotsOf(sp);
  const from = [`${month}-01`, day(kyivToday(), 1)].sort()[1];
  const last = day(`${day(`${month}-28`, 7).slice(0, 7)}-01`, -1);
  if (from > last) return [];
  const existing = db().prepare("SELECT format, substr(scheduled_at, 1, 10) d FROM content_posts WHERE client_id = ? AND scheduled_at >= ? AND scheduled_at < ? AND status != 'rejected'")
    .all(clientId, day(from, -7), day(last, 8)) as { format: Format; d: string }[];
  const out: Omit<Slot, "n" | "pillar_id" | "pillar">[] = [];
  for (let w = day(from, 1 - wd(from)); w <= last; w = day(w, 7)) {
    const days = Array.from({ length: 7 }, (_, i) => day(w, i)).filter((d) => d >= from && d <= last);
    if (!days.length) continue;
    const share = days.length / 7;
    const inWeek = existing.filter((e) => e.d >= w && e.d < day(w, 7));
    const need = (f: Format) => Math.max(0, Math.round(cad[f] * share) - inWeek.filter((e) => e.format === f).length);
    const feedDays = new Set(inWeek.filter((e) => e.format !== "story").map((e) => e.d));
    const storyDays = new Set(inWeek.filter((e) => e.format === "story").map((e) => e.d));
    // Черга стрічки впереміш: Reels, карусель, Reels, карусель…, пост
    const q: Format[] = [];
    for (let r = need("reel"), c = need("carousel"); r > 0 || c > 0;) { if (r > 0) { q.push("reel"); r--; } if (c > 0) { q.push("carousel"); c--; } }
    for (let i = need("post"); i > 0; i--) q.push("post");
    const pref = [...days].sort((a, b) => Number(!times[String(wd(a))]) - Number(!times[String(wd(b))]) || [2, 4, 6, 3, 5, 1, 7].indexOf(wd(a)) - [2, 4, 6, 3, 5, 1, 7].indexOf(wd(b)));
    for (const f of q) {
      const d = pref.find((x) => !feedDays.has(x));
      if (!d) break;
      feedDays.add(d);
      out.push({ date: d, time: times[String(wd(d))] || "18:30", format: f });
    }
    const sDays = [...days.filter((d) => !feedDays.has(d)), ...days.filter((d) => feedDays.has(d))].filter((d) => !storyDays.has(d));
    const spread = (k: number) => Array.from({ length: Math.min(k, sDays.length) }, (_, i) => sDays[Math.floor((i * sDays.length) / Math.min(k, sDays.length))]);
    for (const d of spread(need("story")).sort()) out.push({ date: d, time: "12:30", format: "story" });
  }
  out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  // Рубрики за частками: щоразу та, що найбільше «недобрала» свою частку
  const pillars = listPillars(clientId).filter((p) => p.share > 0);
  const sum = pillars.reduce((a, p) => a + p.share, 0) || 1;
  const used = new Map<number, number>();
  return out.map((s, i) => {
    const p = pillars.length ? [...pillars].sort((a, b) => (used.get(a.id) ?? 0) / (a.share / sum) - (used.get(b.id) ?? 0) / (b.share / sum))[0] : null;
    if (p) used.set(p.id, (used.get(p.id) ?? 0) + 1);
    return { ...s, n: i + 1, pillar_id: p?.id ?? null, pillar: p ? `${p.name}${p.goal ? ` — ${p.goal}` : ""}` : "" };
  });
}

export async function planMonth(clientId: number, month: string, replace: boolean): Promise<string> {
  const first = `${month}-01`, end = `${day(`${month}-28`, 7).slice(0, 7)}-01`;
  if (replace) db().prepare("DELETE FROM content_posts WHERE client_id = ? AND status = 'idea' AND note LIKE ? AND scheduled_at >= ? AND scheduled_at < ?").run(clientId, `${AUTO_NOTE}%`, first, end);
  const slots = monthSlots(clientId, month);
  if (!slots.length) return "Нема вільних слотів: місяць минув або план уже заповнений за частотою (Налаштування студії → частота).";
  const sp = getSocial(clientId);
  const assets = listAssets(clientId).filter((a) => a.mime.startsWith("image/") && ["render", "photo", "plan"].includes(a.kind)).slice(0, 160);
  if (!assets.length) return "Нема кадрів у матеріалах — Контент → Матеріали → «Оновити з Диску».";
  const allowed = new Map(assets.map((a) => [a.id, a]));
  const weeks = [...new Set(slots.map((s) => day(s.date, 1 - wd(s.date))))];
  const themes = weekThemes(clientId, weeks[0], day(weeks.at(-1)!, 6));
  const recent = (db().prepare("SELECT topic FROM content_posts WHERE client_id = ? ORDER BY id DESC LIMIT 40").all(clientId) as { topic: string }[]).map((r) => r.topic).filter(Boolean);
  const an = getAnalysis(clientId), rv = getReview(clientId);
  const r = await askJson<{ weeks?: Record<string, string>; posts?: { n: number; topic: string; hook: string; assets: number[] }[] }>(
    `Ти контент-стратег забудовника. Плануєш місяць публікацій в Instagram українською. Тільки факти з блоку ФАКТИ і тільки кадри зі списку КАДРИ (за id) — нічого не вигадуй: цифр, термінів, зручностей, яких нема. Теми не повторюють ОСТАННІ ТЕМИ і одна одну. Кожен пост — одна чітка думка під свою рубрику і тему тижня; хук — перша фраза, що зупиняє гортання (до 60 символів). Кадри підбирай під тему: сторіс і пост — 1 рендер/фото; карусель — 4–6 (перший — найефектніший рендер для обкладинки, планування доречні); Reels — 3–5 рендерів з різних ракурсів. Не став той самий кадр у сусідні пости. Поверни ТІЛЬКИ JSON: {"weeks": {"YYYY-MM-DD понеділок": "тема тижня до 40 символів"}, "posts": [{"n": номер слота, "topic": "тема до 80 символів", "hook": "хук", "assets": [id кадрів]}]} — по одному запису на КОЖЕН слот.`,
    [
      `ДЛЯ КОГО: ${sp?.audience ?? ""}\nТОН: ${sp?.voice ?? ""}\nЗАБОРОНЕНО: ${sp?.banned ?? ""}\nФАКТИ:\n${sp?.facts ?? ""}`,
      an ? `ЩО ПОКАЗАВ АНАЛІЗ АКАУНТА:\nпрацює: ${an.works.join("; ")}\nслабко: ${an.weak.join("; ")}\nдії: ${an.actions.join("; ")}` : "",
      rv ? `РОЗБІР НАШИХ ПОСТІВ (${rv.period}) — ВРАХУЙ:\nзайшло: ${rv.works.join("; ")}\nслабко: ${rv.weak.join("; ")}\nзмінити: ${rv.next.join("; ")}` : "",
      `ТЕМИ ТИЖНІВ (вже задані — не міняй; порожні — придумай):\n${weeks.map((w) => `${w}: ${themes[w] ?? ""}`).join("\n")}`,
      `ОСТАННІ ТЕМИ:\n${recent.join("\n") || "—"}`,
      `КАДРИ (id | тип | назва | теги):\n${assets.map((a) => `${a.id} | ${a.kind === "plan" ? "планування" : a.kind === "photo" ? "фото" : "рендер"} | ${a.name} | ${a.tags}`).join("\n")}`,
      `СЛОТИ (n | дата | формат | рубрика):\n${slots.map((s) => `${s.n} | ${s.date} | ${FORMATS[s.format]} | ${s.pillar || "—"}`).join("\n")}`,
    ].filter(Boolean).join("\n\n"),
    { maxTokens: 16000, effort: "medium" });
  for (const w of weeks) if (!themes[w] && r.weeks?.[w]) setWeekTheme(clientId, w, String(r.weeks[w]).slice(0, 80));
  const byN = new Map((r.posts ?? []).map((p) => [Number(p.n), p]));
  const uses = new Map<number, number>();
  let made = 0;
  for (const s of slots) {
    const g = byN.get(s.n);
    if (!g?.topic) continue;
    const [min, max] = FRAMES[s.format];
    const ids = [...new Set((g.assets ?? []).map(Number))].filter((id) => allowed.has(id) && !((s.format === "story" || s.format === "post") && allowed.get(id)!.kind === "plan")).slice(0, max);
    // Бракує кадрів — доберемо найменш вживані рендери
    for (const a of [...assets].filter((a) => a.kind !== "plan").sort((x, y) => (uses.get(x.id) ?? 0) - (uses.get(y.id) ?? 0))) { if (ids.length >= min) break; if (!ids.includes(a.id)) ids.push(a.id); }
    ids.forEach((id) => uses.set(id, (uses.get(id) ?? 0) + 1));
    const spec = s.format === "story" || s.format === "post" ? { asset_id: ids[0] } : { slides: ids.map((asset_id, i) => ({ asset_id, pos: i + 1, title: "", text: "" })) };
    const id = addPost(clientId, { format: s.format, pillar_id: s.pillar_id, topic: String(g.topic).slice(0, 300), hook: String(g.hook ?? "").slice(0, 300), template_key: TEMPLATE[s.format] ?? "", scheduled_at: `${s.date} ${s.time}`, note: AUTO_NOTE, status: "idea" });
    updatePost(id, clientId, { spec_json: JSON.stringify(spec), asset_ids: ids.join(",") });
    made++;
  }
  return made ? `✓ Заплановано ${made} постів (${countBy(slots)}). Далі — «Підготувати»: тексти і збірка всіх ідей.` : "Джері не повернув план — спробуй ще раз.";
}
const countBy = (s: Slot[]) => (Object.keys(FORMATS) as Format[]).map((f) => [FORMATS[f], s.filter((x) => x.format === f).length] as const).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(", ");

// ---- Підготовка у фоні: тексти + збірка кожної ідеї місяця з шаблоном. Стан — settings content.prep.<cid>.
export type Prep = { at: string; running: boolean; total: number; done: number; errors: string[] };
export const getPrep = (clientId: number): Prep | null => { try { return JSON.parse(getSetting(`content.prep.${clientId}`) ?? "null"); } catch { return null; } };
const running = new Set<number>();
export function prepIdeas(clientId: number, month: string): Prep["total"] {
  if (running.has(clientId)) return -1;
  const end = `${day(`${month}-28`, 7).slice(0, 7)}-01`;
  const list = db().prepare("SELECT * FROM content_posts WHERE client_id = ? AND status = 'idea' AND template_key != '' AND scheduled_at >= ? AND scheduled_at < ? ORDER BY scheduled_at").all(clientId, `${month}-01`, end) as Post[];
  if (!list.length) return 0;
  running.add(clientId);
  const st: Prep = { at: new Date().toISOString(), running: true, total: list.length, done: 0, errors: [] };
  const save = () => setSetting(`content.prep.${clientId}`, JSON.stringify(st));
  save();
  void (async () => {
    for (const p of list) {
      try {
        const err = (await fillPostTexts(p.id)) ?? (await renderPost(p.id));
        if (err) { st.errors.push(`${p.scheduled_at?.slice(8, 10)}.${p.scheduled_at?.slice(5, 7)} «${p.topic.slice(0, 40)}»: ${err}`); updatePost(p.id, clientId, { publish_error: err }); }
      } catch (e) { st.errors.push(`«${p.topic.slice(0, 40)}»: ${e instanceof Error ? e.message : "помилка"}`); logError("content-prep", e); }
      st.done++; save();
    }
  })().finally(() => { running.delete(clientId); st.running = false; save(); });
  return list.length;
}
