import { createClientQuick } from "@/app/actions";
import { ymd } from "@/lib/dates";

// Перший екран: тільки головне. Решта — у картці після створення.
export default async function NewClientPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const lead = (await searchParams).lead === "1";
  return (
    <div style={{ maxWidth: "40rem" }}>
      <div className="head"><div><h1>{lead ? "Новий лід" : "Новий клієнт"}</h1><div className="hub-sub">Тільки головне. Послуги, сайт, реклама, папки — далі в картці.</div></div></div>
      <form action={createClientQuick} className="card stack" style={{ padding: "1.5rem" }}>
        <div className="field">
          <label htmlFor="name">Компанія / проєкт</label>
          <input id="name" name="name" required autoFocus placeholder="Автосервіс «Мотор»" />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="owner_name">Власник</label>
            <input id="owner_name" name="owner_name" placeholder="Ім'я, хто приймає рішення" />
          </div>
          <div className="field">
            <label htmlFor="phone">Телефон</label>
            <input id="phone" name="phone" type="tel" placeholder="+380…" />
          </div>
          <div className="field">
            <label htmlFor="niche">Вид бізнесу</label>
            <input id="niche" name="niche" placeholder="СТО, стоматологія, меблі…" />
          </div>
          <div className="field">
            <label htmlFor="locations">Скільки бізнесів / точок</label>
            <input id="locations" name="locations" inputMode="numeric" defaultValue="1" />
          </div>
        </div>
        <fieldset className="choice">
          <legend>Статус</legend>
          <label><input type="radio" name="status" value="lead" defaultChecked={lead} /> <span><b>Лід</b><small>ще домовляємось</small></span></label>
          <label><input type="radio" name="status" value="active" defaultChecked={!lead} /> <span><b>Вже працюємо</b><small>ведемо клієнта</small></span></label>
        </fieldset>
        <div className="field">
          <label htmlFor="work_since">Ведемо з (якщо вже працюємо)</label>
          <input id="work_since" name="work_since" type="date" defaultValue={ymd()} />
        </div>
        <div><button>Створити і відкрити картку →</button></div>
      </form>
      <div className="mono" style={{ marginTop: "1rem" }}>Порада: можна просто надиктувати клієнта помічнику — кнопка 🎙.</div>
    </div>
  );
}
