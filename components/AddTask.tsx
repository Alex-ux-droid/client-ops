import { addTask } from "@/app/actions";
import { ymd } from "@/lib/dates";
import type { ClientRow } from "@/lib/repo/clients";

export default function AddTask({ clients, clientId }: { clients?: ClientRow[]; clientId?: number }) {
  return (
    <form action={addTask} className="card">
      <div className="field"><input name="title" placeholder="Нова задача…" required /></div>
      <div className="inline">
        <input type="date" name="due_date" defaultValue={ymd()} />
        {clientId ? (
          <input type="hidden" name="client_id" value={clientId} />
        ) : (
          <select name="client_id" defaultValue="">
            <option value="">Без клієнта</option>
            {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <button>+</button>
      </div>
    </form>
  );
}
