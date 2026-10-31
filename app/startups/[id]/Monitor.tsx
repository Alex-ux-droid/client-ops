import { BarChart } from "@/components/Charts";
import SubmitButton from "@/components/SubmitButton";
import { githubToken, listCommits, listIssues } from "@/lib/github";
import { recentChecks, uptime, type Startup } from "@/lib/repo/startups";
import { checkNowAction, saveStartupAction } from "../actions";

const kyiv = (iso: string) => new Date(iso.replace(" ", "T") + "Z").toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Моніторинг: репозиторій (що робиться) + продакшен (чи живе)
export default async function Monitor({ s }: { s: Startup }) {
  const checks = s.prod_url ? recentChecks(s.id, 24) : [];
  const last = checks.at(-1);
  const up24 = s.prod_url ? uptime(s.id, 1) : null, up7 = s.prod_url ? uptime(s.id, 7) : null;
  // середній час відповіді по годинах
  const hours = new Map<string, { sum: number; n: number; bad: number }>();
  for (const c of checks) {
    const h = kyiv(c.at).slice(-5, -3);
    const x = hours.get(h) ?? { sum: 0, n: 0, bad: 0 };
    hours.set(h, { sum: x.sum + c.ms, n: x.n + 1, bad: x.bad + (c.ok ? 0 : 1) });
  }
  const incidents = checks.filter((c) => !c.ok).slice(-5).reverse();

  let commits: Awaited<ReturnType<typeof listCommits>> = [], issues: Awaited<ReturnType<typeof listIssues>> = [], ghErr = "";
  if (s.repo && githubToken()) {
    try { [commits, issues] = await Promise.all([listCommits(s.repo), listIssues(s.repo, "open")]); }
    catch (e) { ghErr = e instanceof Error ? e.message : "GitHub не відповів"; }
  }

  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <form action={saveStartupAction} className="card stack">
        <input type="hidden" name="id" value={s.id} /><input type="hidden" name="v" value="monitor" />
        <b>Що відстежуємо</b>
        <div className="grid2" style={{ gap: "0.5rem" }}>
          <input name="repo" defaultValue={s.repo} placeholder="GitHub: owner/repo або посилання" />
          <input name="prod_url" type="url" defaultValue={s.prod_url} placeholder="Адреса продакшену: https://…" />
        </div>
        <div><SubmitButton className="small" /></div>
      </form>

      <div className="grid2">
        <section className="card stack">
          <div className="mx-main-head"><b>Продакшен</b>{s.prod_url && <form action={checkNowAction}><input type="hidden" name="id" value={s.id} /><SubmitButton className="ghost small" pendingText="Перевіряю…">Перевірити зараз</SubmitButton></form>}</div>
          {!s.prod_url ? <p className="lab-muted" style={{ margin: 0 }}>Вкажи адресу — система перевірятиме її раз на 5 хв і напише в Telegram, якщо ляже.</p> : (
            <>
              <div className="su-health">
                <span className={`su-dot big ${last ? (last.ok ? "ok" : "bad") : ""}`} />
                <div>
                  <b>{!last ? "Ще не перевіряли" : last.ok ? "Працює" : "Не відповідає"}</b>
                  <span>{last ? `${kyiv(last.at)} · ${last.status || "нема звʼязку"} · ${last.ms} мс` : "перша перевірка — протягом 5 хв"}</span>
                </div>
              </div>
              <div className="mx-blocks" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <div><b>{up24 != null ? `${up24}%` : "—"}</b><span>доступність за добу</span></div>
                <div><b>{up7 != null ? `${up7}%` : "—"}</b><span>за 7 днів</span></div>
              </div>
              {hours.size > 1 && (
                <div>
                  <div className="mono" style={{ marginBottom: "0.375rem" }}>Час відповіді по годинах, мс</div>
                  <BarChart width={520} fmt={(n) => String(Math.round(n))} data={[...hours.entries()].map(([h, x]) => ({ label: h, value: x.sum / x.n, tip: `${h}:00 — ${Math.round(x.sum / x.n)} мс${x.bad ? `, збоїв ${x.bad}` : ""}` }))} />
                </div>
              )}
              {incidents.length > 0 && <div className="stack" style={{ gap: "0.25rem" }}><span className="lab-kicker">Збої</span>{incidents.map((c) => <span key={c.at} className="su-mini-row">{kyiv(c.at)} · {c.status || "нема звʼязку"}</span>)}</div>}
            </>
          )}
        </section>

        <section className="card stack">
          <b>Репозиторій</b>
          {!s.repo ? <p className="lab-muted" style={{ margin: 0 }}>Вкажи репозиторій — тут будуть останні коміти і відкриті задачі.</p>
            : !githubToken() ? <p className="lab-muted" style={{ margin: 0 }}>Підключи GitHub: Налаштування → Конектори → GitHub.</p>
            : ghErr ? <p style={{ margin: 0, color: "var(--warn)" }}>{ghErr}</p> : (
              <>
                <span className="lab-kicker">Останні коміти</span>
                {commits.length ? commits.slice(0, 8).map((c) => <div key={c.sha} className="su-mini-row"><span>{c.date}</span>{c.message}</div>) : <p className="lab-muted" style={{ margin: 0 }}>Комітів нема.</p>}
                <span className="lab-kicker" style={{ marginTop: "0.5rem" }}>Відкриті задачі і PR · {issues.length}</span>
                {issues.slice(0, 8).map((i) => <div key={i.number} className="su-mini-row"><span>{i.kind} #{i.number}</span>{i.title}</div>)}
              </>
            )}
        </section>
      </div>
    </div>
  );
}
