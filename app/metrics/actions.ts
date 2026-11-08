"use server";
// Головна метрика клієнта: додати, ціль, головна, вписати значення, прибрати
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { addMetric, deleteMetric, getMetric, METRIC_SOURCES, setMainMetric, setMetricValue, updateMetric, type MetricSource } from "@/lib/repo/metrics";
import { kyivDay } from "@/lib/repo/meta";

const n = (v: FormDataEntryValue | null) => { const t = String(v ?? "").replace(",", ".").replace(/[^\d.-]/g, ""); return t === "" || Number.isNaN(Number(t)) ? null : Number(t); };
const back = (clientId: number) => revalidatePath(`/clients/${clientId}`);

export async function metricAddAction(fd: FormData) {
  await requireUser();
  const clientId = Number(fd.get("client_id")), source = String(fd.get("source")) as MetricSource;
  if (!clientId || !(source in METRIC_SOURCES)) return;
  addMetric(clientId, { source, name: String(fd.get("name") ?? "").trim().slice(0, 80), target: n(fd.get("target")), direction: fd.get("direction") === "down" ? "down" : fd.get("direction") === "up" ? "up" : undefined, is_main: fd.get("main") === "on" });
  back(clientId);
}

export async function metricEditAction(fd: FormData) {
  await requireUser();
  const m = getMetric(Number(fd.get("id")));
  if (!m) return;
  const op = String(fd.get("op"));
  if (op === "main") setMainMetric(m.id);
  else if (op === "delete") deleteMetric(m.id);
  else if (op === "value") { const v = n(fd.get("value")); if (v != null) setMetricValue(m.id, kyivDay(0), v); }
  else updateMetric(m.id, { target: n(fd.get("target")), name: String(fd.get("name") ?? m.name).trim().slice(0, 80) });
  back(m.client_id);
}
