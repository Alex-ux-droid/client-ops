"use client";
// Клієнтські шматки конструктора кампаній: поле з кнопкою «Копіювати» і лічильником, кнопки Джері, завантаження креативу
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { folderAction, genBriefAction, genCopyAction, genDraftAction, genPlanAction, genTargetingAction, useVariantAction } from "@/app/campaigns/actions";

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
        {busy ? "Джері дивиться на креатив і пише… ~20 с" : has ? "✨ Ще варіанти" : "✨ Тексти під цей креатив"}
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
      <button type="button" className="small" disabled={busy} onClick={() => run(() => genDraftAction(campaignId), (r) => `Додав груп: ${r.adsets}, оголошень: ${r.ads}`)}>{busy ? "Джері збирає… ~1 хв" : "✨ Зібрати задум, групи і креативи"}</button>
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

export function MediaUpload({ adId, has, carousel }: { adId: number; has: boolean; carousel?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);
  const router = useRouter();
  const send = async (list: FileList | File[] | null | undefined) => {
    const files = [...(list ?? [])];
    if (!files.length) return;
    setBusy(true); setErr("");
    const fd = new FormData(); files.forEach((f) => fd.append("file", f));
    const r = await fetch(`/api/campaigns/ad/${adId}`, { method: "POST", body: fd }).then((x) => x.json()).catch(() => ({ error: "Не вдалось завантажити (файл завеликий або обірвався звʼязок)" }));
    setBusy(false);
    if (r.error) setErr(r.error); else { if (r.skipped) setErr(`Максимум 10 карток — ${r.skipped} не додано`); router.refresh(); }
    if (ref.current) ref.current.value = "";
  };
  return (
    <div className={`kp-drop${over ? " over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer.files); }}>
      <input ref={ref} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => send(e.target.files)} />
      <button type="button" className="ghost small" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? "Завантажую…" : carousel ? (has ? "+ Додати картки" : "Завантажити картки (кілька файлів)") : has ? "Замінити фото / відео" : "Завантажити фото / відео"}
      </button>
      <span className="mono">{carousel ? "виділи кілька файлів або перетягни пачкою, до 10" : "або перетягни сюди · кілька файлів = карусель"}</span>
      {err && <span className="kp-msg bad">{err}</span>}
    </div>
  );
}

// Картки каруселі: порядок ← →, прибрати
export function CardStrip({ adId, cards }: { adId: number; cards: number[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const op = async (o: string, file_id: number) => {
    setBusy(true);
    await fetch(`/api/campaigns/ad/${adId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: o, file_id }) }).catch(() => null);
    setBusy(false); router.refresh();
  };
  return (
    <div className="kp-cards-strip">
      {cards.map((id, i) => (
        <div key={id} className="kp-card-i">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/files/${id}`} alt="" />
          <span className="kp-card-n">{i + 1}</span>
          <span className="kp-card-a">
            <button type="button" className="ghost small" disabled={busy || i === 0} onClick={() => op("left", id)} aria-label="Вліво">←</button>
            <button type="button" className="ghost small" disabled={busy || i === cards.length - 1} onClick={() => op("right", id)} aria-label="Вправо">→</button>
            <button type="button" className="ghost small" disabled={busy} onClick={() => op("remove", id)} aria-label="Прибрати">✕</button>
          </span>
        </div>
      ))}
    </div>
  );
}

// Універсальна кнопка «Джері: …» з полем побажання (бриф креативу, задум кампанії)
export function GenWish({ kind, id, label, again, placeholder, wait = "Джері думає… ~20 с" }: { kind: "brief" | "plan"; id: number; label: string; again?: string; placeholder: string; wait?: string }) {
  const [wish, setWish] = useState("");
  const { busy, msg, run } = useRun();
  const fn = kind === "brief" ? genBriefAction : genPlanAction;
  return (
    <div className="kp-gen">
      <input value={wish} onChange={(e) => setWish(e.target.value)} placeholder={placeholder} />
      <button type="button" className="small" disabled={busy} onClick={() => run(() => fn(id, wish), () => "Готово")}>{busy ? wait : again ?? label}</button>
      {msg && <span className={`kp-msg${msg.ok ? "" : " bad"}`}>{msg.t}</span>}
    </div>
  );
}

export function FolderButton({ campaignId, url }: { campaignId: number; url?: string }) {
  const { busy, msg, run } = useRun();
  if (url) return <a href={url} target="_blank" rel="noreferrer" className="btn ghost small">📁 Папка на Диску ↗</a>;
  return (
    <span className="kp-gen-inline">
      <button type="button" className="ghost small" disabled={busy} onClick={() => run(() => folderAction(campaignId), () => "Створено")}>{busy ? "Створюю…" : "📁 Створити папку на Диску"}</button>
      {msg && !msg.ok && <span className="kp-msg bad">{msg.t}</span>}
    </span>
  );
}
