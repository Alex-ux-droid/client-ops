// Стан системи для діагностики (тільки з ключем Claude або після входу). Без даних клієнтів.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { agentConfig } from "@/lib/agent/config";
import { db } from "@/lib/db";
import { recentErrors } from "@/lib/log";
import { dbPath } from "@/lib/migrate.mjs";
import { getApiKey } from "@/lib/secrets";
import { isAuthed, SESSION_COOKIE } from "@/lib/session";

const sh = (cmd: string) => { try { return execSync(cmd, { cwd: process.cwd(), timeout: 3000 }).toString().trim(); } catch { return null; } };
const tail = (file: string, n = 40) => { try { return fs.readFileSync(file, "utf8").trim().split("\n").slice(-n); } catch { return null; } };

export async function GET(req: NextRequest) {
  if (!isAuthed(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("authorization"))) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  const count = (t: string) => (db().prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n;
  const dataDir = path.dirname(dbPath());
  return NextResponse.json({
    commit: sh("git rev-parse --short HEAD"),
    commitMessage: sh("git log -1 --format=%s"),
    node: process.version,
    uptimeMin: Math.round(process.uptime() / 60),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    now: new Date().toString(),
    migrations: (db().prepare("SELECT name FROM _migrations ORDER BY name").all() as { name: string }[]).map((r) => r.name),
    counts: Object.fromEntries(["clients", "tasks", "work_log", "payments", "ad_stats", "materials", "ideas", "playbooks", "chat_messages"].map((t) => [t, count(t)])),
    agent: { ...agentConfig(), instructions: undefined, hasKey: !!getApiKey() },
    backups: (() => { try { return fs.readdirSync(path.join(dataDir, "backups")).sort().slice(-3); } catch { return []; } })(),
    updateLog: tail(path.join(dataDir, "update.log")),
    errors: recentErrors(),
  });
}
