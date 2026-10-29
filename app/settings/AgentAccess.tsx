"use client";
import { useState } from "react";
import { createAgentTokenAction, revokeAgentTokenAction } from "./actions";

export default function AgentAccess({ active }: { active: boolean }) {
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);
  return (
    <div className="stack">
      <div className="mono">Статус: {active || token ? <span style={{ color: "var(--ok)" }}>увімкнено</span> : <span style={{ color: "var(--dim)" }}>вимкнено</span>}</div>
      {token ? (
        <>
          <div className="mono" style={{ color: "var(--warn)" }}>Скопіюй зараз — більше не покажу:</div>
          <input readOnly value={token} onFocus={(e) => e.target.select()} aria-label="Ключ доступу" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
          <button type="button" className="ghost small" onClick={() => navigator.clipboard.writeText(token).then(() => setCopied(true), () => setCopied(false))}>
            {copied ? "Скопійовано" : "Копіювати"}
          </button>
        </>
      ) : (
        <button type="button" className="ghost" onClick={async () => setToken(await createAgentTokenAction())}>
          {active ? "Створити новий ключ (старий перестане працювати)" : "Створити ключ доступу"}
        </button>
      )}
      {(active || token) && <form action={revokeAgentTokenAction}><button className="ghost small">Вимкнути доступ</button></form>}
    </div>
  );
}
