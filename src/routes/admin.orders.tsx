import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  ChefHat,
  Clock3,
  CreditCard,
  Filter,
  MapPin,
  PackageCheck,
  Phone,
  ReceiptText,
  Search,
  Truck,
  UserRound,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DeliveryMap } from "@/components/site/DeliveryMap";
import { useOrderRealtime } from "@/hooks/use-order-realtime";
import {
  listOrders,
  listStaff,
  updateOrderDelivery,
  updateOrderStatus,
  type Order,
  type OrderStatus,
  type StaffUser,
} from "@/services/api";
import { StatusPill } from "./admin.index";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrders,
});

type OrderTab = "active" | OrderStatus | "completed";

const ACTIVE_STATUSES: OrderStatus[] = [
  "received",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
];
const STATUS_STEPS: Array<{ key: OrderStatus; label: string; icon: React.ElementType }> = [
  { key: "received", label: "Received", icon: ReceiptText },
  { key: "accepted", label: "Accepted", icon: CheckCircle2 },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "ready", label: "Ready", icon: PackageCheck },
  { key: "out_for_delivery", label: "Out", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
];
const TABS: Array<{ key: OrderTab; label: string }> = [
  { key: "active", label: "All Active" },
  { key: "received", label: "Received" },
  { key: "accepted", label: "Accepted" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "out_for_delivery", label: "Out For Delivery" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];
const NEXT: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  received: { next: "accepted", label: "Accept" },
  accepted: { next: "preparing", label: "Start cooking" },
  preparing: { next: "ready", label: "Mark ready" },
  ready: { next: "out_for_delivery", label: "Out for delivery" },
  out_for_delivery: { next: "delivered", label: "Mark delivered" },
};

