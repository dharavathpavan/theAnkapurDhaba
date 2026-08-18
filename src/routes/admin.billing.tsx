import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BadgePercent,
  Banknote,
  Bike,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Eye,
  FileSpreadsheet,
  FileText,
  History,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  NotebookPen,
  PanelLeftClose,
  Phone,
  Pin,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Send,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Tag,
  Trash2,
  User,
  Utensils,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { KotBill } from "@/components/site/KotBill";
import { useAdminChrome } from "@/stores/admin-chrome";
import { CATEGORIES, type MenuItem } from "@/data/menu";
import {
  computeTotals,
  createOrder,
  getMenu,
  listCustomerCoupons,
  listOrders,
  updateCatalogItem,
  updateOrderStatus,
  validateCustomerCoupon,
  type CustomerCoupon,
  type Order,
  type OrderItem,
  type OrderStatus,
  type OrderType,
  type PaymentMethod,
} from "@/services/api";
import { useOrderRealtime } from "@/hooks/use-order-realtime";
import { StatusPill } from "./admin.index";
import { downloadOrdersCsv, downloadOrdersExcel } from "@/lib/export-orders";

export const Route = createFileRoute("/admin/billing")({
  component: AdminBilling,
});

type DraftItem = OrderItem & { category: string };
type PrintKind = "bill" | "kot";
const PAGE_SIZES = [10, 25, 50];

const STATUS_STEPS: Array<{ key: OrderStatus; label: string }> = [
  { key: "received", label: "Received" },
  { key: "accepted", label: "Accepted" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "out_for_delivery", label: "Out" },
  { key: "delivered", label: "Delivered" },
];

const NEXT: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  received: { next: "accepted", label: "Accept" },
  accepted: { next: "preparing", label: "Start cooking" },
  preparing: { next: "ready", label: "Mark ready" },
  ready: { next: "out_for_delivery", label: "Out for delivery" },
  out_for_delivery: { next: "delivered", label: "Mark delivered" },
};

