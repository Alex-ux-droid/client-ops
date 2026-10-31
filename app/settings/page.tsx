import Anthropic from "@anthropic-ai/sdk";
import Link from "next/link";
import SubmitButton from "@/components/SubmitButton";
import AgentAccess from "./AgentAccess";
import InstallApp from "@/components/InstallApp";
import { connectMetaAction, disconnectMetaAction, linkMetaAccountAction, syncMetaAction } from "./actions";
import { lastSync, metaToken, tokenAgeDays } from "@/lib/meta";
import { ACCOUNT_STATUS, listAccounts } from "@/lib/repo/meta";
import { fmtDate } from "@/lib/dates";
import { connectTelegramAction, disconnectTelegramAction, disconnectVoiceAction, linkTelegramChatAction, saveVoiceChoiceAction, saveVoiceKeyAction } from "./actions";
import { ownerLinkCode, tg, tgOwner, tgToken, type BotInfo, type WebhookInfo } from "@/lib/telegram";
import { listChats } from "@/lib/repo/telegram";
import { listClients } from "@/lib/repo/clients";
import { getSetting } from "@/lib/repo/settings";
import { listVoices, VOICE_MODELS, voiceConfig, type Voice } from "@/lib/voice";
import { AUTO, CAPS, autoOn, capOn } from "@/lib/agent/caps";
import { saveCapsAction } from "./actions";
import { backupNowAction, saveDigestAction, sendAvatarsAction, sendDigestNowAction } from "./actions";
import { backupFolderUrl, backupInfo } from "@/lib/backup";
import { digestEnabled, digestTime } from "@/lib/digest";
import { disconnectGoogleAction, saveAgentAction, saveMemoryAction, saveGeneralAction, saveGoogleClientAction, saveKeyAction, testKeyAction } from "./actions";
import { headers } from "next/headers";
import { googleStatus } from "@/lib/google";
import { addToolAction, deleteToolAction } from "@/app/actions";
import { listTools } from "@/lib/repo/services";
import { TOOL_CATEGORY_LABEL, type ToolCategory } from "@/lib/services";
import { agentConfig, agentMemory, EFFORT_LABEL, EFFORTS, KNOWN_MODELS, MEMORY_MAX } from "@/lib/agent/config";
import { currency, CURRENCIES } from "@/lib/config";
import { getApiKey, hasAgentToken, maskKey } from "@/lib/secrets";
import { systemInfo } from "@/lib/system";
import VoiceTextarea from "@/components/VoiceTextarea";

const TABS = [
  { k: "general", label: "Загальне" },
  { k: "agent", label: "Джері" },
  { k: "caps", label: "Можливості" },
  { k: "connectors", label: "Конектори" },
  { k: "catalog", label: "Довідники" },
  { k: "access", label: "Доступи" },
  { k: "system", label: "Система" },
] as const;
type Tab = (typeof TABS)[number]["k"];

const TABLE_LABEL: Record<string, string> = {
  clients: "Клієнти", tasks: "Задачі", work_log: "Історія робіт", payments: "Оплати", ad_stats: "Періоди реклами",
  materials: "Матеріали", ideas: "Ідеї", playbooks: "Плейбуки", chat_messages: "Повідомлення Джері",
};

// Список моделей з API (якщо є ключ), інакше — відомі моделі
async function modelOptions(key: string | null): Promise<{ id: string; name: string; note?: string }[]> {
  if (!key) return KNOWN_MODELS;
  try {
    const out: { id: string; name: string; note?: string }[] = [];
    for await (const m of new Anthropic({ apiKey: key, timeout: 5000, maxRetries: 0 }).models.list()) {
      out.push({ id: m.id, name: m.display_name, note: KNOWN_MODELS.find((k) => k.id === m.id)?.note });
    }
    return out.length ? out : KNOWN_MODELS;
  } catch {
    return KNOWN_MODELS;
  }
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; c?: string; msg?: string; ok?: string }> }) {
  const sp = await searchParams;
  // старі посилання ?tab=google ведуть у конектор Google
  const conn = sp.tab === "google" ? "google" : sp.c;
  const tab = (sp.tab === "google" ? "connectors" : TABS.find((t) => t.k === sp.tab)?.k ?? "general") as Tab;
  return (
    <>
      <div className="head"><h1>Налаштування</h1></div>
      <nav className="subnav">
        {TABS.map((t) => <Link key={t.k} href={`/settings?tab=${t.k}`} className={t.k === tab ? "on" : ""}>{t.label}</Link>)}
      </nav>
      {sp.msg && <div className="card" style={{ marginBottom: 16, borderColor: sp.ok ? "var(--ok)" : "var(--bad)" }}>{sp.msg}</div>}
      {tab === "general" && <General />}
      {tab === "agent" && <div className="stack" style={{ gap: "1rem" }}><Agent /><AgentMemory /></div>}
      {tab === "connectors" && (conn === "google" ? <GoogleTab /> : conn === "voice" ? <VoiceTab /> : conn === "telegram" ? <TelegramTab /> : conn === "meta" ? <MetaTab /> : <Connectors />)}
      {tab === "caps" && <Caps />}
      {tab === "catalog" && <Catalog />}
      {tab === "access" && <Access />}
      {tab === "system" && <System />}
    </>
  );
}

