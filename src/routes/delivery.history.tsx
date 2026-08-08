import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { History, Star, TrendingUp } from "lucide-react";
import { useDeliveryPortal } from "@/components/delivery/delivery-context";
import { EmptyState, StatusPill } from "@/components/delivery/delivery-ui";
import { deliveryEarning } from "@/components/delivery/delivery-utils";

export const Route = createFileRoute("/delivery/history")({
  component: DeliveryHistory,
});

function DeliveryHistory() {
  const portal = useDeliveryPortal();
  const [filter, setFilter] = useState<"all" | "delivered" | "cancelled">("all");

  const rows = useMemo(
    () =>
      portal.history.filter((order) => filter === "all" || order.status === filter),
    [portal.history, filter],
  );

  const totals = useMemo(() => {
    const delivered = portal.history.filter((order) => order.status === "delivered");
    const fee = delivered.reduce((sum, order) => sum + (order.earningsBreakdown?.fee ?? Number(order.deliveryFee || 0)), 0);
    const tip = delivered.reduce((sum, order) => sum + (order.earningsBreakdown?.tip ?? Number(order.delivery?.tip || 0)), 0);
    const bonus = delivered.reduce((sum, order) => sum + (order.earningsBreakdown?.bonus ?? Number(order.delivery?.bonus || 0)), 0);
    return {
      delivered: delivered.length,
      cancelled: portal.history.filter((order) => order.status === "cancelled").length,
      fee: Math.round(fee * 100) / 100,
      tip: Math.round(tip * 100) / 100,
      bonus: Math.round(bonus * 100) / 100,
      total: delivered.reduce((sum, order) => sum + deliveryEarning(order), 0),
    };
  }, [portal.history]);

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/10 p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Trip history</p>
        <h2 className="mt-1 text-3xl font-black">Rs {Math.round(totals.total * 100) / 100}</h2>
        <p className="mt-1 text-sm text-emerald-100/80">
          {totals.delivered} delivered · {totals.cancelled} cancelled
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <MiniBreakdown label="Delivery fees" value={`Rs ${totals.fee}`} />
          <MiniBreakdown label="Tips" value={`Rs ${totals.tip}`} />
          <MiniBreakdown label="Bonuses" value={`Rs ${totals.bonus}`} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-200">Earnings detail</p>
          <h2 className="text-2xl font-black">Past Trips</h2>
        </div>
        <div className="flex gap-1 rounded-2xl border border-white/10 bg-slate-950/45 p-1">
          {(["all", "delivered", "cancelled"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-xl px-3 py-2 text-xs font-black capitalize transition ${
                filter === value ? "bg-orange-500 text-white" : "text-slate-300"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={History} title="No trips yet" text="Completed and cancelled deliveries will appear here." />
      ) : (
        <div className="space-y-2">
          {rows.map((order) => (
            <article key={order.id} className="rounded-[26px] border border-white/10 bg-white/[0.06] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-lg font-black">#{order.id}</p>
                  <p className="truncate text-xs text-slate-400">
                    {order.customer.name} · {order.customer.address || "Delivery"} ·{" "}
                    {new Date(order.updatedAt).toLocaleString()}
                  </p>
                  {order.batchId && (
                    <p className="mt-1 text-xs text-orange-200">Batch #{order.batchId}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill tone={order.status === "delivered" ? "green" : "slate"}>
                    {order.status}
                  </StatusPill>
                  <span className="font-black text-emerald-300">Rs {deliveryEarning(order)}</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Breakdown label="Fee" value={`Rs ${order.earningsBreakdown?.fee ?? Number(order.deliveryFee || 0)}`} />
                <Breakdown label="Tip" value={`Rs ${order.earningsBreakdown?.tip ?? Number(order.delivery?.tip || 0)}`} />
                <Breakdown label="Bonus" value={`Rs ${order.earningsBreakdown?.bonus ?? Number(order.delivery?.bonus || 0)}`} />
              </div>

              {order.riderRating && order.riderRating > 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-2xl bg-slate-950/35 p-3 text-sm">
                  <Star className="h-4 w-4 shrink-0 text-yellow-300" />
                  <span className="font-black text-yellow-200">{order.riderRating}/5</span>
                  {order.riderReview && <span className="min-w-0 truncate text-slate-300">"{order.riderReview}"</span>}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniBreakdown({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-950/35 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function Breakdown({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-2">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-black">{value}</p>
    </div>
  );
}
