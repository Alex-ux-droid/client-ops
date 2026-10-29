import fs from "node:fs";
import path from "node:path";

// Номер збірки: відкрита сторінка порівнює його, щоб знати, що прод оновився
export function GET() {
  let build = "dev";
  try { build = fs.readFileSync(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim(); } catch {}
  return Response.json({ build }, { headers: { "Cache-Control": "no-store" } });
}
