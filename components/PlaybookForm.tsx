import { savePlaybookAction } from "@/app/actions";
import type { Playbook } from "@/lib/repo/playbooks";

const TEMPLATE = `# Назва процесу

Коротко: для чого цей плейбук і коли його застосовувати.

## Підготовка
- [ ] Перший пункт
- [ ] Другий пункт

## Запуск
- [ ] Ще пункт
`;

export default function PlaybookForm({ p }: { p?: Playbook }) {
  return (
    <form action={savePlaybookAction} className="stack">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="form-grid">
        <div className="field"><label htmlFor="title">Назва</label><input id="title" name="title" defaultValue={p?.title} required placeholder="Налаштування CRM" /></div>
        <div className="field"><label htmlFor="tags">Теги</label><input id="tags" name="tags" defaultValue={p?.tags} placeholder="crm, facebook" /></div>
      </div>
      <div className="field">
        <label htmlFor="body_md">Чекліст (рядок «- [ ] …» = пункт з галочкою, «#» = заголовок)</label>
        <textarea id="body_md" name="body_md" defaultValue={p?.body_md ?? TEMPLATE} style={{ minHeight: 360, fontFamily: "var(--font-mono)", fontSize: 13 }} />
      </div>
      <div><button>Зберегти</button></div>
    </form>
  );
}
