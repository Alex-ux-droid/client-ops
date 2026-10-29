import Anthropic from "@anthropic-ai/sdk";
import Link from "next/link";
import AgentAccess from "./AgentAccess";
import InstallApp from "@/components/InstallApp";
import { saveAgentAction, saveGeneralAction, saveKeyAction, testKeyAction } from "./actions";
import { addToolAction, deleteToolAction } from "@/app/actions";
import { listTools } from "@/lib/repo/services";
import { TOOL_CATEGORY_LABEL, type ToolCategory } from "@/lib/services";
import { agentConfig, EFFORT_LABEL, EFFORTS, KNOWN_MODELS } from "@/lib/agent/config";
import { currency, CURRENCIES } from "@/lib/config";
import { getApiKey, hasAgentToken, maskKey } from "@/lib/secrets";
import { systemInfo } from "@/lib/system";

const TABS = [
  { k: "general", label: "Загальне" },
  { k: "agent", label: "Помічник" },
  { k: "catalog", label: "Довідники" },
  { k: "access", label: "Доступи" },
  { k: "system", label: "Система" },
] as const;
type Tab = (typeof TABS)[number]["k"];

const TABLE_LABEL: Record<string, string> = {
  clients: "Клієнти", tasks: "Задачі", work_log: "Історія робіт", payments: "Оплати", ad_stats: "Періоди реклами",
  materials: "Матеріали", ideas: "Ідеї", playbooks: "Плейбуки", chat_messages: "Повідомлення помічника",
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

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; msg?: string; ok?: string }> }) {
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.k === sp.tab)?.k ?? "general") as Tab;
  return (
    <>
      <div className="head"><h1>Налаштування</h1></div>
      <nav className="subnav">
        {TABS.map((t) => <Link key={t.k} href={`/settings?tab=${t.k}`} className={t.k === tab ? "on" : ""}>{t.label}</Link>)}
      </nav>
      {sp.msg && <div className="card" style={{ marginBottom: 16, borderColor: sp.ok ? "var(--ok)" : "var(--bad)" }}>{sp.msg}</div>}
      {tab === "general" && <General />}
      {tab === "agent" && <Agent />}
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
        <label htmlFor="instructions">Твої інструкції помічнику</label>
        <textarea id="instructions" name="instructions" defaultValue={cfg.instructions} style={{ minHeight: 200 }}
          placeholder={"Напр.: Відповідай максимально коротко.\nЗвіти клієнтам пиши на «Ви», без води.\nЦіна моєї години — $30, враховуй у пропозиціях."} />
      </div>
      <div className="mono" style={{ color: "var(--dim)" }}>
        Ціни — $ за 1 млн токенів (вхід / вихід). {cfg.fallback ? "Якщо модель відмовить з міркувань безпеки — API автоматично спробує іншу." : "Для цієї моделі автоматичного запасного варіанту нема."}
      </div>
      <div><button>Зберегти</button></div>
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
          {kv("Помічник", `${s.agent.model} · ${s.agent.effort} · ключ ${s.agent.hasKey ? "є" : "нема"}`)}
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
