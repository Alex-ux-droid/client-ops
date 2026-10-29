"use client";
import { useActionState } from "react";
import { login } from "./actions";

export default function LoginForm() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="card" style={{ width: "100%", maxWidth: 360 }}>
      <div className="field">
        <label htmlFor="password">Пароль</label>
        <input id="password" name="password" type="password" autoComplete="current-password" autoFocus required />
      </div>
      {error && <div className="mono" style={{ color: "var(--bad)", marginBottom: 12 }}>{error}</div>}
      <button disabled={pending} style={{ width: "100%" }}>{pending ? "Перевіряю…" : "Увійти"}</button>
    </form>
  );
}
