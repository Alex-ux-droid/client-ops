import Chat from "@/components/Chat";
import { listChat } from "@/lib/repo/chat";
import { getApiKey } from "@/lib/secrets";

export default function AssistantPage() {
  return (
    <>
      <div className="head"><h1>Помічник</h1></div>
      <Chat clientId={null} initial={listChat(null)} hasKey={!!getApiKey()} />
    </>
  );
}
