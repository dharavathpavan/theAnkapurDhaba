import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  getAdminDashboard,
  type AdminDashboardData,
} from "@/services/api";
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  ClipboardList,
  IndianRupee,
  PackageSearch,
  ReceiptText,
  ShoppingBag,
  Table2,
  TrendingUp,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useOrderRealtime } from "@/hooks/use-order-realtime";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  useOrderRealtime();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => getAdminDashboard({ range: "today" }),
    refetchInterval: 5000,
  });

  if (isLoading) return <main className="p-4 md:p-6"><SkeletonGrid /></main>;
  if (error || !data) {
    return (
      <main className="p-4 md:p-6">
        <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-700">
          Could not load dashboard. Please refresh.
        </div>
      </main>
    );
  }

  const k = data.kpis;
  const cards = [
    { label: "Today's Orders", value: k.todaysOrders, icon: ShoppingBag, tone: "red" },
    { label: "Today's Sales", value: money(k.todaysSales), icon: IndianRupee, tone: "green" },
    { label: "Online Payments", value: money(k.todaysOnlinePayments), icon: WalletCards, tone: "blue" },
    { label: "Cash Payments", value: money(k.todaysCashPayments), icon: ReceiptText, tone: "amber" },
    { label: "Today's Expenses", value: money(k.todaysExpenses), icon: TrendingUp, tone: "slate" },
    { label: "Today's Profit", value: money(k.todaysProfit), icon: IndianRupee, tone: k.todaysProfit >= 0 ? "green" : "red" },
    { label: "Pending Orders", value: k.pendingOrders, icon: ClipboardList, tone: "amber" },
    { label: "Completed Orders", value: k.completedOrders, icon: CheckCircle2, tone: "green" },
    { label: "Cancelled Orders", value: k.cancelledOrders, icon: XCircle, tone: "red" },
    { label: "Average Order", value: money(k.averageOrderValue), icon: ReceiptText, tone: "blue" },
    { label: "Active Tables", value: k.liveActiveTables, icon: Table2, tone: "violet" },
    { label: "Delivery Orders", value: k.liveDeliveryOrders, icon: Bike, tone: "orange" },
    { label: "Low Stock", value: k.lowStockItems, icon: PackageSearch, tone: k.lowStockItems ? "red" : "green" },
  ];

  return (
    <main className="space-y-5 p-4 md:p-6 lg:p-8">
      <section className="overflow-hidden rounded-[28px] bg-[#120d0e] p-5 text-white shadow-2xl md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-red-200">
              The Ankapure Dhaba
            </p>
            <h2 className="mt-3 text-3xl font-black md:text-5xl">Owner Dashboard</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
              Live orders, sales, expenses, payments, tables, deliveries and low-stock alerts in one simple view.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
            <HeroStat label="Sales" value={money(k.todaysSales)} />
            <HeroStat label="Profit" value={money(k.todaysProfit)} />
            <HeroStat label="Live Orders" value={String(k.pendingOrders)} />
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {cards.map((card) => <KpiCard key={card.label} {...card} />)}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Order Tracking" action={<Link to="/admin/orders" className="text-sm font-black text-red-600">Manage</Link>}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.ordersByStatus.map((item) => (
              <div key={item.status} className="rounded-2xl bg-background p-4">
                <div className="text-2xl font-black">{item.count}</div>
                <div className="mt-1 text-xs font-black uppercase tracking-widest text-muted-foreground">
                  {item.status.replace(/_/g, " ")}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Payment Breakdown" action={<Link to="/admin/payments" className="text-sm font-black text-red-600">Open</Link>}>
          <div className="space-y-3">
            {data.paymentBreakdown.length === 0 ? <Empty text="No payments today." /> : data.paymentBreakdown.map((item) => (
              <Row key={item.method} label={item.method.toUpperCase()} value={money(item.amount)} detail={`${item.count} orders`} />
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel title="Latest Orders" action={<Link to="/admin/orders" className="text-sm font-black text-red-600">View all</Link>}>
          <div className="space-y-3">
            {data.latestOrders.length === 0 ? <Empty text="No orders yet." /> : data.latestOrders.map((order) => (
              <Link key={order.id} to="/admin/orders" className="flex items-center justify-between gap-3 rounded-2xl bg-background p-4 hover:bg-red-50">
                <div className="min-w-0">
                  <div className="truncate font-black text-red-600">#{order.id}</div>
                  <div className="truncate text-sm font-semibold text-muted-foreground">{order.customer.name || order.customer.phone}</div>
                </div>
                <div className="text-right">
                  <div className="font-black">{money(order.total)}</div>
                  <div className="text-xs uppercase text-muted-foreground">{order.status.replace(/_/g, " ")}</div>
                </div>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Low Stock Items" action={<Link to="/admin/inventory" className="text-sm font-black text-red-600">Inventory</Link>}>
          <div className="space-y-3">
            {data.lowStock.length === 0 ? <Empty text="Stock looks healthy." /> : data.lowStock.map((item) => (
              <Row key={item.id} label={item.name} value={`${item.currentStock} ${item.unit}`} detail={`Minimum ${item.minimumStock} ${item.unit}`} danger />
            ))}
          </div>
        </Panel>
      </section>
    </main>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] border border-border bg-surface p-4 shadow-sm md:p-5">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-black">{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: React.ElementType; tone: string }) {
  const toneClass: Record<string, string> = {
    red: "bg-red-50 text-red-600",
    green: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    orange: "bg-orange-50 text-orange-600",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <div className="rounded-[22px] border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className={`grid h-10 w-10 place-items-center rounded-2xl ${toneClass[tone] ?? toneClass.slate}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-4 text-2xl font-black">{value}</div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
      <div className="text-[11px] font-black uppercase tracking-widest text-white/50">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
}

function Row({ label, value, detail, danger = false }: { label: string; value: string; detail: string; danger?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-2xl p-4 ${danger ? "bg-red-50 text-red-700" : "bg-background"}`}>
      <div className="min-w-0">
        <div className="truncate font-black">{label}</div>
        <div className="text-xs font-semibold opacity-70">{detail}</div>
      </div>
      <div className="shrink-0 font-black">{value}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-background p-6 text-center text-sm font-bold text-muted-foreground">{text}</p>;
}

function SkeletonGrid() {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-[22px] bg-surface" />)}</div>;
}

function money(value: number | undefined) {
  return `Rs ${Math.round(value || 0).toLocaleString("en-IN")}`;
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
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ring-1 ${map[status] ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
