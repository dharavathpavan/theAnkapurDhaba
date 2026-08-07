import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CreditCard,
  Filter,
  ListOrdered,
  MapPin,
  PackageCheck,
  Phone,
  ReceiptText,
  Search,
  Truck,
  UserRound,
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

type DatePreset = "today" | "yesterday" | "week" | "month" | "custom";

const ACTIVE_STATUSES: OrderStatus[] = [
  "received",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
];

const BOARD_COLUMNS: Array<{ key: OrderStatus; label: string; accent: string }> = [
  { key: "received", label: "Received", accent: "border-t-red-500" },
  { key: "accepted", label: "Accepted", accent: "border-t-amber-500" },
  { key: "preparing", label: "Preparing", accent: "border-t-orange-500" },
  { key: "ready", label: "Ready", accent: "border-t-yellow-400" },
  { key: "out_for_delivery", label: "Out for Delivery", accent: "border-t-blue-400" },
];

const STATUS_STEPS: Array<{ key: OrderStatus; label: string; icon: React.ElementType }> = [
  { key: "received", label: "Received", icon: ReceiptText },
  { key: "accepted", label: "Accepted", icon: CheckCircle2 },
  { key: "preparing", label: "Preparing", icon: PackageCheck },
  { key: "ready", label: "Ready", icon: PackageCheck },
  { key: "out_for_delivery", label: "Out", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
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

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [riderFilter, setRiderFilter] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [dateFilter, setDateFilter] = useState("");
  const [view, setView] = useState<"board" | "delivery">("board");
  const [selectedId, setSelectedId] = useState<string>("");

  const today = new Date().toDateString();
  const riders = staff.filter((member) => member.role === "DELIVERY");

  const summary = useMemo(() => {
    const active = orders.filter((order) => ACTIVE_STATUSES.includes(order.status));
    return {
      active: active.length,
      received: orders.filter((order) => order.status === "received").length,
      kitchen: orders.filter((order) => ["accepted", "preparing"].includes(order.status)).length,
      ready: orders.filter((order) => order.status === "ready").length,
      delivery: orders.filter((order) => order.status === "out_for_delivery").length,
      delayed: active.filter((order) => minutesSince(order.createdAt) > 30).length,
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
        if (typeFilter && order.type !== typeFilter) return false;
        if (paymentFilter && order.paymentStatus !== paymentFilter) return false;
        if (
          riderFilter &&
          (order.delivery?.assignedRiderId || order.delivery?.partnerPhone || "") !== riderFilter
        )
          return false;
        if (!matchesDatePreset(order.createdAt, datePreset, dateFilter)) return false;
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
  }, [orders, query, typeFilter, paymentFilter, riderFilter, datePreset, dateFilter]);

  useEffect(() => {
    if (filtered.some((order) => order.id === selectedId)) return;
    setSelectedId(filtered[0]?.id || "");
  }, [filtered, selectedId]);

  const selected = filtered.find((order) => order.id === selectedId) || filtered[0];

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
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-primary">
            <ListOrdered className="h-3.5 w-3.5" /> Live order control
          </div>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">Orders & Tracking</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Kanban dispatch board with realtime kitchen, billing and delivery visibility.
          </p>
        </div>
        <div className="flex gap-2">
          <ViewToggle active={view === "board"} onClick={() => setView("board")} label="Board" />
          <ViewToggle
            active={view === "delivery"}
            onClick={() => setView("delivery")}
            label="Delivery Dispatch"
          />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        <SummaryTile label="Active" value={summary.active} />
        <SummaryTile label="Received" value={summary.received} />
        <SummaryTile label="Kitchen" value={summary.kitchen} />
        <SummaryTile label="Ready" value={summary.ready} />
        <SummaryTile label="Delivery" value={summary.delivery} />
        <SummaryTile
          label="Delayed"
          value={summary.delayed}
          tone={summary.delayed ? "red" : "green"}
        />
        <SummaryTile label="Done today" value={summary.deliveredToday} tone="green" />
      </section>

      <section className="mt-6 rounded-[26px] border border-border bg-surface p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.9fr_0.9fr]">
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
              disabled={datePreset !== "custom"}
              onChange={(event) => setDateFilter(event.target.value)}
              className="min-w-0 flex-1 bg-transparent outline-none disabled:opacity-50"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["today", "yesterday", "week", "month", "custom"] as DatePreset[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setDatePreset(item)}
              className={`min-h-9 shrink-0 rounded-2xl px-4 text-xs font-black uppercase tracking-widest transition ${
                datePreset === item
                  ? "bg-red-600 text-white"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {item === "week" ? "This Week" : item === "month" ? "This Month" : item}
            </button>
          ))}
        </div>
      </section>

      {view === "board" ? (
        <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(500px,1.08fr)]">
          <OrderBoard
            orders={filtered}
            selectedId={selected?.id}
            onSelect={setSelectedId}
            onAdvance={async (order, rider) => {
              await assignRider(order, rider);
              await qc.invalidateQueries({ queryKey: ["orders"] });
            }}
            riders={riders}
          />
          <div className="xl:sticky xl:top-24 xl:self-start">
            {selected ? (
              <OrderDetail
                order={selected}
                orders={orders}
                staff={staff}
                riders={riders}
                onAdvance={advance}
              />
            ) : (
              <div className="rounded-[26px] border border-dashed border-border bg-surface p-12 text-center">
                <p className="text-xl font-black text-muted-foreground">No orders match this view</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Adjust the search, filters or date to see orders.
                </p>
              </div>
            )}
          </div>
        </section>
      ) : (
        <DeliveryDispatchBoard
          orders={orders}
          riders={riders}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdvance={advance}
        />
      )}
    </main>
  );
}

function ViewToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-12 shrink-0 rounded-2xl px-5 text-sm font-black transition ${
        active ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

/* ---------------------------------- Board ---------------------------------- */

function OrderBoard({
  orders,
  selectedId,
  onSelect,
  onAdvance,
  riders,
}: {
  orders: Order[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onAdvance: (order: Order, rider: StaffUser) => Promise<void>;
  riders: StaffUser[];
}) {
  return (
    <div className="overflow-x-auto rounded-[26px] border border-border bg-surface p-3 shadow-sm">
      <div className="flex min-w-max gap-3">
        {BOARD_COLUMNS.map((column) => {
          const group = orders.filter((order) => order.status === column.key);
          return (
            <section
              key={column.key}
              className={`w-[286px] shrink-0 rounded-2xl border border-t-4 ${column.accent} bg-black/20 p-3`}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                  {column.label}
                </h2>
                <span className="rounded-full bg-background px-2.5 py-1 text-xs font-black">
                  {group.length}
                </span>
              </div>
              <div className="space-y-3">
                {group.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    active={order.id === selectedId}
                    onSelect={() => onSelect(order.id)}
                    onAssign={(target, riderId) => {
                      const rider = riders.find((r) => r.id === riderId);
                      if (rider) return onAdvance(target, rider);
                      return Promise.resolve();
                    }}
                    riders={riders}
                  />
                ))}
                {!group.length && (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    Empty
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  active,
  onSelect,
  onAssign,
  riders,
}: {
  order: Order;
  active: boolean;
  onSelect: () => void;
  onAssign: (order: Order, riderId: string) => Promise<void>;
  riders: StaffUser[];
}) {
  const delayed = isDelayed(order);
  const paymentRisk = order.paymentStatus !== "paid" && order.paymentMethod !== "cod";
  const isDelivery = order.type === "delivery";
  const canAssign = isDelivery && ["ready", "out_for_delivery"].includes(order.status);
  return (
    <div
      className={`rounded-[20px] border p-4 transition ${
        active
          ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
          : "border-border bg-surface hover:border-primary/50"
      } ${delayed ? "ring-1 ring-red-500/40" : ""}`}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-black text-primary">#{order.id}</span>
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
            <div className="text-lg font-black">{money(order.total)}</div>
            <PaymentBadge status={order.paymentStatus} method={order.paymentMethod} />
          </div>
        </div>
        <div className="mt-2 truncate text-xs text-muted-foreground">
          {order.items.map((item) => `${item.qty}x ${item.name}`).join(", ")}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {delayed && <WarningPill label="Delayed" tone="red" />}
          {paymentRisk && <WarningPill label="Payment check" tone="amber" />}
          {order.delivery?.assignedRiderName ? (
            <WarningPill label={order.delivery.assignedRiderName} tone="green" />
          ) : isDelivery ? (
            <WarningPill label="Unassigned" tone="amber" />
          ) : null}
          {order.delivery?.etaMinutes ? (
            <WarningPill label={`${order.delivery.etaMinutes} min ETA`} tone="blue" />
          ) : null}
        </div>
      </button>
      {canAssign && (
        <div className="mt-3 border-t border-border pt-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Assign rider
          </label>
          <select
            value=""
            onChange={(event) => {
              if (event.target.value) void onAssign(order, event.target.value);
            }}
            className="mt-1 min-h-10 w-full rounded-xl border border-border bg-background px-2 text-xs outline-none"
          >
            <option value="">Select rider...</option>
            {riders
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((rider) => (
                <option key={rider.id} value={rider.id}>
                  {rider.name}
                </option>
              ))}
          </select>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Detail panel ------------------------------ */

function OrderDetail({
  order,
  orders,
  staff,
  riders,
  onAdvance,
}: {
  order: Order;
  orders: Order[];
  staff: StaffUser[];
  riders: StaffUser[];
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
                <DeliveryAssigner order={order} orders={orders} riders={riders} />
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------ Delivery assign ---------------------------- */

function assignRider(order: Order, rider: StaffUser) {
  const now = new Date().toISOString();
  const alreadyPicked = order.status === "out_for_delivery";
  return updateOrderDelivery(order.id, {
    assignedRiderId: rider.id,
    assignedRiderName: rider.name,
    partnerName: rider.name,
    partnerPhone: rider.phone,
    pickupPin: order.delivery?.pickupPin || generateCode(),
    deliveryOtp: order.delivery?.deliveryOtp || generateCode(),
    deliveryStage: alreadyPicked ? "on_the_way" : "heading_to_restaurant",
    reservedBy: rider.id,
    reservedByName: rider.name,
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
}

function DeliveryAssigner({
  order,
  orders,
  riders,
}: {
  order: Order;
  orders: Order[];
  riders: StaffUser[];
}) {
  const qc = useQueryClient();
  const assignedId = order.delivery?.assignedRiderId || "";
  const [riderId, setRiderId] = useState(assignedId);
  const [saving, setSaving] = useState(false);

  useEffect(() => setRiderId(assignedId), [assignedId, order.id]);

  async function assign() {
    const rider = riders.find((r) => r.id === riderId);
    if (!rider) return toast.error("Select a delivery partner");
    setSaving(true);
    try {
      await assignRider(order, rider);
      await qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Assigned to ${rider.name}`);
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
          <option value="">Select rider</option>
          {riders
            .slice()
            .sort((a, b) => riderLoad(a, orders) - riderLoad(b, orders))
            .map((rider) => {
              const status = riderStatus(rider, orders);
              const load = riderLoad(rider, orders);
              return (
                <option key={rider.id} value={rider.id}>
                  {rider.name} — {status.label} · {load} active
                </option>
              );
            })}
        </select>
        <button
          disabled={saving || !riderId}
          onClick={assign}
          className="min-h-12 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground hover:bg-primary-glow disabled:opacity-50"
        >
          {saving ? "Assigning..." : "Assign delivery partner"}
        </button>
      </div>
      <div className="mt-3 grid gap-2">
        {riders.slice(0, 8).map((rider) => {
          const status = riderStatus(rider, orders);
          const load = riderLoad(rider, orders);
          return (
            <button
              key={rider.id}
              type="button"
              onClick={() => setRiderId(rider.id)}
              className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5 text-left"
            >
              <div>
                <div className="text-sm font-black">{rider.name}</div>
                <div className="text-[11px] text-muted-foreground">{status.label}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-veg/10 px-2 py-0.5 text-[10px] font-black text-veg">
                  {load} active
                </span>
                <span className={`h-2 w-2 rounded-full ${status.dot}`} />
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

/* ----------------------------- Delivery dispatch ---------------------------- */

function DeliveryDispatchBoard({
  orders,
  riders,
  selectedId,
  onSelect,
  onAdvance,
}: {
  orders: Order[];
  riders: StaffUser[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onAdvance: (id: string, status: OrderStatus) => void;
}) {
  const qc = useQueryClient();
  const deliveryOrders = orders.filter((order) => order.type === "delivery");
  const unassigned = deliveryOrders
    .filter(
      (order) =>
        !order.delivery?.assignedRiderId &&
        ["received", "accepted", "preparing", "ready", "out_for_delivery"].includes(order.status),
    )
    .sort((a, b) => orderSortScore(a) - orderSortScore(b));

  return (
    <section className="mt-6 space-y-5">
      <Panel title="Riders & Load">
        {!riders.length ? (
          <p className="text-sm text-muted-foreground">No DELIVERY staff configured yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {riders.map((rider) => {
              const active = orders.filter(
                (order) =>
                  order.delivery?.assignedRiderId === rider.id &&
                  !["delivered", "cancelled"].includes(order.status),
              );
              const status = riderStatus(rider, orders);
              return (
                <div key={rider.id} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-black">{rider.name}</div>
                      <div className="text-xs text-muted-foreground">{rider.phone}</div>
                    </div>
                    <span className="rounded-full bg-veg/10 px-2.5 py-1 text-xs font-black text-veg">
                      {active.length} active
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                    {status.label}
                  </div>
                  <div className="mt-3 space-y-2">
                    {active.length ? (
                      active.map((order) => (
                        <div
                          key={order.id}
                          className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                            order.id === selectedId ? "border-primary bg-primary/10" : "border-border bg-background"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onSelect(order.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="truncate text-sm font-black">#{order.id}</div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {(order.delivery?.deliveryStage || order.status).replace(/_/g, " ")}
                            </div>
                          </button>
                          {order.status === "out_for_delivery" && (
                            <button
                              type="button"
                              onClick={() => onAdvance(order.id, "delivered")}
                              className="min-h-8 shrink-0 rounded-lg bg-veg px-3 text-xs font-black text-white"
                            >
                              Delivered
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                        No active deliveries
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Unassigned Delivery Orders">
        {!unassigned.length ? (
          <p className="text-sm text-muted-foreground">No unassigned delivery orders.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {unassigned.map((order) => (
              <div key={order.id} className="rounded-2xl border border-border bg-background p-4">
                <button type="button" onClick={() => onSelect(order.id)} className="w-full text-left">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-primary">#{order.id}</span>
                    <StatusPill status={order.status} />
                  </div>
                  <div className="mt-1 text-sm font-semibold">{order.customer.name || "Customer"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {order.customer.address || order.delivery?.destinationText}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {order.items.length} items · {money(order.total)}
                  </div>
                </button>
                <RiderAssignInline
                  order={order}
                  riders={riders}
                  orders={orders}
                  onAssigned={() => qc.invalidateQueries({ queryKey: ["orders"] })}
                />
              </div>
            ))}
          </div>
        )}
      </Panel>
    </section>
  );
}

function RiderAssignInline({
  order,
  riders,
  orders,
  onAssigned,
}: {
  order: Order;
  riders: StaffUser[];
  orders: Order[];
  onAssigned: () => void;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <select
      value=""
      disabled={saving}
      onChange={(event) => {
        const rider = riders.find((r) => r.id === event.target.value);
        if (!rider || !event.target.value) return;
        setSaving(true);
        assignRider(order, rider)
          .then(() => {
            toast.success(`Assigned to ${rider.name}`);
            onAssigned();
          })
          .catch(() => toast.error("Couldn't assign rider"))
          .finally(() => setSaving(false));
      }}
      className="mt-3 min-h-10 w-full rounded-xl border border-input bg-background px-2 text-xs outline-none disabled:opacity-50"
    >
      <option value="">Assign rider...</option>
      {riders
        .slice()
        .sort((a, b) => riderLoad(a, orders) - riderLoad(b, orders))
        .map((rider) => (
          <option key={rider.id} value={rider.id}>
            {rider.name} · {riderStatus(rider, orders).label}
          </option>
        ))}
    </select>
  );
}

/* ------------------------------- Shared pieces ----------------------------- */

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

/* --------------------------------- Helpers -------------------------------- */

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
      dot: "bg-veg",
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
    return {
      label: "Recently online",
      className: "border-accent/30 bg-accent/10 text-accent",
      dot: "bg-accent",
    };
  return {
    label: "Available",
    className: "border-border bg-background text-muted-foreground",
    dot: "bg-muted-foreground",
  };
}

function riderLoad(rider: StaffUser, orders: Order[]) {
  return orders.filter(
    (order) =>
      order.delivery?.assignedRiderId === rider.id &&
      !["delivered", "cancelled"].includes(order.status),
  ).length;
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

function matchesDatePreset(date: string, preset: DatePreset, customDate: string) {
  const orderDate = new Date(date);
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  if (preset === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (preset === "week") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
  } else if (preset === "month") {
    start.setDate(1);
  } else if (preset === "custom") {
    if (!customDate) return true;
    return orderDate.toISOString().slice(0, 10) === customDate;
  }
  return orderDate >= start && orderDate <= end;
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