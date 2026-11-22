// Копірайтинг постів студії контенту (спільне для кнопки «Джері, заповни» і автоплану)
import { askJson, llmErrorText } from "./llmJson";
import { getAsset, getPost, updatePost } from "./repo/content";
import { getSocial } from "./repo/social";

const COPY_RULES = "Пишеш українською, коротко, без води і кліше. Тільки факти з блоку ФАКТИ — нічого не вигадуй (цифр, обіцянок, термінів, зручностей, яких там нема). Якщо фактів бракує — пиши загальніше, але не вигадуй.";
// Тексти поста за шаблоном (сторіс / карусель / Reels) — тільки з фактів клієнта. Повертає помилку або null.
export async function fillPostTexts(id: number): Promise<string | null> {
  const p = getPost(id);
  if (!p) return "Поста нема";
  const cid = p.client_id, sp = getSocial(cid);
  const ctx = `ТЕМА: ${p.topic}\nХУК: ${p.hook}\nДЛЯ КОГО: ${sp?.audience ?? ""}\nТОН: ${sp?.voice ?? ""}\nCTA (обирай звідси): ${sp?.cta ?? ""}\nЗАБОРОНЕНО: ${sp?.banned ?? ""}\nФАКТИ:\n${sp?.facts ?? ""}`;
  const prev = JSON.parse(p.spec_json || "{}");
  try {
    if (p.format === "reel" || p.template_key.startsWith("reel")) {
      const sl = ((prev.slides ?? []) as { asset_id: number; title?: string; pos: number }[]).sort((a, b) => a.pos - b.pos);
      if (sl.length < 2) throw new Error("Спершу обери кадри (2–5) і натисни «Зберегти»");
      const frames = sl.map((x, i) => { const a = getAsset(x.asset_id); return `${i + 1}. ${a?.kind === "plan" ? "планування" : "фото/рендер"}: ${a?.name ?? ""}${a?.tags ? ` (${a.tags})` : ""}`; }).join("\n");
      const r = await askJson<{ kicker: string; lines: string[]; end_title: string; cta: string; caption: string }>(
        `Ти сценарист коротких Reels для забудовника: кадри по 3 с, на кожному один рядок великим шрифтом. ${COPY_RULES} Перший рядок — хук, що зупиняє гортання; далі по рядку на кадр, що відповідає кадру; разом — одна думка. Поверни ТІЛЬКИ JSON: {"kicker": "1–3 слова над першим рядком", "lines": ["рядок до 38 символів"], "end_title": "фінал до 40 символів", "cta": "до 24 символів", "caption": "підпис 200–500 символів: хук, користь, CTA, 3–5 хештегів"}. Рядків рівно ${sl.length}.`,
        `${ctx}\nКАДРИ ПО ПОРЯДКУ:\n${frames}`, { maxTokens: 1500, effort: "low" });
      const slides = sl.map((x, i) => ({ ...x, title: String(r.lines?.[i] ?? x.title ?? "").slice(0, 80) }));
      updatePost(id, cid, { spec_json: JSON.stringify({ ...prev, slides, kicker: String(r.kicker ?? "").slice(0, 40), end_title: String(r.end_title ?? "").slice(0, 70), cta: String(r.cta ?? "").slice(0, 30) }), caption: String(r.caption ?? "").slice(0, 2200), publish_error: "" });
    } else if (p.format === "carousel" || p.template_key.startsWith("carousel")) {
      const sl = ((prev.slides ?? []) as { asset_id: number; title?: string; text?: string; pos: number }[]).sort((a, b) => a.pos - b.pos);
      if (sl.length < 3) throw new Error("Спершу обери кадри (щонайменше 3) і натисни «Зберегти»");
      const frames = sl.slice(1).map((x, i) => { const a = getAsset(x.asset_id); return `${i + 1}. ${a?.kind === "plan" ? "планування" : "фото/рендер"}: ${a?.name ?? ""}${a?.tags ? ` (${a.tags})` : ""}`; }).join("\n");
      const r = await askJson<{ kicker: string; title: string; sub: string; slides: { title: string; text: string }[]; end_title: string; end_text: string; cta: string; caption: string }>(
        `Ти копірайтер каруселей Instagram для забудовника. ${COPY_RULES} Карусель: обкладинка-хук → слайди (по одному на кадр, теза має відповідати кадру) → фінальний слайд із закликом. Поверни ТІЛЬКИ JSON: {"kicker": "2–4 слова", "title": "хук обкладинки до 50 символів", "sub": "до 60 символів", "slides": [{"title": "теза до 55 символів", "text": "пояснення до 110 символів"}], "end_title": "до 45 символів", "end_text": "до 110 символів", "cta": "до 24 символів", "caption": "підпис до поста 300–600 символів: перший рядок — хук, далі користь, заклик зберегти, CTA, 3–5 хештегів"}. Слайдів рівно ${sl.length - 1}.`,
        `${ctx}\nКАДРИ ПО ПОРЯДКУ:\n${frames}`, { maxTokens: 2000, effort: "low" });
      const slides = sl.map((x, i) => (i === 0 ? x : { ...x, title: String(r.slides?.[i - 1]?.title ?? x.title ?? "").slice(0, 80), text: String(r.slides?.[i - 1]?.text ?? x.text ?? "").slice(0, 160) }));
      updatePost(id, cid, { spec_json: JSON.stringify({ ...prev, slides, kicker: String(r.kicker ?? "").slice(0, 40), fact: String(r.title ?? "").slice(0, 70), sub: String(r.sub ?? "").slice(0, 140), end_title: String(r.end_title ?? "").slice(0, 70), end_text: String(r.end_text ?? "").slice(0, 160), cta: String(r.cta ?? "").slice(0, 30) }), caption: String(r.caption ?? "").slice(0, 2200), publish_error: "" });
    } else {
      const r = await askJson<{ kicker: string; fact: string; sub: string; cta: string }>(
        `Ти копірайтер сторіс для забудовника. ${COPY_RULES} Поверни ТІЛЬКИ JSON: {"kicker": "2–3 слова, тема", "fact": "головна фраза до 40 символів", "sub": "пояснення до 90 символів", "cta": "заклик до 24 символів"}.`,
        ctx, { maxTokens: 800, effort: "low" });
      updatePost(id, cid, { spec_json: JSON.stringify({ ...prev, kicker: String(r.kicker ?? "").slice(0, 40), fact: String(r.fact ?? "").slice(0, 70), sub: String(r.sub ?? "").slice(0, 140), cta: String(r.cta ?? "").slice(0, 30) }), template_key: p.template_key || "story-fact", publish_error: "" });
    }
  } catch (e) {
    const err = e instanceof Error && e.message.startsWith("Спершу") ? e.message : llmErrorText(e);
    updatePost(id, cid, { publish_error: err });
    return err;
  }
  return null;
}
