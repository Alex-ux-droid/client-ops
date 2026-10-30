import Link from "next/link";
import AskAssistant from "@/components/AskAssistant";
import { chatsForClient, clientMessagesNewest, type TgMessage } from "@/lib/repo/telegram";
import { fileUrl } from "@/lib/google";
import TelegramImport from "./TelegramImport";

const TG_FILE_LIMIT = 20 * 1024 * 1024;
const mb = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} МБ` : `${Math.max(1, Math.round(b / 1024))} КБ`);

// Фото — картинкою, документ/відео — посиланням; більше 20 МБ бот не скачує
function Attach({ m }: { m: TgMessage }) {
  if (!m.tg_file_id) return KIND[m.kind] ? <div className="tg-kind">{KIND[m.kind]}{m.file_name ? ` · ${m.file_name}` : ""}</div> : null;
  const size = m.file_size ?? 0;
  if (size > TG_FILE_LIMIT) return <div className="tg-kind">{KIND[m.kind]}{m.file_name ? ` · ${m.file_name}` : ""} · {mb(size)} — завеликий, тільки в Telegram</div>;
  const src = `/api/tg/file/${m.id}`;
  if (m.kind === "photo") {
    return (
      <a href={src} target="_blank" rel="noreferrer" className="tg-photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Фото з Telegram" loading="lazy" />
      </a>
    );
  }
  return (
    <div className="tg-attach">
      <a href={src} target="_blank" rel="noreferrer">{KIND[m.kind]}{m.file_name ? ` · ${m.file_name}` : ""}</a>
      {size > 0 && <span>{mb(size)}</span>}
      {m.drive_id && <a href={fileUrl(m.drive_id)} target="_blank" rel="noreferrer">на Диску</a>}
    </div>
  );
}

const KIND: Record<string, string> = { photo: "📷 Фото", document: "📎 Файл", video: "🎬 Відео", voice: "🎙 Голосове", other: "" };
const PAGE = 150;
const COLORS = ["#7aa2ff", "#5fd3a8", "#f0b35b", "#e88aa6", "#a98bff", "#5cc8e8", "#f08a6a"];

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const color = (n: string) => COLORS[[...n].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS.length];
const dayLabel = (d: string) => {
  const today = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 10);
  const yest = new Date(Date.now() - 86400_000).toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 10);
  if (d === today) return "Сьогодні";
  if (d === yest) return "Вчора";
  return new Date(`${d}T12:00:00`).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: d.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric" });
};

// Посилання в тексті — клікабельні
function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return <>{parts.map((p, i) => (/^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noreferrer" className="h-link">{p.replace(/^https?:\/\//, "").slice(0, 60)}</a> : p))}</>;
}

type Msg = TgMessage & { chat_title: string };
type Burst = { who: string; me: boolean; msgs: Msg[] };

// Дні — від нових до старих; у дні — «пачки» підряд від однієї людини (до 10 хв), теж від нових; усередині пачки — як писали
function group(rows: Msg[]): { day: string; bursts: Burst[] }[] {
  const days: { day: string; bursts: Burst[] }[] = [];
  for (const m of rows) {
    const day = m.sent_at.slice(0, 10);
    let d = days.at(-1);
    if (!d || d.day !== day) { d = { day, bursts: [] }; days.push(d); }
    const b = d.bursts.at(-1);
    const who = m.is_owner ? "me" : m.from_name;
    const gap = b ? (+new Date(b.msgs.at(-1)!.sent_at.replace(" ", "T")) - +new Date(m.sent_at.replace(" ", "T"))) / 60000 : Infinity;
    if (b && (b.me ? "me" : b.who) === who && gap <= 10) b.msgs.push(m);
    else d.bursts.push({ who: m.from_name, me: !!m.is_owner, msgs: [m] });
  }
  return days;
}

export default function TelegramTab({ clientId, q = "", n }: { clientId: number; q?: string; n?: string }) {
  const chats = chatsForClient(clientId);
  const limit = Math.min(5000, Math.max(PAGE, Number(n) || PAGE));
  const { rows, total } = clientMessagesNewest(clientId, { limit, q });
  const days = group(rows);
  const base = `/clients/${clientId}?tab=telegram${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="tg-head">
        <div className="mono" style={{ color: "var(--dim)" }}>{chats.map((c) => c.title).join(", ")} · {total} повідомл.{q ? ` за «${q}»` : ""}</div>
        <div className="chips">
          <AskAssistant text="Підсумуй переписку в Telegram з цим клієнтом за останній тиждень: про що домовились, що він просив, що обіцяв я. Якщо є задачі — запропонуй їх створити.">Підсумок тижня</AskAssistant>
          <AskAssistant text="Пройдись по переписці в Telegram з цим клієнтом і знайди, що я пообіцяв і ще не зробив або що клієнт чекає від нас.">Що ми обіцяли?</AskAssistant>
        </div>
      </div>

      <form className="inline tg-search">
        <input type="hidden" name="tab" value="telegram" />
        <input name="q" defaultValue={q} placeholder="Пошук по переписці: слово, сума, ім'я…" aria-label="Пошук по переписці" />
        <button className="ghost">Знайти</button>
        {q && <Link href={`/clients/${clientId}?tab=telegram`} className="btn ghost" scroll={false}>Скинути</Link>}
      </form>

      {rows.length === 0 && <div className="empty card">{q ? "Нічого не знайшов." : "Поки тиша. Повідомлення з групи з'являться тут, щойно хтось напише."}</div>}

      <div className="tg-feed">
        {days.map((d) => (
          <section key={d.day} className="tg-dayblock">
            <div className="tg-day"><span>{dayLabel(d.day)}</span></div>
            {d.bursts.map((b) => (
              <div key={b.msgs[0].id} className={`tg-burst ${b.me ? "me" : ""}`}>
                {!b.me && <div className="tg-ava" style={{ background: color(b.who) }}>{initials(b.who)}</div>}
                <div className="tg-bubbles">
                  <div className="tg-who" style={b.me ? undefined : { color: color(b.who) }}>{b.me ? "Ти" : b.who}<span>{b.msgs[0].sent_at.slice(11, 16)}</span></div>
                  {b.msgs.map((m) => (
                    <div key={m.id} className={`tg-bubble ${m.kind !== "text" ? `k-${m.kind}` : ""}`}>
                      <Attach m={m} />
                      {m.text && <div className="tg-text"><Linkify text={m.text} /></div>}
                      {b.msgs.length > 1 && <div className="tg-time">{m.sent_at.slice(11, 16)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>

      {total > rows.length && (
        <Link href={`${base}&n=${limit + PAGE * 2}`} className="btn ghost" scroll={false} style={{ alignSelf: "center" }}>
          Показати старіші ({total - rows.length} ще)
        </Link>
      )}

      <details className="tg-import-wrap">
        <summary className="h-link">Додати стару історію з Telegram Desktop</summary>
        <TelegramImport clientId={clientId} />
      </details>
    </div>
  );
}
