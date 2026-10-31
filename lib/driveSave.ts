// Джері кладе файли в папку клієнта на Google Диску: фото/файли з Telegram-групи і креативи Meta.
// Обмеження scope drive.file: писати можна тільки в папки, які створила система (або підпапки в них).
import { downloadFile, ensureSubfolder, folderExists, folderIdFromUrl, folderUrl, googleConnected, uploadFile } from "./google";
import { getClient } from "./repo/clients";
import { adsForClient } from "./repo/meta";
import { listFolders, saveFolder } from "./repo/services";
import { clientMessages, getTgFile } from "./repo/telegram";
import { FOLDER_KINDS } from "./services";
import { fileBlob, TG_FILE_LIMIT } from "./telegram";

const MAX_FILES = 20;
const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);

async function targetFolder(clientId: number, kind: string, sub?: string): Promise<{ id: string; url: string; title: string }> {
  const def = FOLDER_KINDS.find((f) => f.kind === kind) ?? FOLDER_KINDS[0];
  let id = folderIdFromUrl(listFolders(clientId).find((f) => f.kind === def.kind)?.url ?? "");
  if (id && !(await folderExists(id).catch(() => false))) id = null;
  if (!id) {
    const main = folderIdFromUrl(getClient(clientId)?.drive_url ?? "");
    if (!main) throw new Error("У клієнта нема папки на Диску — спершу drive_create_folders");
    id = await ensureSubfolder(main, def.title);
    saveFolder(clientId, def.kind, def.title, folderUrl(id));
  }
  let title: string = def.title;
  if (sub?.trim()) { id = await ensureSubfolder(id, safe(sub)); title = `${def.title} / ${safe(sub)}`; }
  return { id, url: folderUrl(id), title };
}

export async function saveFilesToDrive(input: { client_id: number; folder?: string; subfolder?: string; tg_message_ids?: number[]; last_files?: number; meta_ad_ids?: string[]; prefix?: string }) {
  if (!googleConnected()) throw new Error("Google не підключено (Налаштування → Конектори → Google)");
  const cid = input.client_id;
  const dest = await targetFolder(cid, input.folder || "creatives", input.subfolder);
  const pre = input.prefix?.trim() ? `${safe(input.prefix)} — ` : "";
  const saved: string[] = [], failed: string[] = [];

  const ids = [...(input.tg_message_ids ?? [])];
  if (input.last_files) {
    const files = clientMessages(cid, { limit: 400 }).filter((m) => m.tg_file_id).slice(-Math.min(MAX_FILES, input.last_files));
    for (const m of files) if (!ids.includes(m.id)) ids.push(m.id);
  }
  for (const id of ids.slice(0, MAX_FILES)) {
    const f = getTgFile(id);
    const label = `Telegram ${id}`;
    try {
      if (!f || !f.tg_file_id) throw new Error("нема файлу");
      if (f.client_id !== cid) throw new Error("файл з групи іншого клієнта");
      if (f.file_size > TG_FILE_LIMIT) throw new Error("понад 20 МБ — бот не скачає");
      const blob = f.drive_id ? await (await downloadFile(f.drive_id)).blob() : await fileBlob(f.tg_file_id);
      const name = `${pre}${f.sent_at.slice(0, 10)} ${safe(f.from_name || "")} — ${safe(f.file_name || (f.kind === "photo" ? `фото-${id}.jpg` : `файл-${id}`))}`;
      await uploadFile(dest.id, name, blob, f.mime || blob.type);
      saved.push(name);
    } catch (e) { failed.push(`${label}: ${e instanceof Error ? e.message : e}`); }
  }

  if (input.meta_ad_ids?.length) {
    const ads = adsForClient(cid);
    for (const adId of input.meta_ad_ids.slice(0, MAX_FILES)) {
      const a = ads.find((x) => x.ad_id === adId);
      // карусель — всі картки; інакше головна картинка (для відео — обкладинка)
      let urls: string[] = [];
      try { urls = (JSON.parse(a?.images_json || "[]") as (string | { url?: string })[]).map((x) => (typeof x === "string" ? x : x.url ?? "")).filter(Boolean); } catch {}
      if (!urls.length && (a?.image_url || a?.thumbnail_url)) urls = [a!.image_url || a!.thumbnail_url];
      if (!a || !urls.length) { failed.push(`Meta ${adId}: нема картинки`); continue; }
      for (const [i, url] of urls.entries()) {
        try {
          const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
          if (!r.ok) throw new Error(`картинка не відкрилась (${r.status})`);
          const blob = await r.blob();
          const ext = blob.type.includes("png") ? "png" : "jpg";
          const name = `${pre}${safe(a.name)}${urls.length > 1 ? ` (${i + 1})` : ""}${a.kind === "video" ? " — обкладинка" : ""}.${ext}`;
          await uploadFile(dest.id, name, blob, blob.type || "image/jpeg");
          saved.push(name);
        } catch (e) { failed.push(`Meta ${adId}: ${e instanceof Error ? e.message : e}`); }
      }
    }
  }
  return { folder: dest.title, url: dest.url, saved, failed };
}
