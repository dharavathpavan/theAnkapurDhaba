import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  BellRing,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Clock3,
  CreditCard,
  Home,
  LogOut,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  UtensilsCrossed,
  X,
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

type WaiterView = "tables" | "order" | "kots" | "bill";

const TABLES = Array.from({ length: 16 }, (_, index) => ({
  id: String(index + 1).padStart(2, "0"),
  capacity: index < 4 ? 4 : index < 12 ? 6 : 8,
}));

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "upi", label: "UPI", icon: Sparkles },
  { value: "phonepe", label: "PhonePe", icon: Sparkles },
  { value: "gpay", label: "Google Pay", icon: Sparkles },
  { value: "paytm", label: "Paytm", icon: Sparkles },
  { value: "split", label: "Split Bill", icon: ReceiptText },
  { value: "partial", label: "Partial", icon: ReceiptText },
] as const;

const WAITER_NAV = [
  { id: "tables", label: "Tables", icon: Home },
  { id: "order", label: "Order", icon: UtensilsCrossed },
  { id: "kots", label: "KOTs", icon: ClipboardList },
  { id: "bill", label: "Bill", icon: ReceiptText },
] as const;

type WaiterPaymentMethod = (typeof PAYMENT_OPTIONS)[number]["value"];

function WaiterConsole() {
  const { hasRole, isAuthenticated, logout, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<WaiterView>("tables");
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
  const [paymentMethod, setPaymentMethod] = useState<WaiterPaymentMethod>("cash");
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
  const draftTotals = computeTotals(
    draft.map((line) => ({ ...line, id: line.id }) as OrderItem),
    "dinein",
  );
  const activeKotCount = dineInOrders.filter(
    (order) => !["delivered", "cancelled"].includes(order.status),
  ).length;
  const readyKotCount = dineInOrders.filter((order) => order.status === "ready").length;
  const openTableCount = [...tableGroups.values()].filter(
    (table) => table.openOrders.length > 0,
  ).length;

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
      setView("kots");
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
      setDraft([]);
      setCleaningTables((tables) => unique([...tables, selectedTable]));
      setView("tables");
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
  }

  function openTable(table: string, nextView: WaiterView = "order") {
    setSelectedTable(table);
    setSeatForTable(null);
    setDraft([]);
    setView(nextView);
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

  function handleLogout() {
    logout();
    navigate({ to: "/login" });
  }

  const selectedStatus = tableStatus(openOrders, cleaningTables.includes(selectedTable));

  return (
    <div className="min-h-screen bg-[#07080b] pb-28 text-white md:pb-10">
      <WaiterTopBar
        userName={user?.name || "Waiter"}
        table={selectedTable}
        statusLabel={selectedStatus.label}
        openTableCount={openTableCount}
        activeKotCount={activeKotCount}
        readyKotCount={readyKotCount}
        onLogout={handleLogout}
      />

      <div className="sticky top-[88px] z-20 hidden border-b border-white/10 bg-[#07080b]/90 px-6 py-3 backdrop-blur-xl md:block">
        <div className="mx-auto flex max-w-7xl gap-2">
          {WAITER_NAV.map((item) => (
            <NavButton
              key={item.id}
              active={view === item.id}
              label={item.label}
              icon={item.icon}
              onClick={() => setView(item.id)}
            />
          ))}
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 md:px-6">
        {view === "tables" && (
          <TablesPage
            tableGroups={tableGroups}
            cleaningTables={cleaningTables}
            selectedTable={selectedTable}
            onSeat={beginSeat}
            onOpen={(table) => openTable(table, "order")}
            onCleaningDone={cleaningDone}
          />
        )}

        {view === "order" && (
          <OrderPage
            table={selectedTable}
            orders={openOrders}
            summary={selectedSummary}
            categories={categories}
            category={category}
            query={query}
            menu={menu}
            draftCount={draft.reduce((sum, line) => sum + line.qty, 0)}
            draftTotal={draftTotals.subtotal + draftTotals.tax}
            isLoading={menuQuery.isLoading}
            onSeat={() => beginSeat(selectedTable)}
            onCategory={setCategory}
            onQuery={setQuery}
            onAdd={addItem}
            onGoCart={() => setView("kots")}
            onGoBill={() => setView("bill")}
          />
        )}

        {view === "kots" && (
          <KotsPage
            table={selectedTable}
            draft={draft}
            totals={draftTotals}
            orders={openOrders}
            sending={sendKot.isPending}
            serving={serveMutation.isPending}
            onQty={setQty}
            onNotes={setNotes}
            onRemove={(id) => setDraft((lines) => lines.filter((line) => line.id !== id))}
            onSend={() => sendKot.mutate()}
            onServed={(id) => serveMutation.mutate(id)}
            onOrderMore={() => setView("order")}
            onBill={() => setView("bill")}
          />
        )}

        {view === "bill" && (
          <BillPage
            table={selectedTable}
            orders={openOrders}
            summary={selectedSummary}
            paymentMethod={paymentMethod}
            paying={closeMutation.isPending}
            onPaymentMethod={setPaymentMethod}
            onPay={() => closeMutation.mutate()}
            onOrderMore={() => setView("order")}
          />
        )}
      </main>

      <MobileWaiterNav active={view} onChange={setView} draftCount={draft.length} />

      {seatForTable && (
        <SeatCustomerModal
          table={seatForTable}
          form={seatForm}
          onChange={setSeatForm}
          onClose={() => setSeatForTable(null)}
          onStart={() => {
            setSelectedTable(seatForTable);
            setSeatForTable(null);
            setView("order");
            toast.success(`Table ${seatForTable} opened`);
          }}
        />
      )}
    </div>
  );
}

function WaiterTopBar({
  userName,
  table,
  statusLabel,
  openTableCount,
  activeKotCount,
  readyKotCount,
  onLogout,
}: {
  userName: string;
  table: string;
  statusLabel: string;
  openTableCount: number;
  activeKotCount: number;
  readyKotCount: number;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-black/90 px-3 py-3 backdrop-blur-xl sm:px-4 md:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/the-ankapure-dhaba-logo.png"
            alt="The Ankapure Dhaba"
            className="h-12 w-12 shrink-0 rounded-2xl bg-black object-cover ring-1 ring-white/10"
          />
          <div className="min-w-0">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-red-300">
              The Ankapure Dhaba
            </p>
            <h1 className="truncate text-lg font-black leading-tight sm:text-2xl">Waiter Portal</h1>
            <p className="truncate text-xs font-bold text-white/45">Hi, {userName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden grid-cols-3 gap-2 lg:grid">
            <MiniMetric label="Tables" value={String(openTableCount)} dense />
            <MiniMetric label="KOTs" value={String(activeKotCount)} dense />
            <MiniMetric label="Ready" value={String(readyKotCount)} dense />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/35">
              Table {table}
            </p>
            <p className="text-sm font-black text-white">{statusLabel}</p>
          </div>
          <button
            onClick={onLogout}
            className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/70"
            aria-label="Logout"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function TablesPage({
  tableGroups,
  cleaningTables,
  selectedTable,
  onSeat,
  onOpen,
  onCleaningDone,
}: {
  tableGroups: Map<string, { orders: Order[]; openOrders: Order[] }>;
  cleaningTables: string[];
  selectedTable: string;
  onSeat: (table: string) => void;
  onOpen: (table: string) => void;
  onCleaningDone: (table: string) => void;
}) {
  return (
    <section className="space-y-4">
      <PageTitle
        eyebrow="Dining floor"
        title="Assigned Tables"
        description="Tap an available table to seat guests. Tap an occupied table to continue ordering, send KOTs or collect payment."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
                  ? onSeat(table.id)
                  : status.key === "cleaning"
                    ? onCleaningDone(table.id)
                    : onOpen(table.id)
              }
              className={`min-h-[150px] rounded-[26px] border p-4 text-left shadow-xl transition active:scale-[0.98] ${
                selectedTable === table.id
                  ? "border-red-400 bg-red-500/15"
                  : "border-white/10 bg-zinc-950"
              } ${status.ring}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xl font-black">Table {table.id}</div>
                  <div className="mt-1 text-xs font-bold text-white/45">
                    Capacity {table.capacity}
                  </div>
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-black ${status.badge}`}>
                  {status.label}
                </span>
              </div>
              {summary.items > 0 ? (
                <div className="mt-5 space-y-1">
                  <div className="text-2xl font-black">Rs {Math.round(summary.grandTotal)}</div>
                  <div className="text-xs font-bold text-white/45">
                    {summary.items} items | {group?.openOrders.length ?? 0} KOTs
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl bg-white/5 px-3 py-2 text-xs font-black text-white/45">
                  {status.key === "cleaning" ? "Tap when clean" : "Seat customer"}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function OrderPage({
  table,
  orders,
  summary,
  categories,
  category,
  query,
  menu,
  draftCount,
  draftTotal,
  isLoading,
  onSeat,
  onCategory,
  onQuery,
  onAdd,
  onGoCart,
  onGoBill,
}: {
  table: string;
  orders: Order[];
  summary: ReturnType<typeof summarize>;
  categories: string[];
  category: string;
  query: string;
  menu: MenuItem[];
  draftCount: number;
  draftTotal: number;
  isLoading: boolean;
  onSeat: () => void;
  onCategory: (category: string) => void;
  onQuery: (query: string) => void;
  onAdd: (item: MenuItem) => void;
  onGoCart: () => void;
  onGoBill: () => void;
}) {
  return (
    <section className="space-y-4">
      <TableHero
        table={table}
        orders={orders}
        summary={summary}
        onSeat={onSeat}
        onBill={onGoBill}
      />

      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black">Order Items</h2>
            <p className="text-sm font-semibold text-white/45">
              Add only new items. Every send creates a fresh KOT.
            </p>
          </div>
          <div className="relative lg:w-80">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Search menu item"
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/40 pl-11 pr-4 text-sm font-bold outline-none focus:border-red-400"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {categories.map((name) => (
            <button
              key={name}
              onClick={() => onCategory(name)}
              className={`min-h-11 shrink-0 rounded-2xl px-4 text-sm font-black ${
                category === name ? "bg-red-600 text-white" : "bg-white/8 text-white/65"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-[22px] bg-white/5" />
            ))
          ) : menu.length === 0 ? (
            <div className="col-span-full rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-white/45">
              No menu items found.
            </div>
          ) : (
            menu.map((item) => <MenuItemCard key={item.id} item={item} onAdd={() => onAdd(item)} />)
          )}
        </div>
      </div>

      {draftCount > 0 && (
        <button
          onClick={onGoCart}
          className="fixed bottom-24 left-3 right-3 z-20 flex min-h-14 items-center justify-between rounded-3xl bg-red-600 px-5 font-black text-white shadow-2xl shadow-red-950/40 md:hidden"
        >
          <span>{draftCount} new items</span>
          <span>View KOT - Rs {Math.round(draftTotal)}</span>
        </button>
      )}
    </section>
  );
}

function KotsPage({
  table,
  draft,
  totals,
  orders,
  sending,
  serving,
  onQty,
  onNotes,
  onRemove,
  onSend,
  onServed,
  onOrderMore,
  onBill,
}: {
  table: string;
  draft: DraftLine[];
  totals: ReturnType<typeof computeTotals>;
  orders: Order[];
  sending: boolean;
  serving: boolean;
  onQty: (id: string, qty: number) => void;
  onNotes: (id: string, notes: string) => void;
  onRemove: (id: string) => void;
  onSend: () => void;
  onServed: (id: string) => void;
  onOrderMore: () => void;
  onBill: () => void;
}) {
  return (
    <section className="space-y-4">
      <PageTitle
        eyebrow={`Table ${table}`}
        title="KOT Cart & History"
        description="Send only the new cart items to the kitchen. Previous KOTs stay locked and are not resent."
      />
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <NewItemsCart
          draft={draft}
          totals={totals}
          sending={sending}
          onQty={onQty}
          onNotes={onNotes}
          onRemove={onRemove}
          onSend={onSend}
          onOrderMore={onOrderMore}
        />
        <KotHistory orders={orders} onServed={onServed} serving={serving} onBill={onBill} />
      </div>
    </section>
  );
}

function BillPage({
  table,
  orders,
  summary,
  paymentMethod,
  paying,
  onPaymentMethod,
  onPay,
  onOrderMore,
}: {
  table: string;
  orders: Order[];
  summary: ReturnType<typeof summarize>;
  paymentMethod: WaiterPaymentMethod;
  paying: boolean;
  onPaymentMethod: (method: WaiterPaymentMethod) => void;
  onPay: () => void;
  onOrderMore: () => void;
}) {
  return (
    <section className="space-y-4">
      <PageTitle
        eyebrow={`Table ${table}`}
        title="Final Bill"
        description="All KOTs are combined into one final table invoice."
      />
      {orders.length === 0 ? (
        <EmptyPanel
          title="No active bill"
          description="Seat a customer or select an occupied table before generating a bill."
          actionLabel="Order items"
          onAction={onOrderMore}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <section className="rounded-[28px] border border-white/10 bg-zinc-950 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-red-300">
                  Combined Invoice
                </p>
                <h2 className="mt-1 text-3xl font-black">Table {table}</h2>
              </div>
              <ReceiptText className="h-8 w-8 text-red-300" />
            </div>
            <div className="mt-5 space-y-3">
              {orders.map((order, index) => (
                <div key={order.id} className="rounded-2xl bg-white/5 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="font-black">KOT {index + 1}</div>
                    <StatusPill status={order.status} />
                  </div>
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
          </section>

          <aside className="space-y-4">
            <section className="rounded-[28px] border border-white/10 bg-zinc-950 p-4">
              <h3 className="text-xl font-black">Bill Summary</h3>
              <div className="mt-4 rounded-2xl bg-white/5 p-4">
                <Row label="Subtotal" value={`Rs ${Math.round(summary.subtotal)}`} />
                <Row label="GST" value={`Rs ${Math.round(summary.tax)}`} />
                <Row label="Discount" value="Rs 0" />
                <Row label="Service charge" value="Rs 0" />
                <Row label="Grand Total" value={`Rs ${Math.round(summary.grandTotal)}`} strong />
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-zinc-950 p-4">
              <h3 className="text-xl font-black">Payment</h3>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {PAYMENT_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => onPaymentMethod(value)}
                    className={`min-h-12 rounded-2xl border px-3 text-sm font-black ${
                      paymentMethod === value
                        ? "border-red-400 bg-red-600 text-white"
                        : "border-white/10 bg-white/5 text-white/70"
                    }`}
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
                className="mt-4 min-h-14 w-full rounded-2xl bg-emerald-500 font-black text-emerald-950 disabled:opacity-50"
              >
                {paying ? "Completing payment..." : "Payment Success - Close Table"}
              </button>
            </section>
          </aside>
        </div>
      )}
    </section>
  );
}

function TableHero({
  table,
  orders,
  summary,
  onSeat,
  onBill,
}: {
  table: string;
  orders: Order[];
  summary: ReturnType<typeof summarize>;
  onSeat: () => void;
  onBill: () => void;
}) {
  const servedCount = orders.filter((order) => order.status === "delivered").length;
  return (
    <section className="rounded-[30px] border border-white/10 bg-gradient-to-br from-red-950/70 via-zinc-950 to-black p-5 shadow-2xl shadow-black/30">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-red-200">Active Table</p>
          <h2 className="mt-2 text-4xl font-black">Table {table}</h2>
          <p className="mt-2 text-sm font-semibold text-white/55">
            {orders.length
              ? `${orders.length} KOTs | ${summary.items} items | ${servedCount} served`
              : "Seat a customer, then start taking the order."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
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
            Bill
          </button>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniMetric label="KOTs" value={String(orders.length)} />
        <MiniMetric label="Subtotal" value={`Rs ${Math.round(summary.subtotal)}`} />
        <MiniMetric label="GST" value={`Rs ${Math.round(summary.tax)}`} />
        <MiniMetric label="Grand total" value={`Rs ${Math.round(summary.grandTotal)}`} />
      </div>
    </section>
  );
}

function MenuItemCard({ item, onAdd }: { item: MenuItem; onAdd: () => void }) {
  return (
    <article className="flex gap-3 rounded-[24px] border border-white/10 bg-black/30 p-3">
      <img src={item.image} alt={item.name} className="h-24 w-24 rounded-2xl object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-black leading-tight">{item.name}</h3>
            <p className="mt-1 line-clamp-1 text-xs font-semibold text-white/45">{item.category}</p>
          </div>
          <span
            className={`mt-1 h-3 w-3 shrink-0 rounded-full ring-2 ${
              item.isVeg ? "bg-emerald-400 ring-emerald-900" : "bg-red-500 ring-red-950"
            }`}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="font-black text-red-200">Rs {item.price}</span>
          <button
            onClick={onAdd}
            disabled={item.available === false}
            className="min-h-10 rounded-2xl bg-white px-4 text-xs font-black text-zinc-950 disabled:opacity-40"
          >
            {item.available === false ? "OFF" : "ADD"}
          </button>
        </div>
      </div>
    </article>
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
  onOrderMore,
}: {
  draft: DraftLine[];
  totals: ReturnType<typeof computeTotals>;
  sending: boolean;
  onQty: (id: string, qty: number) => void;
  onNotes: (id: string, notes: string) => void;
  onRemove: (id: string) => void;
  onSend: () => void;
  onOrderMore: () => void;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-zinc-950 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black">New KOT Cart</h2>
          <p className="mt-1 text-xs font-bold text-white/40">Only new items go to kitchen.</p>
        </div>
        <ChefHat className="h-5 w-5 text-red-300" />
      </div>
      <div className="mt-4 space-y-3">
        {draft.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center">
            <p className="text-sm font-bold text-white/40">No new items yet.</p>
            <button
              onClick={onOrderMore}
              className="mt-4 min-h-11 rounded-2xl bg-white px-4 text-sm font-black text-zinc-950"
            >
              Add items
            </button>
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
                  aria-label={`Remove ${line.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="inline-flex items-center rounded-2xl bg-black/40">
                  <button
                    onClick={() => onQty(line.id, line.qty - 1)}
                    className="grid h-10 w-10 place-items-center"
                    aria-label={`Decrease ${line.name}`}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center font-black">{line.qty}</span>
                  <button
                    onClick={() => onQty(line.id, line.qty + 1)}
                    className="grid h-10 w-10 place-items-center"
                    aria-label={`Increase ${line.name}`}
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
  onBill,
}: {
  orders: Order[];
  onServed: (id: string) => void;
  serving: boolean;
  onBill: () => void;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-zinc-950 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black">KOT History</h2>
          <p className="mt-1 text-xs font-bold text-white/40">Kitchen batches for this table.</p>
        </div>
        <button
          onClick={onBill}
          disabled={orders.length === 0}
          className="min-h-10 rounded-2xl bg-white px-4 text-xs font-black text-zinc-950 disabled:opacity-40"
        >
          Bill
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {orders.length === 0 ? (
          <p className="rounded-2xl bg-white/5 p-5 text-sm font-bold text-white/40">No KOTs yet.</p>
        ) : (
          orders.map((order, index) => (
            <article key={order.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-black">KOT {index + 1}</div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-widest text-white/40">
                    {formatTime(order.createdAt)} | {order.status.replace(/_/g, " ")}
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
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[32px] border border-white/10 bg-zinc-950 p-5 text-white shadow-2xl md:rounded-[32px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-red-300">
              New customer
            </p>
            <h2 className="mt-1 text-2xl font-black">Seat Table {table}</h2>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-white/70"
            aria-label="Close seat customer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
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
            Open Order
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileWaiterNav({
  active,
  draftCount,
  onChange,
}: {
  active: WaiterView;
  draftCount: number;
  onChange: (view: WaiterView) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-black/90 px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-4 gap-1">
        {WAITER_NAV.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`relative min-h-16 rounded-2xl px-2 text-xs font-black ${
                isActive ? "bg-red-600 text-white" : "text-white/55"
              }`}
            >
              {item.id === "kots" && draftCount > 0 && (
                <span className="absolute right-3 top-2 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] text-red-600">
                  {draftCount}
                </span>
              )}
              <Icon className="mx-auto mb-1 h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function NavButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: typeof Home;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex min-h-12 items-center gap-2 rounded-2xl px-5 text-sm font-black ${
        active ? "bg-red-600 text-white" : "bg-white/5 text-white/65 hover:bg-white/10"
      }`}
    >
      <Icon className="h-5 w-5" /> {label}
    </button>
  );
}

function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <p className="text-xs font-black uppercase tracking-[0.28em] text-red-300">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-black sm:text-3xl">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm font-semibold text-white/50">{description}</p>
    </div>
  );
}

function EmptyPanel({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <section className="rounded-[28px] border border-dashed border-white/10 bg-zinc-950 p-8 text-center">
      <UserRound className="mx-auto h-10 w-10 text-white/35" />
      <h3 className="mt-4 text-xl font-black">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-white/45">{description}</p>
      <button
        onClick={onAction}
        className="mt-5 min-h-12 rounded-2xl bg-white px-5 text-sm font-black text-zinc-950"
      >
        {actionLabel}
      </button>
    </section>
  );
}

function MiniMetric({
  label,
  value,
  dense = false,
}: {
  label: string;
  value: string;
  dense?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/5 ${dense ? "px-3 py-2" : "px-4 py-3"}`}
    >
      <div className="text-[10px] font-black uppercase tracking-widest text-white/35">{label}</div>
      <div className={`${dense ? "text-sm" : "text-lg"} mt-1 font-black`}>{value}</div>
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
        className="mt-1 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 font-bold outline-none focus:border-red-400"
      />
    </label>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-3 py-1 ${
        strong ? "text-lg font-black text-white" : "text-sm font-bold text-white/60"
      }`}
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

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
