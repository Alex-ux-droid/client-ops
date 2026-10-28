import { saveClient } from "@/app/actions";
import { CLIENT_STATUSES, type Client } from "@/lib/repo/clients";
import { STATUS_LABEL } from "@/lib/labels";

const F = ({ name, label, c, area, wide, placeholder }: { name: keyof Client; label: string; c?: Client; area?: boolean; wide?: boolean; placeholder?: string }) => (
  <div className={`field ${wide ? "wide" : ""}`}>
    <label htmlFor={name}>{label}</label>
    {area
      ? <textarea id={name} name={name} defaultValue={String(c?.[name] ?? "")} placeholder={placeholder} />
      : <input id={name} name={name} defaultValue={String(c?.[name] ?? "")} placeholder={placeholder} />}
  </div>
);

export default function ClientForm({ c }: { c?: Client }) {
  return (
    <form action={saveClient}>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="form-grid">
        <F name="name" label="Назва" c={c} />
        <div className="field">
          <label htmlFor="status">Статус</label>
          <select id="status" name="status" defaultValue={c?.status ?? "active"}>
            {CLIENT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <F name="niche" label="Ніша" c={c} />
        <F name="offer" label="Що продаємо" c={c} placeholder="Реклама, сайт, CRM…" />
        <F name="budget" label="Бюджет" c={c} placeholder="$1000/міс реклама" />
        <F name="bitwarden_ref" label="Bitwarden (тільки назва запису)" c={c} placeholder="Bitwarden: Клієнт / FB" />
        <F name="needs" label="Що хоче клієнт" c={c} area wide />
        <F name="client_vision" label="Бачення клієнта" c={c} area />
        <F name="my_vision" label="Моє бачення" c={c} area />
        <F name="contacts" label="Контакти" c={c} area />
        <F name="notes" label="Нотатки" c={c} area />
      </div>
      <div className="mono" style={{ marginBottom: 14 }}>Паролі сюди не пиши. Тільки назва запису в Bitwarden.</div>
      <button>{c ? "Зберегти" : "Створити клієнта"}</button>
    </form>
  );
}
