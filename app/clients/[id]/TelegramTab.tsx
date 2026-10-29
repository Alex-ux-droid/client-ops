import { fmtDate } from "@/lib/dates";
import { chatsForClient, clientMessages } from "@/lib/repo/telegram";
import AskAssistant from "@/components/AskAssistant";

const KIND: Record<string, string> = { photo: "📷 фото", document: "📎 файл", video: "🎬 відео", voice: "🎙 голосове", other: "" };

// Переписка з груп клієнта в Telegram (бот мовчки записує). Підсумки — через головного помічника.
export default function TelegramTab({ clientId }: { clientId: number }) {
  const chats = chatsForClient(clientId);
  const msgs = clientMessages(clientId, { limit: 300 });
  let day = "";
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="tg-head">
        <div className="mono" style={{ color: "var(--dim)" }}>
          {chats.map((c) => c.title).join(", ")} · {msgs.length} повідомл.{msgs.length >= 300 ? " (останні 300)" : ""}
        </div>
        <div className="chips">
          <AskAssistant text="Підсумуй переписку в Telegram з цим клієнтом за останній тиждень: про що домовились, що він просив, що обіцяв я. Якщо є задачі — запропонуй їх створити.">Підсумок тижня</AskAssistant>
          <AskAssistant text="Пройдись по переписці в Telegram з цим клієнтом і знайди, що я пообіцяв і ще не зробив або що клієнт чекає від нас.">Що ми обіцяли?</AskAssistant>
        </div>
      </div>
      {msgs.length === 0 && <div className="empty card">Поки тиша. Повідомлення з групи з'являться тут, щойно хтось напише.</div>}
      <div className="tg-log">
        {msgs.map((m) => {
          const d = fmtDate(m.sent_at);
          const sep = d !== day ? (day = d) : null;
          return (
            <div key={m.id}>
              {sep && <div className="tg-day">{sep}</div>}
              <div className={`tg-msg ${m.is_owner ? "me" : ""}`}>
                {!m.is_owner && <div className="tg-from">{m.from_name}</div>}
                {KIND[m.kind] && <div className="tg-kind">{KIND[m.kind]}{m.file_name ? ` · ${m.file_name}` : ""}</div>}
                {m.text && <div className="tg-text">{m.text}</div>}
                <div className="tg-time">{m.sent_at.slice(11, 16)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
