import { notFound } from "next/navigation";
import ClientForm from "@/components/ClientForm";
import { getClient } from "@/lib/repo/clients";

export const dynamic = "force-dynamic";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const c = getClient(Number((await params).id));
  if (!c) notFound();
  return (
    <>
      <div className="head"><div><div className="kicker">Редагування</div><h1>{c.name}</h1></div></div>
      <ClientForm c={c} />
    </>
  );
}
