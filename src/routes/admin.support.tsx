import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  Headphones,
  MessageCircle,
  Plus,
  Search,
  Send,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  addAdminSupportTicketMessage,
  createAdminSupportFaq,
  listAdminSupportFaqs,
  listAdminSupportTickets,
  updateAdminSupportTicket,
  type SupportFaq,
  type SupportStatus,
  type SupportTicket,
} from "@/services/api";

export const Route = createFileRoute("/admin/support")({
  head: () => ({ meta: [{ title: "Support Console - The Ankapure Dhaba" }] }),
  component: AdminSupportPage,
});

function AdminSupportPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<SupportStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState("");
  const [faq, setFaq] = useState({ category: "Orders", question: "", answer: "", keywords: "" });
  const { data: tickets = [] } = useQuery({
    queryKey: ["admin-support-tickets", status],
    queryFn: () => listAdminSupportTickets(status),
  });
  const { data: faqs = [] } = useQuery({
    queryKey: ["admin-support-faqs"],
    queryFn: listAdminSupportFaqs,
  });

  const filtered = useMemo(() => {
    const needle = query.toLowerCase().trim();
    return tickets.filter(
      (ticket) =>
        !needle ||
        `${ticket.id} ${ticket.subject} ${ticket.category} ${ticket.description}`
          .toLowerCase()
          .includes(needle),
    );
  }, [query, tickets]);

  const replyMutation = useMutation({
    mutationFn: () => addAdminSupportTicketMessage(selected!.id, { message: reply }),
    onSuccess: ({ ticket }) => {
      setReply("");
      setSelected(ticket);
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      toast.success("Reply sent");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to reply"),
  });

  const statusMutation = useMutation({
    mutationFn: (patch: Partial<Pick<SupportTicket, "status" | "resolution">>) =>
      updateAdminSupportTicket(selected!.id, patch),
    onSuccess: (ticket) => {
      setSelected(ticket);
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      toast.success("Ticket updated");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to update ticket"),
  });

  const createFaq = useMutation({
    mutationFn: () =>
      createAdminSupportFaq({
        category: faq.category,
        question: faq.question,
        answer: faq.answer,
        keywords: faq.keywords
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        priority: 50,
        active: true,
      }),
    onSuccess: () => {
      setFaq({ category: "Orders", question: "", answer: "", keywords: "" });
      qc.invalidateQueries({ queryKey: ["admin-support-faqs"] });
      toast.success("FAQ added");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add FAQ"),
  });

  const metrics = {
    open: tickets.filter((ticket) => ticket.status === "open").length,
    waiting: tickets.filter((ticket) => ticket.status === "waiting_customer").length,
    resolved: tickets.filter((ticket) => ticket.status === "resolved" || ticket.status === "closed")
      .length,
  };

  return (
    <main className="min-h-screen bg-background p-4 text-foreground md:p-6">
      <section className="rounded-[30px] border border-white/10 bg-[#151013] p-5 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-xs tracking-[0.24em] text-red-300">CUSTOMER CARE</p>
            <h1 className="mt-1 text-3xl font-black">Support Console</h1>
            <p className="mt-1 text-sm text-white/55">
              Solve tickets, reply to customers and manage quick answers.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Metric icon={Headphones} label="Open" value={metrics.open} />
            <Metric icon={Clock} label="Waiting" value={metrics.waiting} />
            <Metric icon={CheckCircle2} label="Resolved" value={metrics.resolved} />
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_430px]">
        <div className="rounded-[28px] border border-white/10 bg-[#151013] p-4">
          <div className="flex flex-wrap gap-2">
            {(
              ["all", "open", "waiting_customer", "in_review", "resolved", "closed"] as Array<
                SupportStatus | "all"
              >
            ).map((item) => (
              <button
                key={item}
                onClick={() => setStatus(item)}
                className={`rounded-2xl px-4 py-2 text-sm font-black capitalize ${status === item ? "bg-red-600 text-white" : "bg-white/8 text-white/65"}`}
              >
                {item.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <label className="mt-4 flex h-13 items-center gap-3 rounded-2xl bg-black/30 px-4 text-white ring-1 ring-white/10">
            <Search className="h-4 w-4 text-white/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ticket, category, subject..."
              className="min-w-0 flex-1 bg-transparent font-semibold outline-none"
            />
          </label>
          <div className="mt-4 space-y-3">
            {filtered.map((ticket) => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                active={selected?.id === ticket.id}
                onClick={() => setSelected(ticket)}
              />
            ))}
            {filtered.length === 0 && (
              <p className="rounded-2xl bg-white/5 p-5 text-sm text-white/45">
                No support tickets found.
              </p>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-[28px] border border-white/10 bg-[#151013] p-4 text-white">
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-red-300">
                      #{selected.id.slice(0, 8)}
                    </p>
                    <h2 className="text-2xl font-black">{selected.subject}</h2>
                    <p className="mt-1 text-sm text-white/50">
                      {selected.category} · {selected.priority}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto rounded-2xl bg-black/20 p-3">
                  {selected.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-2xl p-3 ${message.sender === "admin" ? "bg-red-600 text-white" : "bg-white/10 text-white"}`}
                    >
                      <div className="text-[10px] font-black uppercase tracking-widest opacity-60">
                        {message.sender}
                      </div>
                      <p className="mt-1 text-sm font-semibold">{message.message}</p>
                    </div>
                  ))}
                </div>
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  rows={4}
                  placeholder="Write admin reply..."
                  className="mt-4 w-full rounded-2xl bg-black/30 p-4 font-semibold outline-none ring-1 ring-white/10"
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => replyMutation.mutate()}
                    disabled={!reply.trim() || replyMutation.isPending}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-red-600 font-black disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" /> Reply
                  </button>
                  <button
                    onClick={() =>
                      statusMutation.mutate({
                        status: "resolved",
                        resolution: "Resolved by restaurant support team.",
                      })
                    }
                    className="rounded-2xl bg-emerald-500 font-black text-emerald-950"
                  >
                    Resolve
                  </button>
                  <button
                    onClick={() => statusMutation.mutate({ status: "in_review" })}
                    className="rounded-2xl bg-yellow-400 py-3 font-black text-yellow-950"
                  >
                    In Review
                  </button>
                  <button
                    onClick={() => statusMutation.mutate({ status: "closed" })}
                    className="rounded-2xl bg-white/10 py-3 font-black"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <p className="rounded-2xl bg-white/5 p-5 text-sm text-white/50">
                Select a ticket to reply or resolve.
              </p>
            )}
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#151013] p-4 text-white">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Plus className="h-5 w-5 text-red-400" /> Add quick answer
            </h2>
            <div className="mt-3 space-y-2">
              <input
                value={faq.category}
                onChange={(event) => setFaq((x) => ({ ...x, category: event.target.value }))}
                className="h-12 w-full rounded-2xl bg-black/30 px-4 outline-none ring-1 ring-white/10"
                placeholder="Category"
              />
              <input
                value={faq.question}
                onChange={(event) => setFaq((x) => ({ ...x, question: event.target.value }))}
                className="h-12 w-full rounded-2xl bg-black/30 px-4 outline-none ring-1 ring-white/10"
                placeholder="Question"
              />
              <textarea
                value={faq.answer}
                onChange={(event) => setFaq((x) => ({ ...x, answer: event.target.value }))}
                rows={3}
                className="w-full rounded-2xl bg-black/30 p-4 outline-none ring-1 ring-white/10"
                placeholder="Solution"
              />
              <input
                value={faq.keywords}
                onChange={(event) => setFaq((x) => ({ ...x, keywords: event.target.value }))}
                className="h-12 w-full rounded-2xl bg-black/30 px-4 outline-none ring-1 ring-white/10"
                placeholder="keywords, comma, separated"
              />
              <button
                onClick={() => createFaq.mutate()}
                disabled={!faq.question || !faq.answer || createFaq.isPending}
                className="min-h-12 w-full rounded-2xl bg-red-600 font-black disabled:opacity-50"
              >
                Save FAQ
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {faqs.slice(0, 5).map((item: SupportFaq) => (
                <div key={item.id} className="rounded-2xl bg-white/5 p-3">
                  <div className="font-black">{item.question}</div>
                  <div className="text-xs text-white/45">{item.category}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-24 rounded-2xl bg-white/8 p-3">
      <Icon className="h-4 w-4 text-red-300" />
      <div className="mt-1 text-2xl font-black">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-white/45">{label}</div>
    </div>
  );
}

function TicketRow({
  ticket,
  active,
  onClick,
}: {
  ticket: SupportTicket;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl p-4 text-left transition ${active ? "bg-red-600 text-white" : "bg-white/5 text-white hover:bg-white/10"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-black">{ticket.subject}</div>
        <span className="rounded-full bg-black/20 px-3 py-1 text-[11px] font-black capitalize">
          {ticket.status.replace(/_/g, " ")}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-sm opacity-65">{ticket.description}</p>
      <div className="mt-2 flex items-center gap-2 text-xs font-bold opacity-55">
        <MessageCircle className="h-3.5 w-3.5" /> {ticket.messages.length} messages ·{" "}
        {new Date(ticket.updatedAt).toLocaleString()}
      </div>
    </button>
  );
}
