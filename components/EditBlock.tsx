// Блок «текст + правка в попапі»: на екрані — гарно відформатований зміст (абзац або список), клік — попап з полем і «Зберегти».
// Замість стіни полів вводу. Працює з будь-яким server action, що приймає FormData з полем `name` (+ приховані поля).
import Pop from "./Pop";
import SubmitButton from "./SubmitButton";
import VoiceTextarea from "./VoiceTextarea";

const lines = (s: string) => s.split("\n").map((x) => x.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

export default function EditBlock({ title, name, value, action, hidden, list, hint, rows = 8, wide }: {
  title: string; name: string; value: string; action: (fd: FormData) => void | Promise<void>; hidden: React.ReactNode;
  list?: boolean; hint?: string; rows?: number; wide?: boolean;
}) {
  const items = list ? lines(value) : [];
  const empty = !value.trim();
  return (
    <Pop wide closeOnSubmit className={`pop-card eb${empty ? " empty" : ""}${wide ? " eb-wide" : ""}`} title={title} sub={hint} trigger={
      <>
        <span className="eb-h"><b>{title}</b>{list && items.length > 0 && <span className="qt-n">{items.length}</span>}<span className="eb-pen" aria-hidden>✎</span></span>
        {empty ? <span className="eb-empty">+ Додати</span>
          : list ? <ul className="eb-list">{items.slice(0, 5).map((x, i) => <li key={i}>{x}</li>)}{items.length > 5 && <li className="eb-more">ще {items.length - 5} →</li>}</ul>
          : <span className="eb-text">{value.trim()}</span>}
      </>
    }>
      <form action={action} className="stack" style={{ gap: "0.5rem" }}>
        {hidden}
        {list && <span className="mono">Кожен пункт — з нового рядка.</span>}
        <VoiceTextarea name={name} defaultValue={value} style={{ minHeight: `${rows * 1.5}rem` }} autoFocus />
        <div><SubmitButton className="small">Зберегти</SubmitButton></div>
      </form>
    </Pop>
  );
}
