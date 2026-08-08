import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Bike, Check, CheckCircle2, MapPin, Navigation, PackageCheck, Phone, ReceiptText, Timer } from "lucide-react";
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

/** Board columns. Accepted + Preparing are grouped into one "In Kitchen" lane. */
const BOARD_COLUMNS: Array<{ key: OrderStatus | "kitchen"; label: string }> = [
  { key: "received", label: "Received" },
  { key: "kitchen", label: "In Kitchen" },
  { key: "ready", label: "Ready" },
  { key: "out_for_delivery", label: "Out for Delivery" },
];

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

  const [view, setView] = useState<"orders" | "delivery">("orders");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [dateFilter, setDateFilter] = useState("");
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");

  const riders = staff.filter((member) => member.role === "DELIVERY");
  const activeOrders = orders.filter((order) => ACTIVE_STATUSES.includes(order.status));
  const today = new Date().toDateString();

  const counts = useMemo(
    () => ({
      active: activeOrders.length,
      received: orders.filter((order) => order.status === "received").length,
      kitchen: orders.filter((order) => ["accepted", "preparing"].includes(order.status)).length,
      ready: orders.filter((order) => order.status === "ready").length,
      delivery: orders.filter((order) => order.status === "out_for_delivery").length,
      delayed: activeOrders.filter((order) => minutesSince(order.createdAt) > 30).length,
      doneToday: orders.filter(
        (order) =>
          order.status === "delivered" &&
          new Date(order.updatedAt || order.createdAt).toDateString() === today,
      ).length,
    }),
    [orders, activeOrders, today],
  );

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return orders
      .filter((order) => {
        if (!includeCompleted && !ACTIVE_STATUSES.includes(order.status) && order.status !== "cancelled")
          return false;
        if (typeFilter && order.type !== typeFilter) return false;
        if (paymentFilter && order.paymentStatus !== paymentFilter) return false;
        if (!matchesDatePreset(order.createdAt, datePreset, dateFilter)) return false;
        if (!text) return true;
        const haystack = [
          order.id,
          order.customer.name,
          order.customer.phone,
          order.customer.address,
          order.paymentStatus,
          order.type,
          order.delivery?.assignedRiderName,
          ...order.items.map((item) => item.name),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(text);
      })
      .sort((a, b) => orderSortScore(a) - orderSortScore(b));
  }, [orders, query, typeFilter, paymentFilter, datePreset, dateFilter, includeCompleted]);

  useEffect(() => {
    if (filtered.some((order) => order.id === selectedId)) return;
    setSelectedId(filtered[0]?.id || "");
  }, [filtered, selectedId]);

  const selected = filtered.find((order) => order.id === selectedId) || filtered[0];

  async function advance(id: string, status: OrderStatus) {
    try {
      await updateOrderStatus(id, status);
      await qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Order ${id} → ${status.replace(/_/g, " ")}`);
    } catch {
      toast.error("Couldn't update order");
    }
  }

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-veg" />
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Live
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">Orders</h1>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex rounded-xl border border-border bg-background p-1">
            <button
              type="button"
              onClick={() => setView("orders")}
              className={`min-h-8 rounded-lg px-4 text-sm font-semibold transition ${
                view === "orders" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Orders
            </button>
            <button
              type="button"
              onClick={() => setView("delivery")}
              className={`min-h-8 rounded-lg px-4 text-sm font-semibold transition ${
                view === "delivery" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <Bike className="h-4 w-4" /> Delivery Tracking
              </span>
            </button>
          </div>
          <CountStat label="Active" value={counts.active} />
          <CountStat label="Kitchen" value={counts.kitchen} tone="amber" />
          <CountStat label="Ready" value={counts.ready} tone="amber" />
          <CountStat label="Out" value={counts.delivery} tone="blue" />
          <CountStat label="Delayed" value={counts.delayed} tone="red" />
          <CountStat label="Done today" value={counts.doneToday} tone="green" />
        </div>
      </header>

      <section className="mb-5 rounded-2xl border border-border bg-background p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-11 min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ID, name, phone, item…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              ["", "All types"],
              ["delivery", "Delivery"],
              ["pickup", "Pickup"],
              ["dinein", "Dine in"],
            ]}
          />
          <Select
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
          <div className="flex items-center gap-1">
            {(["today", "yesterday", "week", "month"] as DatePreset[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setDatePreset(item)}
                className={`rounded-lg px-2.5 py-2 text-xs font-semibold ${
                  datePreset === item
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-surface"
                }`}
              >
                {item === "week" ? "Week" : item === "month" ? "Month" : item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
          <label className="flex min-h-9 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold text-muted-foreground">
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(event) => setIncludeCompleted(event.target.checked)}
              className="accent-[var(--primary)]"
            />
            Completed
          </label>
        </div>
      </section>

      {view === "orders" ? (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(440px,1.1fr)]">
          <OrderBoard
            orders={filtered}
            selectedId={selected?.id}
            onSelect={setSelectedId}
            riders={riders}
            onAssign={async (order, rider) => {
              await assignRider(order, rider);
              await qc.invalidateQueries({ queryKey: ["orders"] });
              toast.success(`Assigned to ${rider.name}`);
            }}
          />

          <div className="xl:sticky xl:top-6 xl:self-start">
            {selected ? (
              <OrderDetail order={selected} orders={orders} riders={riders} onAdvance={advance} />
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-background p-12 text-center text-muted-foreground">
                <p className="font-semibold">No orders match.</p>
                <p className="mt-1 text-sm">Adjust the filters or date range.</p>
              </div>
            )}
          </div>
        </section>
      ) : (
        <DeliveryTrackingView
          orders={orders}
          riders={riders}
          onSelect={setSelectedId}
          onAdvance={advance}
        />
      )}
    </main>
  );
}

function CountStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "red" | "green" | "amber" | "blue";
}) {
  const color = {
    neutral: "text-foreground",
    red: "text-red-400",
    green: "text-veg",
    amber: "text-accent",
    blue: "text-blue-400",
  }[tone];
  return (
    <div className="text-center">
      <div className={`text-xl font-bold leading-none ${color}`}>{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

/* --------------------------- Delivery Tracking ---------------------------- */
/* Swiggy / Zomato style: rider-focused tracker cards with a vertical journey. */

function DeliveryTrackingView({
  orders,
  riders,
  onSelect,
  onAdvance,
}: {
  orders: Order[];
  riders: StaffUser[];
  onSelect: (id: string) => void;
  onAdvance: (id: string, status: OrderStatus) => void;
}) {
  const qc = useQueryClient();
  const q = orders.filter(
    (order) => order.type === "delivery" && ACTIVE_STATUSES.includes(order.status),
  );
  const groups: Array<{ title: string; list: Order[] }> = [
    { title: "On the way", list: q.filter((o) => o.status === "out_for_delivery") },
    { title: "Ready for dispatch", list: q.filter((o) => o.status === "ready") },
    { title: "Preparing", list: q.filter((o) => ["received", "accepted", "preparing"].includes(o.status)) },
  ].filter((g) => g.list.length);

  if (!q.length)
    return (
      <div className="rounded-2xl border border-dashed border-border bg-background p-12 text-center text-muted-foreground">
        <Bike className="mx-auto mb-2 h-8 w-8" />
        <p className="font-semibold">No active delivery orders.</p>
        <p className="mt-1 text-sm">New delivery orders will show here as they come in.</p>
      </div>
    );

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.title}>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {group.title}
            </h2>
            <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold">
              {group.list.length}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {group.list.map((order) => (
              <DeliveryTrackCard
                key={order.id}
                order={order}
                riders={riders}
                orders={orders}
                onSelect={() => onSelect(order.id)}
                onAdvance={onAdvance}
                onAssigned={() => qc.invalidateQueries({ queryKey: ["orders"] })}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function DeliveryTrackCard({
  order,
  riders,
  orders,
  onSelect,
  onAdvance,
  onAssigned,
}: {
  order: Order;
  riders: StaffUser[];
  orders: Order[];
  onSelect: () => void;
  onAdvance: (id: string, status: OrderStatus) => void;
  onAssigned: () => void;
}) {
  const d = order.delivery || {};
  const riderName = d.assignedRiderName || d.partnerName;
  const riderPhone = d.partnerPhone || "";
  const canAssign = ["ready", "out_for_delivery"].includes(order.status) && !Boolean(d.assignedRiderId);
  const eta = d.etaMinutes ? `~${d.etaMinutes} min` : null;
  const stageText =
    order.status === "out_for_delivery"
      ? "Delivery partner is on the way"
      : order.status === "ready"
        ? "Ready & waiting for a partner"
        : "Restaurant is preparing your order";

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-background">
      <button type="button" onClick={onSelect} className="w-full border-b border-border p-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-primary">#{order.id}</span>
              <StatusPill status={order.status} />
            </div>
            <p className="mt-1 truncate text-sm font-semibold">{order.customer.name || "Customer"}</p>
            <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="line-clamp-2">
                {order.customer.address || d.destinationText || "No address"}
              </span>
            </p>
          </div>
          <div className="text-right">
            <div className="font-bold">{money(order.total)}</div>
            {eta ? (
              <span className="mt-1 inline-flex rounded-md bg-blue-400/10 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                <Timer className="mr-1 h-3 w-3" /> {eta}
              </span>
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-xs font-medium text-blue-300">{stageText}</p>
      </button>

      <div className="p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 font-bold text-primary">
            {riderName ? initials(riderName) : <Bike className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{riderName || "No rider assigned"}</div>
            <div className="text-xs text-muted-foreground">{riderPhone || (riderName ? "Partner" : "Assign a partner to start tracking")}</div>
          </div>
          {riderPhone && (
            <a
              href={`tel:${riderPhone}`}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-surface text-primary"
              aria-label={`Call ${riderName}`}
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
        </div>

        <DeliveryTracker order={order} />

        {riderName && d.deliveryOtp ? (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-xs">
            <span className="text-muted-foreground">Delivery OTP</span>
            <span className="font-black tracking-widest">{d.deliveryOtp}</span>
          </div>
        ) : null}

        {canAssign ? (
          <select
            value=""
            onChange={(event) => {
              const rider = riders.find((r) => r.id === event.target.value);
              if (!rider || !event.target.value) return;
              assignRider(order, rider)
                .then(() => {
                  toast.success(`Assigned to ${rider.name}`);
                  onAssigned();
                })
                .catch(() => toast.error("Couldn't assign rider"));
            }}
            className="mt-3 min-h-10 w-full rounded-xl border border-border bg-surface px-2 text-xs outline-none"
          >
            <option value="">Assign rider…</option>
            {riders
              .slice()
              .sort((a, b) => riderLoad(a, orders) - riderLoad(b, orders))
              .map((rider) => (
                <option key={rider.id} value={rider.id}>
                  {rider.name} — {riderLoad(rider, orders)} active
                </option>
              ))}
          </select>
        ) : null}

        {order.status === "out_for_delivery" ? (
          <button
            type="button"
            onClick={() => onAdvance(order.id, "delivered")}
            className="mt-3 min-h-10 w-full rounded-xl bg-veg text-sm font-semibold text-white hover:opacity-90"
          >
            Mark delivered
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DeliveryTracker({ order }: { order: Order }) {
  const d = order.delivery || {};
  const steps = [
    { key: "placed", label: "Order placed", sub: formatTime(order.createdAt), done: true, icon: ReceiptText },
    {
      key: "assigned",
      label: "Rider assigned",
      sub: d.assignedRiderName ? d.assignedRiderName : "Waiting for a rider",
      done: Boolean(d.assignedRiderId),
      icon: Bike,
    },
    {
      key: "picked",
      label: "Picked up from store",
      sub: d.pickedUpAt ? formatTime(d.pickedUpAt) : "Partner heading to the store",
      done: Boolean(d.pickedUpAt || d.pickupVerifiedAt),
      icon: PackageCheck,
    },
    {
      key: "onway",
      label: "On the way",
      sub: d.etaMinutes ? `Arriving in ~${d.etaMinutes} min` : "Delivery in progress",
      done:
        order.status === "out_for_delivery" ||
        ["on_the_way", "nearby", "almost_there", "outside"].includes(d.deliveryStage || ""),
      icon: Navigation,
    },
    {
      key: "delivered",
      label: "Delivered",
      sub: d.deliveredAt ? formatTime(d.deliveredAt) : "—",
      done: order.status === "delivered",
      icon: CheckCircle2,
    },
  ];
  const current = steps.findIndex((step) => !step.done);
  return (
    <div className="mt-2">
      {steps.map((step, index) => {
        const isCurrent = index === current;
        const last = index === steps.length - 1;
        return (
          <div key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                  step.done
                    ? "border-veg bg-veg text-white"
                    : isCurrent
                      ? "border-blue-400 bg-blue-400/10 text-blue-300"
                      : "border-border bg-surface text-muted-foreground"
                }`}
              >
                {step.done || !isCurrent ? <Check className="h-3.5 w-3.5" /> : <step.icon className="h-3.5 w-3.5" />}
              </span>
              {!last && <span className={`my-0.5 w-0.5 flex-1 rounded-full ${step.done ? "bg-veg/50" : "bg-border"}`} />}
            </div>
            <div className="pb-4">
              <div className={`text-sm ${isCurrent ? "font-bold text-blue-300" : step.done ? "font-semibold" : "font-medium text-muted-foreground"}`}>
                {step.label}
              </div>
              {step.sub ? <div className="text-xs text-muted-foreground">{step.sub}</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Select({
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
      className="min-h-9 rounded-xl border border-border bg-surface px-3 text-sm outline-none"
    >
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}

function OrderBoard({
  orders,
  selectedId,
  onSelect,
  riders,
  onAssign,
}: {
  orders: Order[];
  selectedId?: string;
  onSelect: (id: string) => void;
  riders: StaffUser[];
  onAssign: (order: Order, rider: StaffUser) => Promise<void>;
}) {
  const isColumn = (order: Order, key: (typeof BOARD_COLUMNS)[number]["key"]) => {
    if (key === "kitchen") return order.status === "accepted" || order.status === "preparing";
    return order.status === key;
  };
  const isTerminal = (order: Order) => !ACTIVE_STATUSES.includes(order.status);

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-3">
        {BOARD_COLUMNS.map((column) => {
          const group = orders.filter((order) => isColumn(order, column.key));
          return (
            <section key={column.key} className="w-[290px] shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {column.label}
                </h2>
                <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold">
                  {group.length}
                </span>
              </div>
              <div className="space-y-2">
                {group.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    active={order.id === selectedId}
                    onSelect={() => onSelect(order.id)}
                    riders={riders}
                    onAssign={onAssign}
                  />
                ))}
                {!group.length && (
                  <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                    Empty
                  </div>
                )}
              </div>
            </section>
          );
        })}

        {/* Completed / Cancelled trailing lane when enabled */}
        {orders.filter(isTerminal).length > 0 && (
          <section key="finished" className="w-[290px] shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Finished</h2>
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold">
                {orders.filter(isTerminal).length}
              </span>
            </div>
            <div className="space-y-2">
              {orders.filter(isTerminal).map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  active={order.id === selectedId}
                  onSelect={() => onSelect(order.id)}
                  riders={riders}
                  onAssign={onAssign}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  active,
  onSelect,
  riders,
  onAssign,
}: {
  order: Order;
  active: boolean;
  onSelect: () => void;
  riders?: StaffUser[];
  onAssign?: (order: Order, rider: StaffUser) => Promise<void>;
}) {
  const delayed = isDelayed(order);
  const isDelivery = order.type === "delivery";
  const canAssign = isDelivery && ["ready", "out_for_delivery"].includes(order.status);
  return (
    <div
      className={`rounded-xl border bg-background p-3 transition ${
        active ? "border-primary ring-1 ring-primary/40" : "border-border"
      } ${delayed ? "border-l-2 border-l-red-500" : ""}`}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-primary">#{order.id}</span>
              <StatusPill status={order.status} />
            </div>
            <p className="mt-1 truncate text-sm font-medium">{order.customer.name || "Customer"}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {formatTime(order.createdAt)} · {order.items.length} items · {money(order.total)}
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {delayed && <Chip tone="red">Delayed</Chip>}
          {order.delivery?.assignedRiderName ? (
            <Chip tone="green">{order.delivery.assignedRiderName}</Chip>
          ) : isDelivery && canAssign ? (
            <Chip tone="amber">Unassigned</Chip>
          ) : null}
        </div>
      </button>
      {canAssign && onAssign && (
        <select
          value=""
          onChange={(event) => {
            const rider = riders?.find((r) => r.id === event.target.value);
            if (rider && event.target.value) void onAssign(order, rider);
          }}
          className="mt-2 min-h-8 w-full rounded-lg border border-border bg-surface px-2 text-xs outline-none"
        >
          <option value="">Assign rider…</option>
          {riders
            ?.slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((rider) => (
              <option key={rider.id} value={rider.id}>
                {rider.name}
              </option>
            ))}
        </select>
      )}
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone: "red" | "green" | "amber" }) {
  const map = {
    red: "bg-red-500/10 text-red-400",
    green: "bg-veg/10 text-veg",
    amber: "bg-accent/10 text-accent",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[tone]}`}>
      {children}
    </span>
  );
}

function OrderDetail({
  order,
  orders,
  riders,
  onAdvance,
}: {
  order: Order;
  orders: Order[];
  riders: StaffUser[];
  onAdvance: (id: string, status: OrderStatus) => void;
}) {
  const action = NEXT[order.status];
  const isDelivery = order.type === "delivery";
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-background">
      <header className="border-b border-border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-primary">#{order.id}</h2>
              <StatusPill status={order.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(order.createdAt)} · {(order.customer.phone || "No phone")} ·{" "}
              {order.type.toUpperCase()}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold">{money(order.total)}</div>
            <PaymentTag status={order.paymentStatus} method={order.paymentMethod} />
          </div>
        </div>
        <ActionBar order={order} action={action} onAdvance={onAdvance} />
      </header>

      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Section title="Progress">
            <StatusTimeline order={order} />
          </Section>
          <Section title="Items">
            <div className="space-y-2">
              {order.items.map((item, index) => (
                <div key={`${item.id}-${index}`} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <span className="font-semibold">
                      <span className="text-primary">{item.qty}x</span> {item.name}
                    </span>
                    {item.addons?.length ? (
                      <div className="text-xs text-muted-foreground">
                        {item.addons.map((a) => a.name).join(", ")}
                      </div>
                    ) : null}
                    {item.instructions ? (
                      <p className="mt-1 text-xs italic text-muted-foreground">{item.instructions}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 font-semibold">{money(item.qty * item.price)}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-border pt-3 text-sm">
              <BillRow label="Subtotal" value={order.subtotal} />
              <BillRow label="Tax" value={order.tax} />
              <BillRow label="Delivery" value={order.deliveryFee} />
              <div className="mt-1 flex justify-between font-bold">
                <span>Total</span>
                <span>{money(order.total)}</span>
              </div>
            </div>
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Customer">
            <div className="space-y-1 text-sm">
              <p>{order.customer.address || "No address provided"}</p>
              {order.customer.landmark && <p className="text-muted-foreground">{order.customer.landmark}</p>}
              {order.customer.notes && <p className="text-muted-foreground">{order.customer.notes}</p>}
            </div>
          </Section>

          {isDelivery && (
            <>
              <Section title="Delivery Tracking">
                <DeliveryTimeline order={order} />
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Partner</div>
                    <div>{order.delivery?.assignedRiderName || order.delivery?.partnerName || "Not assigned"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Phone</div>
                    <div>{order.delivery?.partnerPhone || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Pickup PIN</div>
                    <div>{order.delivery?.pickupPin || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Delivery OTP</div>
                    <div>{order.delivery?.deliveryOtp || "—"}</div>
                  </div>
                </div>
                {["ready", "out_for_delivery", "delivered"].includes(order.status) && (
                  <div className="mt-3">
                    <DeliveryMap order={order} compact />
                  </div>
                )}
              </Section>
              {["ready", "out_for_delivery"].includes(order.status) && (
                <Section title="Assign rider">
                  <RiderPicker order={order} orders={orders} riders={riders} />
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function RiderPicker({
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
    <div className="space-y-2">
      <select
        value={riderId}
        onChange={(event) => setRiderId(event.target.value)}
        className="min-h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none"
      >
        <option value="">Select rider…</option>
        {riders
          .slice()
          .sort((a, b) => riderLoad(a, orders) - riderLoad(b, orders))
          .map((rider) => (
            <option key={rider.id} value={rider.id}>
              {rider.name} — {riderLoad(rider, orders)} active
            </option>
          ))}
      </select>
      <button
        type="button"
        disabled={saving || !riderId}
        onClick={assign}
        className="min-h-9 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary-glow disabled:opacity-50"
      >
        {saving ? "Assigning…" : "Assign rider"}
      </button>
    </div>
  );
}

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
    routeProgress: Math.max(Number(order.delivery?.routeProgress || 0), alreadyPicked ? 0.35 : 0.12),
    trackingPaused: false,
  });
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
    <div className="mt-4 flex flex-wrap gap-2">
      {order.status === "received" && (
        <button
          onClick={() => onAdvance(order.id, "cancelled")}
          className="min-h-9 rounded-xl border border-red-500/30 px-4 text-sm font-semibold text-red-400 hover:bg-red-500/10"
        >
          Cancel
        </button>
      )}
      {action ? (
        <button
          onClick={() => onAdvance(order.id, action.next)}
          className="min-h-9 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-glow"
        >
          {action.label}
        </button>
      ) : (
        <span className="inline-flex min-h-9 items-center rounded-xl bg-veg/10 px-4 text-sm font-semibold text-veg">
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
    <div className="flex flex-wrap gap-1.5">
      {STATUS_STEPS.map((step, index) => {
        const done = order.status === "delivered" || (currentIndex >= index && currentIndex !== -1);
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
  );
}

function DeliveryTimeline({ order }: { order: Order }) {
  const stages = [
    { key: "assigned", label: "Assigned", done: Boolean(order.delivery?.assignedRiderId) },
    { key: "picked", label: "Picked up", done: Boolean(order.delivery?.pickedUpAt) },
    { key: "out", label: "Out", done: ["out_for_delivery", "delivered"].includes(order.status) },
    { key: "delivered", label: "Delivered", done: order.status === "delivered" },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {stages.map((stage) => (
        <span
          key={stage.key}
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            stage.done ? "bg-blue-400/10 text-blue-300" : "bg-surface text-muted-foreground"
          }`}
        >
          {stage.label}
        </span>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      <div className="rounded-xl border border-border bg-surface p-4">{children}</div>
    </section>
  );
}

function PaymentTag({ status, method }: { status: string; method: string }) {
  const good = status === "paid" || method === "cod";
  return (
    <span
      className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
        good ? "bg-veg/10 text-veg" : "bg-red-500/10 text-red-400"
      }`}
    >
      {method} · {status}
    </span>
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

/* --------------------------------- Helpers -------------------------------- */

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
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