function AdminBilling() {
  useOrderRealtime();
  const qc = useQueryClient();
  const { data: menu = [] } = useQuery({ queryKey: ["menu"], queryFn: getMenu });
  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: listOrders,
    refetchInterval: 4000,
  });
  const { data: coupons = [] } = useQuery({
    queryKey: ["billing-coupons"],
    queryFn: () => listCustomerCoupons(),
    staleTime: 60_000,
  });

  const [fullscreen, setFullscreen] = useState(false);
  const navHidden = useAdminChrome((state) => state.navHidden);
  const setNavHidden = useAdminChrome((state) => state.setNavHidden);
  const [activeTab, setActiveTab] = useState<"pos" | "orders">("pos");
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
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CustomerCoupon | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [manualDiscount, setManualDiscount] = useState(0);
  const [couponOpen, setCouponOpen] = useState(false);
  const [pinUpdating, setPinUpdating] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totals = useMemo(() => computeTotals(items, type), [items, type]);
  const discount = useMemo(
    () => Math.max(0, couponDiscount + manualDiscount),
    [couponDiscount, manualDiscount],
  );
  const grandTotal = useMemo(() => Math.max(0, totals.total - discount), [totals.total, discount]);

  const availableMenu = menu.filter((m) => m.available);
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of availableMenu) {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
    return counts;
  }, [availableMenu]);
  const filteredMenu = availableMenu.filter((m) => {
    const matchesCategory = category === "All" || m.category === category;
    const needle = query.trim().toLowerCase();
    const matchesQuery =
      needle.length === 0 ||
      m.name.toLowerCase().includes(needle) ||
      m.category.toLowerCase().includes(needle);
    return matchesCategory && matchesQuery;
  });
  const sortedMenu = useMemo(
    () => [...filteredMenu].sort((a, b) => Number(b.pinned || false) - Number(a.pinned || false)),
    [filteredMenu],
  );

  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageOrders = useMemo(
    () => orders.slice((safePage - 1) * pageSize, safePage * pageSize),
    [orders, safePage, pageSize],
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fullscreen]);

  const subtotalRef = useRef(totals.subtotal);
  useEffect(() => {
    subtotalRef.current = totals.subtotal;
    if (!appliedCoupon) return;
    let cancelled = false;
    validateCustomerCoupon({
      code: appliedCoupon.code,
      subtotal: totals.subtotal,
      phone: customerPhone,
    })
      .then((result) => {
        if (cancelled) return;
        setCouponDiscount(result.discount);
      })
      .catch(() => {
        if (cancelled) return;
        setAppliedCoupon(null);
        setCouponCode("");
        setCouponDiscount(0);
        toast.error("Coupon no longer valid for this total");
      });
    return () => {
      cancelled = true;
    };
  }, [totals.subtotal, appliedCoupon, customerPhone]);

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

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
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
    setCouponCode("");
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setManualDiscount(0);
  }

  async function applyCoupon(code: string) {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    if (items.length === 0) {
      toast.error("Add items before applying a coupon");
      return;
    }
    try {
      const result = await validateCustomerCoupon({
        code: trimmed,
        subtotal: totals.subtotal,
        phone: customerPhone,
      });
      setAppliedCoupon(result.coupon);
      setCouponCode(result.coupon.code);
      setCouponDiscount(result.discount);
      toast.success(`Coupon applied: -Rs ${result.discount}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid coupon");
    }
  }

  function clearCoupon() {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponDiscount(0);
  }

  async function togglePin(item: MenuItem) {
    if (pinUpdating) return;
    setPinUpdating(item.id);
    try {
      await updateCatalogItem(item.id, { pinned: !item.pinned });
      await qc.invalidateQueries({ queryKey: ["menu"] });
      toast.success(item.pinned ? `Unpinned ${item.name}` : `Pinned ${item.name}`);
    } catch {
      toast.error("Could not update pin");
    } finally {
      setPinUpdating(null);
    }
  }

  async function advanceOrder(id: string, status: OrderStatus) {
    try {
      await updateOrderStatus(id, status);
      await qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Order ${id} → ${status.replace(/_/g, " ")}`);
    } catch {
      toast.error("Couldn't update order");
    }
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
        subtotal: totals.subtotal,
        tax: totals.tax,
        deliveryFee: totals.deliveryFee,
        total: grandTotal,
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

  const posUI = (
    <div
      className={
        fullscreen ? "fixed inset-0 z-[9999] flex flex-col bg-background text-foreground" : ""
      }
    >
      <div
        className={`flex flex-col ${fullscreen ? "h-full min-h-0" : `mx-auto w-full max-w-[1600px] px-4 py-4 md:px-6 ${navHidden ? "h-dvh" : "h-[calc(100dvh-81px)]"}`}`}
      >
        <header
          className={`mb-3 flex flex-wrap items-center justify-between gap-3 ${fullscreen ? "border-b border-border bg-surface px-4 py-3" : ""}`}
        >
          <div className="flex items-center gap-3">
            {!fullscreen && <h1 className="font-display text-3xl tracking-wide">Self Billing</h1>}
            {fullscreen && (
              <div className="flex items-center gap-3">
                <span className="font-display text-xl tracking-widest">POS</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-600">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  Live
                </span>
              </div>
            )}
            <span className="hidden text-sm text-muted-foreground md:inline">
              {activeTab === "pos"
                ? "Generate a counter bill, create the order, and send a live KOT to kitchen."
                : "Review every order, advance its status, and reprint KOTs or bills."}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-md border border-border bg-surface p-1">
              <button
                type="button"
                onClick={() => setActiveTab("pos")}
                className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-display text-xs tracking-widest transition ${
                  activeTab === "pos"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-background hover:text-foreground"
                }`}
              >
                <ShoppingCart className="h-3.5 w-3.5" /> POS
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("orders")}
                className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-display text-xs tracking-widest transition ${
                  activeTab === "orders"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-background hover:text-foreground"
                }`}
              >
                <History className="h-3.5 w-3.5" /> ORDERS
                {orders.length > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                      activeTab === "orders" ? "bg-primary-foreground/20" : "bg-background"
                    }`}
                  >
                    {orders.length}
                  </span>
                )}
              </button>
            </div>
            {activeTab === "pos" && createdOrder && (
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
            {!fullscreen && (
              <button
                onClick={() => setNavHidden(true)}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 font-display text-xs tracking-widest hover:bg-background"
              >
                <PanelLeftClose className="h-4 w-4" /> HIDE NAV
              </button>
            )}
            <button
              onClick={() => setFullscreen((value) => !value)}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 font-display text-xs tracking-widest hover:bg-background"
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {fullscreen ? "EXIT FULL" : "FULLSCREEN"}
            </button>
            {activeTab === "pos" && (
              <button
                onClick={clearBill}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 font-display text-xs tracking-widest text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="h-4 w-4" /> CLEAR
              </button>
            )}
          </div>
        </header>

        {activeTab === "pos" && (
          <div
            className={`grid min-h-0 flex-1 gap-4 overflow-y-auto ${fullscreen ? "grid-cols-1 lg:grid-cols-[1.5fr_1fr]" : "lg:grid-cols-[1.4fr_0.9fr]"}`}
          >
            <section className="flex min-w-0 flex-col overflow-hidden">
              <div className="mb-3 flex flex-col gap-2">
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search menu"
                      className="h-11 w-full rounded-md border border-input bg-surface pl-10 pr-10 text-sm outline-none focus:border-primary"
                    />
                    {query.length > 0 && (
                      <button
                        onClick={() => setQuery("")}
                        aria-label="Clear search"
                        className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </label>
                  <span className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-muted-foreground">
                    <ShoppingCart className="h-4 w-4" />
                    {sortedMenu.length} of {availableMenu.length} items
                  </span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {(["All", ...CATEGORIES] as string[]).map((c) => {
                    const count = c === "All" ? availableMenu.length : (categoryCounts.get(c) ?? 0);
                    const active = category === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setCategory(c)}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-surface text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        }`}
                      >
                        {c}
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                            active
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-background"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid content-start gap-3 overflow-y-auto pr-1 pb-4 sm:grid-cols-2 xl:grid-cols-3">
                {sortedMenu.map((item) => {
                  const inBill = items.find((entry) => entry.id === item.id)?.qty ?? 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => addItem(item)}
                      aria-label={
                        inBill > 0
                          ? `${item.name}, ${inBill} in bill, tap to add one more`
                          : `Add ${item.name}`
                      }
                      className={`group relative flex min-h-44 flex-col overflow-hidden rounded-lg border bg-surface text-left transition ${
                        inBill > 0
                          ? "border-primary/60 ring-1 ring-primary/30"
                          : "border-border hover:border-primary/50"
                      } hover:bg-background`}
                    >
                      <div className="relative aspect-[16/9] bg-background">
                        <img
                          src={item.thumbnail || item.image || "/assets/hero-biryani.jpg"}
                          alt={item.name}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                        {inBill > 0 && (
                          <span className="absolute bottom-2 right-2 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 font-display text-sm tracking-widest text-primary-foreground shadow-lg">
                            {inBill}
                          </span>
                        )}
                        <span
                          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-black ${
                            item.isVeg ? "bg-veg text-white" : "bg-primary text-primary-foreground"
                          }`}
                        >
                          {item.isVeg ? "VEG" : "NON-VEG"}
                        </span>
                        {(item.pinned || item.featured) && (
                          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-black text-black">
                            <Pin className="h-3 w-3" /> Priority
                          </span>
                        )}
                      </div>
                      <span className="flex flex-1 flex-col p-3">
                        <span className="line-clamp-2 font-display text-lg leading-tight tracking-wide">
                          {item.name}
                        </span>
                        <span className="mt-1 flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-muted-foreground">
                            {item.category}
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={`${item.pinned ? "Unpin" : "Pin"} ${item.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              togglePin(item);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                togglePin(item);
                              }
                            }}
                            className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border transition ${
                              item.pinned
                                ? "border-yellow-400 bg-yellow-400 text-black"
                                : "border-border bg-background text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {pinUpdating === item.id ? (
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              <Pin className="h-3.5 w-3.5" />
                            )}
                          </span>
                        </span>
                        <span className="mt-auto flex items-center justify-between pt-3">
                          <span className="flex items-baseline gap-2">
                            <span className="font-display text-xl text-primary">
                              Rs {item.offerPrice ?? item.price}
                            </span>
                            {item.offerPrice ? (
                              <span className="text-xs text-muted-foreground line-through">
                                Rs {item.price}
                              </span>
                            ) : null}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 font-display text-[11px] tracking-widest transition ${
                              inBill > 0
                                ? "bg-veg/15 text-veg"
                                : "bg-primary text-primary-foreground group-hover:bg-primary-glow"
                            }`}
                          >
                            {inBill > 0 ? (
                              <>
                                <Plus className="h-3.5 w-3.5" /> MORE
                              </>
                            ) : (
                              <>
                                <Plus className="h-3.5 w-3.5" /> ADD
                              </>
                            )}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
                {sortedMenu.length === 0 && (
                  <div className="col-span-full rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-muted-foreground">
                    No menu items match.
                  </div>
                )}
              </div>
            </section>

            <aside className="flex min-h-0 flex-col">
              <section className="flex min-h-0 flex-col rounded-lg border border-border bg-surface">
                <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    <h2 className="font-display text-lg tracking-widest">Current Bill</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-widest text-primary">
                      {itemCount} items
                    </span>
                    {items.length > 0 && (
                      <button
                        onClick={clearBill}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-black tracking-widest text-muted-foreground hover:border-red-400/50 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> CLEAR
                      </button>
                    )}
                  </div>
                </header>

                <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                      Order Type
                    </h3>
                    <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-background p-1">
                      {(
                        [
                          { mode: "dinein", label: "DINE-IN", icon: Utensils },
                          { mode: "pickup", label: "PICKUP", icon: ShoppingBag },
                          { mode: "delivery", label: "DELIVERY", icon: Bike },
                        ] as { mode: OrderType; label: string; icon: typeof Utensils }[]
                      ).map(({ mode, label, icon: Icon }) => (
                        <button
                          key={mode}
                          onClick={() => setType(mode)}
                          className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-2 font-display text-[11px] tracking-widest transition ${
                            type === mode
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-background hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                      Customer
                    </h3>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      <label className="relative block">
                        <User className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={customerName}
                          onChange={(event) => setCustomerName(event.target.value)}
                          placeholder="Customer name"
                          className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-2.5 text-sm outline-none focus:border-primary"
                        />
                      </label>
                      <label className="relative block">
                        <Phone className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={customerPhone}
                          onChange={(event) => setCustomerPhone(event.target.value)}
                          placeholder="Phone"
                          inputMode="tel"
                          className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-2.5 text-sm outline-none focus:border-primary"
                        />
                      </label>
                    </div>

                    {type === "dinein" && (
                      <label className="relative block">
                        <Utensils className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={tableNumber}
                          onChange={(event) => setTableNumber(event.target.value)}
                          placeholder="Table number"
                          className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-2.5 text-sm outline-none focus:border-primary"
                        />
                      </label>
                    )}
                    {type === "delivery" && (
                      <label className="relative block">
                        <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <textarea
                          value={address}
                          onChange={(event) => setAddress(event.target.value)}
                          placeholder="Delivery address"
                          rows={1}
                          className="w-full resize-none rounded-md border border-input bg-background py-1.5 pl-8 pr-2.5 text-sm outline-none focus:border-primary"
                        />
                      </label>
                    )}
                    <label className="relative block">
                      <NotebookPen className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Kitchen note"
                        rows={1}
                        className="w-full resize-none rounded-md border border-input bg-background py-1.5 pl-8 pr-2.5 text-sm outline-none focus:border-primary"
                      />
                    </label>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                      Items
                    </h3>
                    <div className="flex-1 overflow-y-auto rounded-md border border-border bg-background">
                      {items.length === 0 ? (
                        <div className="grid min-h-40 place-items-center px-4 text-center">
                          <span className="text-sm text-muted-foreground">
                            <span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-background">
                              <Utensils className="h-5 w-5" />
                            </span>
                            Tap a product to add it to the bill
                          </span>
                        </div>
                      ) : (
                        <ul className="divide-y divide-border">
                          {items.map((item) => (
                            <li key={item.id} className="flex items-start gap-2 p-2.5">
                              <span
                                className={`mt-1 h-3 w-3 shrink-0 rounded-[3px] border-2 ${
                                  item.isVeg
                                    ? "border-veg bg-veg/20"
                                    : "border-red-500 bg-red-500/20"
                                }`}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="line-clamp-2 font-display leading-tight tracking-wide">
                                  {item.name}
                                </span>
                                <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>Rs {item.price} each</span>
                                  <span className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => changeQty(item.id, -1)}
                                      className="grid h-6 w-6 place-items-center rounded border border-border bg-surface hover:bg-background"
                                      aria-label="Decrease quantity"
                                    >
                                      <Minus className="h-3.5 w-3.5" />
                                    </button>
                                    <span className="w-5 text-center font-display text-sm">
                                      {item.qty}
                                    </span>
                                    <button
                                      onClick={() => changeQty(item.id, 1)}
                                      className="grid h-6 w-6 place-items-center rounded border border-border bg-surface hover:bg-background"
                                      aria-label="Increase quantity"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                    </button>
                                  </span>
                                </span>
                              </span>
                              <span className="flex flex-col items-end gap-1">
                                <span className="font-display">Rs {item.price * item.qty}</span>
                                <button
                                  onClick={() => removeItem(item.id)}
                                  aria-label={`Remove ${item.name}`}
                                  className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                      Summary
                    </h3>
                    <div className="rounded-md border border-border bg-background p-2.5 text-sm">
                      <BillLine label="Subtotal" value={`Rs ${totals.subtotal}`} />
                      <BillLine label="GST 5%" value={`Rs ${totals.tax}`} />
                      {totals.deliveryFee > 0 && (
                        <BillLine label="Delivery" value={`Rs ${totals.deliveryFee}`} />
                      )}
                      {discount > 0 && (
                        <BillLine label="Discount" value={`-Rs ${discount}`} accent />
                      )}
                      <div className="mt-1.5 flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 font-display text-xl">
                        <span>Total</span>
                        <span className="text-primary">Rs {grandTotal}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-background">
                    <div className="flex items-center justify-between px-2.5 py-2">
                      <button
                        type="button"
                        onClick={() => setCouponOpen((value) => !value)}
                        className="flex items-center gap-1.5"
                      >
                        <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                          <Tag className="h-3.5 w-3.5" /> Coupon &amp; Discount
                        </span>
                        {couponOpen ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      {(appliedCoupon || manualDiscount > 0) && (
                        <button
                          onClick={clearCoupon}
                          className="text-[11px] font-bold text-muted-foreground hover:text-foreground"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {couponOpen && (
                      <div className="px-2.5 pb-2.5">
                        <div className="flex gap-1.5">
                          <input
                            value={couponCode}
                            onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                            placeholder="Coupon code"
                            className="min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm uppercase outline-none focus:border-primary"
                          />
                          <button
                            onClick={() => applyCoupon(couponCode)}
                            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-black tracking-widest text-primary-foreground hover:bg-primary-glow"
                          >
                            <BadgePercent className="h-4 w-4" /> APPLY
                          </button>
                        </div>

                        {appliedCoupon && (
                          <div className="mt-1.5 flex items-center justify-between rounded-md border border-veg/30 bg-veg/10 px-2.5 py-1.5 text-sm">
                            <div>
                              <div className="font-black text-veg">{appliedCoupon.code}</div>
                              <div className="text-xs text-muted-foreground">
                                {appliedCoupon.title}
                              </div>
                            </div>
                            <button
                              onClick={clearCoupon}
                              aria-label="Remove coupon"
                              className="text-veg"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}

                        {coupons.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {coupons.slice(0, 4).map((coupon) => (
                              <button
                                key={coupon.id}
                                onClick={() => applyCoupon(coupon.code)}
                                disabled={appliedCoupon?.code === coupon.code}
                                className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-bold disabled:opacity-40 hover:border-primary/50"
                              >
                                {coupon.code}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="mt-1.5 flex items-center gap-2">
                          <label className="text-xs text-muted-foreground">
                            Manual discount (Rs)
                          </label>
                          <input
                            value={manualDiscount || ""}
                            onChange={(event) =>
                              setManualDiscount(Math.max(0, Number(event.target.value) || 0))
                            }
                            type="number"
                            min={0}
                            placeholder="0"
                            className="w-24 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                      Payment Method
                    </h3>
                    <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-background p-1">
                      {(
                        [
                          { method: "cod", label: "CASH", icon: Banknote },
                          { method: "upi", label: "UPI", icon: Smartphone },
                          { method: "razorpay", label: "CARD", icon: CreditCard },
                        ] as { method: PaymentMethod; label: string; icon: typeof Banknote }[]
                      ).map(({ method, label, icon: Icon }) => (
                        <button
                          key={method}
                          onClick={() => setPaymentMethod(method)}
                          className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-2 font-display text-[11px] tracking-widest transition ${
                            paymentMethod === method
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-background hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={generateBill}
                    disabled={saving || items.length === 0}
                    className="inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-md bg-primary font-display text-sm tracking-[0.25em] text-primary-foreground hover:bg-primary-glow disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {saving ? "CREATING..." : `GENERATE BILL + SEND KOT · Rs ${grandTotal}`}
                  </button>
                </div>
              </section>
            </aside>
          </div>
        )}

        {activeTab === "orders" && (
          <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-surface">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl tracking-widest">Complete Order History</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-600">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Live
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{orders.length} total orders</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                  className="h-9 rounded-md border border-border bg-background px-2 text-xs font-bold"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size} / page
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    downloadOrdersCsv(orders);
                    toast.success("CSV download started");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-black tracking-widest hover:border-primary/50"
                >
                  <FileText className="h-3.5 w-3.5" /> CSV
                </button>
                <button
                  onClick={() => {
                    downloadOrdersExcel(orders);
                    toast.success("Excel download started");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-black tracking-widest hover:border-primary/50"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" /> EXCEL
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
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
                  {pageOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="cursor-pointer hover:bg-background/40"
                      onClick={() => setViewOrderId(order.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-display text-primary">#{order.id}</span>
                        </div>
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
                            onClick={(event) => {
                              event.stopPropagation();
                              setCreatedOrder(order);
                              setPrintKind("kot");
                            }}
                            className="rounded-md border border-border bg-background px-2 py-1 font-display text-[11px] tracking-widest hover:border-primary/50"
                          >
                            KOT
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
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
                  {pageOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        No orders yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {orders.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  Page {safePage} of {totalPages} · Showing {(safePage - 1) * pageSize + 1}–
                  {Math.min(safePage * pageSize, orders.length)} of {orders.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    disabled={safePage <= 1}
                    className="rounded-md border border-border bg-background px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    PREV
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                    let start = Math.max(1, safePage - 2);
                    start = Math.min(start, Math.max(1, totalPages - 4));
                    const value = start + index;
                    if (value > totalPages) return null;
                    return (
                      <button
                        key={value}
                        onClick={() => setPage(value)}
                        className={`grid h-9 w-9 place-items-center rounded-md border text-xs font-black ${
                          value === safePage
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:border-primary/50"
                        }`}
                      >
                        {value}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                    disabled={safePage >= totalPages}
                    className="rounded-md border border-border bg-background px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    NEXT
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {createdOrder && printKind && (
        <PrintDialog order={createdOrder} kind={printKind} onClose={() => setPrintKind(null)} />
      )}
      {viewOrderId && (
        <OrderHistoryDrawer
          order={(orders.find((order) => order.id === viewOrderId) || null) as Order | null}
          onClose={() => setViewOrderId(null)}
          onAdvance={advanceOrder}
          onPrint={(order, kind) => {
            setCreatedOrder(order);
            setPrintKind(kind);
          }}
        />
      )}
    </div>
  );

  return fullscreen ? createPortal(posUI, document.body) : posUI;
}

function BillLine({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className={accent ? "font-bold text-veg" : "text-muted-foreground"}>{label}</span>
      <span className={accent ? "font-bold text-veg" : ""}>{value}</span>
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur">
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

function OrderHistoryDrawer({
  order,
  onClose,
  onAdvance,
  onPrint,
}: {
  order: Order;
  onClose: () => void;
  onAdvance: (id: string, status: OrderStatus) => void;
  onPrint: (order: Order, kind: PrintKind) => void;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  if (!order) return null;

  const action = NEXT[order.status];
  const itemsLabel = order.items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <button
        type="button"
        aria-label="Close order details"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <aside className="relative flex h-full w-full max-w-lg flex-col border-l border-border bg-background shadow-2xl">
        <header className="border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl tracking-widest">#{order.id}</h2>
                <StatusPill status={order.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {new Date(order.createdAt).toLocaleString()} · {order.customer.name} ·{" "}
                <span className="uppercase">
                  {order.tableNumber ? `Table ${order.tableNumber}` : order.type}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface hover:bg-background"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => onPrint(order, "kot")}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 font-display text-[11px] tracking-widest hover:border-primary/50"
            >
              <Printer className="h-3.5 w-3.5" /> KOT
            </button>
            <button
              onClick={() => onPrint(order, "bill")}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 font-display text-[11px] tracking-widest hover:border-primary/50"
            >
              <ReceiptText className="h-3.5 w-3.5" /> BILL
            </button>
            {order.status === "received" && (
              <button
                onClick={() => onAdvance(order.id, "cancelled")}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-red-500/30 px-3 py-1.5 font-display text-[11px] tracking-widest text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> CANCEL
              </button>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <section className="space-y-3">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              Progress · {itemsLabel} items
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_STEPS.map((step, index) => {
                const currentIndex =
                  order.status === "cancelled"
                    ? -1
                    : STATUS_STEPS.findIndex((entry) => entry.key === order.status);
                const done =
                  order.status === "delivered" || (currentIndex >= index && currentIndex !== -1);
                return (
                  <span
                    key={step.key}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      done ? "bg-veg/10 text-veg" : "bg-surface text-muted-foreground"
                    } ${order.status === step.key ? "ring-1 ring-primary/40" : ""}`}
                  >
                    {step.label}
                  </span>
                );
              })}
            </div>
            {action ? (
              <button
                onClick={() => onAdvance(order.id, action.next)}
                className="min-h-10 w-full rounded-md bg-primary font-display text-sm tracking-widest text-primary-foreground hover:bg-primary-glow"
              >
                {action.label.toUpperCase()}
              </button>
            ) : (
              <div className="rounded-md bg-veg/10 px-4 py-3 text-center font-display text-sm tracking-widest text-veg">
                {order.status === "cancelled"
                  ? "ORDER CANCELLED"
                  : "Order completed — no further action"}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              Items
            </h3>
            <div className="divide-y divide-border rounded-lg border border-border bg-surface">
              {order.items.map((item, index) => (
                <div
                  key={`${item.id}-${index}`}
                  className="flex items-start justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-semibold">
                      <span className="text-primary">{item.qty}x</span> {item.name}
                    </span>
                    {item.addons?.length ? (
                      <div className="text-xs text-muted-foreground">
                        {item.addons.map((addon) => addon.name).join(", ")}
                      </div>
                    ) : null}
                    {item.instructions ? (
                      <p className="mt-1 text-xs italic text-muted-foreground">
                        {item.instructions}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 font-semibold">Rs {item.qty * item.price}</div>
                </div>
              ))}
              {order.items.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No items on this order.
                </div>
              )}
            </div>
            <div className="space-y-1 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
              <BillLine label="Subtotal" value={`Rs ${order.subtotal}`} />
              <BillLine label="Tax" value={`Rs ${order.tax}`} />
              <BillLine label="Delivery" value={`Rs ${order.deliveryFee}`} />
              <div className="mt-1 flex justify-between border-t border-border pt-2 font-display tracking-widest">
                <span className="font-bold">TOTAL</span>
                <span className="font-bold text-veg">Rs {order.total}</span>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              Customer
            </h3>
            <div className="space-y-1 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                {order.customer.name}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {order.customer.phone}
              </div>
              {order.customer.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{order.customer.address}</span>
                </div>
              )}
              {order.customer.notes && (
                <p className="pt-1 text-xs italic text-muted-foreground">{order.customer.notes}</p>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              Payment
            </h3>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
              <span className="font-black uppercase">{order.paymentMethod}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest ${
                  order.paymentStatus === "paid" || order.paymentMethod === "cod"
                    ? "bg-veg/10 text-veg"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                {order.paymentStatus}
              </span>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
