import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { adminReportDownloadUrl, getAdminPayments, type AdminRangePreset } from "@/services/api";
import { CreditCard, Download, IndianRupee, RefreshCcw, WalletCards } from "lucide-react";

export const Route = createFileRoute("/admin/payments")({
  component: PaymentsPage,
});

function PaymentsPage() {
  const [range, setRange] = useState<AdminRangePreset>("today");
  const { data, isLoading } = useQuery({ queryKey: ["admin-payments", range], queryFn: () => getAdminPayments({ range }) });

  return (
    <main className="space-y-5 p-4 md:p-6 lg:p-8">
      <section className="rounded-[28px] bg-[#120d0e] p-5 text-white shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-red-200">Payment Control</p>
        <h1 className="mt-2 text-3xl font-black">Payments</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/65">Cash, UPI, PhonePe, Google Pay, Paytm, cards, gateway collections, pending payments and refunds.</p>
      </section>

      <div className="flex flex-col gap-3 rounded-[24px] border border-border bg-surface p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <RangeTabs value={range} onChange={setRange} />
        <a href={adminReportDownloadUrl("csv", { type: "payments", range })} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 font-black text-white"><Download className="h-4 w-4" /> Download Payment Report</a>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total Revenue" value={money(data?.summary.total)} icon={IndianRupee} />
        <Metric label="Paid" value={money(data?.summary.paid)} icon={WalletCards} tone="green" />
        <Metric label="Pending" value={money(data?.summary.pending)} icon={RefreshCcw} tone="amber" />
        <Metric label="Refunds" value={money(data?.summary.refunds)} icon={CreditCard} tone="red" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="Payment Breakdown">
          {isLoading ? <Skeleton /> : !data?.breakdown.length ? <Empty text="No payment records." /> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.breakdown.map((item) => (
                <div key={item.method} className="rounded-[22px] bg-background p-4">
                  <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">{labelPayment(item.method)}</div>
                  <div className="mt-2 text-2xl font-black">{money(item.amount)}</div>
                  <div className="mt-1 text-sm font-bold text-muted-foreground">{item.count} orders · Pending {money(item.pending)}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Pending Payments">
          {!data?.pendingOrders.length ? <Empty text="No pending payments." /> : (
            <div className="space-y-3">
              {data.pendingOrders.slice(0, 8).map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-3 rounded-2xl bg-background p-4">
                  <div className="min-w-0">
                    <div className="truncate font-black text-red-600">#{order.id}</div>
                    <div className="text-sm font-bold text-muted-foreground">{order.customer.name || order.customer.phone}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black">{money(order.total)}</div>
                    <div className="text-xs uppercase text-muted-foreground">{order.paymentMethod}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-[24px] border border-border bg-surface p-4 shadow-sm"><h2 className="mb-4 text-xl font-black">{title}</h2>{children}</section>;
}

function Metric({ label, value, icon: Icon, tone = "slate" }: { label: string; value: string; icon: React.ElementType; tone?: string }) {
  const color = tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "red" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700";
  return <div className="rounded-[22px] border border-border bg-surface p-4 shadow-sm"><span className={`grid h-10 w-10 place-items-center rounded-2xl ${color}`}><Icon className="h-5 w-5" /></span><div className="mt-3 text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-black">{value}</div></div>;
}

function RangeTabs({ value, onChange }: { value: AdminRangePreset; onChange: (value: AdminRangePreset) => void }) {
  const options: AdminRangePreset[] = ["today", "yesterday", "week", "month", "year"];
  return <div className="flex gap-2 overflow-x-auto">{options.map((option) => <button key={option} onClick={() => onChange(option)} className={`min-h-11 shrink-0 rounded-2xl px-4 text-sm font-black capitalize ${value === option ? "bg-red-600 text-white" : "bg-background text-muted-foreground"}`}>{option}</button>)}</div>;
}

function Skeleton() {
  return <div className="h-48 animate-pulse rounded-2xl bg-background" />;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-background p-8 text-center text-sm font-bold text-muted-foreground">{text}</p>;
}

function labelPayment(method: string) {
  const map: Record<string, string> = { cash: "Cash / COD", upi: "UPI", card: "Card", cashfree: "Cashfree", razorpay: "Razorpay", wallet: "Wallet" };
  return map[method] || method;
}

function money(value?: number) {
  return `Rs ${Math.round(value || 0).toLocaleString("en-IN")}`;
}
