import ClientForm from "@/components/ClientForm";

export default async function NewClientPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const lead = (await searchParams).lead === "1";
  return (
    <>
      <div className="head"><div><div className="kicker">Новий запис</div><h1>{lead ? "Новий лід" : "Новий клієнт"}</h1></div></div>
      <ClientForm c={lead ? { status: "lead", stage: "new" } : undefined} />
    </>
  );
}
