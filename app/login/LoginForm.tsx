"use client";
import { useActionState, useEffect } from "react";
import { login } from "./actions";

export default function LoginForm() {
  const [error, action, pending] = useActionState(login, null);
  // Поки перевіряємо пароль — зорі розганяються в «гіперстрибок»; помилка — гальмуємо
  useEffect(() => { (window as unknown as { __warp?: boolean }).__warp = pending; }, [pending]);
  return (
    <form action={action} className="login-form">
      <label htmlFor="password" className="sr-only">Пароль</label>
      <input id="password" name="password" type="password" autoComplete="current-password" autoFocus required placeholder="Пароль" className={error ? "bad" : ""} />
      {error && <div className="login-err">{error}</div>}
      <button disabled={pending}>{pending ? "Стрибаємо…" : "Увійти"}</button>
    </form>
  );
}
