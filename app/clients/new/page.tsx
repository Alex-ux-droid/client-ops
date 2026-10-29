import { createClientQuick } from "@/app/actions";
import { ymd } from "@/lib/dates";

// Перший екран: тільки головне, на всю ширину, без прокрутки. Решта — у картці.
export default async function NewClientPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const lead = (await searchParams).lead === "1";
  return (
    <>
      <div className="head" style={{ marginBottom: "1rem" }}>
        <h1>{lead ? "Новий лід" : "Новий клієнт"}</h1>
        <div className="mono">Тільки головне — послуги, сайт, реклама і папки далі в картці. Або надиктуй Джері 🎙</div>
      </div>
      <form action={createClientQuick} className="card quick-form">
        <div className="field qf-wide">
          <label htmlFor="name">Компанія / проєкт</label>
          <input id="name" name="name" required autoFocus placeholder="Автосервіс «Мотор»" />
        </div>
        <div className="field">
          <label htmlFor="owner_name">Власник</label>
          <input id="owner_name" name="owner_name" placeholder="Хто приймає рішення" />
        </div>
        <div className="field">
          <label htmlFor="phone">Телефон</label>
          <input id="phone" name="phone" type="tel" placeholder="+380…" />
        </div>
        <div className="field qf-wide">
          <label htmlFor="niche">Вид бізнесу</label>
          <input id="niche" name="niche" placeholder="СТО, стоматологія, меблі…" />
        </div>
        <div className="field">
          <label htmlFor="locations">Бізнесів / точок</label>
          <input id="locations" name="locations" inputMode="numeric" defaultValue="1" />
        </div>
        <div className="field">
          <label htmlFor="work_since">Ведемо з</label>
          <input id="work_since" name="work_since" type="date" defaultValue={ymd()} />
        </div>
        <fieldset className="choice qf-wide">
          <legend>Статус</legend>
          <label><input type="radio" name="status" value="lead" defaultChecked={lead} /> <span><b>Лід</b><small>ще домовляємось</small></span></label>
          <label><input type="radio" name="status" value="active" defaultChecked={!lead} /> <span><b>Вже працюємо</b><small>ведемо клієнта</small></span></label>
        </fieldset>
        <div className="qf-submit qf-wide2">
          <button>Створити і відкрити картку →</button>
        </div>
      </form>
    </>
  );
}
