import Link from "next/link";
import Pop from "@/components/Pop";
import { deleteDevAction } from "@/app/actions";
import { fmtDate } from "@/lib/dates";
import { listChangelog } from "@/lib/repo/changelog";
import { DEV_KINDS, DEV_SOURCES, listDev, type DevKind } from "@/lib/repo/devlog";
import { AddEntry, CopyExport, DownloadExport } from "./JournalTools";

const TAG: Record<DevKind, string> = { request: "accent", bug: "bad", note: "warn", error: "bad" };

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const v = (await searchParams).v;
  if (v === "updates") return <Updates />;
  const archive = v === "archive";
  const entries = listDev(archive ? "exported" : "new");
  return (
    <>
      <div className="head">
        <div>
          <h1>Журнал системи</h1>
          <div className="hub-sub">Що доробити, глюки і нюанси. Пише Джері, ти і сама система. Експортуй і кидай Claude.</div>
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
        <Link href="/journal?v=updates">Оновлення</Link>
      </div>
      <div className="split">
        <div className="list">
          {entries.length ? groups(entries).map((g) => {
            const e = g[0], last = g[g.length - 1];
            return (
              <Pop key={e.id} wide title={e.title} sub={`${DEV_KINDS[e.kind]} · ${DEV_SOURCES[e.source]}${g.length > 1 ? ` · ${g.length} рази` : ""}`} trigger={
                <div className="row jr-row">
                  <div className="row-main">
                    <div className="row-title jr-t">{e.title}</div>
                    <div className="meta">
                      <span className={`tag ${TAG[e.kind]}`}>{DEV_KINDS[e.kind]}</span>
                      {g.length > 1 && <span className="tag bad">×{g.length}</span>}
                      <span className="mono">{g.length > 1 ? `${fmtDate(e.created_at)} – ${fmtDate(last.created_at)}` : fmtDate(e.created_at)}{e.context ? ` · ${e.context}` : ""}</span>
                    </div>
                  </div>
                </div>
              }>
                {e.body && <pre className="material">{e.body}</pre>}
                {g.length > 1 && <div className="mono" style={{ margin: "0.5rem 0" }}>Повторювалось: {g.map((x) => `${fmtDate(x.created_at)}${x.context && x.context !== e.context ? ` (${x.context})` : ""}`).join(", ")}</div>}
                {!archive && (
                  <form action={deleteDevAction} style={{ marginTop: "0.5rem" }}>
                    <input type="hidden" name="ids" value={g.map((x) => x.id).join(",")} />
                    <button className="ghost small">{g.length > 1 ? `Видалити всі ${g.length}` : "Видалити"}</button>
                  </form>
                )}
              </Pop>
            );
          }) : <div className="empty">{archive ? "Ще нічого не відправляли." : "Нових записів нема."}</div>}
        </div>
        {!archive && <AddEntry />}
      </div>
    </>
  );
}

// Що додали в систему — бачить і Джері (останні 8 у системному промпті)
function Updates() {
  const list = listChangelog();
  return (
    <>
      <div className="head">
        <div>
          <h1>Журнал системи</h1>
          <div className="hub-sub">Оновлення: що додали і змінили. Джері бачить останні й спирається на них.</div>
        </div>
        <div className="inline" style={{ flexWrap: "wrap" }}>
          <a href="/api/changelog/pdf?days=1" target="_blank" rel="noreferrer" className="btn ghost small">PDF за сьогодні</a>
          <a href="/api/changelog/pdf?days=7" target="_blank" rel="noreferrer" className="btn ghost small">PDF за тиждень</a>
        </div>
      </div>
      <div className="tabs">
        <Link href="/journal">Нові</Link>
        <Link href="/journal?v=archive">Відправлені</Link>
        <Link href="/journal?v=updates" className="on">Оновлення</Link>
      </div>
      <div className="upd-list">
        {list.length ? list.map((e) => (
          <article key={e.id} className="card upd">
            <div className="upd-date">{new Date(e.created_at.replace(" ", "T") + "Z").toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv", day: "numeric", month: "long" })}</div>
            <div>
              <h3>{e.title}</h3>
              <Pop title={e.title} trigger={<p className="pv-s l4" style={{ margin: 0 }}>{e.body}</p>}><p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{e.body}</p></Pop>
            </div>
          </article>
        )) : <div className="empty">Оновлень ще нема.</div>}
      </div>
    </>
  );
}

// Однакові записи (помилка з тим самим текстом, різняться лише числа/id) — одна плитка з лічильником
const norm = (t: string) => t.replace(/req_[A-Za-z0-9]+/g, "").replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();
function groups<T extends { kind: string; title: string }>(xs: T[]): T[][] {
  const m = new Map<string, T[]>();
  for (const x of xs) { const k = `${x.kind}|${norm(x.title)}`; m.set(k, [...(m.get(k) ?? []), x]); }
  return [...m.values()];
}
