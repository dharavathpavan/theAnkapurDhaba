import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Headphones, HelpCircle, MessageCircle, Package, Search, Truck, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createSupportTicket, listMyOrders, listSupportFaqs, listSupportTickets, type SupportPriority } from "@/services/api";
import { useAuth } from "@/stores/auth";

export const Route = createFileRoute("/support")({
  head: () => ({ meta: [{ title: "Support - The Ankapure Dhaba" }] }),
  component: SupportPage,
});

const categories = [
  { id: "Orders", label: "Orders", icon: Package },
  { id: "Delivery", label: "Delivery", icon: Truck },
  { id: "Payments", label: "Payments", icon: CreditCard },
  { id: "Wallet", label: "Wallet", icon: Wallet },
  { id: "Food Quality", label: "Food Quality", icon: HelpCircle },
];

function SupportPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Orders");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [orderId, setOrderId] = useState("");
  const [priority, setPriority] = useState<SupportPriority>("normal");

  const { data: faqs = [] } = useQuery({ queryKey: ["support-faqs"], queryFn: listSupportFaqs, staleTime: 60_000 });
  const { data: tickets = [] } = useQuery({ queryKey: ["support-tickets"], queryFn: listSupportTickets, enabled: isAuthenticated() });
  const { data: orders = [] } = useQuery({ queryKey: ["my-orders"], queryFn: listMyOrders, enabled: isAuthenticated() });

  const filteredFaqs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return faqs.filter((faq) => {
      const blob = `${faq.category} ${faq.question} ${faq.answer} ${faq.keywords.join(" ")}`.toLowerCase();
      return (!needle || blob.includes(needle)) && (!category || faq.category === category || needle);
    });
  }, [category, faqs, query]);

  const createTicket = useMutation({
    mutationFn: () => createSupportTicket({ category, subject, description, orderId: orderId || null, priority }),
    onSuccess: (ticket) => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      toast.success("Support ticket created");
      navigate({ to: "/support/$ticketId", params: { ticketId: ticket.id } });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to create ticket"),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-5 md:px-6 md:py-8">
      <section className="rounded-[34px] bg-zinc-950 p-6 text-white shadow-xl shadow-zinc-950/20">
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-3xl bg-red-600"><Headphones className="h-7 w-7" /></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-200">Help Center</p>
            <h1 className="text-3xl font-black md:text-5xl">How can we help?</h1>
          </div>
        </div>
        <label className="mt-6 flex min-h-14 items-center gap-3 rounded-3xl bg-white px-4 text-zinc-950">
          <Search className="h-5 w-5 text-zinc-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search payment, refund, delivery, order..." className="min-w-0 flex-1 bg-transparent font-bold outline-none" />
        </label>
      </section>

      <section className="mt-5 flex gap-2 overflow-x-auto pb-2">
        {categories.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} onClick={() => setCategory(item.id)} className={`flex min-w-fit items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black ${category === item.id ? "bg-red-600 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-100"}`}>
              <Icon className="h-4 w-4" /> {item.label}
            </button>
          );
        })}
      </section>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_390px]">
        <section className="space-y-3">
          <h2 className="text-2xl font-black">Quick solutions</h2>
          {filteredFaqs.length === 0 ? <p className="rounded-3xl bg-white p-5 text-sm font-semibold text-zinc-500">No matching answer. Create a ticket and our team will help.</p> : filteredFaqs.map((faq) => (
            <details key={faq.id} className="group rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
              <summary className="cursor-pointer list-none font-black">{faq.question}</summary>
              <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">{faq.answer}</p>
              <div className="mt-3 text-xs font-black uppercase tracking-widest text-red-600">{faq.category}</div>
            </details>
          ))}

          {isAuthenticated() && (
            <div className="mt-6">
              <h2 className="text-2xl font-black">Your tickets</h2>
              <div className="mt-3 space-y-2">
                {tickets.length === 0 ? <p className="rounded-3xl bg-white p-5 text-sm font-semibold text-zinc-500">No tickets yet.</p> : tickets.map((ticket) => (
                  <Link key={ticket.id} to="/support/$ticketId" params={{ ticketId: ticket.id }} className="block rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-black">{ticket.subject}</div>
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black capitalize">{ticket.status.replace(/_/g, " ")}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-zinc-500">{ticket.category} · {new Date(ticket.updatedAt).toLocaleString()}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="h-fit rounded-[34px] bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <h2 className="flex items-center gap-2 text-2xl font-black"><MessageCircle className="h-6 w-6 text-red-600" /> Create ticket</h2>
          {!isAuthenticated() ? (
            <div className="mt-4 rounded-2xl bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-600">Sign in to create and track support tickets.</p>
              <Link to="/login" className="mt-3 inline-flex rounded-2xl bg-red-600 px-4 py-3 font-black text-white">Sign in</Link>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-13 w-full rounded-2xl bg-zinc-50 px-4 font-bold outline-none ring-1 ring-zinc-200">
                {categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <select value={orderId} onChange={(event) => setOrderId(event.target.value)} className="h-13 w-full rounded-2xl bg-zinc-50 px-4 font-bold outline-none ring-1 ring-zinc-200">
                <option value="">No order selected</option>
                {orders.slice(0, 10).map((order) => <option key={order.id} value={order.id}>#{order.id} · Rs {order.total}</option>)}
              </select>
              <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" className="h-13 w-full rounded-2xl bg-zinc-50 px-4 font-bold outline-none ring-1 ring-zinc-200" />
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} placeholder="Explain the issue" className="w-full rounded-2xl bg-zinc-50 p-4 font-semibold outline-none ring-1 ring-zinc-200" />
              <select value={priority} onChange={(event) => setPriority(event.target.value as SupportPriority)} className="h-13 w-full rounded-2xl bg-zinc-50 px-4 font-bold outline-none ring-1 ring-zinc-200">
                <option value="normal">Normal priority</option>
                <option value="high">High priority</option>
                <option value="urgent">Urgent</option>
              </select>
              <button onClick={() => createTicket.mutate()} disabled={createTicket.isPending || !subject || !description} className="min-h-14 w-full rounded-2xl bg-red-600 font-black text-white disabled:opacity-50">{createTicket.isPending ? "Creating..." : "Create Ticket"}</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
