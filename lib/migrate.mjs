// Спільний для застосунку і скриптів: проганяє db/migrations/*.sql по порядку, один раз кожен.
import fs from "node:fs";
import path from "node:path";

export function migrate(db, dir) {
  db.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const done = new Set(db.prepare("SELECT name FROM _migrations").all().map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    db.transaction(() => {
      db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
      db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, datetime('now'))").run(f);
    })();
  }
}

export function dbPath() {
  return process.env.DATABASE_PATH || path.join(process.cwd(), "data", "app.db");
}
