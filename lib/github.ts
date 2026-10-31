// GitHub — ТІЛЬКИ ЧИТАННЯ для Джері: репозиторії (і приватні), файли, пошук по коду, задачі/PR, коміти.
// Токен (fine-grained, read-only) — у .env (GITHUB_TOKEN), зберігається тільки після успішної перевірки.
import { getSetting, setSetting } from "./repo/settings";
import { setEnvVar } from "./secrets";

const API = "https://api.github.com";
export const githubToken = () => process.env.GITHUB_TOKEN?.trim() || null;

async function gh<T>(path: string, token = githubToken()): Promise<T> {
  if (!token) throw new Error("GitHub не підключено (Налаштування → Конектори → GitHub)");
  const r = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "client-ops" },
    signal: AbortSignal.timeout(20000),
  });
  if (r.status === 401) throw new Error("Токен GitHub не працює (протермінований або відкликаний) — онови в Налаштування → Конектори → GitHub");
  if (r.status === 404) throw new Error("Не знайдено — або нема такого шляху, або токен не має доступу до цього репозиторію");
  if (r.status === 403 || r.status === 429) throw new Error(`GitHub не пускає (${r.status}): ${(await r.text()).slice(0, 160)}`);
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return (await r.json()) as T;
}

export async function connectGithub(token: string): Promise<string> {
  const me = await gh<{ login: string }>("/user", token);
  setEnvVar("GITHUB_TOKEN", token);
  setSetting("github.login", me.login);
  setSetting("github.connected_at", new Date().toISOString());
  return me.login;
}
export function disconnectGithub(): void {
  setEnvVar("GITHUB_TOKEN", null);
}
export const githubLogin = () => getSetting("github.login") ?? "";

type Repo = { full_name: string; private: boolean; description: string | null; language: string | null; pushed_at: string; default_branch: string; html_url: string; archived: boolean };
export async function listRepos(q = "") {
  const repos: Repo[] = [];
  for (let page = 1; page <= 3; page++) {
    const part = await gh<Repo[]>(`/user/repos?per_page=100&sort=pushed&page=${page}`);
    repos.push(...part);
    if (part.length < 100) break;
  }
  const f = q.trim().toLowerCase();
  return repos.filter((r) => !f || r.full_name.toLowerCase().includes(f) || (r.description ?? "").toLowerCase().includes(f)).slice(0, 60)
    .map((r) => ({ repo: r.full_name, private: r.private, about: r.description, language: r.language, last_push: r.pushed_at.slice(0, 10), branch: r.default_branch, archived: r.archived || undefined }));
}

// Папка → список; файл → текст (до 60 тис. символів)
export async function browse(repo: string, path = "", ref = "") {
  const q = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const clean = path.replace(/^\/+|\/+$/g, "");
  type Entry = { name: string; path: string; type: string; size: number };
  type File = { type: "file"; content?: string; encoding?: string; size: number; path: string; download_url?: string };
  const d = await gh<Entry[] | File>(`/repos/${repo}/contents/${clean.split("/").map(encodeURIComponent).join("/")}${q}`);
  if (Array.isArray(d)) return { kind: "dir", path: clean || "/", items: d.map((e) => ({ name: e.name, path: e.path, type: e.type === "dir" ? "dir" : "file", size: e.type === "dir" ? undefined : e.size })) };
  if (d.size > 1_000_000) return { kind: "file", path: d.path, note: "Файл завеликий (>1 МБ) — не читаю повністю" };
  const text = d.content && d.encoding === "base64" ? Buffer.from(d.content, "base64").toString("utf8") : "";
  return { kind: "file", path: d.path, size: d.size, content: text.slice(0, 60000), truncated: text.length > 60000 || undefined };
}

export async function searchCode(query: string, repo = "") {
  const q = `${query}${repo ? ` repo:${repo}` : ` user:${githubLogin()}`}`;
  type R = { items: { path: string; repository: { full_name: string }; html_url: string }[]; total_count: number };
  const r = await gh<R>(`/search/code?per_page=30&q=${encodeURIComponent(q)}`);
  return { total: r.total_count, items: r.items.map((i) => ({ repo: i.repository.full_name, path: i.path })) };
}

export async function listIssues(repo: string, state = "open") {
  type I = { number: number; title: string; state: string; pull_request?: unknown; labels: { name: string }[]; updated_at: string; user: { login: string }; body: string | null };
  const r = await gh<I[]>(`/repos/${repo}/issues?per_page=40&state=${state === "closed" ? "closed" : state === "all" ? "all" : "open"}`);
  return r.map((i) => ({ number: i.number, kind: i.pull_request ? "PR" : "issue", title: i.title, state: i.state, labels: i.labels.map((l) => l.name), updated: i.updated_at.slice(0, 10), by: i.user.login, body: (i.body ?? "").slice(0, 400) }));
}

export async function listCommits(repo: string, path = "") {
  type C = { sha: string; commit: { message: string; author: { name: string; date: string } } };
  const r = await gh<C[]>(`/repos/${repo}/commits?per_page=25${path ? `&path=${encodeURIComponent(path)}` : ""}`);
  return r.map((c) => ({ sha: c.sha.slice(0, 7), date: c.commit.author.date.slice(0, 10), by: c.commit.author.name, message: c.commit.message.split("\n")[0].slice(0, 200) }));
}
