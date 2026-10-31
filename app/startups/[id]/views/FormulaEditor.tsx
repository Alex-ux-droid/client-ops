"use client";
import { useState } from "react";
import { FORMULA, formulaText, type FormulaKey } from "@/lib/startupSystem";
import { saveFormulaAction } from "../../actions";

// Формула ідеї: заповнюєш шматки — бачиш готове речення наживо. Зберіг змінене — у історії зʼявилась нова версія.
export default function FormulaEditor({ id, initial }: { id: number; initial: Partial<Record<FormulaKey, string>> }) {
  const [f, setF] = useState(initial);
  const text = formulaText(f);
  const changed = text !== formulaText(initial);
  return (
    <form action={saveFormulaAction} className="card id-formula" id="formula">
      <input type="hidden" name="id" value={id} />
      <div className={`id-sentence ${text ? "" : "empty"}`}>{text || "Заповни поля — тут складеться ідея одним реченням."}</div>
      <div className="id-fields">
        {FORMULA.map((x) => (
          <label key={x.k} className="fin-field">
            <span>{x.label}</span>
            <input name={`f_${x.k}`} value={f[x.k] ?? ""} placeholder={x.ph} onChange={(e) => setF((v) => ({ ...v, [x.k]: e.target.value }))} />
          </label>
        ))}
      </div>
      {changed && <input name="why" placeholder="Що змінили і чому (для історії версій), необовʼязково" />}
      <div className="inline" style={{ gap: "0.75rem" }}><button disabled={!changed}>{changed ? "Зберегти нову версію" : "Збережено"}</button></div>
    </form>
  );
}
