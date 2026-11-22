// Матеріали клієнта для студії контенту: синхронізація з папкою Google Диска → content_assets (тільки реальні файли клієнта)
import { driveReadAll, googleConnected, listFolderTree } from "./google";
import { pruneAssets, upsertAsset, type AssetKind } from "./repo/content";
import { getSocial, saveSocial } from "./repo/social";

export function guessKind(name: string, path: string, mime: string): AssetKind {
  const t = `${path} ${name}`.toLowerCase();
  if (mime.startsWith("video/")) return "video";
  if (/лого|logo/.test(t) || mime === "image/svg+xml") return "logo";
  if (/план|plan|layout|поверх/.test(t)) return "plan";
  if (/фото|photo|img_|dsc|будівниц|хід/.test(t)) return "photo";
  if (mime.startsWith("image/")) return "render";
  if (mime === "application/pdf" || /document|presentation|spreadsheet|iwork|msword|ms-excel|ms-powerpoint/.test(mime) || /\.(pdf|xlsx?|csv|numbers|docx?|pages|pptx?|key)$/i.test(name)) return "doc";
  return "other";
}

export async function syncAssets(clientId: number): Promise<{ ok: boolean; error?: string; total?: number; removed?: number }> {
  const s = getSocial(clientId);
  if (!s?.drive_folder_id) return { ok: false, error: "Спершу вкажи папку з матеріалами в «Налаштуваннях»." };
  if (!googleConnected()) return { ok: false, error: "Google не підключено: Налаштування → Конектори → Google → «Перепідключити»." };
  if (!driveReadAll()) return { ok: false, error: "Google підключено без читання Диску: перепідключи і постав усі галочки." };
  const files = (await listFolderTree(s.drive_folder_id, 4, 600)).filter((f) => !f.folder);
  for (const f of files) {
    const dir = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/")) : "";
    upsertAsset(clientId, { drive_id: f.id, name: f.name, path: dir, mime: f.mimeType, kind: guessKind(f.name, dir, f.mimeType), size: f.size ? Number(f.size) : null, link: f.webViewLink ?? "", modified_at: f.modifiedTime ?? null });
  }
  const removed = pruneAssets(clientId, files.map((f) => f.id));
  saveSocial(clientId, { assets_synced_at: new Date().toISOString() });
  return { ok: true, total: files.length, removed };
}
