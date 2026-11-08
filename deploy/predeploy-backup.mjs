// Копія бази перед деплоєм, у якому є нові міграції (міграції лише «вперед» — відкат = відновлення з цієї копії).
// Кладе в <папка бази>/predeploy/app-<час>.db, тримає 10 останніх. Запуск: node deploy/predeploy-backup.mjs
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const env = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
const fromEnv = env.match(/^DATABASE_PATH=(.+)$/m)?.[1]?.trim();
const file = process.env.DATABASE_PATH || fromEnv || path.join(process.cwd(), "data", "app.db");
if (!fs.existsSync(file)) { console.log("predeploy-backup: бази ще нема"); process.exit(0); }
const dir = path.join(path.dirname(file), "predeploy");
fs.mkdirSync(dir, { recursive: true });
const out = path.join(dir, `app-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.db`);
await new Database(file, { readonly: true }).backup(out);
for (const f of fs.readdirSync(dir).filter((x) => x.startsWith("app-")).sort().reverse().slice(10)) fs.rmSync(path.join(dir, f));
console.log(`predeploy-backup: ${out}`);
