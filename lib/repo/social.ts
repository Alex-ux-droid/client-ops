import { db } from "../db";

export type SocialProfile = { client_id: number; page_id: string; page_name: string; ig_id: string; ig_username: string; drive_folder_id: string; drive_folder_url: string; updated_at: string };
const F = ["page_id", "page_name", "ig_id", "ig_username", "drive_folder_id", "drive_folder_url"] as const;

export const getSocial = (clientId: number) => db().prepare("SELECT * FROM social_profiles WHERE client_id = ?").get(clientId) as SocialProfile | undefined;
export function saveSocial(clientId: number, p: Partial<Pick<SocialProfile, (typeof F)[number]>>): void {
  const keys = F.filter((k) => p[k] !== undefined);
  if (!keys.length) return;
  db().prepare("INSERT INTO social_profiles (client_id) VALUES (?) ON CONFLICT(client_id) DO NOTHING").run(clientId);
  db().prepare(`UPDATE social_profiles SET ${keys.map((k) => `${k} = @${k}`).join(", ")}, updated_at = datetime('now') WHERE client_id = @client_id`).run({ ...p, client_id: clientId });
}
