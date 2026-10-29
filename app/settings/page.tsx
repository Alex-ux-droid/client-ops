import { saveKeyAction, testKeyAction } from "./actions";
import { CURRENCY } from "@/lib/config";
import { agentModel, getApiKey, maskKey } from "@/lib/secrets";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ msg?: string; ok?: string }> }) {
  const sp = await searchParams;
  const key = getApiKey();
  return (
    <>
      <div className="head"><div><div className="kicker">Система</div><h1>Налаштування</h1></div></div>
      {sp.msg && <div className="card" style={{ marginBottom: 16, borderColor: sp.ok ? "var(--ok)" : "var(--bad)" }}>{sp.msg}</div>}
      <div className="grid2">
        <div className="card stack">
          <h2>Помічник (Anthropic API)</h2>
          <div className="mono">Ключ: {key ? <span style={{ color: "var(--ok)" }}>{maskKey(key)}</span> : <span style={{ color: "var(--warn)" }}>не задано</span>}</div>
          <div className="mono">Модель: {agentModel()}</div>
          <form action={saveKeyAction} className="stack">
            <input name="key" type="password" autoComplete="off" placeholder="sk-ant-…" required aria-label="Ключ API" />
            <button>{key ? "Замінити ключ" : "Зберегти ключ"}</button>
          </form>
          {key && <form action={testKeyAction}><button className="ghost small">Перевірити ключ</button></form>}
          <div className="mono" style={{ color: "var(--dim)" }}>Ключ зберігається тільки у файлі .env на сервері і ніде не показується повністю. Витрати — у platform.claude.com → Витрати.</div>
        </div>
        <div className="card stack">
          <h2>Інше</h2>
          <div className="mono">Валюта: {CURRENCY} (змінюється змінною APP_CURRENCY)</div>
        </div>
      </div>
    </>
  );
}
