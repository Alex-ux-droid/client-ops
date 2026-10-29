import Link from "next/link";
import { saveMailToMaterials, sendMailAction } from "@/app/actions";
import { fmtDate } from "@/lib/dates";
import { GoogleReconnectError, listMail, mailQuery, readMail, type MailItem } from "@/lib/google";

const who = (s: string) => s.replace(/<.*>/, "").replace(/"/g, "").trim() || s;

// Пошта клієнта з Gmail: листування з адресами з картки, перегляд, відповідь, збереження в матеріали
export default async function MailTab({ clientId, email, open, err, sent }: { clientId: number; email: string; open?: string; err?: string; sent?: boolean }) {
  const q = mailQuery(email);
  if (!q) {
    return (
      <div className="callout">
        Щоб бачити листування, додай пошту клієнта в картку — <Link href={`/clients/${clientId}/edit`} className="h-link">Редагувати → Пошта</Link>.
        Можна кілька адрес через кому.
      </div>
    );
  }

  let items: MailItem[] = [];
  let loadErr = "";
  try {
    items = await listMail(q, 25);
  } catch (e) {
    loadErr = e instanceof GoogleReconnectError ? e.message : `Не вдалось завантажити пошту: ${e instanceof Error ? e.message : ""}`;
  }
  const msg = open ? await readMail(open).catch(() => null) : null;
  const replyTo = msg ? (msg.incoming ? msg.from : msg.to) : email.split(/[,;\s]+/)[0];

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      {err && <div className="callout" style={{ borderColor: "var(--bad)" }}>{err}</div>}
      {sent && <div className="callout" style={{ borderColor: "var(--ok)" }}>Лист надіслано і записано в історію.</div>}
      {loadErr && <div className="callout" style={{ borderColor: "var(--warn)" }}>{loadErr} <Link href="/settings?tab=connectors&c=google" className="h-link">Налаштування → Конектори</Link></div>}

      <div className="split">
        <div>
          <h2 style={{ marginBottom: "0.75rem" }}>Листування <span className="mono">· {email}</span></h2>
          <div className="list">
            {items.length ? items.map((m) => (
              <Link key={m.id} href={`/clients/${clientId}?tab=mail&m=${m.id}`} className={`row mail-row ${open === m.id ? "on" : ""}`} scroll={false}>
                <span className={`mail-dir ${m.incoming ? "in" : "out"}`} title={m.incoming ? "Від клієнта" : "Від тебе"}>{m.incoming ? "↙" : "↗"}</span>
                <div className="row-main">
                  <div className="row-title">{m.subject}</div>
                  <div className="row-sub">{who(m.incoming ? m.from : `→ ${m.to}`)} · {m.snippet.slice(0, 120)}</div>
                </div>
                <span className="mono">{fmtDate(m.date)}</span>
              </Link>
            )) : !loadErr && <div className="empty">Листів з цими адресами не знайдено.</div>}
          </div>
        </div>

        <div className="stack" style={{ gap: "1rem" }}>
          {msg && (
            <div className="card stack">
              <div>
                <h3>{msg.subject}</h3>
                <div className="mono">{who(msg.from)} → {who(msg.to)} · {fmtDate(msg.date)}</div>
              </div>
              <pre className="material" style={{ maxHeight: "22rem", margin: 0 }}>{msg.body || msg.snippet}</pre>
              <form action={saveMailToMaterials}>
                <input type="hidden" name="client_id" value={clientId} />
                <input type="hidden" name="message_id" value={msg.id} />
                <button className="ghost small">Зберегти в матеріали клієнта</button>
              </form>
            </div>
          )}
          <form key={open ?? "new"} action={sendMailAction} className="card stack">
            <h3>{msg ? "Відповісти" : "Новий лист"}</h3>
            <input type="hidden" name="client_id" value={clientId} />
            {msg && <input type="hidden" name="thread_id" value={msg.threadId} />}
            {msg && <input type="hidden" name="in_reply_to" value={msg.messageId} />}
            <input name="to" defaultValue={replyTo} aria-label="Кому" required />
            <input name="subject" defaultValue={msg ? (msg.subject.startsWith("Re:") ? msg.subject : `Re: ${msg.subject}`) : ""} placeholder="Тема" aria-label="Тема" />
            <textarea name="body" placeholder="Текст листа (можна попросити Джері написати чернетку)" style={{ minHeight: "9rem" }} aria-label="Текст" required />
            <div><button>Надіслати</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}