function AdminOrders() {
  useOrderRealtime();
  const qc = useQueryClient();
  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: listOrders,
    refetchInterval: 4000,
  });
  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: listStaff,
    refetchInterval: 10000,
  });
  const [tab, setTab] = useState<OrderTab>("active");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [riderFilter, setRiderFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");

  const today = new Date().toDateString();
  const summary = useMemo(() => {
    const active = orders.filter((order) => ACTIVE_STATUSES.includes(order.status));
    return {
      active: active.length,
      received: orders.filter((order) => order.status === "received").length,
      preparing: orders.filter((order) => ["accepted", "preparing"].includes(order.status)).length,
      ready: orders.filter((order) => order.status === "ready").length,
      delivery: orders.filter((order) => order.status === "out_for_delivery").length,
      delayed: active.filter((order) => isDelayed(order)).length,
      deliveredToday: orders.filter(
        (order) =>
          order.status === "delivered" &&
          new Date(order.updatedAt || order.createdAt).toDateString() === today,
      ).length,
    };
  }, [orders, today]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return orders
      .filter((order) => {
        if (tab === "active" && !ACTIVE_STATUSES.includes(order.status)) return false;
        if (tab === "completed" && order.status !== "delivered") return false;
        if (tab !== "active" && tab !== "completed" && order.status !== tab) return false;
        if (typeFilter && order.type !== typeFilter) return false;
        if (paymentFilter && order.paymentStatus !== paymentFilter) return false;
        if (
          riderFilter &&
          (order.delivery?.assignedRiderId || order.delivery?.partnerPhone || "") !== riderFilter
        )
          return false;
        if (dateFilter && new Date(order.createdAt).toISOString().slice(0, 10) !== dateFilter)
          return false;
        if (!text) return true;
        const haystack = [
          order.id,
          order.customer.name,
          order.customer.phone,
          order.customer.address,
          order.paymentStatus,
          order.type,
          order.delivery?.partnerName,
          order.delivery?.assignedRiderName,
          ...order.items.map((item) => item.name),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(text);
      })
      .sort((a, b) => orderSortScore(a) - orderSortScore(b));
  }, [orders, tab, query, typeFilter, paymentFilter, riderFilter, dateFilter]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId("");
      return;
    }
    if (!selectedId || !filtered.some((order) => order.id === selectedId))
      setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const selected = filtered.find((order) => order.id === selectedId) || filtered[0];
  const riders = staff.filter((member) => member.role === "DELIVERY");

  async function advance(id: string, status: OrderStatus) {
    try {
      await updateOrderStatus(id, status);
      await qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Order ${id} -> ${status.replace(/_/g, " ")}`);
    } catch {
      toast.error("Couldn't update order");
    }
  }

  return (
    <main className="px-4 py-6 md:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-primary">
            <ClipboardIcon /> Live order control
          </div>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">Orders & Tracking</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Complete kitchen, billing and delivery visibility with realtime order status updates.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          <SummaryTile label="Active" value={summary.active} />
          <SummaryTile label="Received" value={summary.received} />
          <SummaryTile label="Kitchen" value={summary.preparing} />
          <SummaryTile label="Ready" value={summary.ready} />
          <SummaryTile label="Delivery" value={summary.delivery} />
          <SummaryTile
            label="Delayed"
            value={summary.delayed}
            tone={summary.delayed ? "red" : "green"}
          />
          <SummaryTile label="Done today" value={summary.deliveredToday} tone="green" />
        </div>
      </header>

      <section className="rounded-[26px] border border-border bg-surface p-4 shadow-sm">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`min-h-11 shrink-0 rounded-2xl px-4 text-sm font-black transition ${tab === item.key ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.9fr_0.9fr]">
          <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-background px-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ID, customer, phone, item..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
          <FilterSelect
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              ["", "All types"],
              ["delivery", "Delivery"],
              ["pickup", "Pickup"],
              ["dinein", "Dine in"],
            ]}
          />
          <FilterSelect
            value={paymentFilter}
            onChange={setPaymentFilter}
            options={[
              ["", "All payments"],
              ["paid", "Paid"],
              ["pending", "Pending"],
              ["failed", "Failed"],
              ["refunded", "Refunded"],
            ]}
          />
          <FilterSelect
            value={riderFilter}
            onChange={setRiderFilter}
            options={[["", "All riders"], ...riderOptions(riders)]}
          />
          <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-background px-3 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
          </label>
        </div>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(520px,1.08fr)]">
        <div className="space-y-4">
          <QueueBoard orders={filtered} selectedId={selected?.id} onSelect={setSelectedId} />
        </div>
        <div className="xl:sticky xl:top-28 xl:self-start">
          {selected ? (
            <OrderDetail order={selected} orders={orders} staff={staff} onAdvance={advance} />
          ) : (
            <div className="rounded-[26px] border border-dashed border-border bg-surface p-12 text-center">
              <p className="text-xl font-black text-muted-foreground">No orders match this view</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Change the tab or filters to see restaurant orders.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function QueueBoard({
  orders,
  selectedId,
  onSelect,
}: {
  orders: Order[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  if (!orders.length)
    return (
      <div className="rounded-[26px] border border-dashed border-border bg-surface p-12 text-center text-muted-foreground">
        No orders in this queue.
      </div>
    );
  const activeCount = orders.filter((order) => ACTIVE_STATUSES.includes(order.status)).length;
  const columnMode = activeCount >= 3 && orders.length <= 30;
  if (!columnMode) {
    return (
      <div className="grid gap-3">
        {orders.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            active={order.id === selectedId}
            onClick={() => onSelect(order.id)}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
      {ACTIVE_STATUSES.map((status) => {
        const group = orders.filter((order) => order.status === status);
        if (!group.length) return null;
        return (
          <section key={status} className="rounded-[24px] border border-border bg-surface p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                {status.replace(/_/g, " ")}
              </h2>
              <span className="rounded-full bg-background px-2 py-1 text-xs font-black">
                {group.length}
              </span>
            </div>
            <div className="space-y-3">
              {group.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  active={order.id === selectedId}
                  onClick={() => onSelect(order.id)}
                  compact
                />
              ))}
            </div>
          </section>
        );
      })}
      {orders
        .filter((order) => !ACTIVE_STATUSES.includes(order.status))
        .map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            active={order.id === selectedId}
            onClick={() => onSelect(order.id)}
          />
        ))}
    </div>
  );
}

function OrderRow({
  order,
  active,
  compact = false,
  onClick,
}: {
  order: Order;
  active: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  const delayed = isDelayed(order);
  const paymentRisk = order.paymentStatus !== "paid" && order.paymentMethod !== "cod";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[22px] border p-4 text-left transition ${active ? "border-primary bg-primary/10 shadow-lg shadow-primary/10" : "border-border bg-surface hover:border-primary/50"} ${delayed ? "ring-1 ring-red-500/40" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl font-black text-primary">#{order.id}</span>
            <StatusPill status={order.status} />
          </div>
          <div className="mt-1 truncate text-sm font-semibold">
            {order.customer.name || "Customer"} · {order.type.toUpperCase()}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatTime(order.createdAt)} · {minutesSince(order.createdAt)} min ago
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-black">{money(order.total)}</div>
          <PaymentBadge status={order.paymentStatus} method={order.paymentMethod} />
        </div>
      </div>
      {!compact && (
        <div className="mt-3 truncate text-sm text-muted-foreground">
          {order.items.map((item) => `${item.qty}x ${item.name}`).join(", ")}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {delayed && <WarningPill label="Delayed" tone="red" />}
        {paymentRisk && <WarningPill label="Payment check" tone="amber" />}
        {order.delivery?.assignedRiderName && (
          <WarningPill label={order.delivery.assignedRiderName} tone="green" />
        )}
        {order.delivery?.etaMinutes && (
          <WarningPill label={`${order.delivery.etaMinutes} min ETA`} tone="blue" />
        )}
      </div>
    </button>
  );
}

function OrderDetail({
  order,
  orders,
  staff,
  onAdvance,
}: {
  order: Order;
  orders: Order[];
  staff: StaffUser[];
  onAdvance: (id: string, status: OrderStatus) => void;
}) {
  const action = NEXT[order.status];
  const isDelivery = order.type === "delivery";
  return (
    <article className="overflow-hidden rounded-[28px] border border-border bg-surface shadow-2xl">
      <header className="border-b border-border bg-background/60 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-3xl font-black text-primary">#{order.id}</h2>
              <StatusPill status={order.status} />
              {isDelayed(order) && <WarningPill label="Delayed" tone="red" />}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatDate(order.createdAt)} · {minutesSince(order.createdAt)} minutes elapsed ·{" "}
              {order.type.toUpperCase()}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-3xl font-black">{money(order.total)}</div>
            <PaymentBadge status={order.paymentStatus} method={order.paymentMethod} />
          </div>
        </div>
        <ActionBar order={order} action={action} onAdvance={onAdvance} />
      </header>

      <div className="grid gap-5 p-5 2xl:grid-cols-[1fr_0.92fr]">
        <div className="space-y-5">
          <Panel title="Order Status Journey">
            <StatusTimeline order={order} />
          </Panel>

          <Panel title="Items & Bill">
            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div
                  key={`${item.id}-${index}`}
                  className="rounded-2xl border border-border bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-black">
                        <span className="text-primary">{item.qty}x</span> {item.name}
                      </div>
                      {item.size && (
                        <div className="mt-1 text-xs text-muted-foreground">Size: {item.size}</div>
                      )}
                      {item.addons?.length ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Add-ons: {item.addons.map((a) => a.name).join(", ")}
                        </div>
                      ) : null}
                      {item.variants?.length ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Variants: {item.variants.map((v) => `${v.group}: ${v.option}`).join(", ")}
                        </div>
                      ) : null}
                      {item.instructions && (
                        <div className="mt-2 rounded-xl bg-accent/10 px-3 py-2 text-xs text-accent">
                          {item.instructions}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 font-black">{money(item.qty * item.price)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2 rounded-2xl bg-background p-4 text-sm">
              <BillRow label="Subtotal" value={order.subtotal} />
              <BillRow label="Tax" value={order.tax} />
              <BillRow label="Delivery" value={order.deliveryFee} />
              <div className="flex justify-between border-t border-border pt-3 text-lg font-black">
                <span>Total</span>
                <span>{money(order.total)}</span>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Customer & Payment">
            <InfoGrid
              items={[
                { icon: UserRound, label: "Customer", value: order.customer.name || "Customer" },
                { icon: Phone, label: "Phone", value: order.customer.phone || "Not provided" },
                {
                  icon: CreditCard,
                  label: "Payment",
                  value: `${order.paymentMethod.toUpperCase()} · ${order.paymentStatus.toUpperCase()}`,
                },
                {
                  icon: MapPin,
                  label: "Address",
                  value:
                    order.customer.address ||
                    order.delivery?.destinationText ||
                    (order.type === "dinein"
                      ? `Table ${order.tableNumber || "--"}`
                      : "Not required"),
                },
              ]}
            />
            {(order.customer.landmark || order.customer.notes) && (
              <div className="mt-4 rounded-2xl bg-background p-4 text-sm text-muted-foreground">
                {order.customer.landmark && (
                  <p>
                    <b className="text-foreground">Landmark:</b> {order.customer.landmark}
                  </p>
                )}
                {order.customer.notes && (
                  <p className="mt-1">
                    <b className="text-foreground">Notes:</b> {order.customer.notes}
                  </p>
                )}
              </div>
            )}
          </Panel>

          {isDelivery && (
            <>
              <Panel title="Delivery Tracking">
                <DeliveryTimeline order={order} />
                <DeliveryStats order={order} />
                {["ready", "out_for_delivery", "delivered"].includes(order.status) && (
                  <div className="mt-4">
                    <DeliveryMap order={order} compact />
                    <ManualLocationEditor order={order} />
                  </div>
                )}
              </Panel>
              {["ready", "out_for_delivery"].includes(order.status) && (
                <DeliveryPartnerAssigner order={order} orders={orders} staff={staff} />
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function ActionBar({
  order,
  action,
  onAdvance,
}: {
  order: Order;
  action?: { next: OrderStatus; label: string };
  onAdvance: (id: string, status: OrderStatus) => void;
}) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {order.status === "received" && (
        <button
          onClick={() => onAdvance(order.id, "cancelled")}
          className="min-h-11 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 text-sm font-black text-destructive hover:bg-destructive/20"
        >
          Cancel
        </button>
      )}
      {action ? (
        <button
          onClick={() => onAdvance(order.id, action.next)}
          className="min-h-11 rounded-2xl bg-primary px-5 text-sm font-black text-primary-foreground hover:bg-primary-glow"
        >
          {action.label}
        </button>
      ) : (
        <span className="inline-flex min-h-11 items-center rounded-2xl bg-veg/10 px-4 text-sm font-black text-veg">
          Completed
        </span>
      )}
    </div>
  );
}

function StatusTimeline({ order }: { order: Order }) {
  const currentIndex =
    order.status === "cancelled" ? -1 : STATUS_STEPS.findIndex((step) => step.key === order.status);
  return (
    <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {STATUS_STEPS.map((step, index) => {
        const done = order.status === "delivered" || (currentIndex >= index && currentIndex !== -1);
        const active = order.status === step.key;
        return (
          <div
            key={step.key}
            className={`rounded-2xl border p-3 ${done ? "border-veg/30 bg-veg/10" : "border-border bg-background"} ${active ? "ring-2 ring-primary/40" : ""}`}
          >
            <step.icon className={`h-5 w-5 ${done ? "text-veg" : "text-muted-foreground"}`} />
            <div className="mt-2 text-xs font-black uppercase tracking-widest">{step.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function DeliveryTimeline({ order }: { order: Order }) {
  const stages = [
    {
      key: "assigned",
      label: "Assigned",
      done: Boolean(order.delivery?.assignedRiderId || order.delivery?.partnerName),
    },
    {
      key: "picked",
      label: "Picked up",
      done: Boolean(order.delivery?.pickedUpAt || order.delivery?.pickupVerifiedAt),
    },
    { key: "out", label: "Out", done: ["out_for_delivery", "delivered"].includes(order.status) },
    {
      key: "nearby",
      label: "Nearby",
      done: ["nearby", "almost_there", "outside", "delivered"].includes(
        order.delivery?.deliveryStage || "",
      ),
    },
    { key: "delivered", label: "Delivered", done: order.status === "delivered" },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {stages.map((stage) => (
        <div
          key={stage.key}
          className={`rounded-2xl border p-3 ${stage.done ? "border-blue-400/30 bg-blue-400/10 text-blue-200" : "border-border bg-background text-muted-foreground"}`}
        >
          <div className="text-xs font-black uppercase tracking-widest">{stage.label}</div>
        </div>
      ))}
    </div>
  );
}

function DeliveryStats({ order }: { order: Order }) {
  const d = order.delivery || {};
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <SmallInfo label="Partner" value={d.partnerName || d.assignedRiderName || "Not assigned"} />
      <SmallInfo label="Phone" value={d.partnerPhone || "Not available"} />
      <SmallInfo label="Stage" value={(d.deliveryStage || order.status).replace(/_/g, " ")} />
      <SmallInfo label="ETA" value={d.etaMinutes ? `${d.etaMinutes} min` : "Updating"} />
      <SmallInfo
        label="Distance"
        value={
          d.distanceKm
            ? `${d.distanceKm} km`
            : `${Math.round(Number(d.routeProgress || 0) * 100)}% progress`
        }
      />
      <SmallInfo
        label="GPS"
        value={
          d.lastLocationAt || d.currentLocation?.updatedAt
            ? `Updated ${new Date(d.lastLocationAt || d.currentLocation?.updatedAt || "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "Waiting"
        }
      />
      <SmallInfo label="Pickup PIN" value={d.pickupPin || "Not generated"} />
      <SmallInfo label="Delivery OTP" value={d.deliveryOtp || "Not generated"} />
    </div>
  );
}

function ManualLocationEditor({ order }: { order: Order }) {
  const qc = useQueryClient();
  const [lat, setLat] = useState(order.delivery?.currentLocation?.lat.toString() ?? "");
  const [lng, setLng] = useState(order.delivery?.currentLocation?.lng.toString() ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLat(order.delivery?.currentLocation?.lat.toString() ?? "");
    setLng(order.delivery?.currentLocation?.lng.toString() ?? "");
  }, [order.id, order.delivery?.currentLocation?.lat, order.delivery?.currentLocation?.lng]);

  async function save() {
    const nextLat = Number(lat);
    const nextLng = Number(lng);
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng))
      return toast.error("Enter valid latitude and longitude");
    setSaving(true);
    try {
      await updateOrderDelivery(order.id, {
        currentLocation: {
          lat: nextLat,
          lng: nextLng,
          label: "Admin location update",
          updatedAt: new Date().toISOString(),
        },
        lastLocationAt: new Date().toISOString(),
      });
      await qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Delivery location updated");
    } catch {
      toast.error("Couldn't update location");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <input
        value={lat}
        onChange={(event) => setLat(event.target.value)}
        placeholder="Latitude"
        inputMode="decimal"
        className="min-h-11 rounded-2xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
      />
      <input
        value={lng}
        onChange={(event) => setLng(event.target.value)}
        placeholder="Longitude"
        inputMode="decimal"
        className="min-h-11 rounded-2xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
      />
      <button
        disabled={saving}
        onClick={save}
        className="min-h-11 rounded-2xl border border-border px-4 text-sm font-black text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        Update GPS
      </button>
    </div>
  );
}

function DeliveryPartnerAssigner({
  order,
  orders,
  staff,
}: {
  order: Order;
  orders: Order[];
  staff: StaffUser[];
}) {
  const qc = useQueryClient();
  const riders = staff.filter((member) => member.role === "DELIVERY");
  const assignedId = order.delivery?.assignedRiderId || "";
  const [riderId, setRiderId] = useState(assignedId);
  const [saving, setSaving] = useState(false);
  const selectedRider = riders.find((rider) => rider.id === riderId);

  useEffect(() => setRiderId(assignedId), [assignedId, order.id]);

  async function assign() {
    if (!selectedRider) return toast.error("Select a delivery partner");
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const alreadyPicked = order.status === "out_for_delivery";
      await updateOrderDelivery(order.id, {
        assignedRiderId: selectedRider.id,
        assignedRiderName: selectedRider.name,
        partnerName: selectedRider.name,
        partnerPhone: selectedRider.phone,
        pickupPin: order.delivery?.pickupPin || generateCode(),
        deliveryOtp: order.delivery?.deliveryOtp || generateCode(),
        deliveryStage: alreadyPicked ? "on_the_way" : "heading_to_restaurant",
        reservedBy: selectedRider.id,
        reservedByName: selectedRider.name,
        reservedAt: order.delivery?.reservedAt || now,
        reserveExpiresAt: null,
        pickedUpAt: alreadyPicked ? order.delivery?.pickedUpAt || now : order.delivery?.pickedUpAt,
        pickupVerifiedAt: alreadyPicked
          ? order.delivery?.pickupVerifiedAt || now
          : order.delivery?.pickupVerifiedAt,
        routeProgress: Math.max(
          Number(order.delivery?.routeProgress || 0),
          alreadyPicked ? 0.35 : 0.12,
        ),
        trackingPaused: false,
      });
      await qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Assigned to ${selectedRider.name}`);
    } catch {
      toast.error("Couldn't assign delivery partner");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Delivery Partner">
      <div className="grid gap-3">
        <select
          value={riderId}
          onChange={(event) => setRiderId(event.target.value)}
          className="min-h-12 rounded-2xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
        >
          <option value="">Select online / active rider</option>
          {riders
            .slice()
            .sort((a, b) => riderRank(a, orders) - riderRank(b, orders))
            .map((rider) => {
              const status = riderStatus(rider, orders);
              return (
                <option key={rider.id} value={rider.id}>
                  {rider.name} - {rider.phone} - {status.label}
                </option>
              );
            })}
        </select>
        <button
          disabled={saving || !riderId}
          onClick={assign}
          className="min-h-12 rounded-2xl bg-primary px-4 text-sm font-black text-primary-foreground hover:bg-primary-glow disabled:opacity-50"
        >
          Assign delivery partner
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {riders.slice(0, 8).map((rider) => {
          const status = riderStatus(rider, orders);
          return (
            <button
              key={rider.id}
              type="button"
              onClick={() => setRiderId(rider.id)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-black uppercase ${status.className}`}
            >
              {rider.name}: {status.label}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] border border-border bg-surface p-4">
      <h3 className="mb-4 text-lg font-black">{title}</h3>
      {children}
    </section>
  );
}

function SummaryTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "red" | "green";
}) {
  const toneClass =
    tone === "red" ? "text-red-300" : tone === "green" ? "text-veg" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
      <div className={`text-2xl font-black ${toneClass}`}>{value}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-12 rounded-2xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
    >
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}

function InfoGrid({
  items,
}: {
  items: Array<{ icon: React.ElementType; label: string; value: string }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <SmallInfo key={item.label} icon={item.icon} label={item.label} value={item.value} />
      ))}
    </div>
  );
}

function SmallInfo({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-background p-4">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
        {Icon && <Icon className="h-4 w-4 text-primary" />} {label}
      </div>
      <div className="mt-2 break-words text-sm font-bold capitalize">{value}</div>
    </div>
  );
}

function BillRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span>{money(value)}</span>
    </div>
  );
}

function PaymentBadge({ status, method }: { status: string; method: string }) {
  const good = status === "paid" || method === "cod";
  return (
    <span
      className={`mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${good ? "bg-veg/10 text-veg" : "bg-red-500/10 text-red-300"}`}
    >
      {method} · {status}
    </span>
  );
}

function WarningPill({ label, tone }: { label: string; tone: "red" | "amber" | "green" | "blue" }) {
  const map = {
    red: "bg-red-500/10 text-red-300",
    amber: "bg-accent/10 text-accent",
    green: "bg-veg/10 text-veg",
    blue: "bg-blue-400/10 text-blue-200",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${map[tone]}`}
    >
      {label}
    </span>
  );
}

function ClipboardIcon() {
  return <ReceiptText className="h-3.5 w-3.5" />;
}

function riderOptions(riders: StaffUser[]) {
  return riders.flatMap((rider) => {
    const values = [[rider.id, rider.name]];
    if (rider.phone) values.push([rider.phone, `${rider.name} phone`]);
    return values;
  });
}

function riderStatus(rider: StaffUser, orders: Order[]) {
  const active = orders.find(
    (order) =>
      order.delivery?.assignedRiderId === rider.id &&
      !["delivered", "cancelled"].includes(order.status),
  );
  if (active)
    return {
      label: `Online ${active.status.replace(/_/g, " ")}`,
      className: "border-veg/30 bg-veg/10 text-veg",
    };
  const lastTracked = orders
    .filter(
      (order) =>
        order.delivery?.assignedRiderId === rider.id ||
        order.delivery?.partnerPhone === rider.phone,
    )
    .map((order) => order.delivery?.lastLocationAt || order.delivery?.currentLocation?.updatedAt)
    .filter(Boolean)
    .map((value) => new Date(String(value)).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  if (lastTracked && Date.now() - lastTracked < 15 * 60 * 1000)
    return { label: "Recently online", className: "border-accent/30 bg-accent/10 text-accent" };
  return { label: "Available", className: "border-border bg-background text-muted-foreground" };
}

function riderRank(rider: StaffUser, orders: Order[]) {
  const status = riderStatus(rider, orders).label;
  if (status.startsWith("Online")) return 0;
  if (status === "Recently online") return 1;
  return 2;
}

function orderSortScore(order: Order) {
  const statusWeight: Record<string, number> = {
    received: 0,
    accepted: 1,
    preparing: 2,
    ready: 3,
    out_for_delivery: 4,
    delivered: 5,
    cancelled: 6,
  };
  return (statusWeight[order.status] ?? 9) * 10000000000000 - new Date(order.createdAt).getTime();
}

function isDelayed(order: Order) {
  return ACTIVE_STATUSES.includes(order.status) && minutesSince(order.createdAt) > 30;
}

function minutesSince(date: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
}

function formatTime(date: string) {
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(date),
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function money(value: number) {
  return `Rs ${Math.round(value || 0).toLocaleString("en-IN")}`;
}

function generateCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}