function General() {
  const cur = currency();
  return (
    <div className="grid2">
      <form action={saveGeneralAction} className="card stack">
        <h2>Гроші</h2>
        <div className="field">
          <label htmlFor="currency">Валюта всієї системи</label>
          <select id="currency" name="currency" defaultValue={cur}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="mono" style={{ color: "var(--dim)" }}>Суми не перераховуються — міняється тільки знак. Тримай усі суми в одній валюті.</div>
        <div><button>Зберегти</button></div>
      </form>
      <div className="card stack">
        <h2>Застосунок на телефоні</h2>
        <div className="mono" style={{ color: "var(--dim)" }}>Іконка на головному екрані, відкривається на весь екран без панелей браузера.</div>
        <InstallApp />
      </div>
      <div className="card stack">
        <h2>Вхід</h2>
        <div className="mono">Пароль входу задається на сервері (змінна APP_PASSWORD у .env). Сесія живе 30 днів.</div>
        <div className="mono" style={{ color: "var(--dim)" }}>Зміна пароля з інтерфейсу — пізніше, разом з повноцінним етапом безпеки.</div>
      </div>
    </div>
  );
}

async function Agent() {
  const key = getApiKey();
  const cfg = agentConfig();
  const models = await modelOptions(key);
  if (!models.some((m) => m.id === cfg.model)) models.unshift({ id: cfg.model, name: cfg.model });
  return (
    <form action={saveAgentAction} className="card stack" style={{ maxWidth: "48rem" }}>
      {!key && <div className="mono" style={{ color: "var(--warn)" }}>Ключ API не задано — додай його у вкладці <Link href="/settings?tab=access" style={{ color: "var(--link)" }}>Доступи</Link>.</div>}
      <div>
        <div className="field">
          <label htmlFor="model">Модель</label>
          <select id="model" name="model" defaultValue={cfg.model}>
            {models.map((m) => <option key={m.id} value={m.id}>{m.name}{m.note ? ` — ${m.note}` : ""}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="effort">Глибина думання</label>
          <select id="effort" name="effort" defaultValue={cfg.effort}>
            {EFFORTS.map((e) => <option key={e} value={e}>{EFFORT_LABEL[e]}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="instructions">Твої інструкції для Джері</label>
        <VoiceTextarea id="instructions" name="instructions" defaultValue={cfg.instructions} style={{ minHeight: 200 }}
          placeholder={"Напр.: Відповідай максимально коротко.\nЗвіти клієнтам пиши на «Ви», без води.\nЦіна моєї години — $30, враховуй у пропозиціях."} />
      </div>
      <div className="mono" style={{ color: "var(--dim)" }}>
        Ціни — $ за 1 млн токенів (вхід / вихід). {cfg.fallback ? "Якщо модель відмовить з міркувань безпеки — API автоматично спробує іншу." : "Для цієї моделі автоматичного запасного варіанту нема."}
      </div>
      <div><button>Зберегти</button></div>
    </form>
  );
}

function AgentMemory() {
  const memory = agentMemory();
  return (
    <form action={saveMemoryAction} className="card stack" style={{ maxWidth: "48rem" }}>
      <h2>Пам'ять Джері</h2>
      <div className="mono">Після кожної розмови Джері сам перечитує її і оновлює пам'ять: факти про тебе, правила, уроки з виправлень, цілі. Можеш поправити або стерти. {memory.length}/{MEMORY_MAX}</div>
      <textarea name="memory" defaultValue={memory} style={{ minHeight: 220 }} placeholder="Поки порожньо — скажи Джері: «запам'ятай, що…»" aria-label="Пам'ять Джері" />
      <div><button className="ghost">Зберегти пам'ять</button></div>
    </form>
  );
}

// Зовнішні сервіси, до яких підключається система і помічник
function Connectors() {
  const g = googleStatus();
  const v = voiceConfig();
  const list = [
    {
      id: "google", name: "Google", ico: "G", desc: "Gmail, Google Диск і Календар: пошта клієнтів у картці, папки клієнтів на Диску, задачі в календар.",
      agent: "Джері: шукає і читає листи, створює папки, ставить задачі в календар.",
      status: g.connected && g.calendar ? "ok" : g.configured ? "warn" : "off",
      label: g.connected ? (g.calendar ? "Підключено" : "Перепідключи для Календаря") : g.configured ? "Не підключено" : "Не налаштовано",
    },
    {
      id: "voice", name: "ElevenLabs", ico: "🎙", desc: "Голос Джері і точне розпізнавання того, що ти диктуєш.",
      agent: "Джері: говорить відповіді вголос, чує диктування без пропусків.",
      status: v.configured && v.voiceId ? "ok" : v.configured ? "warn" : "off",
      label: v.configured && v.voiceId ? "Підключено" : v.configured ? "Обери голос" : "Не налаштовано",
    },
    {
      id: "telegram", name: "Telegram", ico: "✈", desc: "Бот у групах з клієнтами мовчки збирає переписку в картку. В особистих — Джері.",
      agent: "Джері: читає переписку клієнта, відповідає тобі в Telegram, розбирає голосові.",
      status: tgToken() && tgOwner() ? "ok" : tgToken() ? "warn" : "off",
      label: tgToken() && tgOwner() ? "Підключено" : tgToken() ? "Прив'яжи свій Telegram" : "Не налаштовано",
    },
    {
      id: "meta", name: "Meta Ads", ico: "f", desc: "Цифри з рекламних кабінетів Facebook / Instagram самі підтягуються в картки клієнтів (тільки читання).",
      agent: "Джері: бачить витрати, ліди, ціну ліда, кампанії і креативи; помічає, коли щось іде не так.",
      status: metaToken() ? "ok" : "off",
      label: metaToken() ? "Підключено" : "Не налаштовано",
    },
  ];
  return (
    <div className="conn-grid">
      {list.map((c) => {
        const body = (
          <>
            <div className="conn-head">
              <span className="conn-ico">{c.ico}</span>
              <b className="grow">{c.name}</b>
              <span className={`tag ${c.status === "ok" ? "ok" : c.status === "warn" ? "warn" : ""}`}>{c.label}</span>
            </div>
            <div className="mono">{c.desc}</div>
            {c.agent && <div className="mono" style={{ color: "var(--dim)" }}>{c.agent}</div>}
          </>
        );
        return c.status === "soon"
          ? <div key={c.id} className="card stack conn soon">{body}</div>
          : <Link key={c.id} href={`/settings?tab=connectors&c=${c.id}`} className="card stack conn">{body}</Link>;
      })}
    </div>
  );
}

function MetaTab() {
  const token = metaToken();
  const accounts = token ? listAccounts() : [];
  const clients = listClients().filter((c) => c.status !== "archived");
  const synced = lastSync();
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <Link href="/settings?tab=connectors" className="h-link">← Конектори</Link>
      <div className="grid2">
        <div className="card stack">
          <h2>Meta Ads — тільки читання</h2>
          {!token ? (
            <>
              <div className="mono">Найпростіше — <b>особистий токен</b>: бачить усі кабінети з усіх твоїх портфоліо, живе ~60 днів (система нагадає оновити).</div>
              <ol className="steps">
                <li><b>developers.facebook.com/apps</b> → Створити застосунок «Client Ops» → сценарій «Створення реклами і керування нею через Marketing API» (Create &amp; manage ads).</li>
                <li><b>developers.facebook.com/tools/explorer</b> → справа обери застосунок Client Ops → «Маркер користувача» → дозвіл <b>ads_read</b> → «Згенерувати маркер» → дозволь.</li>
                <li>Скопіюй маркер → <b>developers.facebook.com/tools/debug/accesstoken</b> → встав → «Налагодити» → внизу <b>«Продовжити маркер доступу»</b> → скопіюй новий довгий маркер.</li>
                <li>Встав його сюди.</li>
              </ol>
              <form action={connectMetaAction} className="inline">
                <input name="token" type="password" placeholder="EAAG…" autoComplete="off" aria-label="Токен Meta" />
                <button>Підключити</button>
              </form>
              <div className="mono" style={{ color: "var(--dim)" }}>Система нічого не змінює в кабінетах — лише читає. Токен лежить тільки в .env на сервері.</div>
            </>
          ) : (
            <>
              <div className="inline" style={{ flexWrap: "wrap" }}>
                <span className="tag ok">Підключено</span>
                {(tokenAgeDays() ?? 0) >= 50 && <span className="tag warn">токену {tokenAgeDays()} дн. — якщо він особистий, онови (живе ~60)</span>}
                <span className="mono">{accounts.length} кабінет(ів) · оновлення кожні 2 год{synced ? ` · востаннє ${fmtDate(synced)} ${new Date(synced).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" })}` : ""}</span>
              </div>
              <div className="inline" style={{ flexWrap: "wrap" }}>
                <form action={syncMetaAction}><SubmitButton className="ghost small">Оновити зараз</SubmitButton></form>
                <form action={disconnectMetaAction}><button className="ghost small">Відключити</button></form>
              </div>
              <details>
                <summary className="h-link">Оновити токен</summary>
                <form action={connectMetaAction} className="inline" style={{ marginTop: "0.5rem" }}>
                  <input name="token" type="password" placeholder="новий маркер EAAG…" autoComplete="off" aria-label="Новий токен Meta" />
                  <button className="ghost">Зберегти</button>
                </form>
              </details>
            </>
          )}
        </div>
        {token && (
          <div className="card stack">
            <h2>Кабінети</h2>
            <div className="mono" style={{ color: "var(--dim)" }}>Привʼяжи кабінет до клієнта — цифри зʼявляться у вкладці Meta клієнта і Джері їх бачитиме. Кабінети, ID яких уже вписаний у картці клієнта, привʼязуються самі.</div>
            {accounts.length === 0 && <div className="empty">Кабінетів не видно. Перевір, що системному користувачу призначені рекламні акаунти.</div>}
            {accounts.map((a) => (
              <form key={a.account_id} action={linkMetaAccountAction} className="tg-chat">
                <input type="hidden" name="account_id" value={a.account_id} />
                <div style={{ minWidth: 0 }}>
                  <b>{a.name}</b>
                  <div className="mono" style={{ color: a.last_error || (a.account_status && a.account_status !== 1) ? "var(--warn)" : "var(--dim)" }}>
                    {a.account_id.replace("act_", "")} · {a.currency}{a.account_status && a.account_status !== 1 ? ` · ${ACCOUNT_STATUS[a.account_status] ?? "проблема"}` : ""}{a.last_error ? ` · ${a.last_error}` : ""}
                  </div>
                </div>
                <div className="inline">
                  <select name="client_id" defaultValue={a.client_id ?? ""} aria-label="Клієнт">
                    <option value="">— не привʼязано —</option>
                    {clients.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                  <SubmitButton className="ghost small">Ок</SubmitButton>
                </div>
              </form>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function TelegramTab() {
  const token = tgToken();
  let me: BotInfo | null = null;
  let hook: WebhookInfo | null = null;
  let err = "";
  if (token) {
    try { [me, hook] = await Promise.all([tg<BotInfo>("getMe"), tg<WebhookInfo>("getWebhookInfo")]); } catch (e) { err = e instanceof Error ? e.message : "Помилка"; }
  }
  const owner = tgOwner();
  const chats = token ? listChats() : [];
  const clients = listClients().filter((c) => c.status !== "archived");
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <Link href="/settings?tab=connectors" className="h-link">← Конектори</Link>
      <div className="grid2">
        <div className="card stack">
          <h2>Telegram-бот</h2>
          {!token ? (
            <>
              <ol className="steps">
                <li>У Telegram відкрий <b>@BotFather</b> → <b>/newbot</b> → будь-яка назва → юзернейм на <b>bot</b>.</li>
                <li>Скопіюй токен і встав сюди. Ім'я «Джері» і опис система поставить сама.</li>
              </ol>
              <form action={connectTelegramAction} className="inline">
                <input name="token" type="password" placeholder="123456789:AAE…" autoComplete="off" aria-label="Токен бота" />
                <button>Підключити</button>
              </form>
            </>
          ) : (
            <>
              {err && <div className="mono" style={{ color: "var(--bad)" }}>{err}</div>}
              {me && (
                <div className="inline" style={{ flexWrap: "wrap" }}>
                  <span className="tag ok">@{me.username}</span>
                  {me.can_read_all_group_messages
                    ? <span className="tag ok">бачить усі повідомлення в групах</span>
                    : <span className="tag bad">в групах бачить тільки команди</span>}
                </div>
              )}
              {me && !me.can_read_all_group_messages && (
                <div className="callout">
                  <b>Один крок руками</b> (Telegram не дає зробити це з системи): у <b>@BotFather</b> надішли <b>/setprivacy</b> → обери <b>@{me.username}</b> → <b>Disable</b>. Потім онови цю сторінку. Якщо бот уже в групах — видали його звідти і додай знову.
                </div>
              )}
              {hook && (hook.last_error_message
                ? <div className="mono" style={{ color: "var(--warn)" }}>Остання помилка доставки: {hook.last_error_message}</div>
                : <div className="mono" style={{ color: "var(--dim)" }}>Зв'язок з Telegram: ок{hook.pending_update_count ? `, у черзі ${hook.pending_update_count}` : ""}.</div>)}
              {owner ? (
                <>
                  <div className="mono">Твій Telegram прив'язаний: <b>{getSetting("tg.owner_name") || owner}</b>. Пиши або надиктовуй боту в особисті — відповідатиме Джері.</div>
                  <div className="card stack" style={{ background: "var(--bg-input)" }}>
                    <b>Ранкове зведення</b>
                    <div className="mono" style={{ color: "var(--dim)" }}>Щодня в Telegram: прострочені і сьогоднішні задачі, оплати, реклама за вчора, хто потребує уваги. Без ШІ — безкоштовно.</div>
                    <form action={saveDigestAction} className="inline" style={{ flexWrap: "wrap" }}>
                      <label className="inline" style={{ gap: "0.375rem" }}><input type="checkbox" name="on" defaultChecked={digestEnabled()} style={{ width: "auto" }} /> надсилати</label>
                      <input type="time" name="time" defaultValue={digestTime()} style={{ width: "auto" }} aria-label="Час" />
                      <button className="ghost small">Зберегти</button>
                    </form>
                    <div className="inline" style={{ flexWrap: "wrap" }}>
                      <form action={sendDigestNowAction}><SubmitButton className="ghost small" pendingText="Надсилаю…">Надіслати зараз</SubmitButton></form>
                      <form action={sendAvatarsAction}><SubmitButton className="ghost small" pendingText="Надсилаю…">Надіслати аватарки для бота</SubmitButton></form>
                    </div>
                  </div>
                </>
              ) : me ? (
                <div className="stack">
                  <div className="mono">Тепер покажи боту, що ти — це ти (щоб чужі не могли ним керувати):</div>
                  <div><a className="btn" href={`https://t.me/${me.username}?start=${ownerLinkCode()}`} target="_blank" rel="noreferrer">Прив'язати мій Telegram ↗</a></div>
                  <div className="mono" style={{ color: "var(--dim)" }}>Відкриється чат з ботом — натисни «Start». Потім онови цю сторінку.</div>
                </div>
              ) : null}
              <form action={disconnectTelegramAction}><button className="ghost small">Відключити бота</button></form>
            </>
          )}
        </div>
        {token && (
          <div className="card stack">
            <h2>Групи</h2>
            <div className="mono" style={{ color: "var(--dim)" }}>Додай бота в групу з клієнтом — вона з'явиться тут. Обери клієнта, і вся переписка піде в його картку (вкладка «Telegram»). Бот у групах мовчить.</div>
            {chats.length === 0 && <div className="empty">Поки нема груп. Додай бота в групу і напиши там будь-що.</div>}
            {chats.map((c) => (
              <form key={c.chat_id} action={linkTelegramChatAction} className="tg-chat">
                <input type="hidden" name="chat_id" value={c.chat_id} />
                <div style={{ minWidth: 0 }}>
                  <b>{c.title}</b>
                  <div className="mono" style={{ color: "var(--dim)" }}>{c.active ? `${c.messages} повідомл.` : "бота прибрали з групи"}</div>
                </div>
                <div className="inline">
                  <select name="client_id" defaultValue={c.client_id ?? ""} aria-label="Клієнт">
                    <option value="">— не прив'язано —</option>
                    {clients.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                  <button className="ghost small">Ок</button>
                </div>
              </form>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function VoiceTab() {
  const v = voiceConfig();
  let voices: Voice[] = [];
  let err = "";
  if (v.configured) {
    try { voices = await listVoices(); } catch (e) { err = e instanceof Error ? e.message : "Помилка"; }
  }
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <Link href="/settings?tab=connectors" className="h-link">← Конектори</Link>
      <div className="grid2">
        <div className="card stack">
          <h2>ElevenLabs: голос і розпізнавання</h2>
          {v.configured ? (
            <div className="inline" style={{ flexWrap: "wrap" }}>
              <span className="tag ok">Ключ збережено</span>
              {v.voiceName && <span className="tag accent">Голос: {v.voiceName}</span>}
              <form action={disconnectVoiceAction}><button className="ghost small">Відключити</button></form>
            </div>
          ) : (
            <div className="mono">Зареєструйся на elevenlabs.io (тариф Starter), у профілі → API Keys створи ключ і встав сюди.</div>
          )}
          <form action={saveVoiceKeyAction} className="inline">
            <input name="key" type="password" placeholder={v.configured ? "новий ключ, якщо треба замінити" : "sk_…"} autoComplete="off" aria-label="Ключ ElevenLabs" />
            <button className="ghost">Зберегти</button>
          </form>
          <div className="mono" style={{ color: "var(--dim)" }}>Ключ лежить тільки в .env на сервері. Розпізнавання і голос списують кредити твого тарифу ElevenLabs.</div>
        </div>
        {v.configured && (
          <form action={saveVoiceChoiceAction} className="card stack">
            <h2>Голос</h2>
            {err && <div className="mono" style={{ color: "var(--bad)" }}>{err}</div>}
            <div className="field">
              <label htmlFor="voice">Яким голосом говорить Джері</label>
              <select id="voice" name="voice" defaultValue={v.voiceId ? `${v.voiceId}|${v.voiceName}` : ""}>
                <option value="">— обери —</option>
                {voices.map((x) => (
                  <option key={x.voice_id} value={`${x.voice_id}|${x.name}`}>
                    {x.name}{x.labels ? ` · ${Object.values(x.labels).filter(Boolean).slice(0, 3).join(", ")}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="model">Модель</label>
              <select id="model" name="model" defaultValue={v.model}>
                {VOICE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div className="mono" style={{ color: "var(--dim)" }}>Голоси з бібліотеки ElevenLabs говорять українською через багатомовну модель. Свій голос можна додати в їхньому кабінеті — він з'явиться в цьому списку.</div>
            <div><button>Зберегти голос</button></div>
          </form>
        )}
      </div>
    </div>
  );
}

async function GoogleTab() {
  const g = googleStatus();
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "ops.alexbentsa.com";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const redirect = `${proto}://${host}/api/google/callback`;
  const days = g.connectedAt ? Math.floor((Date.now() - +new Date(g.connectedAt)) / 86400_000) : 0;
  return (
    <div className="stack" style={{ gap: "1rem" }}>
    <Link href="/settings?tab=connectors" className="h-link">← Конектори</Link>
    <div className="grid2">
      <div className="card stack">
        <h2>Google: Gmail і Диск</h2>
        {g.connected ? (
          <>
            <div><span className="tag ok">Підключено</span> <b>{g.email}</b></div>
            {!g.calendar && (
              <div className="callout" style={{ borderColor: "var(--warn)" }}>
                <b>Календар:</b> доступ до Google Календаря додали пізніше. Щоб задачі ставились у календар: 1) у Google Cloud увімкни <b>Google Calendar API</b> (APIs &amp; Services → Library → Google Calendar API → Enable); 2) натисни «Перепідключити» нижче і дай дозвіл на календар.
              </div>
            )}
            <div className="mono">Підключено {days === 0 ? "сьогодні" : `${days} дн. тому`}. Поки застосунок Google у тестовому режимі, доступ живе ~7 днів — тоді просто натисни «Перепідключити».</div>
            {g.error && <div className="mono" style={{ color: "var(--warn)" }}>{g.error}</div>}
            <div className="inline" style={{ flexWrap: "wrap" }}>
              <a href="/api/google/connect" className="btn">Перепідключити</a>
              <form action={disconnectGoogleAction}><button className="ghost">Відключити</button></form>
            </div>
            <BackupBlock />
          </>
        ) : g.configured ? (
          <>
            <div className="mono">Ключі є. Натисни, увійди своєю поштою і дозволь доступ (Google попередить, що застосунок не перевірений, — це твій власний, тисни «Продовжити»).</div>
            <div><a href="/api/google/connect" className="btn">Підключити Google</a></div>
          </>
        ) : (
          <div className="mono">Спершу встав Client ID і Client secret з Google Cloud (у блоці «Ключі Google Cloud»).</div>
        )}
        <div className="mono" style={{ color: "var(--dim)" }}>Що дає: папки клієнтів на Диску створюються самі; у картці клієнта — вкладка «Пошта» з листуванням, відповіддю і збереженням листів у матеріали.</div>
      </div>
      <div className="card stack">
        <h2>Ключі Google Cloud</h2>
        {g.configured ? (
          <>
            <div><span className="tag ok">Збережено</span> <span className="mono">Client ID …{g.clientId.replace(/\.apps\.googleusercontent\.com$/, "").slice(-6)}</span></div>
            <details className="stack">
              <summary className="mono" style={{ color: "var(--link)" }}>Змінити ключі</summary>
              <KeysForm redirect={redirect} configured />
            </details>
          </>
        ) : (
          <KeysForm redirect={redirect} configured={false} />
        )}
        <div className="mono" style={{ color: "var(--dim)" }}>Зберігаються тільки в .env на сервері.</div>
      </div>
    </div>
    </div>
  );
}

function KeysForm({ redirect, configured }: { redirect: string; configured: boolean }) {
  return (
    <form action={saveGoogleClientAction} className="stack">
      <div className="field">
        <label htmlFor="g_redirect">Authorized redirect URI (встав у Google Cloud)</label>
        <input id="g_redirect" readOnly value={redirect} />
      </div>
      <div className="field">
        <label htmlFor="client_id">Client ID</label>
        <input id="client_id" name="client_id" placeholder="…apps.googleusercontent.com" required autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="client_secret">Client secret {configured && <span className="mono">(збережено — залиш порожнім, щоб не міняти)</span>}</label>
        <input id="client_secret" name="client_secret" type="password" placeholder="GOCSPX-…" autoComplete="off" />
      </div>
      <div><button className="ghost">Зберегти ключі</button></div>
    </form>
  );
}

function Catalog() {
  const tools = listTools();
  const cats = Object.keys(TOOL_CATEGORY_LABEL) as ToolCategory[];
  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <div className="mono">Ці списки з'являються у вкладках послуг клієнта (яка CRM, на чому сайт тощо). Нове можна додати тут або просто вписати в картці клієнта.</div>
      <div className="grid2">
        {cats.map((cat) => (
          <div key={cat} className="panel">
            <div className="panel-head"><h2>{TOOL_CATEGORY_LABEL[cat]}</h2><span className="mono">{tools.filter((t) => t.category === cat).length}</span></div>
            <div className="tool-list">
              {tools.filter((t) => t.category === cat).map((t) => (
                <form key={t.id} action={deleteToolAction} className="tool-chip">
                  <input type="hidden" name="id" value={t.id} />
                  {t.url ? <a href={t.url} target="_blank" rel="noreferrer">{t.name}</a> : <span>{t.name}</span>}
                  <button className="tool-x" title="Видалити з довідника" aria-label={`Видалити ${t.name}`}>×</button>
                </form>
              ))}
            </div>
            <form action={addToolAction} className="inline" style={{ padding: "0 1.125rem 1rem" }}>
              <input type="hidden" name="category" value={cat} />
              <input name="name" placeholder="Додати…" required aria-label="Назва" />
              <button className="ghost small">+</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}

function Access() {
  const key = getApiKey();
  return (
    <div className="grid2">
      <div className="card stack">
        <h2>Ключ Anthropic API</h2>
        <div className="mono">Ключ: {key ? <span style={{ color: "var(--ok)" }}>{maskKey(key)}</span> : <span style={{ color: "var(--warn)" }}>не задано</span>}</div>
        <form action={saveKeyAction} className="stack">
          <input name="key" type="password" autoComplete="off" placeholder="sk-ant-…" required aria-label="Ключ API" />
          <button className="ghost">{key ? "Замінити ключ" : "Зберегти ключ"}</button>
        </form>
        {key && <form action={testKeyAction}><button className="ghost small">Перевірити ключ</button></form>}
        <div className="mono" style={{ color: "var(--dim)" }}>Зберігається тільки в .env на сервері. Витрати — platform.claude.com → Витрати.</div>
      </div>
      <div className="card stack">
        <h2>Доступ для Claude (розробка)</h2>
        <div className="mono" style={{ color: "var(--dim)" }}>Окремий ключ, щоб Claude, який будує систему, міг заходити сюди і перевіряти, як усе працює. Пароль входу йому не потрібен. Вимкнути можна будь-коли.</div>
        <AgentAccess active={hasAgentToken()} />
      </div>
    </div>
  );
}

function System() {
  const s = systemInfo();
  const kv = (label: string, value: React.ReactNode) => <div><dt>{label}</dt><dd>{value}</dd></div>;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid2">
        <dl className="card kv">
          {kv("Версія", <span className="mono" style={{ color: "var(--text)" }}>{s.commit ?? "—"}</span>)}
          {kv("Остання зміна", s.commitMessage ?? "—")}
          {kv("Коли", s.commitDate ? new Date(s.commitDate).toLocaleString("uk-UA") : "—")}
        </dl>
        <dl className="card kv">
          {kv("Працює без перезапуску", `${s.uptimeMin} хв`)}
          {kv("Часовий пояс сервера", s.tz)}
          {kv("Розмір бази", s.dbKb !== null ? `${s.dbKb} КБ` : "—")}
          {kv("Джері", `${s.agent.model} · ${s.agent.effort} · ключ ${s.agent.hasKey ? "є" : "нема"}`)}
        </dl>
      </div>
      <div className="grid2">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Записи</th><th className="num">Кількість</th></tr></thead>
            <tbody>{Object.entries(s.counts).map(([t, n]) => <tr key={t}><td>{TABLE_LABEL[t] ?? t}</td><td className="num">{n}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Бекапи (щодня 03:30)</th><th className="num">Розмір</th></tr></thead>
            <tbody>{s.backups.length ? s.backups.map((b) => <tr key={b.name}><td>{b.name}</td><td className="num">{b.kb} КБ</td></tr>) : <tr><td colSpan={2} style={{ color: "var(--dim)" }}>Ще не було (перший — сьогодні вночі).</td></tr>}</tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="chart-title"><span>Журнал оновлень</span></div>
        <pre className="material" style={{ maxHeight: 260 }}>{s.updateLog?.join("\n") || "Записів нема."}</pre>
      </div>
      <div className="card">
        <div className="chart-title"><span>Останні помилки</span><b>{s.errors.length}</b></div>
        {s.errors.length ? s.errors.slice(0, 10).map((e, i) => <div key={i} className="mono" style={{ padding: "6px 0", borderTop: i ? "1px solid var(--line)" : undefined }}>{new Date(e.at).toLocaleString("uk-UA")} · {e.where} · {e.message}</div>) : <div className="mono" style={{ color: "var(--dim)" }}>Помилок нема.</div>}
      </div>
    </div>
  );
}

// Бекап бази на Google Диск — щодня о 04:00 сам, тут — стан і «зробити зараз»
function BackupBlock() {
  const b = backupInfo();
  const url = backupFolderUrl();
  return (
    <div className="card stack" style={{ background: "var(--bg-input)" }}>
      <b>Бекап бази на Диск</b>
      <div className="mono" style={{ color: "var(--dim)" }}>Щодня о 04:00 копія всієї бази летить у «Client Ops — клієнти» → «_Бекапи бази» (30 останніх). Ключі (.env) туди не потрапляють.</div>
      {b.last
        ? <div className="mono">Останній: {new Date(b.last).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}{b.size ? ` · ${(Number(b.size) / 1024 / 1024).toFixed(1)} МБ` : ""}</div>
        : <div className="mono">Ще не було.</div>}
      {b.error && <div className="mono" style={{ color: "var(--bad)" }}>Помилка: {b.error}</div>}
      <div className="inline" style={{ flexWrap: "wrap" }}>
        <form action={backupNowAction}><SubmitButton className="ghost small" pendingText="Роблю бекап…">Зробити бекап зараз</SubmitButton></form>
        {url && <a href={url} target="_blank" rel="noreferrer" className="btn ghost small">Папка з бекапами ↗</a>}
      </div>
    </div>
  );
}

// Тумблери: що Джері може і що система робить сама
function Caps() {
  const Row = ({ name, on, label, desc }: { name: string; on: boolean; label: string; desc: string }) => (
    <label className="cap-row">
      <input type="checkbox" name={name} defaultChecked={on} className="cap-toggle" />
      <span><b>{label}</b><small>{desc}</small></span>
    </label>
  );
  return (
    <form action={saveCapsAction} className="stack" style={{ gap: "1rem" }}>
      <div className="grid2">
        <div className="card stack">
          <h2>Що Джері може</h2>
          <div className="mono" style={{ color: "var(--dim)" }}>Читати і дивитись (клієнтів, задачі, рекламу, переписку) Джері може завжди. Тут — що він може робити.</div>
          {CAPS.map((c) => <Row key={c.key} name={`cap.${c.key}`} on={capOn(c.key)} label={c.label} desc={c.desc} />)}
        </div>
        <div className="card stack">
          <h2>Що система робить сама</h2>
          <div className="mono" style={{ color: "var(--dim)" }}>Фонові задачі. Вимкнув — просто перестане робити, нічого не зламається.</div>
          {AUTO.map((a) => <Row key={a.key} name={`auto.${a.key}`} on={autoOn(a.key)} label={a.label} desc={a.desc} />)}
        </div>
      </div>
      <div><SubmitButton>Зберегти</SubmitButton></div>
    </form>
  );
}
