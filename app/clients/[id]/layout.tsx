import { Suspense } from "react";
import { STATUS_LABEL, STATUS_TAG } from "@/lib/labels";
import { getClientRow } from "@/lib/repo/clients";
import { listServices } from "@/lib/repo/services";
import ClientNav from "./ClientNav";
import { clientSections } from "./sections";

// Усередині клієнта ліва панель перетворюється на його «карту»
export default async function ClientLayout({ params, children }: { params: Promise<{ id: string }>; children: React.ReactNode }) {
  const id = Number((await params).id);
  const c = getClientRow(id);
  if (!c) return children;
  return (
    <>
      <Suspense>
        <ClientNav id={id} name={c.name} status={STATUS_LABEL[c.status]} statusTag={STATUS_TAG[c.status]} sections={clientSections(c, listServices(id))} />
      </Suspense>
      {children}
    </>
  );
}
