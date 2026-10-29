// Щоденна копія бази. Зберігає останні 14 копій поруч з базою в backups/.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { dbPath } from "../lib/migrate.mjs";

const file = dbPath();
if (!fs.existsSync(file)) process.exit(0);
const dir = path.join(path.dirname(file), "backups");
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
await new Database(file, { readonly: true }).backup(path.join(dir, `app-${stamp}.db`));
const old = fs.readdirSync(dir).filter((f) => f.startsWith("app-")).sort().slice(0, -14);
for (const f of old) fs.rmSync(path.join(dir, f));
console.log(`backup ok: app-${stamp}.db`);
