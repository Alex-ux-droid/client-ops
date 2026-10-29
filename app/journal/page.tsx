import Link from "next/link";
import { deleteDevAction } from "@/app/actions";
import { fmtDate } from "@/lib/dates";
import { DEV_KINDS, DEV_SOURCES, listDev, type DevKind } from "@/lib/repo/devlog";
import { AddEntry, CopyExport, DownloadExport } from "./JournalTools";

const TAG: Record<DevKind, string> = { request: "accent", bug: "bad", note: "warn", error: "bad" };

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const archive = (await searchParams).v === "archive";
  const entries = listDev(archive ? "exported" : "new");
  return (
    <>
      <div className="head">
        <div>
          <h1>Журнал системи</h1>
          <div className="hub-sub">Що доробити, глюки і нюанси. Пише помічник, ти і сама система. Експортуй і кидай Claude.</div>
        </div>
        {!archive && (
          <div className="inline" style={{ flexWrap: "wrap" }}>
            <CopyExport disabled={!entries.length} />
            <DownloadExport disabled={!entries.length} />
          </div>
        )}
      </div>
      <div className="tabs">
        <Link href="/journal" className={archive ? "" : "on"}>Нові{!archive && entries.length ? <b>{entries.length}</b> : null}</Link>
        <Link href="/journal?v=archive" className={archive ? "on" : ""}>Відправлені</Link>
      </div>
      <div className="split">
        <div className="list">
          {entries.length ? entries.map((e) => (
            <details key={e.id} className="row" style={{ display: "block" }}>
              <summary>
                <div className="row-title">{e.title}</div>
                <div className="meta">
                  <span className={`tag ${TAG[e.kind]}`}>{DEV_KINDS[e.kind]}</span>
                  <span className="tag">{DEV_SOURCES[e.source]}</span>
                  <span className="mono">{fmtDate(e.created_at)}{e.context ? ` · ${e.context}` : ""}</span>
                </div>
              </summary>
              {e.body && <pre className="material">{e.body}</pre>}
              {!archive && (
                <form action={deleteDevAction} style={{ marginTop: "0.5rem" }}>
                  <input type="hidden" name="id" value={e.id} />
                  <button className="ghost small">Видалити</button>
                </form>
              )}
            </details>
          )) : <div className="empty">{archive ? "Ще нічого не відправляли." : "Нових записів нема."}</div>}
        </div>
        {!archive && <AddEntry />}
      </div>
    </>
  );
}
