import { db } from "../db";

// Профіль клієнта для контенту: куди публікуємо, матеріали, стратегія, апрув, частота і слоти
export type SocialProfile = {
  client_id: number; page_id: string; page_name: string; ig_id: string; ig_username: string; drive_folder_id: string; drive_folder_url: string;
  audience: string; voice: string; cta: string; banned: string; facts: string; approval: "manual" | "auto"; auto_hours: number;
  cadence_json: string; slots_json: string; assets_synced_at: string | null; updated_at: string;
};
const F = ["page_id", "page_name", "ig_id", "ig_username", "drive_folder_id", "drive_folder_url", "audience", "voice", "cta", "banned", "facts", "approval", "auto_hours", "cadence_json", "slots_json", "assets_synced_at"] as const;
export type SocialPatch = Partial<Pick<SocialProfile, (typeof F)[number]>>;

export const getSocial = (clientId: number) => db().prepare("SELECT * FROM social_profiles WHERE client_id = ?").get(clientId) as SocialProfile | undefined;
export function saveSocial(clientId: number, p: SocialPatch): void {
  const keys = F.filter((k) => p[k] !== undefined);
  if (!keys.length) return;
  db().prepare("INSERT INTO social_profiles (client_id) VALUES (?) ON CONFLICT(client_id) DO NOTHING").run(clientId);
  db().prepare(`UPDATE social_profiles SET ${keys.map((k) => `${k} = @${k}`).join(", ")}, updated_at = datetime('now') WHERE client_id = @client_id`).run({ ...p, client_id: clientId });
}

export const FORMATS = { reel: "Reels", carousel: "Карусель", story: "Сторіс", post: "Пост" } as const;
export type Format = keyof typeof FORMATS;
export const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
export function cadenceOf(p?: SocialProfile): Record<Format, number> {
  const d = { reel: 2, carousel: 2, story: 4, post: 0 };
  try { return { ...d, ...JSON.parse(p?.cadence_json || "{}") }; } catch { return d; }
}
// Слоти: день тижня 1..7 → "HH:MM"
export function slotsOf(p?: SocialProfile): Record<string, string> {
  try { return JSON.parse(p?.slots_json || "{}"); } catch { return {}; }
}
