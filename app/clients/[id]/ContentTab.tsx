// Контент (автопостинг, крок 1): куди публікуємо, матеріали з Диску, як це працює, черга (далі)
import Pop from "@/components/Pop";
import SubmitButton from "@/components/SubmitButton";
import { saveSocialAction } from "@/app/content/actions";
import { driveReadAll, googleConnected, listFolderTree } from "@/lib/google";
import { metaToken, metaTokenCheck } from "@/lib/meta";
import { getSocial } from "@/lib/repo/social";

const STEPS = [
  ["План місяця", "система пропонує теми на кожен тиждень — ти тиснеш ОК"],
  ["Пости", "каруселі, сторіс, Reels — тільки з реальних рендерів і планувань з папки"],
  ["Апрув", "готовий пост приходить у Telegram: ✓ / правка / ✕"],
  ["Публікація", "після ✓ сам виходить в Instagram і Facebook у свій час"],
  ["Навчання", "що зайшло — того більше в наступному місяці"],
];

const kindOf = (m: string) => (m.startsWith("image/") ? "фото" : m.startsWith("video/") ? "відео" : m === "application/pdf" ? "PDF" : "інше");

async function Materials({ folderId }: { folderId: string }) {
  if (!googleConnected()) return <div className="mx-warn">Google не підключено — Налаштування → Конектори → Google → «Перепідключити». Без цього система не бачить папку.</div>;
  if (!driveReadAll()) return <div className="mx-warn">Google підключено без доступу до читання Диску — перепідключи Google і постав усі галочки.</div>;
  try {
    const files = (await listFolderTree(folderId, 3, 300)).filter((f) => !f.folder);
    if (!files.length) return <p className="mono">Папка порожня або немає доступу до неї.</p>;
    const by = files.reduce<Record<string, number>>((a, f) => ({ ...a, [kindOf(f.mimeType)]: (a[kindOf(f.mimeType)] ?? 0) + 1 }), {});
    return (
      <div className="stack" style={{ gap: "0.375rem" }}>
        <div className="mono">Знайшов {files.length}: {Object.entries(by).map(([k, n]) => `${k} ${n}`).join(" · ")}</div>
        <Pop className="pop-trigger pop-inline" wide title="Що лежить у папці" trigger={<span className="h-link mono">показати файли →</span>}>
          <div className="stack" style={{ gap: "0.25rem" }}>
            {files.map((f) => <a key={f.id} href={f.webViewLink} target="_blank" rel="noreferrer" className="mono">{kindOf(f.mimeType)} · {f.path}</a>)}
          </div>
        </Pop>
      </div>
    );
  } catch (e) {
    return <div className="mx-warn">Не вдалось прочитати папку: {e instanceof Error ? e.message.slice(0, 200) : "помилка"}</div>;
  }
}

export default async function ContentTab({ clientId }: { clientId: number }) {
  const s = getSocial(clientId);
  const check = metaToken() ? await metaTokenCheck() : null;
  const pages = check?.ok ? check.pages ?? [] : [];
  const hid = <input type="hidden" name="client_id" value={clientId} />;
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="card stack" style={{ gap: "0.5rem" }}>
        <b>1. Куди публікуємо</b>
        {s?.page_id ? <div className="mono">Facebook: {s.page_name} · Instagram: {s.ig_username ? `@${s.ig_username}` : "не привʼязаний до сторінки"}</div> : <div className="mono">Ще не обрано.</div>}
        {pages.length ? (
          <form action={saveSocialAction} className="inline" style={{ flexWrap: "wrap" }}>
            {hid}
            <select key={s?.page_id || "none"} name="page" defaultValue={s?.page_id ? `${s.page_id}|${s.ig_id}|${s.ig_username}|${s.page_name}` : ""} aria-label="Сторінка">
              <option value="" disabled>Обери сторінку</option>
              {pages.map((p) => <option key={p.id} value={`${p.id}|${p.ig}|${p.igUser}|${p.name}`}>{p.name}{p.igUser ? ` · @${p.igUser}` : " · без Instagram"}</option>)}
            </select>
            <SubmitButton className="small">Зберегти</SubmitButton>
          </form>
        ) : <div className="mx-warn">Токен Meta не бачить сторінок — Налаштування → Конектори → Meta Ads.</div>}
      </div>

      <div className="card stack" style={{ gap: "0.5rem" }}>
        <b>2. Матеріали клієнта</b>
        <div className="mono">Папка Google Диска з рендерами, плануваннями, лого. Система бере ТІЛЬКИ звідси — нічого не домальовує.</div>
        <form action={saveSocialAction} className="inline" style={{ flexWrap: "wrap" }}>
          {hid}
          <input key={s?.drive_folder_url || "none"} name="drive" defaultValue={s?.drive_folder_url ?? ""} placeholder="https://drive.google.com/drive/folders/…" inputMode="url" autoCapitalize="off" style={{ minWidth: "min(100%, 28rem)" }} aria-label="Папка на Диску" />
          <SubmitButton className="small">Зберегти</SubmitButton>
          {s?.drive_folder_url && <a href={s.drive_folder_url} target="_blank" rel="noreferrer" className="btn ghost small">Відкрити ↗</a>}
        </form>
        {s?.drive_folder_id ? <Materials folderId={s.drive_folder_id} /> : s?.drive_folder_url ? <div className="mx-warn">Не схоже на посилання на папку — скопіюй адресу папки з браузера.</div> : null}
      </div>

      <div className="card stack" style={{ gap: "0.375rem" }}>
        <b>3. Як це працює</b>
        <ol className="stack" style={{ gap: "0.25rem", margin: 0, paddingLeft: "1.25rem" }}>
          {STEPS.map(([t, d]) => <li key={t}><b>{t}</b> — <span className="mono">{d}</span></li>)}
        </ol>
      </div>

      <div className="card stack" style={{ gap: "0.375rem" }}>
        <b>4. Черга постів</b>
        <p className="mono" style={{ margin: 0 }}>Тут зʼявляться готові пости на ✓. Наступний крок — перша сторіс для перевірки публікації.</p>
      </div>
    </div>
  );
}
