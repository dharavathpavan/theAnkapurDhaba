import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BadgeIndianRupee, History, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { useDeliveryPortal } from "@/components/delivery/delivery-context";
import { MetricCard, Field, StatusPill } from "@/components/delivery/delivery-ui";
import {
  getDeliveryWallet,
  requestDeliveryPayout,
  type DeliveryPayoutStatus,
} from "@/services/api";

export const Route = createFileRoute("/delivery/wallet")({
  component: DeliveryWallet,
});

function DeliveryWallet() {
  const portal = useDeliveryPortal();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank");
  const [note, setNote] = useState("");

  const { data: wallet, isLoading } = useQuery({
    queryKey: ["delivery-wallet"],
    queryFn: getDeliveryWallet,
    refetchInterval: 5000,
    enabled: Boolean(portal.profile),
  });

  const request = useMutation({
    mutationFn: () =>
      requestDeliveryPayout({
        amount: Number(amount),
        method,
        note: note || undefined,
      }),
    onSuccess: async () => {
      toast.success("Payout requested. Admin approval needed.");
      setAmount("");
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["delivery-wallet"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not request payout"),
  });

  const statusTone: Record<DeliveryPayoutStatus, "green" | "orange" | "slate"> = {
    requested: "orange",
    approved: "green",
    paid: "green",
    rejected: "slate",
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[32px] border border-emerald-400/20 bg-emerald-400/10 p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Driver wallet</p>
        <h2 className="mt-2 text-4xl font-black text-emerald-100">Rs {wallet?.available ?? 0}</h2>
        <p className="mt-1 text-sm text-emerald-100/80">Available balance. Request a payout to your bank or UPI.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard icon={WalletCards} label="Total earned" value={`Rs ${wallet?.earned ?? 0}`} tone="green" />
        <MetricCard icon={BadgeIndianRupee} label="Paid out" value={`Rs ${wallet?.paidOut ?? 0}`} tone="blue" />
        <MetricCard icon={History} label="In request" value={`Rs ${wallet?.requested ?? 0}`} tone="orange" />
      </div>

      <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-4">
        <h3 className="text-lg font-black">Request payout</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Field label="Amount (Rs)" value={amount} onChange={setAmount} type="number" placeholder="e.g. 100" />
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Method</span>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-3 text-sm font-bold text-white outline-none focus:border-orange-300"
            >
              <option value="bank">Bank transfer</option>
              <option value="upi">UPI</option>
              <option value="cash">Cash pickup</option>
            </select>
          </label>
          <Field label="Note" value={note} onChange={setNote} placeholder="Optional note" />
        </div>
        <button
          onClick={() => request.mutate()}
          disabled={!amount || Number(amount) <= 0 || request.isPending}
          className="mt-3 w-full rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-emerald-950 shadow-lg shadow-emerald-950/20 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          Request Payout
        </button>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-4">
        <h3 className="text-lg font-black">Transaction history</h3>
        <div className="mt-3 space-y-2">
          {isLoading && <p className="text-sm text-slate-400">Loading wallet...</p>}
          {!isLoading && (wallet?.transactions?.length ?? 0) === 0 && (
            <p className="text-sm text-slate-400">No transactions yet.</p>
          )}
          {(wallet?.transactions ?? []).map((tx) => (
            <div key={tx.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-950/40 p-3 text-sm">
              <div className="min-w-0">
                <span className="block truncate font-bold">
                  {tx.type === "earning" ? `Earning #${tx.orderId ?? ""}` : tx.type === "payout_rejected" ? "Payout rejected" : "Payout"}
                </span>
                <span className="block text-xs text-slate-400">
                  {new Date(tx.date).toLocaleString()} · {tx.note || tx.status}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusPill tone={statusTone[tx.status as DeliveryPayoutStatus] ?? "slate"}>{tx.status || tx.type}</StatusPill>
                <span className={`font-black ${tx.type === "earning" ? "text-emerald-300" : "text-orange-300"}`}>
                  {tx.type === "earning" ? "+" : "-"} Rs {tx.amount}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
