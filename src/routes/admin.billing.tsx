import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Printer, ReceiptText, Search, Send, Trash2, Utensils } from "lucide-react";
import { toast } from "sonner";
import { KotBill } from "@/components/site/KotBill";
import { CATEGORIES, type MenuItem } from "@/data/menu";
import {
  computeTotals,
  createOrder,
  getMenu,
  listOrders,
  type Order,
  type OrderItem,
  type OrderType,
  type PaymentMethod,
} from "@/services/api";
import { useOrderRealtime } from "@/hooks/use-order-realtime";
import { StatusPill } from "./admin.index";

export const Route = createFileRoute("/admin/billing")({
  component: AdminBilling,
});

type DraftItem = OrderItem & { category: string };
type PrintKind = "bill" | "kot";

function AdminBilling() {
  useOrderRealtime();
  const qc = useQueryClient();
  const { data: menu = [] } = useQuery({ queryKey: ["menu"], queryFn: getMenu });
  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: listOrders,
    refetchInterval: 4000,
  });

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [type, setType] = useState<OrderType>("dinein");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerPhone, setCustomerPhone] = useState("9999999999");
  const [tableNumber, setTableNumber] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [printKind, setPrintKind] = useState<PrintKind | null>(null);

  const totals = useMemo(() => computeTotals(items, type), [items, type]);
  const availableMenu = menu.filter((m) => m.available);
  const filteredMenu = availableMenu.filter((m) => {
    const matchesCategory = category === "All" || m.category === category;
    const needle = query.trim().toLowerCase();
    const matchesQuery =
      needle.length === 0 ||
      m.name.toLowerCase().includes(needle) ||
      m.category.toLowerCase().includes(needle);
    return matchesCategory && matchesQuery;
  });

  const recentOrders = orders.slice(0, 10);
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);

  function addItem(item: MenuItem) {
    setItems((current) => {
      const existing = current.find((entry) => entry.id === item.id);
      if (existing) {
        return current.map((entry) =>
          entry.id === item.id ? { ...entry, qty: entry.qty + 1 } : entry,
        );
      }
      return [
        ...current,
        {
          id: item.id,
          name: item.name,
          price: item.price,
          qty: 1,
          isVeg: item.isVeg,
          category: item.category,
        },
      ];
    });
  }

  function changeQty(id: string, delta: number) {
    setItems((current) =>
      current
        .map((item) => (item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item))
        .filter((item) => item.qty > 0),
    );
  }

  function clearBill() {
    setItems([]);
    setType("dinein");
    setPaymentMethod("cod");
    setCustomerName("Walk-in Customer");
    setCustomerPhone("9999999999");
    setTableNumber("");
    setAddress("");
    setNotes("");
    setCreatedOrder(null);
    setPrintKind(null);
  }

  async function generateBill() {
    if (items.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    if (type === "dinein" && !tableNumber.trim()) {
      toast.error("Enter table number");
      return;
    }
    if (type === "delivery" && !address.trim()) {
      toast.error("Enter delivery address");
      return;
    }

    setSaving(true);
    try {
      const order = await createOrder({
        items: items.map(({ category: _category, ...item }) => item),
        ...totals,
        customer: {
          name: customerName.trim() || "Walk-in Customer",
          phone: customerPhone.trim() || "9999999999",
          address: type === "delivery" ? address.trim() : undefined,
          notes: notes.trim() || undefined,
        },
        type,
        tableNumber: type === "dinein" ? tableNumber.trim() : undefined,
        paymentMethod,
      });
      setCreatedOrder(order);
      setPrintKind("bill");
      await qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Bill ${order.id} generated and KOT sent to kitchen`);
    } catch {
      toast.error("Could not generate bill");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-wide">Self Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate a counter bill, create the order, and send a live KOT to kitchen.
          </p>
        </div>
        <div className="flex gap-2">
          {createdOrder && (
            <>
              <button
                onClick={() => setPrintKind("kot")}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 font-display text-xs tracking-widest hover:bg-background"
              >
                <Printer className="h-4 w-4" /> KOT
              </button>
              <button
                onClick={() => setPrintKind("bill")}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 font-display text-xs tracking-widest hover:bg-background"
              >
                <ReceiptText className="h-4 w-4" /> BILL
              </button>
            </>
          )}
          <button
            onClick={clearBill}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 font-display text-xs tracking-widest text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" /> CLEAR
          </button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
        <section className="min-w-0">
          <div className="mb-3 grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search menu"
                className="h-11 w-full rounded-md border border-input bg-surface pl-10 pr-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-11 rounded-md border border-input bg-surface px-3 text-sm outline-none focus:border-primary"
            >
              <option>All</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredMenu.map((item) => (
              <button
                key={item.id}
                onClick={() => addItem(item)}
                className="group flex min-h-28 flex-col justify-between rounded-lg border border-border bg-surface p-4 text-left transition hover:border-primary/50 hover:bg-background"
              >
                <span>
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-display text-lg leading-tight tracking-wide">
                      {item.name}
                    </span>
                    <span
                      className={`font-display text-xs tracking-widest ${item.isVeg ? "text-veg" : "text-primary"}`}
                    >
                      {item.isVeg ? "VEG" : "NON-VEG"}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{item.category}</span>
                </span>
                <span className="mt-3 flex items-center justify-between">
                  <span className="font-display text-xl text-primary">Rs {item.price}</span>
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground group-hover:bg-primary-glow">
                    <Plus className="h-4 w-4" />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-lg border border-border bg-surface">
            <header className="border-b border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl tracking-widest">Current Bill</h2>
                <span className="text-xs text-muted-foreground">{itemCount} items</span>
              </div>
            </header>

            <div className="space-y-3 p-4">
              <div className="grid grid-cols-3 gap-2">
                {(["dinein", "pickup", "delivery"] as OrderType[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setType(mode)}
                    className={`rounded-md border px-2 py-2 font-display text-xs tracking-widest ${
                      type === mode
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode === "dinein" ? "DINE-IN" : mode.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Customer name"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <input
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="Phone"
                  inputMode="tel"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>

              {type === "dinein" && (
                <input
                  value={tableNumber}
                  onChange={(event) => setTableNumber(event.target.value)}
                  placeholder="Table number"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              )}
              {type === "delivery" && (
                <textarea
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Delivery address"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              )}
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Kitchen note"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />

              <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-background">
                {items.length === 0 ? (
                  <div className="grid min-h-32 place-items-center px-4 text-center text-sm text-muted-foreground">
                    <span>
                      <Utensils className="mx-auto mb-2 h-5 w-5" />
                      Add items from the menu
                    </span>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {items.map((item) => (
                      <li key={item.id} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-display tracking-wide">{item.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Rs {item.price} each
                            </div>
                          </div>
                          <div className="font-display">Rs {item.price * item.qty}</div>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => changeQty(item.id, -1)}
                            className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface hover:bg-background"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-8 text-center font-display text-lg">{item.qty}</span>
                          <button
                            onClick={() => changeQty(item.id, 1)}
                            className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface hover:bg-background"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-md border border-border bg-background p-3 text-sm">
                <BillLine label="Subtotal" value={`Rs ${totals.subtotal}`} />
                <BillLine label="GST 5%" value={`Rs ${totals.tax}`} />
                {totals.deliveryFee > 0 && (
                  <BillLine label="Delivery" value={`Rs ${totals.deliveryFee}`} />
                )}
                <div className="mt-2 flex items-center justify-between border-t border-border pt-2 font-display text-2xl">
                  <span>Total</span>
                  <span className="text-primary">Rs {totals.total}</span>
                </div>
              </div>

              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              >
                <option value="cod">Cash</option>
                <option value="upi">UPI</option>
                <option value="razorpay">Card/Razorpay</option>
              </select>

              <button
                onClick={generateBill}
                disabled={saving || items.length === 0}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary font-display text-sm tracking-[0.25em] text-primary-foreground hover:bg-primary-glow disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {saving ? "CREATING..." : "GENERATE BILL + SEND KOT"}
              </button>
            </div>
          </section>
        </aside>
      </div>

      <section className="mt-8 rounded-lg border border-border bg-surface">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-display text-xl tracking-widest">Complete Order History</h2>
          <span className="text-xs text-muted-foreground">{orders.length} total orders</span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="border-b border-border bg-background/50 text-left font-display text-xs tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Print</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-background/40">
                  <td className="px-4 py-3">
                    <div className="font-display text-primary">#{order.id}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{order.customer.name}</div>
                    <div className="text-xs text-muted-foreground">{order.customer.phone}</div>
                  </td>
                  <td className="px-4 py-3 uppercase">
                    {order.tableNumber ? `Table ${order.tableNumber}` : order.type}
                  </td>
                  <td className="px-4 py-3">
                    {order.items.reduce((sum, item) => sum + item.qty, 0)}
                  </td>
                  <td className="px-4 py-3 font-display">Rs {order.total}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={order.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setCreatedOrder(order);
                          setPrintKind("kot");
                        }}
                        className="rounded-md border border-border bg-background px-2 py-1 font-display text-[11px] tracking-widest hover:border-primary/50"
                      >
                        KOT
                      </button>
                      <button
                        onClick={() => {
                          setCreatedOrder(order);
                          setPrintKind("bill");
                        }}
                        className="rounded-md border border-border bg-background px-2 py-1 font-display text-[11px] tracking-widest hover:border-primary/50"
                      >
                        BILL
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {createdOrder && printKind && (
        <PrintDialog order={createdOrder} kind={printKind} onClose={() => setPrintKind(null)} />
      )}
    </div>
  );
}

function BillLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function PrintDialog({
  order,
  kind,
  onClose,
}: {
  order: Order;
  kind: PrintKind;
  onClose: () => void;
}) {
  const printedRef = useRef(false);

  useEffect(() => {
    if (printedRef.current) return;
    printedRef.current = true;
    const id = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(id);
  }, [order.id, kind]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur">
      <div className="no-print absolute right-4 top-4 flex gap-2">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-display text-xs tracking-widest text-primary-foreground hover:bg-primary-glow"
        >
          <Printer className="h-4 w-4" /> PRINT
        </button>
        <button
          onClick={onClose}
          className="rounded-md border border-border bg-surface px-4 py-2 font-display text-xs tracking-widest hover:bg-background"
        >
          DONE
        </button>
      </div>
      <div className="print-area">
        <KotBill order={order} kind={kind} />
      </div>
    </div>
  );
}
