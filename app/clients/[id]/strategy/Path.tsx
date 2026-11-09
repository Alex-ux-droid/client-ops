// Шлях клієнта від А до Я: 1 Дірки → 2 Червоні → 3 Жовті → 4 Зелені. Ідемо по черзі, «Ми тут» — перший незакритий етап.
import Pop from "@/components/Pop";
import Icon from "@/components/Icon";
import SubmitButton from "@/components/SubmitButton";
import VoiceTextarea from "@/components/VoiceTextarea";
import TaskOpen from "@/components/TaskOpen";
import { currentStage, listPath, PATH_STAGE_KEYS, PATH_STAGES, PATH_STATUS, type PathItem, type PathStage } from "@/lib/repo/strategyPath";
import { pathAction } from "./actions";

export default function Path({ clientId }: { clientId: number }) {
  const items = listPath(clientId);
  const cur = currentStage(items);
  const total = items.length, done = items.filter((i) => i.status === "done").length;
  const hid = <input type="hidden" name="client_id" value={clientId} />;
  return (
    <section className="wy">
      <div className="wy-head">
        <div>
          <b className="wy-title">Шлях</b>
          <span className="mono">{total ? `${done} з ${total} зроблено · ${cur ? `зараз: ${PATH_STAGES[cur].label.toLowerCase()}` : "усе закрито — вдосконалюємо"}` : "почни з дірок: що протікає прямо зараз?"}</span>
        </div>
        {total > 0 && <div className="wy-bar" aria-label={`${done} з ${total}`}><i style={{ width: `${Math.round((done / total) * 100)}%` }} /></div>}
      </div>
      <div className="wy-road">
        {PATH_STAGE_KEYS.map((s) => <Stage key={s} stage={s} items={items.filter((i) => i.stage === s)} state={!cur ? "past" : s === cur ? "now" : PATH_STAGES[s].n < PATH_STAGES[cur].n ? "past" : "next"} hid={hid} />)}
      </div>
    </section>
  );
}

function Stage({ stage, items, state, hid }: { stage: PathStage; items: PathItem[]; state: "past" | "now" | "next"; hid: React.ReactNode }) {
  const st = PATH_STAGES[stage];
  const done = items.filter((i) => i.status === "done").length;
  return (
    <div className={`wy-st wy-${stage} ${state}`}>
      <div className="wy-st-h">
        <span className="wy-n">{state === "past" && items.length ? <Icon name="check" size={14} /> : st.n}</span>
        <b>{st.label}</b>
        {state === "now" && <span className="wy-here">ми тут</span>}
        <span className="grow" />
        {items.length > 0 && <span className="wy-cnt">{done}/{items.length}</span>}
      </div>
      <div className="wy-hint">{st.hint}</div>
      <ul className="wy-list">
        {items.map((i) => <Item key={i.id} it={i} hid={hid} />)}
      </ul>
      <form action={pathAction} className="wy-add">
        {hid}
        <input type="hidden" name="op" value="add" />
        <input type="hidden" name="stage" value={stage} />
        <input name="title" placeholder={`+ ${stage === "holes" ? "дірка" : stage === "green" ? "що підкрутити" : "проблема"}`} aria-label={`Додати в «${st.label}»`} autoComplete="off" />
      </form>
    </div>
  );
}

function Item({ it, hid }: { it: PathItem; hid: React.ReactNode }) {
  const form = (op: string, extra: React.ReactNode, label: React.ReactNode, cls = "ghost small") => (
    <form action={pathAction}>{hid}<input type="hidden" name="id" value={it.id} /><input type="hidden" name="op" value={op} />{extra}<button className={cls}>{label}</button></form>
  );
  return (
    <li className={`wy-it s-${it.status}`}>
      <form action={pathAction}>
        {hid}<input type="hidden" name="id" value={it.id} /><input type="hidden" name="op" value="toggle" />
        <button className="wy-chk" aria-label={it.status === "done" ? "Повернути" : "Готово"} title={it.status === "done" ? "Повернути" : "Готово"}>{it.status === "done" && <Icon name="check" size={13} />}</button>
      </form>
      <Pop className="pop-trigger pop-inline wy-t" title={PATH_STAGES[it.stage].label} closeOnSubmit trigger={<>{it.title}{it.status === "doing" && <span className="wy-doing">в роботі</span>}</>}>
        <form action={pathAction} className="stack" style={{ gap: "0.5rem" }}>
          {hid}<input type="hidden" name="id" value={it.id} /><input type="hidden" name="op" value="edit" />
          <input name="title" defaultValue={it.title} aria-label="Назва" />
          <VoiceTextarea name="body" defaultValue={it.body} placeholder="деталі: що саме, чому важливо, як зрозуміємо, що закрили" style={{ minHeight: "6rem" }} />
          <div><SubmitButton className="small">Зберегти</SubmitButton></div>
        </form>
        <div className="wy-ops">
          <span className="mono">Статус:</span>
          {(Object.keys(PATH_STATUS) as (keyof typeof PATH_STATUS)[]).map((s) => form("status", <input type="hidden" name="status" value={s} />, PATH_STATUS[s], s === it.status ? "small" : "ghost small"))}
        </div>
        <div className="wy-ops">
          <span className="mono">Перенести:</span>
          {PATH_STAGE_KEYS.filter((s) => s !== it.stage).map((s) => <span key={s}>{form("move", <input type="hidden" name="stage" value={s} />, PATH_STAGES[s].label)}</span>)}
        </div>
        <div className="wy-ops">
          {it.task_id ? <TaskOpen id={it.task_id} className="btn ghost small">Відкрити задачу</TaskOpen> : form("task", null, "→ Зробити задачею")}
          <span className="grow" />
          {form("delete", null, "Видалити")}
        </div>
      </Pop>
    </li>
  );
}
