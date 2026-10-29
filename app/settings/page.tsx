import Anthropic from "@anthropic-ai/sdk";
import AgentAccess from "./AgentAccess";
import { saveAgentAction, saveKeyAction, testKeyAction } from "./actions";
import { agentConfig, EFFORT_LABEL, EFFORTS, KNOWN_MODELS } from "@/lib/agent/config";
import { CURRENCY } from "@/lib/config";
import { getApiKey, hasAgentToken, maskKey } from "@/lib/secrets";

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

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ msg?: string; ok?: string }> }) {
  const sp = await searchParams;
  const key = getApiKey();
  const cfg = agentConfig();
  const models = await modelOptions(key);
  if (!models.some((m) => m.id === cfg.model)) models.unshift({ id: cfg.model, name: cfg.model });

  return (
    <>
      <div className="head"><div><div className="kicker">Система</div><h1>Налаштування</h1></div></div>
      {sp.msg && <div className="card" style={{ marginBottom: 16, borderColor: sp.ok ? "var(--ok)" : "var(--bad)" }}>{sp.msg}</div>}

      <div className="split">
        <form action={saveAgentAction} className="card stack">
          <h2>Помічник</h2>
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
          <div className="field">
            <label htmlFor="instructions">Твої інструкції помічнику</label>
            <textarea id="instructions" name="instructions" defaultValue={cfg.instructions} style={{ minHeight: 180 }}
              placeholder={"Напр.: Відповідай максимально коротко.\nЗвіти клієнтам пиши на «Ви», без води.\nЦіна моєї години — $30, враховуй у пропозиціях."} />
          </div>
          <div className="mono" style={{ color: "var(--dim)" }}>
            {cfg.fallback ? "Якщо модель відмовить з міркувань безпеки — API автоматично спробує іншу." : "Для цієї моделі автоматичного запасного варіанту нема."}
          </div>
          <div><button>Зберегти</button></div>
        </form>

        <div className="stack" style={{ gap: 16 }}>
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

          <div className="card stack">
            <h2>Інше</h2>
            <div className="mono">Валюта: {CURRENCY} (змінна APP_CURRENCY)</div>
          </div>
        </div>
      </div>
    </>
  );
}
