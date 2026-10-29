// Технічний стан системи (без даних клієнтів): для /api/status і вкладки «Система».
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { agentConfig } from "./agent/config";
import { db } from "./db";
import { recentErrors } from "./log";
import { dbPath } from "./migrate.mjs";
import { getApiKey, hasAgentToken } from "./secrets";

const sh = (cmd: string) => { try { return execSync(cmd, { cwd: process.cwd(), timeout: 3000 }).toString().trim(); } catch { return null; } };
const tail = (file: string, n = 40) => { try { return fs.readFileSync(file, "utf8").trim().split("\n").slice(-n); } catch { return null; } };

export const COUNTED = ["clients", "tasks", "work_log", "payments", "ad_stats", "materials", "ideas", "playbooks", "chat_messages"] as const;

export function systemInfo() {
  const file = dbPath();
  const dataDir = path.dirname(file);
  const count = (t: string) => (db().prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n;
  let backups: { name: string; kb: number }[] = [];
  try {
    backups = fs.readdirSync(path.join(dataDir, "backups")).sort().reverse().slice(0, 5)
      .map((name) => ({ name, kb: Math.round(fs.statSync(path.join(dataDir, "backups", name)).size / 1024) }));
  } catch { /* бекапів ще нема */ }
  return {
    commit: sh("git rev-parse --short HEAD"),
    commitMessage: sh("git log -1 --format=%s"),
    commitDate: sh("git log -1 --format=%cI"),
    node: process.version,
    uptimeMin: Math.round(process.uptime() / 60),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    now: new Date().toString(),
    dbKb: (() => { try { return Math.round(fs.statSync(file).size / 1024); } catch { return null; } })(),
    migrations: (db().prepare("SELECT name FROM _migrations ORDER BY name").all() as { name: string }[]).map((r) => r.name),
    counts: Object.fromEntries(COUNTED.map((t) => [t, count(t)])) as Record<(typeof COUNTED)[number], number>,
    agent: { model: agentConfig().model, effort: agentConfig().effort, hasKey: !!getApiKey(), claudeAccess: hasAgentToken() },
    backups,
    updateLog: tail(path.join(dataDir, "update.log")),
    errors: recentErrors(),
  };
}
