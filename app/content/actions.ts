"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { syncAssets } from "@/lib/contentAssets";
import { folderIdFromUrl } from "@/lib/google";
import { addPillar, addPost, deletePost, setWeekTheme, updateAsset, updatePillar, updatePost, type AssetKind, type PostStatus, ASSET_KINDS, POST_STATUS } from "@/lib/repo/content";
import { FORMATS, saveSocial, type Format } from "@/lib/repo/social";
import { setSetting } from "@/lib/repo/settings";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const cidOf = (fd: FormData) => Number(fd.get("client_id")) || 0;
const done = (cid: number) => revalidatePath(`/clients/${cid}`);

// Налаштування і стратегія: зберігаємо тільки ті поля, що прийшли з форми
export async function saveSocialAction(fd: FormData) {
  await requireUser();
  const cid = cidOf(fd);
  if (!cid) return;
  if (fd.has("page")) {
    const [page_id = "", ig_id = "", ig_username = "", ...name] = s(fd, "page").split("|");
    saveSocial(cid, { page_id, ig_id, ig_username, page_name: name.join("|") });
  }
  if (fd.has("drive")) {
    const url = s(fd, "drive");
    saveSocial(cid, { drive_folder_url: url, drive_folder_id: folderIdFromUrl(url) ?? (/^[\w-]{20,}$/.test(url) ? url : "") });
  }
  for (const k of ["audience", "voice", "cta", "banned", "facts"] as const) if (fd.has(k)) saveSocial(cid, { [k]: s(fd, k).slice(0, 4000) });
  if (fd.has("approval")) saveSocial(cid, { approval: s(fd, "approval") === "auto" ? "auto" : "manual", auto_hours: Math.min(168, Math.max(1, Number(s(fd, "auto_hours")) || 24)) });
  if (fd.has("cad_reel")) saveSocial(cid, { cadence_json: JSON.stringify(Object.fromEntries(Object.keys(FORMATS).map((f) => [f, Math.min(21, Math.max(0, Number(s(fd, `cad_${f}`)) || 0))]))) });
  if (fd.has("slots_form")) {
    const slots: Record<string, string> = {};
    for (let d = 1; d <= 7; d++) { const t = s(fd, `slot_${d}`); if (fd.get(`day_${d}`) && /^\d{2}:\d{2}$/.test(t)) slots[d] = t; }
    saveSocial(cid, { slots_json: JSON.stringify(slots) });
  }
  done(cid);
}

export async function syncAssetsAction(fd: FormData): Promise<void> {
  await requireUser();
  const cid = cidOf(fd);
  // Результат — у settings, вкладка показує його («оновлено N» або що не так)
  const r = await syncAssets(cid).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message.slice(0, 200) : "помилка" }));
  setSetting(`content.sync.${cid}`, r.ok ? `ok:${r.total}` : `err:${r.error}`);
  done(cid);
}

export async function assetAction(fd: FormData) {
  await requireUser();
  const cid = cidOf(fd), id = Number(fd.get("id"));
  const kind = s(fd, "kind");
  updateAsset(id, cid, {
    ...(kind && kind in ASSET_KINDS ? { kind: kind as AssetKind } : {}),
    ...(fd.has("tags") ? { tags: s(fd, "tags").slice(0, 300) } : {}),
    ...(fd.has("hidden") ? { hidden: s(fd, "hidden") === "1" ? 1 : 0 } : {}),
  });
  done(cid);
}

export async function pillarAction(fd: FormData) {
  await requireUser();
  const cid = cidOf(fd), id = Number(fd.get("id")) || 0;
  const p = { name: s(fd, "name").slice(0, 80), goal: s(fd, "goal").slice(0, 400), color: /^#[0-9a-f]{6}$/i.test(s(fd, "color")) ? s(fd, "color") : undefined, share: fd.has("share") ? Math.min(100, Math.max(0, Number(s(fd, "share")) || 0)) : undefined };
  if (s(fd, "op") === "archive" && id) updatePillar(id, cid, { archived: 1 });
  else if (id) updatePillar(id, cid, { ...(p.name ? { name: p.name } : {}), goal: p.goal, color: p.color, share: p.share });
  else if (p.name) addPillar(cid, { name: p.name, goal: p.goal, color: p.color, share: p.share });
  done(cid);
}

export async function weekThemeAction(fd: FormData) {
  await requireUser();
  const cid = cidOf(fd), week = s(fd, "week");
  if (/^\d{4}-\d{2}-\d{2}$/.test(week)) setWeekTheme(cid, week, s(fd, "theme").slice(0, 200));
  done(cid);
}

export async function postAction(fd: FormData) {
  await requireUser();
  const cid = cidOf(fd), id = Number(fd.get("id")) || 0, op = s(fd, "op") || "save";
  if (op === "delete" && id) { deletePost(id, cid); return done(cid); }
  if (op === "status" && id) { const st = s(fd, "status"); if (st in POST_STATUS) updatePost(id, cid, { status: st as PostStatus }); return done(cid); }
  const date = s(fd, "date"), time = s(fd, "time");
  const p = {
    format: (s(fd, "format") in FORMATS ? s(fd, "format") : "carousel") as Format,
    pillar_id: Number(fd.get("pillar_id")) || null,
    topic: s(fd, "topic").slice(0, 300),
    hook: s(fd, "hook").slice(0, 300),
    template_key: s(fd, "template_key").slice(0, 60),
    note: s(fd, "note").slice(0, 2000),
    scheduled_at: /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date} ${/^\d{2}:\d{2}$/.test(time) ? time : "18:30"}` : null,
  };
  if (id) updatePost(id, cid, p);
  else if (p.topic) addPost(cid, p);
  done(cid);
}

// Задачі-прохання клієнта → правки проєктів (CRM / сайт)
export async function moveAsksAction(fd: FormData) {
  await requireUser();
  const cid = cidOf(fd);
  const { moveAsksToRequests } = await import("@/lib/taskLog");
  if (cid) moveAsksToRequests(cid);
  revalidatePath("/", "layout");
}
