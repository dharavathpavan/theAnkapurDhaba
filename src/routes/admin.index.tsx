import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listOrders, getMenu, getAdminCustomerContent, type Order, type OrderStatus } from "@/services/api";
import { AlertTriangle, Bike, ChefHat, ClipboardList, Clock3, IndianRupee, Megaphone, QrCode, ReceiptText, ShoppingBag, Store, TrendingUp, Users, UtensilsCrossed } from "lucide-react";
import { useOrderRealtime } from "@/hooks/use-order-realtime";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

const ACTIVE_STATUSES: OrderStatus[] = ["received", "accepted", "preparing", "ready", "out_for_delivery"];

function Dashboard() {
  useOrderRealtime();
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: listOrders, refetchInterval: 5000 });
  const { data: menu = [] } = useQuery({ queryKey: ["menu"], queryFn: getMenu });
  const { data: customerContent } = useQuery({ queryKey: ["admin-customer-content"], queryFn: getAdminCustomerContent });

  const now = new Date();
  const today = now.toDateString();
  const todays = orders.filter((o) => new Date(o.createdAt).toDateString() === today);
  const monthOrders = orders.filter((o) => {
    const d = new Date(o.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const revenueToday = sum(todays.map((o) => o.total));
  const revenueMonth = sum(monthOrders.map((o) => o.total));
  const paidToday = todays.filter((o) => o.paymentStatus === "paid").length;
  const pending = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const delayed = pending.filter((o) => minutesSince(o.createdAt) > 30);
  const customers = new Set(orders.map((o) => o.customer.phone).filter(Boolean)).size;
  const avgOrderValue = todays.length ? Math.round(revenueToday / todays.length) : 0;
  const availableItems = menu.filter((item) => item.available).length;
  const hiddenItems = menu.length - availableItems;

  const byStatus = ACTIVE_STATUSES.map((status) => ({ status, count: pending.filter((o) => o.status === status).length }));
  const byType = ["delivery", "pickup", "dinein"].map((type) => ({ type, count: todays.filter((o) => o.type === type).length }));
  const top = topItems(orders);
  const latestOrders = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 7);

  const activeBanners = customerContent?.banners?.filter((item) => item.active).length ?? 0;
  const activeCoupons = customerContent?.coupons?.filter((item) => item.active).length ?? 0;
  const activeAnnouncements = customerContent?.announcements?.filter((item) => item.active).length ?? 0;
  const storeOpen = customerContent?.store?.isOpen ?? true;

  return (
    <main className="px-4 py-6 md:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[28px] bg-[#120d0e] text-white shadow-2xl">
        <div className="grid gap-6 p-5 md:p-7 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="flex min-w-0 flex-col justify-between gap-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-red-200">
                <Store className="h-3.5 w-3.5" /> Restaurant Command Center
              </div>
              <h2 className="mt-5 max-w-3xl text-3xl font-black leading-tight md:text-5xl">The Ankapure Dhaba operations, orders, kitchen and customer app in one place.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/65">Monitor today&apos;s sales, active kitchen load, delivery status, menu health, marketing content and staff portals from this admin dashboard.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <HeroMetric label="Today Revenue" value={money(revenueToday)} />
              <HeroMetric label="Live Orders" value={pending.length.toString()} />
              <HeroMetric label="Store Status" value={storeOpen ? "Open" : "Closed"} tone={storeOpen ? "green" : "red"} />
            </div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/8 p-4">
            <img src="/the-ankapure-dhaba-logo.png" alt="The Ankapure Dhaba" className="mx-auto h-32 w-32 rounded-[28px] border border-white/10 bg-black object-cover shadow-xl" />
            <div className="mt-5 grid gap-3">
              <QuickAction to="/admin/billing" icon={ReceiptText} label="Open Billing" />
              <QuickAction to="/admin/orders" icon={ClipboardList} label="Manage Orders" />
              <QuickAction to="/admin/menu" icon={UtensilsCrossed} label="Update Menu" />
              <QuickAction to="/admin/marketing" icon={Megaphone} label="Marketing Banners" />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IndianRupee} label="Revenue today" value={money(revenueToday)} detail={`${paidToday} paid orders`} />
        <StatCard icon={ShoppingBag} label="Orders today" value={todays.length.toString()} detail={`${avgOrderValue ? money(avgOrderValue) : "Rs 0"} average order`} />
        <StatCard icon={TrendingUp} label="Month revenue" value={money(revenueMonth)} detail={`${monthOrders.length} monthly orders`} />
        <StatCard icon={Users} label="Customers" value={customers.toString()} detail="Unique phone numbers" />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3" title="Live Order Pipeline" action={<Link to="/admin/orders" className="text-sm font-bold text-red-600">View all</Link>}>
          <div className="grid gap-3 sm:grid-cols-5">
            {byStatus.map((item) => (
              <div key={item.status} className="rounded-2xl border border-border bg-background p-4">
                <div className="text-2xl font-black">{item.count}</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">{labelStatus(item.status)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {byType.map((item) => (
              <div key={item.type} className="flex items-center justify-between rounded-2xl bg-background px-4 py-3">
                <span className="text-sm font-bold capitalize text-muted-foreground">{item.type === "dinein" ? "Dine in" : item.type}</span>
                <span className="text-lg font-black">{item.count}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="lg:col-span-2" title="Attention Needed">
          <div className="space-y-3">
            <AlertRow icon={AlertTriangle} label="Delayed active orders" value={delayed.length.toString()} tone={delayed.length ? "red" : "green"} />
            <AlertRow icon={ChefHat} label="Kitchen queue" value={pending.filter((o) => ["accepted", "preparing"].includes(o.status)).length.toString()} />
            <AlertRow icon={Bike} label="Out for delivery" value={pending.filter((o) => o.status === "out_for_delivery").length.toString()} />
            <AlertRow icon={Clock3} label="Ready for dispatch" value={pending.filter((o) => o.status === "ready").length.toString()} />
          </div>
        </Panel>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Latest Orders" action={<Link to="/admin/billing" className="text-sm font-bold text-red-600">Go to billing</Link>}>
          {latestOrders.length === 0 ? (
            <EmptyState text="No orders yet." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              {latestOrders.map((order) => (
                <Link key={order.id} to="/admin/orders" className="grid gap-3 border-b border-border bg-background p-4 last:border-b-0 hover:bg-primary/10 md:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-red-600">#{order.id}</span>
                      <StatusPill status={order.status} />
                      <span className="rounded-full bg-surface px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{order.type}</span>
                    </div>
                    <div className="mt-2 truncate text-sm font-semibold text-foreground">{order.customer.name} · {order.items.map((item) => `${item.qty}x ${item.name}`).join(", ")}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatTime(order.createdAt)} · {order.paymentStatus.toUpperCase()} · {order.paymentMethod.toUpperCase()}</div>
                  </div>
                  <div className="text-left md:text-right">
                    <div className="text-xl font-black">{money(order.total)}</div>
                    <div className="text-xs font-bold text-muted-foreground">{minutesSince(order.createdAt)} min ago</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Top Sellers">
          {top.length === 0 ? (
            <EmptyState text="Top items will appear after sales." />
          ) : (
            <div className="space-y-3">
              {top.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between rounded-2xl border border-border bg-background p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-red-50 font-black text-red-600">{index + 1}</span>
                    <div className="min-w-0">
                      <div className="truncate font-bold">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.qty} sold</div>
                    </div>
                  </div>
                  <div className="font-black">{money(item.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Menu Health">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <InfoBlock label="Total menu items" value={menu.length.toString()} />
            <InfoBlock label="Available now" value={availableItems.toString()} />
            <InfoBlock label="Hidden / unavailable" value={hiddenItems.toString()} />
          </div>
        </Panel>
        <Panel title="Customer App Content">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <InfoBlock label="Active banners" value={activeBanners.toString()} />
            <InfoBlock label="Active announcements" value={activeAnnouncements.toString()} />
            <InfoBlock label="Active coupons" value={activeCoupons.toString()} />
          </div>
        </Panel>
        <Panel title="Store Setup">
          <div className="space-y-3">
            <InfoBlock label="Delivery radius" value={`${customerContent?.store?.zoneRadiusKm ?? 8} km`} />
            <InfoBlock label="Delivery fee" value={money(customerContent?.store?.deliveryCharge ?? 10)} />
            <InfoBlock label="Minimum order" value={money(customerContent?.store?.minimumOrder ?? 199)} />
            <Link to="/admin/store" className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground">Edit store settings</Link>
          </div>
        </Panel>
      </section>
    </main>
  );
}

function Panel({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[24px] border border-border bg-surface p-4 shadow-sm md:p-5 ${className}`}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function StatCard({ icon: Icon, label, value, detail }: { icon: React.ElementType; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-red-50 text-red-600"><Icon className="h-5 w-5" /></span>
      </div>
      <div className="mt-4 text-3xl font-black">{value}</div>
      <div className="mt-1 text-sm font-semibold text-muted-foreground">{detail}</div>
    </div>
  );
}

function HeroMetric({ label, value, tone = "white" }: { label: string; value: string; tone?: "white" | "green" | "red" }) {
  const toneClass = tone === "green" ? "text-emerald-300" : tone === "red" ? "text-red-300" : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
      <div className="text-[11px] font-bold uppercase tracking-widest text-white/45">{label}</div>
      <div className={`mt-1 text-2xl font-black ${toneClass}`}>{value}</div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <Link to={to} className="flex min-h-12 items-center justify-between rounded-2xl bg-white px-4 text-sm font-black text-slate-950 hover:bg-red-50">
      <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-red-600" /> {label}</span>
      <span className="text-red-600">Go</span>
    </Link>
  );
}

function AlertRow({ icon: Icon, label, value, tone = "neutral" }: { icon: React.ElementType; label: string; value: string; tone?: "neutral" | "red" | "green" }) {
  const className = tone === "red" ? "bg-red-500/10 text-red-300" : tone === "green" ? "bg-emerald-500/10 text-emerald-300" : "bg-background text-muted-foreground";
  return (
    <div className={`flex items-center justify-between rounded-2xl px-4 py-3 ${className}`}>
      <span className="flex items-center gap-2 text-sm font-bold"><Icon className="h-4 w-4" /> {label}</span>
      <span className="text-xl font-black">{value}</span>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-background p-4">
      <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-2xl bg-background px-6 py-12 text-center text-sm font-semibold text-muted-foreground">{text}</p>;
}

function topItems(orders: Order[]) {
  const counter = new Map<string, { name: string; qty: number; revenue: number }>();
  orders.forEach((order) => {
    order.items.forEach((item) => {
      const current = counter.get(item.id) ?? { name: item.name, qty: 0, revenue: 0 };
      current.qty += item.qty;
      current.revenue += item.qty * item.price;
      counter.set(item.id, current);
    });
  });
  return Array.from(counter.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function money(value: number) {
  return `Rs ${Math.round(value || 0).toLocaleString("en-IN")}`;
}

function minutesSince(date: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
}

function formatTime(date: string) {
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(new Date(date));
}

function labelStatus(status: string) {
  return status.replace(/_/g, " ");
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    received: "bg-amber-50 text-amber-700 ring-amber-100",
    accepted: "bg-blue-50 text-blue-700 ring-blue-100",
    preparing: "bg-orange-50 text-orange-700 ring-orange-100",
    ready: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    out_for_delivery: "bg-purple-50 text-purple-700 ring-purple-100",
    delivered: "bg-green-50 text-green-700 ring-green-100",
    cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ring-1 ${map[status] ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
