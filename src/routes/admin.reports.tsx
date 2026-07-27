import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { adminReportDownloadUrl, getAdminReports, type AdminRangePreset } from "@/services/api";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
});

const reports = [
  "sales",
  "orders",
  "payments",
  "expenses",
  "inventory",
  "salary",
  "customers",
  "delivery",
];

function ReportsPage() {
  const [range, setRange] = useState<AdminRangePreset>("today");
  const [type, setType] = useState("sales");
  const { data, isLoading } = useQuery({ queryKey: ["admin-reports", range], queryFn: () => getAdminReports({ range }) });

  return (
    <main className="space-y-5 p-4 md:p-6 lg:p-8">
      <section className="rounded-[28px] bg-[#120d0e] p-5 text-white shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-red-200">Restaurant Reports</p>
        <h1 className="mt-2 text-3xl font-black">Download Reports</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/65">Sales, orders, payments, expenses, inventory, salary, customer and delivery reports.</p>
      </section>

      <section className="rounded-[24px] border border-border bg-surface p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_240px] md:items-end">
          <div>
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">Date Filter</div>
            <div className="flex gap-2 overflow-x-auto">
              {(["today", "yesterday", "week", "month", "year"] as AdminRangePreset[]).map((option) => (
                <button key={option} onClick={() => setRange(option)} className={`min-h-11 shrink-0 rounded-2xl px-4 text-sm font-black capitalize ${range === option ? "bg-red-600 text-white" : "bg-background text-muted-foreground"}`}>{option}</button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Report Type</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-border bg-background px-3 font-bold capitalize">
              {reports.map((report) => <option key={report} value={report}>{report}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <DownloadCard title="CSV Report" icon={FileText} href={adminReportDownloadUrl("csv", { type, range })} />
        <DownloadCard title="Excel Report" icon={FileSpreadsheet} href={adminReportDownloadUrl("excel", { type, range })} />
        <DownloadCard title="Print / PDF" icon={Printer} href={adminReportDownloadUrl("pdf", { type, range })} />
      </section>

      <section className="rounded-[24px] border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-4 text-xl font-black">Current Summary</h2>
        {isLoading ? <div className="h-48 animate-pulse rounded-2xl bg-background" /> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries((data?.summary ?? {}) as Record<string, unknown>).map(([key, value]) => (
              <div key={key} className="rounded-2xl bg-background p-4">
                <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">{key}</div>
                <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap text-xs font-semibold text-foreground/75">{JSON.stringify(value, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function DownloadCard({ title, href, icon: Icon }: { title: string; href: string; icon: React.ElementType }) {
  return (
    <a href={href} className="group rounded-[24px] border border-border bg-surface p-5 shadow-sm transition hover:border-red-200 hover:bg-red-50">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-red-600 text-white"><Icon className="h-5 w-5" /></span>
      <div className="mt-4 text-xl font-black">{title}</div>
      <div className="mt-2 flex items-center gap-2 text-sm font-black text-red-600"><Download className="h-4 w-4" /> Download</div>
    </a>
  );
}
