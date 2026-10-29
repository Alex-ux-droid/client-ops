import { notFound } from "next/navigation";
import PlaybookForm from "@/components/PlaybookForm";
import { getPlaybook } from "@/lib/repo/playbooks";

export default async function EditPlaybookPage({ params }: { params: Promise<{ id: string }> }) {
  const p = getPlaybook(Number((await params).id));
  if (!p) notFound();
  return (
    <>
      <div className="head"><div><div className="kicker">Редагування</div><h1>{p.title}</h1></div></div>
      <PlaybookForm p={p} />
    </>
  );
}
