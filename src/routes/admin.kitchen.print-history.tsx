import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Filter, Printer, RefreshCcw, RotateCcw, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import { listPrinterHistory, updatePrinterHistory, type PrinterHistoryEntry } from "@/services/api";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/admin/kitchen/print-history")({
  head: () => ({
    meta: [{ title: "Kitchen Print History | The Ankapure Dhaba" }, { name: "robots", content: "noindex" }],
  }),
  component: PrintHistoryPage,
});

function PrintHistoryPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [orderId, setOrderId] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["printer-history", status, orderId],
    queryFn: () => listPrinterHistory({ status: status || undefined, orderId: orderId || undefined }),
  });

  const retryMutation = useMutation({
    mutationFn: async (entry: PrinterHistoryEntry) =>
      updatePrinterHistory(entry.id, {
        status: "retrying",
        attempts: (entry.attempts || 0) + 1,
        message: "Queued for manual retry. Open the KDS order and print again if bridge is unavailable.",
      }),
    onSuccess: () => {
      toast.success("Print job marked for retry");
      qc.invalidateQueries({ queryKey: ["printer-history"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not retry print job"),
  });

  const summary = useMemo(
    () => ({
      total: data.length,
      success: data.filter((entry) => entry.status === "success").length,
      failed: data.filter((entry) => entry.status === "failed").length,
      printing: data.filter((entry) => ["printing", "queued", "retrying"].includes(entry.status)).length,
    }),
    [data],
  );

  return (
    <main className="min-h-screen bg-[#0f1115] p-4 text-white md:p-6">
      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.24em] text-red-300">
              <CalendarClock className="h-5 w-5" /> Print History
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Kitchen Print Attempts</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
              Track successful KOT prints, bridge failures, retries, copies and station routing from one place.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-4">
        <SummaryCard label="Total jobs" value={summary.total} />
        <SummaryCard label="Successful" value={summary.success} tone="green" />
        <SummaryCard label="In queue" value={summary.printing} tone="amber" />
        <SummaryCard label="Failed" value={summary.failed} tone="red" />
      </section>

      <section className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
            <input
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              placeholder="Search order or KOT number"
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 pl-12 pr-4 text-sm font-bold text-white outline-none"
            />
          </label>
          <label className="relative block">
            <Filter className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 pl-12 pr-4 text-sm font-bold text-white outline-none"
            >
              <option value="">All statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="printing">Printing</option>
              <option value="retrying">Retrying</option>
              <option value="queued">Queued</option>
            </select>
          </label>
        </div>
      </section>

      <section className="mt-5 grid gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-[28px] bg-white/8" />)
        ) : data.length ? (
          data.map((entry) => (
            <article key={entry.id} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-950">#{entry.orderNumber}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(entry.status)}`}>{entry.status}</span>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-white/55">{entry.jobType}</span>
                  </div>
                  <h2 className="mt-3 text-xl font-black">{entry.station || "General Kitchen"} print job</h2>
                  <p className="mt-1 text-sm text-white/50">
                    {entry.copies} copy/copies • {entry.paperSize} • Attempts {entry.attempts || 0} • {new Date(entry.createdAt).toLocaleString()}
                  </p>
                  {entry.message ? <p className="mt-2 text-sm text-white/65">{entry.message}</p> : null}
                </div>
                <div className="flex gap-2">
                  {entry.status === "failed" ? (
                    <button
                      type="button"
                      disabled={retryMutation.isPending}
                      onClick={() => retryMutation.mutate(entry)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 text-sm font-black text-white disabled:opacity-50"
                    >
                      <RotateCcw className="h-4 w-4" /> Retry
                    </button>
                  ) : (
                    <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 text-sm font-bold text-white/55">
                      <Printer className="h-4 w-4" /> Logged
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-10 text-center">
            <XCircle className="mx-auto h-10 w-10 text-white/30" />
            <h2 className="mt-3 text-xl font-black">No print jobs found</h2>
            <p className="mt-2 text-sm text-white/50">KOT prints, test prints and retry attempts will appear here.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "green" | "amber" | "red" }) {
  const tones = {
    slate: "border-white/10 bg-white/[0.04] text-white",
    green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-100",
    red: "border-red-400/20 bg-red-400/10 text-red-100",
  };
  return (
    <article className={`rounded-[24px] border p-4 ${tones[tone]}`}>
      <p className="text-xs font-black uppercase tracking-[0.2em] opacity-60">{label}</p>
      <div className="mt-2 text-3xl font-black">{value}</div>
    </article>
  );
}

function statusClass(status: string) {
  if (status === "success") return "bg-emerald-400/15 text-emerald-200";
  if (status === "failed") return "bg-red-400/15 text-red-100";
  if (status === "retrying" || status === "queued" || status === "printing") return "bg-amber-400/15 text-amber-100";
  return "bg-white/10 text-white/70";
}
