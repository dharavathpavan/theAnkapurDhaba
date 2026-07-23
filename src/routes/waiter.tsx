import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  BellRing,
  CheckCircle2,
  ChefHat,
  Clock3,
  CreditCard,
  HandPlatter,
  Minus,
  Plus,
  ReceiptText,
  Search,
  Sparkles,
  Trash2,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/stores/auth";
import {
  closeTableOrders,
  computeTotals,
  createOrder,
  getCustomerMenu,
  listOrders,
  subscribeToOrderEvents,
  updateOrderStatus,
  type Order,
  type OrderItem,
  type PaymentMethod,
} from "@/services/api";
import type { MenuItem } from "@/data/menu";

export const Route = createFileRoute("/waiter")({
  head: () => ({
    meta: [
      { title: "Waiter Console | The Ankapure Dhaba" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WaiterConsole,
});

type DraftLine = {
  id: string;
  name: string;
  price: number;
  qty: number;
  isVeg: boolean;
  notes: string;
};

type SeatForm = {
  guests: number;
  customerName: string;
  phone: string;
  occasion: string;
};

const TABLES = Array.from({ length: 16 }, (_, index) => ({
  id: String(index + 1).padStart(2, "0"),
  capacity: index < 4 ? 4 : index < 12 ? 6 : 8,
}));

const PAYMENT_OPTIONS = [
  ["cash", "Cash", Banknote],
  ["card", "Card", CreditCard],
  ["upi", "UPI", Sparkles],
  ["phonepe", "PhonePe", Sparkles],
  ["gpay", "Google Pay", Sparkles],
  ["paytm", "Paytm", Sparkles],
  ["split", "Split Bill", ReceiptText],
  ["partial", "Partial", ReceiptText],
] as const;

function WaiterConsole() {
  const { hasRole, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [selectedTable, setSelectedTable] = useState("01");
  const [seatForTable, setSeatForTable] = useState<string | null>(null);
  const [seatForm, setSeatForm] = useState<SeatForm>({
    guests: 2,
    customerName: "",
    phone: "",
    occasion: "",
  });
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [billOpen, setBillOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_OPTIONS)[number][0]>("cash");
  const [cleaningTables, setCleaningTables] = useState<string[]>([]);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated() || !hasRole("ADMIN", "WAITER")) navigate({ to: "/login" });
  }, [mounted, isAuthenticated, hasRole, navigate]);

  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: listOrders,
    refetchInterval: 4000,
  });
  const menuQuery = useQuery({
    queryKey: ["customer-menu"],
    queryFn: getCustomerMenu,
  });

  useEffect(() => {
    return subscribeToOrderEvents(() => {
      qc.invalidateQueries({ queryKey: ["orders"] });
    });
  }, [qc]);

  const dineInOrders = useMemo(
    () => (ordersQuery.data ?? []).filter((order) => order.type === "dinein" && order.tableNumber),
    [ordersQuery.data],
  );
  const tableGroups = useMemo(() => groupTables(dineInOrders), [dineInOrders]);
  const tableState = tableGroups.get(selectedTable);
  const openOrders = tableState?.openOrders ?? [];
  const selectedSummary = summarize(openOrders);
  const servedCount = openOrders.filter((order) => order.status === "delivered").length;
  const activeKotCount = openOrders.filter(
    (order) => !["delivered", "cancelled"].includes(order.status),
  ).length;
  const draftTotals = computeTotals(
    draft.map((line) => ({ ...line, id: line.id }) as OrderItem),
    "dinein",
  );
  const categories = useMemo(() => {
    const names = new Set((menuQuery.data ?? []).map((item) => item.category).filter(Boolean));
    return ["All", ...Array.from(names)];
  }, [menuQuery.data]);
  const menu = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (menuQuery.data ?? []).filter((item) => {
      if (category !== "All" && item.category !== category) return false;
      if (!term) return true;
      return [item.name, item.description, item.category].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(term),
      );
    });
  }, [menuQuery.data, category, query]);

  const sendKot = useMutation({
    mutationFn: async () => {
      if (draft.length === 0) throw new Error("Add at least one new item");
      const totals = computeTotals(
        draft.map((line) => ({ ...line, id: line.id }) as OrderItem),
        "dinein",
      );
      return createOrder({
        items: draft.map((line) => ({
          id: line.id,
          name: line.notes ? `${line.name} - ${line.notes}` : line.name,
          price: line.price,
          qty: line.qty,
          isVeg: line.isVeg,
          instructions: line.notes,
        })) as OrderItem[],
        subtotal: totals.subtotal,
        tax: totals.tax,
        deliveryFee: 0,
        total: totals.subtotal + totals.tax,
        customer: {
          name: seatForm.customerName || `Table ${selectedTable}`,
          phone: seatForm.phone || user?.phone || "0000000000",
          address: `Dine-in Table ${selectedTable}`,
          notes: seatForm.occasion || undefined,
        },
        type: "dinein",
        tableNumber: selectedTable,
        paymentMethod: "cod" as PaymentMethod,
      });
    },
    onSuccess: (order) => {
      toast.success(`KOT ${order.id} sent to kitchen`);
      setDraft([]);
      setBillOpen(false);
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not send KOT"),
  });

  const serveMutation = useMutation({
    mutationFn: (orderId: string) => updateOrderStatus(orderId, "delivered"),
    onSuccess: () => {
      toast.success("Marked served");
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: () => toast.error("Could not mark served"),
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      closeTableOrders({
        tableNumber: selectedTable,
        orderIds: openOrders.map((order) => order.id),
        paymentMethod,
        amountPaid: selectedSummary.grandTotal,
      }),
    onSuccess: () => {
      toast.success(`Table ${selectedTable} payment completed`);
      setBillOpen(false);
      setDraft([]);
      setCleaningTables((tables) => unique([...tables, selectedTable]));
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not close table"),
  });

  if (!mounted || !isAuthenticated() || !hasRole("ADMIN", "WAITER")) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#08090c] text-white">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-white/50">
          Opening waiter console...
        </p>
      </div>
    );
  }

  function beginSeat(table: string) {
    setSelectedTable(table);
    setSeatForTable(table);
    setSeatForm({ guests: 2, customerName: "", phone: "", occasion: "" });
    setDraft([]);
    setBillOpen(false);
  }

  function openTable(table: string) {
    setSelectedTable(table);
    setSeatForTable(null);
    setDraft([]);
    setBillOpen(false);
  }

  function addItem(item: MenuItem) {
    setDraft((lines) => {
      const existing = lines.find((line) => line.id === item.id && !line.notes);
      if (existing) {
        return lines.map((line) => (line === existing ? { ...line, qty: line.qty + 1 } : line));
      }
      return [
        ...lines,
        { id: item.id, name: item.name, price: item.price, qty: 1, isVeg: item.isVeg, notes: "" },
      ];
    });
  }

  function setQty(id: string, qty: number) {
    setDraft((lines) =>
      qty <= 0
        ? lines.filter((line) => line.id !== id)
        : lines.map((line) => (line.id === id ? { ...line, qty } : line)),
    );
  }

  function setNotes(id: string, notes: string) {
    setDraft((lines) => lines.map((line) => (line.id === id ? { ...line, notes } : line)));
  }

  function cleaningDone(table: string) {
    setCleaningTables((tables) => tables.filter((id) => id !== table));
    toast.success(`Table ${table} is available`);
  }

  return (
    <div className="min-h-screen bg-[#07080b] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/the-ankapure-dhaba-logo.png"
              alt="The Ankapure Dhaba"
              className="h-14 w-14 rounded-2xl bg-black object-cover"
            />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-red-300">
                The Ankapure Dhaba
              </p>
              <h1 className="text-2xl font-black tracking-tight md:text-4xl">
                Waiter Order Console
              </h1>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniMetric
              label="Open tables"
              value={String(
                [...tableGroups.values()].filter((table) => table.openOrders.length > 0).length,
              )}
            />
            <MiniMetric label="Active KOT" value={String(activeKotCount)} />
            <MiniMetric
              label="Table total"
              value={`Rs ${Math.round(selectedSummary.grandTotal)}`}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 md:px-6 xl:grid-cols-[360px_1fr]">
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/30">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">Assigned Tables</h2>
              <p className="text-sm font-semibold text-white/45">
                Tap a table to seat, add KOTs or bill.
              </p>
            </div>
            <UtensilsCrossed className="h-6 w-6 text-red-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {TABLES.map((table) => {
              const group = tableGroups.get(table.id);
              const isCleaning = cleaningTables.includes(table.id);
              const status = tableStatus(group?.openOrders ?? [], isCleaning);
              const summary = summarize(group?.openOrders ?? []);
              return (
                <button
                  key={table.id}
                  onClick={() =>
                    status.key === "available"
                      ? beginSeat(table.id)
                      : status.key === "cleaning"
                        ? cleaningDone(table.id)
                        : openTable(table.id)
                  }
                  className={`min-h-[142px] rounded-[24px] border p-4 text-left transition active:scale-[0.98] ${selectedTable === table.id ? "border-red-400 bg-red-500/15" : "border-white/10 bg-zinc-950"} ${status.ring}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-lg font-black">Table {table.id}</div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${status.badge}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-3 text-sm font-bold text-white/50">
                    Capacity {table.capacity}
                  </div>
                  {summary.items > 0 ? (
                    <div className="mt-3 space-y-1">
                      <div className="text-2xl font-black text-white">
                        Rs {Math.round(summary.grandTotal)}
                      </div>
                      <div className="text-xs font-bold text-white/45">
                        {summary.items} Items · {group?.openOrders.length ?? 0} KOTs
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 text-xs font-bold text-white/35">
                      {status.key === "cleaning"
                        ? "Tap when cleaning is done"
                        : "Tap to seat customer"}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <div className="space-y-5">
            <TableHeader
              table={selectedTable}
              orders={openOrders}
              summary={selectedSummary}
              servedCount={servedCount}
              onSeat={() => beginSeat(selectedTable)}
              onBill={() => setBillOpen(true)}
            />

            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black">Add New Items</h2>
                  <p className="text-sm font-semibold text-white/45">
                    Only this cart is sent to the kitchen as the next KOT.
                  </p>
                </div>
                <div className="relative md:w-72">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search item"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/40 pl-11 pr-4 text-sm font-bold outline-none focus:border-red-400"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {categories.map((name) => (
                  <button
                    key={name}
                    onClick={() => setCategory(name)}
                    className={`min-h-11 shrink-0 rounded-2xl px-4 text-sm font-black ${category === name ? "bg-red-600 text-white" : "bg-white/8 text-white/65"}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {menu.map((item) => (
                  <article
                    key={item.id}
                    className="flex gap-3 rounded-[22px] border border-white/10 bg-black/30 p-3"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-20 w-20 rounded-2xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-1 font-black">{item.name}</h3>
                      <p className="mt-1 line-clamp-1 text-xs font-semibold text-white/45">
                        {item.category}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="font-black text-red-200">Rs {item.price}</span>
                        <button
                          onClick={() => addItem(item)}
                          className="min-h-10 rounded-2xl bg-white px-4 text-xs font-black text-zinc-950"
                        >
                          ADD
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <NewItemsCart
              draft={draft}
              totals={draftTotals}
              sending={sendKot.isPending}
              onQty={setQty}
              onNotes={setNotes}
              onRemove={(id) => setDraft((lines) => lines.filter((line) => line.id !== id))}
              onSend={() => sendKot.mutate()}
            />
            <KotHistory
              orders={openOrders}
              onServed={(id) => serveMutation.mutate(id)}
              serving={serveMutation.isPending}
            />
          </aside>
        </section>
      </main>

      {seatForTable && (
        <SeatCustomerModal
          table={seatForTable}
          form={seatForm}
          onChange={setSeatForm}
          onClose={() => setSeatForTable(null)}
          onStart={() => {
            setSelectedTable(seatForTable);
            setSeatForTable(null);
            toast.success(`Table ${seatForTable} opened`);
          }}
        />
      )}

      {billOpen && (
        <BillModal
          table={selectedTable}
          orders={openOrders}
          summary={selectedSummary}
          paymentMethod={paymentMethod}
          onPaymentMethod={setPaymentMethod}
          onClose={() => setBillOpen(false)}
          onPay={() => closeMutation.mutate()}
          paying={closeMutation.isPending}
        />
      )}
    </div>
  );
}

function TableHeader({
  table,
  orders,
  summary,
  servedCount,
  onSeat,
  onBill,
}: {
  table: string;
  orders: Order[];
  summary: ReturnType<typeof summarize>;
  servedCount: number;
  onSeat: () => void;
  onBill: () => void;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-gradient-to-br from-red-950/70 to-zinc-950 p-5 shadow-2xl shadow-black/30">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-red-200">
            Table Summary
          </p>
          <h2 className="mt-2 text-4xl font-black">Table {table}</h2>
          <p className="mt-2 text-sm font-semibold text-white/55">
            {orders.length
              ? `${orders.length} KOTs · ${summary.items} items · ${servedCount} served`
              : "Available for a new customer"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onSeat}
            className="min-h-12 rounded-2xl border border-white/10 px-4 text-sm font-black text-white/80"
          >
            Seat Customer
          </button>
          <button
            onClick={onBill}
            disabled={orders.length === 0}
            className="min-h-12 rounded-2xl bg-white px-4 text-sm font-black text-zinc-950 disabled:opacity-50"
          >
            Generate Bill
          </button>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <MiniMetric label="KOTs" value={String(orders.length)} />
        <MiniMetric label="Subtotal" value={`Rs ${Math.round(summary.subtotal)}`} />
        <MiniMetric label="GST" value={`Rs ${Math.round(summary.tax)}`} />
        <MiniMetric label="Grand Total" value={`Rs ${Math.round(summary.grandTotal)}`} />
      </div>
    </section>
  );
}

function NewItemsCart({
  draft,
  totals,
  sending,
  onQty,
  onNotes,
  onRemove,
  onSend,
}: {
  draft: DraftLine[];
  totals: ReturnType<typeof computeTotals>;
  sending: boolean;
  onQty: (id: string, qty: number) => void;
  onNotes: (id: string, notes: string) => void;
  onRemove: (id: string) => void;
  onSend: () => void;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-zinc-950 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">New KOT Cart</h2>
        <ChefHat className="h-5 w-5 text-red-300" />
      </div>
      <div className="mt-4 space-y-3">
        {draft.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-white/40">
            Add items to create the next KOT.
          </div>
        ) : (
          draft.map((line) => (
            <div key={line.id} className="rounded-2xl bg-white/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-black">{line.name}</div>
                  <div className="text-sm font-bold text-white/45">Rs {line.price} each</div>
                </div>
                <button
                  onClick={() => onRemove(line.id)}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white/60"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="inline-flex items-center rounded-2xl bg-black/40">
                  <button
                    onClick={() => onQty(line.id, line.qty - 1)}
                    className="grid h-10 w-10 place-items-center"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center font-black">{line.qty}</span>
                  <button
                    onClick={() => onQty(line.id, line.qty + 1)}
                    className="grid h-10 w-10 place-items-center"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="font-black">Rs {line.price * line.qty}</div>
              </div>
              <input
                value={line.notes}
                onChange={(event) => onNotes(line.id, event.target.value)}
                placeholder="Cooking note: less spicy, no onion..."
                className="mt-3 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-3 text-sm font-semibold outline-none focus:border-red-400"
              />
            </div>
          ))
        )}
      </div>
      <div className="mt-4 rounded-2xl bg-white/5 p-4">
        <Row label="Subtotal" value={`Rs ${Math.round(totals.subtotal)}`} />
        <Row label="GST" value={`Rs ${Math.round(totals.tax)}`} />
        <Row label="KOT Total" value={`Rs ${Math.round(totals.subtotal + totals.tax)}`} strong />
      </div>
      <button
        onClick={onSend}
        disabled={draft.length === 0 || sending}
        className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-red-600 font-black text-white shadow-lg shadow-red-950/30 disabled:opacity-50"
      >
        <BellRing className="h-5 w-5" /> {sending ? "Sending..." : "Send To Kitchen"}
      </button>
    </section>
  );
}

function KotHistory({
  orders,
  onServed,
  serving,
}: {
  orders: Order[];
  onServed: (id: string) => void;
  serving: boolean;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-zinc-950 p-4">
      <h2 className="text-xl font-black">KOT History</h2>
      <div className="mt-4 space-y-3">
        {orders.length === 0 ? (
          <p className="rounded-2xl bg-white/5 p-5 text-sm font-bold text-white/40">No KOTs yet.</p>
        ) : (
          orders.map((order, index) => (
            <article key={order.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-black">KOT {order.id}</div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-widest text-white/40">
                    Batch {index + 1} · {order.status.replace(/_/g, " ")}
                  </div>
                </div>
                <StatusPill status={order.status} />
              </div>
              <div className="mt-3 space-y-2">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between gap-3 text-sm font-semibold text-white/70"
                  >
                    <span>
                      {item.qty}x {item.name}
                    </span>
                    <span>Rs {item.qty * item.price}</span>
                  </div>
                ))}
              </div>
              {order.status === "ready" && (
                <button
                  onClick={() => onServed(order.id)}
                  disabled={serving}
                  className="mt-4 min-h-11 w-full rounded-2xl bg-emerald-500 font-black text-emerald-950"
                >
                  Mark Served
                </button>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function SeatCustomerModal({
  table,
  form,
  onChange,
  onClose,
  onStart,
}: {
  table: string;
  form: SeatForm;
  onChange: (form: SeatForm) => void;
  onClose: () => void;
  onStart: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-0 backdrop-blur-sm md:place-items-center md:p-6">
      <div className="w-full max-w-xl rounded-t-[32px] border border-white/10 bg-zinc-950 p-5 text-white shadow-2xl md:rounded-[32px]">
        <h2 className="text-2xl font-black">Seat Customer · Table {table}</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-white/40">
              Guests
            </span>
            <input
              type="number"
              min={1}
              value={form.guests}
              onChange={(event) => onChange({ ...form, guests: Number(event.target.value) || 1 })}
              className="mt-1 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 font-bold"
            />
          </label>
          <Field
            label="Customer name"
            value={form.customerName}
            onChange={(value) => onChange({ ...form, customerName: value })}
          />
          <Field
            label="Mobile"
            value={form.phone}
            onChange={(value) =>
              onChange({ ...form, phone: value.replace(/\D/g, "").slice(0, 10) })
            }
          />
          <Field
            label="Occasion"
            value={form.occasion}
            onChange={(value) => onChange({ ...form, occasion: value })}
          />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="min-h-13 rounded-2xl border border-white/10 font-black text-white/70"
          >
            Cancel
          </button>
          <button
            onClick={onStart}
            className="min-h-13 rounded-2xl bg-red-600 font-black text-white"
          >
            Open Order Screen
          </button>
        </div>
      </div>
    </div>
  );
}

function BillModal({
  table,
  orders,
  summary,
  paymentMethod,
  onPaymentMethod,
  onClose,
  onPay,
  paying,
}: {
  table: string;
  orders: Order[];
  summary: ReturnType<typeof summarize>;
  paymentMethod: (typeof PAYMENT_OPTIONS)[number][0];
  onPaymentMethod: (method: (typeof PAYMENT_OPTIONS)[number][0]) => void;
  onClose: () => void;
  onPay: () => void;
  paying: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-0 backdrop-blur-sm md:place-items-center md:p-6">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[32px] border border-white/10 bg-zinc-950 p-5 text-white shadow-2xl md:rounded-[32px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-red-300">
              Combined Invoice
            </p>
            <h2 className="mt-1 text-3xl font-black">Table {table}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl bg-white/10 px-4 py-2 font-black text-white/70"
          >
            Close
          </button>
        </div>
        <div className="mt-5 space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl bg-white/5 p-4">
              <div className="mb-2 font-black">KOT {order.id}</div>
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between gap-3 py-1 text-sm font-semibold text-white/70"
                >
                  <span>
                    {item.qty}x {item.name}
                  </span>
                  <span>Rs {item.qty * item.price}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-2xl bg-white/5 p-4">
          <Row label="Subtotal" value={`Rs ${Math.round(summary.subtotal)}`} />
          <Row label="GST" value={`Rs ${Math.round(summary.tax)}`} />
          <Row label="Discount" value="Rs 0" />
          <Row label="Service charge" value="Rs 0" />
          <Row label="Grand Total" value={`Rs ${Math.round(summary.grandTotal)}`} strong />
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
          {PAYMENT_OPTIONS.map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => onPaymentMethod(value)}
              className={`min-h-12 rounded-2xl border px-3 text-sm font-black ${paymentMethod === value ? "border-red-400 bg-red-600 text-white" : "border-white/10 bg-white/5 text-white/70"}`}
            >
              <span className="inline-flex items-center gap-2">
                <Icon className="h-4 w-4" /> {label}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={onPay}
          disabled={orders.length === 0 || paying}
          className="mt-5 min-h-14 w-full rounded-2xl bg-emerald-500 font-black text-emerald-950 disabled:opacity-50"
        >
          {paying ? "Completing payment..." : "Payment Success · Close Table"}
        </button>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-white/35">{label}</div>
      <div className="mt-1 text-lg font-black">{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-widest text-white/40">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 font-bold"
      />
    </label>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-3 py-1 ${strong ? "text-lg font-black text-white" : "text-sm font-bold text-white/60"}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "ready"
      ? "bg-emerald-500/20 text-emerald-200"
      : status === "delivered"
        ? "bg-sky-500/20 text-sky-200"
        : status === "cancelled"
          ? "bg-zinc-500/20 text-zinc-300"
          : "bg-amber-500/20 text-amber-200";
  return (
    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${tone}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function groupTables(orders: Order[]) {
  const groups = new Map<string, { orders: Order[]; openOrders: Order[] }>();
  for (const order of orders) {
    const table = order.tableNumber || "";
    if (!table) continue;
    const normalized = table.padStart(2, "0");
    const group = groups.get(normalized) ?? { orders: [], openOrders: [] };
    group.orders.push(order);
    const closed = order.paymentStatus === "paid" && order.status === "delivered";
    if (!closed && order.status !== "cancelled") group.openOrders.push(order);
    groups.set(normalized, group);
  }
  return groups;
}

function summarize(orders: Order[]) {
  const subtotal = orders.reduce((sum, order) => sum + order.subtotal, 0);
  const tax = orders.reduce((sum, order) => sum + order.tax, 0);
  const grandTotal = orders.reduce((sum, order) => sum + order.total, 0);
  const items = orders.reduce(
    (sum, order) => sum + order.items.reduce((count, item) => count + item.qty, 0),
    0,
  );
  return { subtotal, tax, grandTotal, items };
}

function tableStatus(orders: Order[], cleaning: boolean) {
  if (cleaning)
    return {
      key: "cleaning",
      label: "Cleaning",
      badge: "bg-zinc-500/20 text-zinc-200",
      ring: "shadow-zinc-950/40",
    };
  if (orders.length === 0)
    return {
      key: "available",
      label: "Available",
      badge: "bg-emerald-500/20 text-emerald-200",
      ring: "shadow-emerald-950/20",
    };
  if (orders.some((order) => order.status === "ready"))
    return {
      key: "bill",
      label: "Ready",
      badge: "bg-sky-500/20 text-sky-200",
      ring: "shadow-sky-950/20",
    };
  return {
    key: "occupied",
    label: "Occupied",
    badge: "bg-red-500/20 text-red-200",
    ring: "shadow-red-950/20",
  };
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}
