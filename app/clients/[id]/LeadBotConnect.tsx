"use client";
// Підключення власного бота клієнта (токен з @BotFather) + копіювання запрошення + тест
import { useState } from "react";
import { leadBotConnectAction, leadBotTestAction } from "@/app/leads/actions";

export function LeadBotConnect({ clientId }: { clientId: number }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [busyUrl, setBusyUrl] = useState("");
  async function go(force: boolean) {
    setBusy(true); setMsg("");
    const r = await leadBotConnectAction(clientId, token, force);
    setBusy(false);
    if (r.ok) { setToken(""); setBusyUrl(""); setMsg(`Підключено @${r.username} ✓`); }
    else { setMsg(r.error); setBusyUrl(r.busy ?? ""); }
  }
  return (
    <div className="stack" style={{ gap: "0.5rem" }}>
      <div className="inline">
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Токен бота від @BotFather: 123456:ABC…" autoComplete="off" aria-label="Токен бота клієнта" />
        <button type="button" disabled={busy || !token.trim()} onClick={() => go(false)}>{busy ? "Підключаю…" : "Підключити"}</button>
      </div>
      {msg && <div className="mono" style={{ color: busyUrl ? "var(--warn)" : "var(--link)" }}>{msg}</div>}
      {busyUrl && <div className="inline"><button type="button" className="ghost small" disabled={busy} onClick={() => go(true)}>Все одно підключити</button><span className="mono">бот перестане працювати там</span></div>}
    </div>
  );
}

export function CopyInvite({ link }: { link: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="lb-invite">
      <code>{link}</code>
      <button type="button" className="ghost small" onClick={async () => { try { await navigator.clipboard.writeText(link); setOk(true); setTimeout(() => setOk(false), 1500); } catch {} }}>{ok ? "Скопійовано ✓" : "Копіювати"}</button>
    </div>
  );
}

export function TestLead({ clientId }: { clientId: number }) {
  const [msg, setMsg] = useState("");
  return (
    <span className="inline">
      <button type="button" className="ghost small" onClick={async () => { setMsg("…"); const r = await leadBotTestAction(clientId); setMsg(r.text); }}>Тестова заявка</button>
      {msg && <span className="mono">{msg}</span>}
    </span>
  );
}
