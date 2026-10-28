import ClientForm from "@/components/ClientForm";

export default function NewClientPage() {
  return (
    <>
      <div className="head"><div><div className="kicker">Новий запис</div><h1>Новий клієнт</h1></div></div>
      <ClientForm />
    </>
  );
}
