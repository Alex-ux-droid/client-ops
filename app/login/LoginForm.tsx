"use client";
import { useActionState, useEffect, useState } from "react";
import { checkLogin, login } from "./actions";

export default function LoginForm() {
  const [res, action, pending] = useActionState(login, null);
  const waitId = res?.startsWith("WAIT:") ? res.slice(5) : null;
  const [waitErr, setWaitErr] = useState<string | null>(null);
  const error = waitId ? waitErr : res;
  // Поки перевіряємо пароль — зорі розганяються в «гіперстрибок»; помилка — гальмуємо
  useEffect(() => { (window as unknown as { __warp?: boolean }).__warp = pending || !!waitId; }, [pending, waitId]);
  // Чекаємо кнопку «Це я» в Telegram
  useEffect(() => {
    if (!waitId) return;
    setWaitErr(null);
    let stop = false;
    const tick = async () => {
      if (stop) return;
      const s = await checkLogin(waitId).catch(() => "wait" as const);
      if (s === "ok") { window.location.href = "/"; return; }
      if (s === "no") { setWaitErr("Вхід відхилено в Telegram."); return; }
      if (s === "gone") { setWaitErr("Час на підтвердження минув (5 хв). Увійди ще раз."); return; }
      setTimeout(tick, 2000);
    };
    void tick();
    return () => { stop = true; };
  }, [waitId]);
  return (
    <form action={action} className="login-form">
      <label htmlFor="password" className="sr-only">Пароль</label>
      <input id="password" name="password" type="password" autoComplete="current-password" autoFocus required placeholder="Пароль" className={error ? "bad" : ""} />
      <label className="login-remember"><input type="checkbox" name="remember" /> Запамʼятати цей пристрій на 7 днів</label>
      <div className="login-hint">Без галочки — вихід після 30 хв без дій (для чужого компʼютера).</div>
      {waitId && !waitErr && <div className="login-hint" role="status">📲 Підтверди вхід кнопкою «Це я» в Telegram (Джері вже написав).</div>}
      {error && <div className="login-err">{error}</div>}
      <button disabled={pending || (!!waitId && !waitErr)}>{pending ? "Стрибаємо…" : waitId && !waitErr ? "Чекаю Telegram…" : "Увійти"}</button>
    </form>
  );
}
