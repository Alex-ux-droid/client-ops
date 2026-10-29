// Завершення сесії лабораторії: висновок → у картку клієнта (матеріал, історія, послуга з обраним інструментом)
import { money } from "./config";
import { ymd } from "./dates";
import { getLab, LAB_CATEGORIES, labReport, setLabStatus, updateLab } from "./repo/lab";
import { addMaterial } from "./repo/materials";
import { addTool, findToolByName, getService, updateService } from "./repo/services";
import { addWork } from "./repo/worklog";
import type { ServiceType, ToolCategory } from "./services";

const SERVICE_FOR: Record<string, ServiceType | null> = { crm: "crm", telephony: "telephony", site: "website", other: null };

export function finishLab(id: number, opts: { chosenOptionId?: number | null; conclusion?: string; enableService?: boolean }): { clientId: number | null } {
  if (opts.chosenOptionId !== undefined || opts.conclusion !== undefined) {
    updateLab(id, {
      ...(opts.chosenOptionId !== undefined ? { chosen_option_id: opts.chosenOptionId } : {}),
      ...(opts.conclusion !== undefined ? { conclusion: opts.conclusion } : {}),
    });
  }
  const l = getLab(id);
  if (!l) throw new Error("Сесії нема");
  setLabStatus(id, "done");
  if (!l.client_id) return { clientId: null };

  const chosen = l.options.find((o) => o.id === l.chosen_option_id);
  addMaterial({ client_id: l.client_id, kind: "brief", title: `Лабораторія: ${l.title}`, content: labReport(l, money) });
  addWork({
    client_id: l.client_id,
    done_at: ymd(),
    what: `Лабораторія «${l.title}»${chosen ? `: обрали ${chosen.name}` : ""}`,
    result: l.conclusion.slice(0, 500),
  });

  const svc = SERVICE_FOR[l.category];
  const toolCat = LAB_CATEGORIES[l.category].tool as ToolCategory | null;
  if (opts.enableService && svc && chosen) {
    let toolId = chosen.tool_id;
    if (!toolId && toolCat) toolId = findToolByName(toolCat, chosen.name)?.id ?? addTool(toolCat, chosen.name, chosen.link);
    // Нотатки послуги не затираємо — дописуємо висновок
    const prev = getService(l.client_id, svc)?.notes ?? "";
    const add = `Обрано в лабораторії «${l.title}»: ${chosen.name}.${l.conclusion ? ` ${l.conclusion.slice(0, 1000)}` : ""}`;
    updateService(l.client_id, svc, { tool_id: toolId ?? null, notes: prev ? `${prev}\n\n${add}` : add });
  }
  return { clientId: l.client_id };
}
