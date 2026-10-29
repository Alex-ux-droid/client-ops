"use client";
// 1) Незбережений текст у формах переживає оновлення сторінки (sessionStorage).
// 2) Коли прод оновився, стара сторінка вже не може зберігати — показуємо плашку «онови».
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type Draft = Record<string, string>; // "номер форми|name" → значення

const KEY = (path: string) => `draft:${path}`;
const SKIP = new Set(["hidden", "password", "file", "submit", "button", "checkbox", "radio"]);

function fields(): [string, Field][] {
  const out: [string, Field][] = [];
  document.querySelectorAll("main form:not([data-nodraft])").forEach((form, fi) => {
    form.querySelectorAll<Field>("input[name], textarea[name], select[name]").forEach((el) => {
      if (!SKIP.has((el as HTMLInputElement).type)) out.push([`${fi}|${el.name}`, el]);
    });
  });
  return out;
}

const read = (path: string): Draft => { try { return JSON.parse(sessionStorage.getItem(KEY(path)) || "{}"); } catch { return {}; } };
const write = (path: string, d: Draft) => {
  try { if (Object.keys(d).length) sessionStorage.setItem(KEY(path), JSON.stringify(d)); else sessionStorage.removeItem(KEY(path)); } catch {}
};

export default function Drafts() {
  const path = usePathname();
  const [restored, setRestored] = useState(false);
  const [stale, setStale] = useState(false);

  // Відновити після завантаження сторінки; зберігати при кожній зміні
  useEffect(() => {
    setRestored(false);
    const t = setTimeout(() => {
      const draft = read(path);
      let n = 0;
      for (const [k, el] of fields()) {
        if (!(k in draft)) continue;
        if (el.value === draft[k] || el.value === `https://${draft[k]}`) delete draft[k]; // вже збережено на сервері
        else { el.value = draft[k]; n++; }
      }
      write(path, draft);
      if (n) setRestored(true);
    }, 300);
    const onInput = (e: Event) => {
      const el = e.target as Field;
      const form = el.closest?.("main form:not([data-nodraft])");
      if (!form || !el.name || SKIP.has((el as HTMLInputElement).type)) return;
      const fi = Array.from(document.querySelectorAll("main form:not([data-nodraft])")).indexOf(form);
      const d = read(path);
      d[`${fi}|${el.name}`] = el.value;
      write(path, d);
    };
    document.addEventListener("input", onInput);
    document.addEventListener("change", onInput);
    return () => { clearTimeout(t); document.removeEventListener("input", onInput); document.removeEventListener("change", onInput); };
  }, [path]);

  // Перевірка версії: при поверненні на вкладку і раз на 2 хв
  useEffect(() => {
    let first: string | null = null;
    const check = async () => {
      try {
        const { build } = await (await fetch("/api/version", { cache: "no-store" })).json();
        if (first === null) first = build;
        else if (build !== first) setStale(true);
      } catch {}
    };
    check();
    const iv = setInterval(check, 120_000);
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  if (!stale && !restored) return null;
  return (
    <div className="draft-bar">
      {stale ? (
        <>
          <span>Система оновилась — онови сторінку, інакше «Зберегти» не спрацює. Набраний текст не пропаде.</span>
          <button className="small" onClick={() => location.reload()}>Оновити</button>
        </>
      ) : (
        <>
          <span>Повернув незбережений текст. Перевір і натисни «Зберегти».</span>
          <button className="ghost small" onClick={() => setRestored(false)}>Ок</button>
        </>
      )}
    </div>
  );
}
