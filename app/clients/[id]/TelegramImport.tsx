"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { openAssistant } from "@/components/assistant";

// Завантаження експорту чату з Telegram Desktop у картку клієнта
export default function TelegramImport({ clientId, compact = false }: { clientId: number; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [done, setDone] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setMsg(null);
    const fd = new FormData();
    fd.append("client_id", String(clientId));
    for (const f of Array.from(files)) fd.append("files", f);
    try {
      const r = await fetch("/api/telegram/import", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Не вийшло");
      setMsg({ ok: true, text: `«${d.title}»: додано ${d.added} повідомл.${d.skipped ? `, ${d.skipped} вже були` : ""}` });
      setDone(true);
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Не вийшло" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`card stack tg-import ${compact ? "compact" : ""}`}>
      <div>
        <h2>Історія з Telegram</h2>
        <div className="mono" style={{ color: "var(--dim)" }}>Завантаж експорт чату — вся стара переписка зʼявиться тут, і Джері її бачитиме.</div>
      </div>
      {!compact && (
        <ol className="steps">
          <li>Відкрий чат у <b>Telegram Desktop</b> (desktop.telegram.org; звичайний Telegram для Mac з App Store не вміє експорт).</li>
          <li>Вгорі справа <b>⋮</b> → <b>«Експорт історії чату»</b>.</li>
          <li>Зніми галочки з фото й відео (потрібен тільки текст), формат — <b>«Машиночитний JSON»</b> → Експортувати.</li>
          <li>Обери тут файл <b>result.json</b> з папки експорту (або всі <b>messages*.html</b>, якщо експортував у HTML).</li>
        </ol>
      )}
      <label className={`btn ${busy ? "ghost" : ""}`} style={{ alignSelf: "flex-start", cursor: busy ? "wait" : "pointer" }}>
        {busy ? "Завантажую…" : "Обрати файл експорту"}
        <input type="file" accept=".json,.html,.htm" multiple hidden disabled={busy} onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
      </label>
      {msg && <div className="mono" style={{ color: msg.ok ? "var(--ok)" : "var(--bad)" }}>{msg.text}</div>}
      {done && (
        <button type="button" className="ghost small" style={{ alignSelf: "flex-start" }}
          onClick={() => openAssistant("Розбери всю історію переписки з цим клієнтом у Telegram: хто він, що хоче, бюджет, про що домовились, що обіцяли обидві сторони. Онови картку клієнта (потреби, бачення, бюджет, наступний крок), створи задачі з дедлайнами, запиши ідеї. В кінці коротко — що вніс.", true)}>
          Джері, розбери історію і заповни картку
        </button>
      )}
    </div>
  );
}
