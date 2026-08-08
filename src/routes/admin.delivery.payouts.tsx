import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BadgeIndianRupee, CheckCircle2, WalletCards, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  approveDeliveryPayout,
  listAdminPayouts,
  rejectDeliveryPayout,
  type DeliveryPayout,
  type DeliveryPayoutStatus,
} from "@/services/api";

export const Route = createFileRoute("/admin/delivery/payouts")({
  component: AdminPayouts,
});

const FILTERS: { id: string; label: string }[] = [
  { id: "requested", label: "Requested" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "paid", label: "Paid" },
  { id: "all", label: "All" },
];

function AdminPayouts() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("requested");

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ["admin-payouts", filter],
    queryFn: () => listAdminPayouts(filter),
    refetchInterval: 8000,
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-payouts"] }),
      queryClient.invalidateQueries({ queryKey: ["delivery-wallet"] }),
    ]);
  };

  const approve = useMutation({
    mutationFn: (id: string) => approveDeliveryPayout(id),
    onSuccess: async () => {
      toast.success("Payout approved");
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not approve"),
  });
  const reject = useMutation({
    mutationFn: (id: string) => rejectDeliveryPayout(id),
    onSuccess: async () => {
      toast.success("Payout rejected");
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not reject"),
  });

  const totals = payouts.reduce(
    (acc, payout) => {
      acc[payout.status as DeliveryPayoutStatus] = (acc[payout.status as DeliveryPayoutStatus] || 0) + payout.amount;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-600">Driver payouts</p>
          <h2 className="text-2xl font-black">Payout Requests</h2>
          <p className="text-sm text-muted-foreground">Approve or reject rider withdrawal requests.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatPill icon={WalletCards} label="Total" value={`Rs ${Object.values(totals).reduce((s, v) => s + v, 0)}`} />
          <StatPill icon={BadgeIndianRupee} label="Requested" value={`Rs ${totals.requested || 0}`} />
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            onClick={() => setFilter(item.id)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black transition ${
              filter === item.id ? "bg-red-600 text-white" : "text-muted-foreground hover:bg-background"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-border bg-surface p-6 text-sm text-muted-foreground">Loading payouts...</div>
      ) : payouts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          No {filter === "all" ? "" : filter + " "}payouts found.
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map((payout) => (
            <PayoutRow
              key={payout.id}
              payout={payout}
              onApprove={() => approve.mutate(payout.id)}
              onReject={() => reject.mutate(payout.id)}
              approvePending={approve.isPending}
              rejectPending={reject.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PayoutRow({
  payout,
  onApprove,
  onReject,
  approvePending,
  rejectPending,
}: {
  payout: DeliveryPayout;
  onApprove: () => void;
  onReject: () => void;
  approvePending: boolean;
  rejectPending: boolean;
}) {
  const statusTone: Record<string, string> = {
    requested: "bg-orange-100 text-orange-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-600",
    paid: "bg-emerald-100 text-emerald-700",
  };
  const canAct = payout.status === "requested";
  return (
    <article className="rounded-[24px] border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-lg font-black">Rs {payout.amount}</p>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${statusTone[payout.status] || "bg-zinc-100 text-zinc-600"}`}>
              {payout.status.toUpperCase()}
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-bold">
            {payout.riderName || "Rider"} · {payout.method?.toUpperCase() || "BANK"}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(payout.requestedAt).toLocaleString()}
            {payout.note ? ` · ${payout.note}` : ""}
          </p>
          {payout.approvedByName && (
            <p className="mt-1 text-xs text-muted-foreground">
              {payout.status === "approved"
                ? `Approved by ${payout.approvedByName}`
                : payout.status === "rejected"
                  ? `Rejected by ${payout.approvedByName}`
                  : `Processed by ${payout.approvedByName}`}
            </p>
          )}
        </div>
        {canAct && (
          <div className="flex shrink-0 gap-2">
            <button
              onClick={onReject}
              disabled={rejectPending}
              className="inline-flex items-center gap-1 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-600 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" /> Reject
            </button>
            <button
              onClick={onApprove}
              disabled={approvePending}
              className="inline-flex items-center gap-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" /> Approve
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">
      <Icon className="h-4 w-4 text-red-600" />
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
        <div className="text-sm font-black">{value}</div>
      </div>
    </div>
  );
}
