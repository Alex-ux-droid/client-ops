import { saveFoldersAction } from "@/app/actions";
import { listFolders } from "@/lib/repo/services";
import { FOLDER_KINDS } from "@/lib/services";

// Папки клієнта: головна папка на Диску і стандартні підпапки. Поки Google не підключено — посилання вставляються вручну.
export default function FilesTab({ clientId, driveUrl }: { clientId: number; driveUrl: string }) {
  const folders = listFolders(clientId);
  const url = (kind: string) => folders.find((f) => f.kind === kind)?.url ?? "";
  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      <div className="folder-grid">
        <a className={`folder main ${driveUrl ? "" : "off"}`} href={driveUrl || undefined} target="_blank" rel="noreferrer">
          <span className="folder-ico">▣</span>
          <span><b>Папка клієнта</b><small>{driveUrl ? "Google Диск ↗" : "посилання не додано"}</small></span>
        </a>
        {FOLDER_KINDS.map((f) => (
          <a key={f.kind} className={`folder ${url(f.kind) ? "" : "off"}`} href={url(f.kind) || undefined} target="_blank" rel="noreferrer">
            <span className="folder-ico">▢</span>
            <span><b>{f.title}</b><small>{url(f.kind) ? "відкрити ↗" : "не додано"}</small></span>
          </a>
        ))}
      </div>

      <details className="card" open={!driveUrl}>
        <summary><b>Посилання на папки</b> <span className="mono">— вставляй з Google Диска</span></summary>
        <form key={JSON.stringify([driveUrl, folders])} action={saveFoldersAction} className="form-grid" style={{ marginTop: "1rem" }}>
          <input type="hidden" name="client_id" value={clientId} />
          <div className="field wide">
            <label htmlFor="drive_url">Головна папка клієнта</label>
            <input id="drive_url" name="drive_url" type="url" defaultValue={driveUrl} placeholder="https://drive.google.com/drive/folders/…" />
          </div>
          {FOLDER_KINDS.map((f) => (
            <div key={f.kind} className="field">
              <label htmlFor={`f_${f.kind}`}>{f.title}</label>
              <input id={`f_${f.kind}`} name={`f_${f.kind}`} type="url" defaultValue={url(f.kind)} placeholder="https://drive.google.com/…" />
            </div>
          ))}
          <div className="wide"><button>Зберегти</button></div>
        </form>
      </details>
      <div className="mono">Після підключення Google Диска (Налаштування) ці папки створюватимуться самі для кожного нового клієнта.</div>
    </div>
  );
}
