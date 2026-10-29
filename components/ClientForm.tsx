import { saveClient } from "@/app/actions";
import { CURRENCY } from "@/lib/config";
import { STAGE_LABEL, STATUS_LABEL } from "@/lib/labels";
import { CLIENT_STATUSES, LEAD_STAGES, type Client } from "@/lib/repo/clients";

const F = ({ name, label, c, area, wide, placeholder, mode }: { name: keyof Client; label: string; c?: Partial<Client>; area?: boolean; wide?: boolean; placeholder?: string; mode?: "decimal" | "numeric" }) => (
  <div className={`field ${wide ? "wide" : ""}`}>
    <label htmlFor={name}>{label}</label>
    {area
      ? <textarea id={name} name={name} defaultValue={String(c?.[name] ?? "")} placeholder={placeholder} />
      : <input id={name} name={name} defaultValue={c?.[name] === 0 ? "" : String(c?.[name] ?? "")} placeholder={placeholder} inputMode={mode} />}
  </div>
);

export default function ClientForm({ c }: { c?: Partial<Client> }) {
  return (
    <form action={saveClient}>
      {c?.id && <input type="hidden" name="id" value={c.id} />}
      <h2 style={{ marginBottom: 12 }}>Основне</h2>
      <div className="form-grid">
        <F name="name" label="Назва" c={c} />
        <F name="niche" label="Ніша" c={c} />
        <div className="field">
          <label htmlFor="status">Статус</label>
          <select id="status" name="status" defaultValue={c?.status ?? "active"}>
            {CLIENT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="stage">Етап воронки (для ліда)</label>
          <select id="stage" name="stage" defaultValue={c?.stage ?? "new"}>
            {LEAD_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </select>
        </div>
        <F name="offer" label="Що продаємо" c={c} placeholder="Реклама, сайт, CRM…" />
        <F name="next_step" label="Наступний крок" c={c} placeholder="Відправити КП до п'ятниці" />
      </div>

      <h2 style={{ margin: "12px 0" }}>Гроші</h2>
      <div className="form-grid">
        <F name="fee_monthly" label={`Платить мені щомісяця, ${CURRENCY}`} c={c} placeholder="0" mode="decimal" />
        <F name="pay_day" label="День оплати (1–31)" c={c} placeholder="1" mode="numeric" />
        <F name="budget" label="Рекламний бюджет / умови" c={c} placeholder="$1000/міс на рекламу" wide />
      </div>

      <h2 style={{ margin: "12px 0" }}>Що в голові</h2>
      <div className="form-grid">
        <F name="needs" label="Що хоче клієнт" c={c} area wide />
        <F name="client_vision" label="Бачення клієнта" c={c} area />
        <F name="my_vision" label="Моє бачення" c={c} area />
        <F name="contacts" label="Контакти" c={c} area />
        <F name="notes" label="Нотатки" c={c} area />
        <F name="bitwarden_ref" label="Bitwarden (тільки назва запису)" c={c} placeholder="Bitwarden: Клієнт / FB" wide />
      </div>
      <div className="mono" style={{ marginBottom: 14 }}>Паролі сюди не пиши. Тільки назва запису в Bitwarden.</div>
      <button>{c?.id ? "Зберегти" : "Створити"}</button>
    </form>
  );
}
