import Link from "next/link";
import { connection } from "next/server";
import { logout } from "@/app/login/actions";
import { SECTIONS } from "@/components/nav";
import { navCounts } from "@/lib/repo/counts";

// Меню на телефоні — окрема сторінка (на компʼютері те саме в боковій панелі)
export default async function MenuPage() {
  await connection();
  const counts = navCounts();
  return (
    <div className="menu-page">
      <h1>Меню</h1>
      {SECTIONS.map((s) => (
        <div key={s.title} className="side-group">
          <div className="side-title">{s.title}</div>
          {s.items.map((i) => {
            const c = i.count ? counts[i.count] : 0;
            return (
              <Link key={i.href} href={i.href} className="side-link">
                <span className="ico">{i.ico}</span>
                <span className="grow">{i.label}</span>
                {c > 0 && <span className={`count ${i.bad ? "bad" : ""}`}>{c}</span>}
              </Link>
            );
          })}
        </div>
      ))}
      <form action={logout}><button className="ghost" style={{ width: "100%" }}>Вийти</button></form>
    </div>
  );
}
