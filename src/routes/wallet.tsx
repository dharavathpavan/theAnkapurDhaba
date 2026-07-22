import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownCircle,
  CheckCircle2,
  CreditCard,
  History,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createWalletTopupSession, getCustomerWallet, verifyWalletTopup } from "@/services/api";
import { useAuth } from "@/stores/auth";

const PENDING_KEY = "ankapur:wallet-pending-topup";

export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [{ title: "Main Wallet - The Ankapure Dhaba" }] }),
  component: WalletPage,
});

function WalletPage() {
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  const [amount, setAmount] = useState("500");
  const [pending, setPending] = useState<{ orderId: string; amount: number } | null>(() =>
    readPendingTopup(),
  );
  const { data: wallet, isLoading } = useQuery({
    queryKey: ["customer-wallet"],
    queryFn: getCustomerWallet,
    enabled: isAuthenticated(),
  });

  const topup = useMutation({
    mutationFn: async () => {
      const value = Number(amount);
      if (!Number.isFinite(value) || value < 1 || value > 50000)
        throw new Error("Enter an amount between Rs 1 and Rs 50,000");
      const session = await createWalletTopupSession(value);
      if (!session.paymentSessionId) throw new Error("Wallet top-up session was not created");
      const nextPending = { orderId: session.orderId, amount: value };
      savePendingTopup(nextPending);
      setPending(nextPending);
      const checkout = await openCashfreeCheckout(session.paymentSessionId, session.mode);
      if (checkout.redirect) return null;
      return verifyTopup(nextPending);
    },
    onSuccess: (result) => {
      if (!result) return;
      qc.invalidateQueries({ queryKey: ["customer-wallet"] });
      toast.success("Money added to Main Wallet");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Wallet top-up failed"),
  });

  const verify = useMutation({
    mutationFn: async () => {
      if (!pending) throw new Error("No pending wallet payment found");
      return verifyTopup(pending);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-wallet"] });
      toast.success("Wallet payment verified");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Payment is not complete yet"),
  });

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("order_id");
    if (fromUrl && pending?.orderId === fromUrl) verify.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verifyTopup(nextPending: { orderId: string; amount: number }) {
    const result = await verifyWalletTopup(nextPending.orderId, nextPending.amount);
    if (String(result.status).toUpperCase() !== "PAID" || !result.wallet)
      throw new Error("Payment was not completed");
    clearPendingTopup();
    setPending(null);
    return result;
  }

  const quickAmounts = useMemo(() => [200, 500, 1000, 2000], []);

  if (!isAuthenticated()) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <Wallet className="mx-auto h-12 w-12 text-zinc-400" />
        <h1 className="mt-4 text-3xl font-black">Sign in to use wallet</h1>
        <p className="mt-2 text-zinc-500">
          Add money, view refunds and pay faster from your Main Wallet.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-flex rounded-3xl bg-red-600 px-6 py-4 font-black text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-5 md:px-6 md:py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">
            The Ankapure Dhaba
          </p>
          <h1 className="text-4xl font-black">Main Wallet</h1>
        </div>
        <Link
          to="/support"
          className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-black text-white"
        >
          Need help?
        </Link>
      </div>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[34px] bg-gradient-to-br from-emerald-500 to-teal-800 p-6 text-white shadow-xl shadow-emerald-700/20">
          <Wallet className="h-9 w-9" />
          <p className="mt-8 text-sm font-black uppercase tracking-[0.2em] text-white/70">
            Available balance
          </p>
          <div className="mt-1 text-6xl font-black">
            Rs {isLoading ? "..." : Math.round(wallet?.balance ?? 0)}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <MiniStat icon={ShieldCheck} title="Verified" text="Backend credited" />
            <MiniStat icon={CreditCard} title="Cashfree" text="UPI, cards, netbanking" />
            <MiniStat icon={History} title="Ledger" text="Every rupee tracked" />
          </div>
        </div>

        <div className="rounded-[34px] bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <h2 className="text-2xl font-black">Add money</h2>
          <p className="mt-1 text-sm font-semibold text-zinc-500">
            Wallet is credited only after Cashfree confirms payment.
          </p>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {quickAmounts.map((value) => (
              <button
                key={value}
                onClick={() => setAmount(String(value))}
                className={`rounded-2xl py-3 text-sm font-black ring-1 ${amount === String(value) ? "bg-red-600 text-white ring-red-600" : "bg-zinc-50 text-zinc-700 ring-zinc-200"}`}
              >
                Rs {value}
              </button>
            ))}
          </div>
          <label className="mt-4 block">
            <span className="text-sm font-black">Custom amount</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))}
              className="mt-2 h-14 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-xl font-black outline-none focus:border-red-500"
            />
          </label>
          <button
            onClick={() => topup.mutate()}
            disabled={topup.isPending}
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-red-600 font-black text-white shadow-lg shadow-red-600/20 disabled:opacity-60"
          >
            <ArrowDownCircle className="h-5 w-5" />
            {topup.isPending ? "Opening Cashfree..." : "Add Money Securely"}
          </button>
          {pending && (
            <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
              <div className="font-black text-yellow-900">Pending top-up: Rs {pending.amount}</div>
              <p className="mt-1 text-sm font-semibold text-yellow-800">
                Order {pending.orderId}. If payment succeeded, verify it here.
              </p>
              <button
                onClick={() => verify.mutate()}
                disabled={verify.isPending}
                className="mt-3 rounded-xl bg-yellow-500 px-4 py-2 text-sm font-black text-yellow-950 disabled:opacity-60"
              >
                {verify.isPending ? "Checking..." : "Verify payment"}
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="mt-5 rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-zinc-100">
        <h2 className="flex items-center gap-2 text-2xl font-black">
          <History className="h-6 w-6 text-red-600" /> Wallet history
        </h2>
        <div className="mt-4 space-y-2">
          {(wallet?.transactions ?? []).length === 0 ? (
            <p className="rounded-2xl bg-zinc-50 p-5 text-sm font-semibold text-zinc-500">
              No wallet activity yet.
            </p>
          ) : (
            wallet!.transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-50 p-4"
              >
                <div>
                  <div className="font-black capitalize">{tx.type.replace(/_/g, " ")}</div>
                  <div className="text-xs font-semibold text-zinc-500">{tx.reason}</div>
                  <div className="mt-1 text-[11px] font-bold text-zinc-400">
                    {new Date(tx.createdAt).toLocaleString()}
                  </div>
                </div>
                <div
                  className={`text-right font-black ${tx.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}
                >
                  {tx.amount >= 0 ? "+" : "-"}Rs {Math.abs(tx.amount)}
                  <div className="text-[11px] text-zinc-400">
                    Bal Rs {Math.round(tx.balanceAfter)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl bg-white/15 p-4">
      <Icon className="h-5 w-5" />
      <div className="mt-2 font-black">{title}</div>
      <div className="text-xs text-white/70">{text}</div>
    </div>
  );
}

function readPendingTopup() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || "null") as {
      orderId: string;
      amount: number;
    } | null;
  } catch {
    return null;
  }
}

function savePendingTopup(value: { orderId: string; amount: number }) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(value));
}

function clearPendingTopup() {
  localStorage.removeItem(PENDING_KEY);
}

declare global {
  interface Window {
    Cashfree?: (options: { mode: "sandbox" | "production" }) => {
      checkout: (options: {
        paymentSessionId: string;
        redirectTarget: "_modal" | "_self" | "_top" | "_blank";
      }) => Promise<{ error?: unknown; redirect?: boolean; paymentDetails?: unknown }>;
    };
    __cashfreeScriptLoading?: Promise<void>;
  }
}

async function loadCashfreeScript() {
  if (typeof window === "undefined")
    throw new Error("Cashfree checkout is available only in browser");
  if (window.Cashfree) return;
  if (!window.__cashfreeScriptLoading) {
    window.__cashfreeScriptLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Unable to load Cashfree checkout"));
      document.head.appendChild(script);
    });
  }
  await window.__cashfreeScriptLoading;
  if (!window.Cashfree) throw new Error("Cashfree checkout did not initialize");
}

async function openCashfreeCheckout(paymentSessionId: string, mode: "sandbox" | "production") {
  await loadCashfreeScript();
  const cashfree = window.Cashfree?.({ mode });
  if (!cashfree) throw new Error("Cashfree checkout is unavailable");
  const result = await cashfree.checkout({ paymentSessionId, redirectTarget: "_modal" });
  if (result.error) throw new Error("Payment was not completed");
  return result;
}
