import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listOrders, updateOrderDelivery, updateOrderStatus, type Order, type OrderStatus } from "@/services/api";
import { StatusPill } from "./admin.index";
import { toast } from "sonner";
import { useState } from "react";
import { useOrderRealtime } from "@/hooks/use-order-realtime";
import { DeliveryMap } from "@/components/site/DeliveryMap";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrders,
});

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
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: listOrders, refetchInterval: 4000 });
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? orders : orders.filter((o) => !["delivered", "cancelled"].includes(o.status));

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
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wide">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">Auto-refreshing every 4 seconds.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show completed
        </label>
      </header>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-16 text-center">
          <p className="font-display text-2xl tracking-wide text-muted-foreground">No active orders right now</p>
          <p className="mt-2 text-sm text-muted-foreground">Place a test order from the customer site to see it appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((o) => {
            const action = NEXT[o.status];
            return (
              <article key={o.id} className="rounded-xl border border-border bg-surface p-5">
                <header className="flex items-start justify-between border-b border-border pb-3">
                  <div>
                    <div className="font-display text-2xl tracking-wide text-primary">#{o.id}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleTimeString()} · {o.type.toUpperCase()}
                    </div>
                  </div>
                  <StatusPill status={o.status} />
                </header>

                <ul className="mt-3 space-y-1 text-sm">
                  {o.items.map((it) => (
                    <li key={it.id} className="flex justify-between">
                      <span><span className="font-display text-primary">{it.qty}×</span> {it.name}</span>
                      <span className="text-muted-foreground">₹{it.price * it.qty}</span>
                    </li>
                  ))}
                </ul>

                {o.customer.notes && (
                  <p className="mt-3 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">
                    📝 {o.customer.notes}
                  </p>
                )}

                {o.type === "delivery" && ["out_for_delivery", "delivered"].includes(o.status) && (
                  <div className="mt-3">
                    <DeliveryMap order={o} compact />
                    <ManualLocationEditor order={o} />
                  </div>
                )}

                <div className="mt-3 border-t border-border pt-3 text-sm">
                  <div className="font-display tracking-widest">{o.customer.name}</div>
                  <div className="text-xs text-muted-foreground">{o.customer.phone}</div>
                  {o.customer.address && (
                    <div className="mt-1 text-xs text-muted-foreground">{o.customer.address}</div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-display text-xl">₹{o.total}</span>
                  <div className="flex flex-wrap gap-2">
                    {o.status === "received" && (
                      <button
                        onClick={() => advance(o.id, "cancelled")}
                        className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-display text-xs tracking-widest text-destructive hover:bg-destructive/20"
                      >
                        CANCEL
                      </button>
                    )}
                    {action ? (
                      <button
                        onClick={() => advance(o.id, action.next)}
                        className="rounded-md bg-primary px-4 py-2 font-display text-xs tracking-widest text-primary-foreground hover:bg-primary-glow"
                      >
                        {action.label.toUpperCase()} →
                      </button>
                    ) : (
                    <span className="font-display text-xs tracking-widest text-veg">✓ DONE</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ManualLocationEditor({ order }: { order: Order }) {
  const qc = useQueryClient();
  const [lat, setLat] = useState(order.delivery?.currentLocation?.lat.toString() ?? "");
  const [lng, setLng] = useState(order.delivery?.currentLocation?.lng.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const nextLat = Number(lat);
    const nextLng = Number(lng);
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) {
      toast.error("Enter valid latitude and longitude");
      return;
    }
    setSaving(true);
    try {
      await updateOrderDelivery(order.id, {
        currentLocation: {
          lat: nextLat,
          lng: nextLng,
          label: "Admin location update",
          updatedAt: new Date().toISOString(),
        },
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
    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <input
        value={lat}
        onChange={(event) => setLat(event.target.value)}
        placeholder="Latitude"
        inputMode="decimal"
        className="rounded-md border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
      />
      <input
        value={lng}
        onChange={(event) => setLng(event.target.value)}
        placeholder="Longitude"
        inputMode="decimal"
        className="rounded-md border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
      />
      <button
        disabled={saving}
        onClick={save}
        className="rounded-md border border-border px-3 py-2 font-display text-[11px] tracking-widest text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        GPS
      </button>
    </div>
  );
}
