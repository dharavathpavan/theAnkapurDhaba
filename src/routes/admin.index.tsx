import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listOrders, getMenu } from "@/services/api";
import { TrendingUp, ShoppingBag, IndianRupee, Users } from "lucide-react";
import { useOrderRealtime } from "@/hooks/use-order-realtime";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  useOrderRealtime();
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: listOrders, refetchInterval: 5000 });
  const { data: menu = [] } = useQuery({ queryKey: ["menu"], queryFn: getMenu });

  const today = new Date().toDateString();
  const todays = orders.filter((o) => new Date(o.createdAt).toDateString() === today);
  const revenueToday = todays.reduce((s, o) => s + o.total, 0);
  const revenueMonth = orders
    .filter((o) => {
      const d = new Date(o.createdAt);
      const n = new Date();
      return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
    })
    .reduce((s, o) => s + o.total, 0);
  const customers = new Set(orders.map((o) => o.customer.phone)).size;
  const pending = orders.filter((o) => !["delivered", "cancelled"].includes(o.status));

  // Top items by qty
  const counter = new Map<string, { name: string; qty: number; revenue: number }>();
  orders.forEach((o) =>
    o.items.forEach((it) => {
      const cur = counter.get(it.id) ?? { name: it.name, qty: 0, revenue: 0 };
      cur.qty += it.qty;
      cur.revenue += it.qty * it.price;
      counter.set(it.id, cur);
    }),
  );
  const top = Array.from(counter.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <h1 className="font-display text-4xl tracking-wide">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Live overview of today's operations.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={IndianRupee} label="Revenue today" value={`₹${revenueToday}`} />
        <StatCard icon={ShoppingBag} label="Orders today" value={todays.length.toString()} />
        <StatCard icon={TrendingUp} label="Revenue (month)" value={`₹${revenueMonth}`} />
        <StatCard icon={Users} label="Unique customers" value={customers.toString()} />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {/* Pending */}
        <section className="lg:col-span-2 rounded-xl border border-border bg-surface">
          <header className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="font-display text-xl tracking-widest">PENDING ORDERS</h2>
            <Link to="/admin/orders" className="text-xs text-primary hover:text-primary-glow">View all →</Link>
          </header>
          {pending.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-muted-foreground">No pending orders. The kitchen is caught up.</p>
          ) : (
            <ul className="divide-y divide-border">
              {pending.slice(0, 6).map((o) => (
                <li key={o.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <div className="font-display text-lg tracking-wide text-primary">#{o.id}</div>
                    <div className="text-sm text-muted-foreground">
                      {o.customer.name} · {o.items.length} item{o.items.length > 1 ? "s" : ""} · {o.type}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg">₹{o.total}</div>
                    <StatusPill status={o.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Top items */}
        <section className="rounded-xl border border-border bg-surface">
          <header className="border-b border-border px-6 py-4">
            <h2 className="font-display text-xl tracking-widest">TOP SELLERS</h2>
          </header>
          {top.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-muted-foreground">No sales yet.</p>
          ) : (
            <ol className="divide-y divide-border">
              {top.map((t, i) => (
                <li key={t.name} className="flex items-center justify-between px-6 py-3">
                  <span className="flex items-center gap-3">
                    <span className="font-display text-2xl text-accent">{(i + 1).toString().padStart(2, "0")}</span>
                    <span>{t.name}</span>
                  </span>
                  <span className="font-display text-sm text-muted-foreground">{t.qty} sold</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        {menu.length} items on the menu · Data stored locally for the prototype. Hook to your Express API in <code>src/services/api.ts</code>.
      </p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="font-display text-xs tracking-widest text-muted-foreground">{label.toUpperCase()}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-3 font-display text-3xl">{value}</div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    received: "border-accent/40 text-accent",
    accepted: "border-accent/40 text-accent",
    preparing: "border-primary/40 text-primary",
    ready: "border-primary/40 text-primary",
    out_for_delivery: "border-primary/40 text-primary",
    delivered: "border-veg/40 text-veg",
    cancelled: "border-border text-muted-foreground",
  };
  return (
    <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 font-display text-[10px] tracking-widest ${map[status] ?? "border-border"}`}>
      {status.replace(/_/g, " ").toUpperCase()}
    </span>
  );
}
