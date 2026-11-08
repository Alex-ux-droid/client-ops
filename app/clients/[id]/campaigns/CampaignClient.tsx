"use client";
// Клієнтські шматки конструктора кампаній: поле з кнопкою «Копіювати» і лічильником, кнопки Джері, завантаження креативу
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { creativePromptAction, genCopyAction, genDraftAction, genTargetingAction, useVariantAction } from "@/app/campaigns/actions";

async function copy(text: string) { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } }

export function CopyBtn({ text, label = "Копіювати", small = true }: { text: string; label?: string; small?: boolean }) {
  const [ok, setOk] = useState(false);
  return <button type="button" className={`ghost${small ? " small" : ""} kp-copy`} disabled={!text} onClick={async () => { if (await copy(text)) { setOk(true); setTimeout(() => setOk(false), 1500); } }}>{ok ? "✓" : label}</button>;
}

// Рядок «назва поля — значення — [Копіювати]» як у кабінеті Meta; ліміт — лічильник символів
export function CopyField({ label, value, limit, hint, multiline, soft }: { label: string; value: string; limit?: number; hint?: string; multiline?: boolean; soft?: boolean }) {
  const n = value.length;
  return (
    <div className={`kp-f${multiline ? " multi" : ""}`}>
      <div className="kp-f-h">
        <span className="kp-f-l">{label}{hint && <i>{hint}</i>}</span>
        {limit != null && value && <span className={`kp-cnt${n > limit ? (soft ? " near" : " over") : n > limit * 0.85 ? " near" : ""}`}>{n}/{limit}</span>}
        <CopyBtn text={value} />
      </div>
      <div className={`kp-f-v${value ? "" : " kp-none"}`}>{value || "—"}</div>
    </div>
  );
}

function useRun() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const router = useRouter();
  const run = async (fn: () => Promise<{ ok: boolean; error?: string } & Record<string, unknown>>, done: (r: Record<string, unknown>) => string) => {
    setBusy(true); setMsg(null);
    const r = await fn();
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, t: done(r) }); router.refresh(); } else setMsg({ ok: false, t: String(r.error ?? "Помилка") });
  };
  return { busy, msg, run };
}

export function GenCopy({ adId, has }: { adId: number; has: boolean }) {
  const [wish, setWish] = useState("");
  const { busy, msg, run } = useRun();
  return (
    <div className="kp-gen">
      <input value={wish} onChange={(e) => setWish(e.target.value)} placeholder="Побажання (необовʼязково): коротше, з ціною, на «ви»…" />
      <button type="button" className="small" disabled={busy} onClick={() => run(() => genCopyAction(adId, wish), () => "Готово — варіанти нижче")}>
        {busy ? "Джері пише… ~20 с" : has ? "✨ Ще варіанти" : "✨ Тексти від Джері"}
      </button>
      {msg && <span className={`kp-msg${msg.ok ? "" : " bad"}`}>{msg.t}</span>}
    </div>
  );
}

export function GenTargeting({ adsetId }: { adsetId: number }) {
  const [wish, setWish] = useState("");
  const { busy, msg, run } = useRun();
  return (
    <div className="kp-gen">
      <input value={wish} onChange={(e) => setWish(e.target.value)} placeholder="Побажання: напр. «тільки Київ +20 км», «власники бізнесу»" />
      <button type="button" className="small" disabled={busy} onClick={() => run(() => genTargetingAction(adsetId, wish), (r) => String(r.why || "Готово"))}>{busy ? "Джері думає…" : "✨ Таргетинг від Джері"}</button>
      {msg && <span className={`kp-msg${msg.ok ? "" : " bad"}`}>{msg.t}</span>}
    </div>
  );
}

export function GenDraft({ campaignId }: { campaignId: number }) {
  const { busy, msg, run } = useRun();
  return (
    <span className="kp-gen-inline">
      <button type="button" className="small" disabled={busy} onClick={() => run(() => genDraftAction(campaignId), (r) => `Додав груп: ${r.adsets}, оголошень: ${r.ads}`)}>{busy ? "Джері збирає… ~40 с" : "✨ Зібрати групи й оголошення"}</button>
      {msg && <span className={`kp-msg${msg.ok ? "" : " bad"}`}>{msg.t}</span>}
    </span>
  );
}

export function UseVariant({ adId, field, value, current }: { adId: number; field: "primary_text" | "headline" | "description"; value: string; current: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className={`kp-var${current ? " on" : ""}`}>
      <span>{value}</span>
      <span className="kp-var-a">
        <i className="kp-cnt">{value.length}</i>
        <CopyBtn text={value} label="⧉" />
        {!current && <button type="button" className="ghost small" disabled={busy} onClick={async () => { setBusy(true); await useVariantAction(adId, field, value); setBusy(false); router.refresh(); }}>Взяти</button>}
      </span>
    </div>
  );
}

export function MediaUpload({ adId, has }: { adId: number; has: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);
  const router = useRouter();
  const send = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true); setErr("");
    const fd = new FormData(); fd.append("file", f);
    const r = await fetch(`/api/campaigns/ad/${adId}`, { method: "POST", body: fd }).then((x) => x.json()).catch(() => ({ error: "Не вдалось завантажити" }));
    setBusy(false);
    if (r.error) setErr(r.error); else router.refresh();
  };
  return (
    <div className={`kp-drop${over ? " over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer.files[0]); }}>
      <input ref={ref} type="file" accept="image/*,video/*" hidden onChange={(e) => send(e.target.files?.[0])} />
      <button type="button" className="ghost small" disabled={busy} onClick={() => ref.current?.click()}>{busy ? "Завантажую…" : has ? "Замінити фото / відео" : "Завантажити фото / відео"}</button>
      <span className="mono">або перетягни сюди</span>
      {err && <span className="kp-msg bad">{err}</span>}
    </div>
  );
}

export function CreativePrompt({ adId, code }: { adId: number; code?: string }) {
  const [p, setP] = useState<{ prompt: string; code: string } | null>(null);
  const { busy, msg, run } = useRun();
  return (
    <div className="stack" style={{ gap: "0.5rem" }}>
      <div className="kp-gen-inline">
        <button type="button" className="ghost small" disabled={busy} onClick={() => run(async () => { const r = await creativePromptAction(adId); if (r.ok) setP({ prompt: r.prompt, code: r.code }); return r; }, () => "")}>
          {busy ? "Джері пише промпт… ~30 с" : code ? `Промпт ${code} для Claude` : "✨ Промпт для Claude (намалювати креатив)"}
        </button>
        {p && <CopyBtn text={p.prompt} label={`Скопіювати промпт ${p.code}`} small />}
        {msg && !msg.ok && <span className="kp-msg bad">{msg.t}</span>}
      </div>
      {p && <p className="mono" style={{ margin: 0 }}>Встав у Claude (першим повідомленням — «Контекст клієнта» з кнопки нижче), збережи картинку і завантаж сюди.</p>}
    </div>
  );
}
