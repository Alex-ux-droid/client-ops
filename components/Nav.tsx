"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

const ITEMS = [
  { href: "/", label: "Центр", ico: "◎" },
  { href: "/tasks", label: "Задачі", ico: "▣" },
  { href: "/clients", label: "Клієнти", ico: "◇" },
  { href: "/ideas", label: "Ідеї", ico: "✦" },
];

export default function Nav() {
  const path = usePathname();
  if (path === "/login") return null;
  return (
    <nav className="nav">
      <div className="nav-brand">CLIENT<span>/</span>OPS</div>
      {ITEMS.map((i) => {
        const on = i.href === "/" ? path === "/" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={on ? "on" : ""}>
            <span className="ico">{i.ico}</span>
            {i.label}
          </Link>
        );
      })}
      <form action={logout} className="nav-logout"><button>Вийти</button></form>
    </nav>
  );
}
