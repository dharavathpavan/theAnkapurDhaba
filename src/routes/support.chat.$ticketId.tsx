import { createFileRoute } from "@tanstack/react-router";
import { SupportTicketChat } from "./support.$ticketId";

export const Route = createFileRoute("/support/chat/$ticketId")({
  head: () => ({ meta: [{ title: "Support Chat - The Ankapure Dhaba" }] }),
  component: SupportChatPage,
});

function SupportChatPage() {
  const { ticketId } = Route.useParams();
  return <SupportTicketChat ticketId={ticketId} backTo="/support" />;
}
