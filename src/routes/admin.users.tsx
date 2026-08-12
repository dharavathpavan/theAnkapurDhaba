import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeIndianRupee,
  Crown,
  Eye,
  History,
  Minus,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  Trash2,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import {
  adjustAdminUserWallet,
  deleteStaff,
  getAdminCustomerContent,
  listAdminUsers,
  listStaff,
  refundAdminUserWallet,
  registerStaff,
  type AdminCustomerUser,
  type StaffUser,
  type WalletTransaction,
} from "@/services/api";
import { useOrderRealtime } from "@/hooks/use-order-realtime";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Users & Wallet - The Ankapure Dhaba" }] }),
  component: UsersPage,
});

type Tab = "customers" | "wallet" | "staff" | "coupons";
type WalletMode = "credit" | "debit" | "refund";

const tierClass: Record<string, string> = {
  bronze: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  silver: "border-zinc-300/40 bg-zinc-300/10 text-zinc-200",
  gold: "border-yellow-400/40 bg-yellow-400/10 text-yellow-200",
  platinum: "border-sky-300/40 bg-sky-300/10 text-sky-200",
};

function UsersPage() {
  useOrderRealtime();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("customers");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [walletAction, setWalletAction] = useState<{
    user: AdminCustomerUser;
    mode: WalletMode;
  } | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: listAdminUsers,
    refetchInterval: 15000,
  });
  const staffQuery = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const contentQuery = useQuery({
    queryKey: ["admin-customer-content"],
    queryFn: getAdminCustomerContent,
  });
  const users = usersQuery.data ?? [];
  const selected = users.find((user) => user.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      [
        user.name,
        user.phone,
        user.email,
        user.tier,
        String(user.orderCount),
        String(user.walletBalance),
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(term),
      ),
    );
  }, [query, users]);

  const summary = useMemo(() => {
    const walletTotal = users.reduce((sum, user) => sum + Number(user.walletBalance || 0), 0);
    const refunds = users.reduce(
      (sum, user) =>
        sum +
        user.walletTransactions
          .filter((tx) => tx.type === "refund")
          .reduce((s, tx) => s + Math.max(0, tx.amount), 0),
      0,
    );
    const newCustomers = users.filter(
      (user) => Date.now() - new Date(user.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000,
    ).length;
    return { walletTotal, refunds, newCustomers };
  }, [users]);

  function refreshAll() {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["staff"] });
    qc.invalidateQueries({ queryKey: ["admin-customer-content"] });
  }

  return (
    <div className="min-h-screen bg-[#05070b] px-4 py-6 text-white md:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-gradient-to-br from-zinc-950 to-red-950/30 p-5 shadow-2xl shadow-black/30 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-red-300">
              The Ankapure Dhaba
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">
              Users & Main Wallet
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-zinc-400">
              Customer profiles, one-wallet balance, refunds, staff logins and coupon visibility in
              one admin control center.
            </p>
          </div>
          <button
            onClick={refreshAll}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 font-black text-zinc-950"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </header>

        <section className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Metric icon={Users} label="Customers" value={String(users.length)} />
          <Metric
            icon={ShieldCheck}
            label="Active buyers"
            value={String(users.filter((u) => u.orderCount > 0).length)}
          />
          <Metric icon={Crown} label="New this week" value={String(summary.newCustomers)} />
          <Metric
            icon={Wallet}
            label="Wallet total"
            value={`Rs ${Math.round(summary.walletTotal)}`}
          />
          <Metric icon={ReceiptText} label="Refunds" value={`Rs ${Math.round(summary.refunds)}`} />
          <Metric icon={UserCog} label="Staff" value={String(staffQuery.data?.length ?? 0)} />
        </section>

        <nav className="mt-5 flex gap-2 overflow-x-auto rounded-[24px] border border-white/10 bg-white/5 p-2">
          {(
            [
              ["customers", "Customers", Users],
              ["wallet", "Wallet", Wallet],
              ["staff", "Staff", UserCog],
              ["coupons", "Coupons", Ticket],
            ] as Array<[Tab, string, React.ElementType]>
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-2xl px-4 font-black ${tab === value ? "bg-red-600 text-white shadow-lg shadow-red-600/25" : "text-zinc-300 hover:bg-white/10"}`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>

        {(tab === "customers" || tab === "wallet") && (
          <section className="mt-5 rounded-[28px] border border-white/10 bg-zinc-950/80 shadow-xl shadow-black/20">
            <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between">
              <div className="relative max-w-xl flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search customer, phone, wallet, tier..."
                  className="h-13 w-full rounded-2xl border border-white/10 bg-black/40 pl-12 pr-4 font-semibold text-white outline-none focus:border-red-400"
                />
              </div>
              <div className="text-sm font-bold text-zinc-400">
                {filtered.length} customers shown
              </div>
            </div>

            <div className="grid gap-4 p-4 xl:grid-cols-[1fr_390px]">
              <div className="overflow-hidden rounded-[22px] border border-white/10">
                <div className="hidden grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_120px] bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-500 md:grid">
                  <span>Customer</span>
                  <span>Orders</span>
                  <span>Spend</span>
                  <span>Wallet</span>
                  <span>Action</span>
                </div>
                <div className="divide-y divide-white/10">
                  {filtered.length === 0 ? (
                    <div className="p-10 text-center text-zinc-500">
                      No customers match this search.
                    </div>
                  ) : (
                    filtered.map((user) => (
                      <CustomerRow
                        key={user.id}
                        user={user}
                        active={selectedId === user.id}
                        onView={() => setSelectedId(user.id)}
                        onWallet={(mode) => setWalletAction({ user, mode })}
                      />
                    ))
                  )}
                </div>
              </div>

              <CustomerDetail
                user={selected ?? filtered[0] ?? null}
                onWallet={(user, mode) => setWalletAction({ user, mode })}
              />
            </div>
          </section>
        )}

        {tab === "staff" && <StaffSection staff={staffQuery.data ?? []} onChange={refreshAll} />}
        {tab === "coupons" && <CouponsPanel coupons={contentQuery.data?.coupons ?? []} />}
      </div>

      {walletAction && (
        <WalletActionModal
          action={walletAction}
          onClose={() => setWalletAction(null)}
          onDone={() => {
            setWalletAction(null);
            refreshAll();
          }}
        />
      )}
    </div>
  );
}

function CustomerRow({
  user,
  active,
  onView,
  onWallet,
}: {
  user: AdminCustomerUser;
  active: boolean;
  onView: () => void;
  onWallet: (mode: WalletMode) => void;
}) {
  return (
    <div
      className={`grid gap-3 p-4 md:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_120px] md:items-center ${active ? "bg-red-500/10" : "bg-transparent"}`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-black text-white">{user.name}</div>
          <Tier tier={user.tier} />
        </div>
        <div className="mt-1 text-sm font-semibold text-zinc-400">
          {user.phone}
          {user.email ? ` · ${user.email}` : ""}
        </div>
      </div>
      <InfoStack label="Orders" value={String(user.orderCount)} />
      <InfoStack label="Spend" value={`Rs ${Math.round(user.totalSpend)}`} />
      <InfoStack label="Main Wallet" value={`Rs ${Math.round(user.walletBalance)}`} accent />
      <div className="flex items-center gap-2">
        <button
          onClick={onView}
          className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-white hover:bg-white/20"
          aria-label="View customer"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={() => onWallet("credit")}
          className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500 text-white"
          aria-label="Add money"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          onClick={() => onWallet("refund")}
          className="grid h-11 w-11 place-items-center rounded-2xl bg-red-600 text-white"
          aria-label="Refund"
        >
          <BadgeIndianRupee className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CustomerDetail({
  user,
  onWallet,
}: {
  user: AdminCustomerUser | null;
  onWallet: (user: AdminCustomerUser, mode: WalletMode) => void;
}) {
  if (!user)
    return (
      <aside className="rounded-[24px] border border-white/10 bg-black/30 p-6 text-center text-zinc-500">
        Select a customer to view details.
      </aside>
    );
  const defaultAddress = user.addresses?.find((item) => item.isDefault) ?? user.addresses?.[0];
  return (
    <aside className="rounded-[24px] border border-white/10 bg-black/30 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">{user.name}</h2>
          <p className="mt-1 text-sm font-semibold text-zinc-400">{user.phone}</p>
        </div>
        <Tier tier={user.tier} />
      </div>

      <div className="mt-5 rounded-[22px] bg-gradient-to-br from-emerald-500 to-teal-700 p-5 text-white">
        <div className="flex items-center justify-between">
          <span className="text-sm font-black uppercase tracking-widest text-white/70">
            Main Wallet
          </span>
          <Wallet className="h-6 w-6" />
        </div>
        <div className="mt-3 text-4xl font-black">Rs {Math.round(user.walletBalance)}</div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            onClick={() => onWallet(user, "credit")}
            className="rounded-2xl bg-white px-3 py-3 text-xs font-black text-emerald-700"
          >
            Add
          </button>
          <button
            onClick={() => onWallet(user, "debit")}
            className="rounded-2xl bg-black/25 px-3 py-3 text-xs font-black text-white"
          >
            Remove
          </button>
          <button
            onClick={() => onWallet(user, "refund")}
            className="rounded-2xl bg-red-600 px-3 py-3 text-xs font-black text-white"
          >
            Refund
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MiniCard label="Orders" value={String(user.orderCount)} />
        <MiniCard label="Spend" value={`Rs ${Math.round(user.totalSpend)}`} />
        <MiniCard label="Addresses" value={String(user.addresses?.length ?? 0)} />
        <MiniCard label="Reviews" value={String(user.reviews?.length ?? 0)} />
      </div>

      <section className="mt-5">
        <h3 className="mb-2 flex items-center gap-2 font-black">
          <History className="h-4 w-4 text-red-400" /> Wallet history
        </h3>
        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {user.walletTransactions.length === 0 ? (
            <p className="rounded-2xl bg-white/5 p-4 text-sm text-zinc-500">
              No wallet transactions yet.
            </p>
          ) : (
            user.walletTransactions.slice(0, 8).map((tx) => <TransactionRow key={tx.id} tx={tx} />)
          )}
        </div>
      </section>

      <section className="mt-5 rounded-2xl bg-white/5 p-4">
        <h3 className="font-black">Default address</h3>
        <p className="mt-2 text-sm font-semibold text-zinc-400">
          {defaultAddress?.address || "No saved address"}
        </p>
      </section>

      <section className="mt-5">
        <h3 className="mb-2 font-black">Recent orders</h3>
        <div className="space-y-2">
          {user.orders.slice(0, 4).map((order) => (
            <div key={order.id} className="rounded-2xl bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-red-300">#{order.id}</span>
                <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-black uppercase">
                  {order.status}
                </span>
              </div>
              <div className="mt-1 text-sm text-zinc-400">
                Rs {order.total} · {new Date(order.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function WalletActionModal({
  action,
  onClose,
  onDone,
}: {
  action: { user: AdminCustomerUser; mode: WalletMode };
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState(
    action.mode === "refund" ? "Refund approved by restaurant" : "",
  );
  const [orderId, setOrderId] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error("Enter a valid amount");
      if (reason.trim().length < 3) throw new Error("Reason is required");
      if (action.mode === "refund")
        return refundAdminUserWallet(action.user.id, {
          amount: value,
          reason,
          orderId: orderId || null,
        });
      return adjustAdminUserWallet(action.user.id, {
        amount: value,
        direction: action.mode === "debit" ? "debit" : "credit",
        reason,
        orderId: orderId || null,
      });
    },
    onSuccess: () => {
      toast.success("Wallet updated");
      onDone();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Wallet update failed"),
  });
  const title =
    action.mode === "refund"
      ? "Refund to wallet"
      : action.mode === "debit"
        ? "Remove money"
        : "Add money";
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-zinc-950 p-5 text-white shadow-2xl">
        <h2 className="text-2xl font-black">{title}</h2>
        <p className="mt-1 text-sm text-zinc-400">
          {action.user.name} · Current wallet Rs {Math.round(action.user.walletBalance)}
        </p>
        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-widest text-zinc-500">
              Amount
            </span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))}
              className="h-13 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none focus:border-red-400"
              placeholder="500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-widest text-zinc-500">
              Reason
            </span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none focus:border-red-400"
              placeholder="Why is this wallet change needed?"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-widest text-zinc-500">
              Linked order optional
            </span>
            <input
              value={orderId}
              onChange={(event) => setOrderId(event.target.value.toUpperCase())}
              className="h-13 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none focus:border-red-400"
              placeholder="AD1234567"
            />
          </label>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="min-h-13 rounded-2xl bg-white/10 font-black text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="min-h-13 rounded-2xl bg-red-600 font-black text-white disabled:opacity-60"
          >
            {mutation.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StaffSection({ staff, onChange }: { staff: StaffUser[]; onChange: () => void }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    role: "DELIVERY" as "KITCHEN" | "DELIVERY" | "WAITER",
  });
  const [saving, setSaving] = useState(false);
  async function createStaff() {
    if (!form.name.trim() || form.phone.length < 10 || form.password.length < 6)
      return toast.error("Enter name, 10-digit phone and 6+ character password");
    setSaving(true);
    try {
      await registerStaff(form);
      toast.success("Staff login created");
      setForm({ name: "", phone: "", password: "", role: form.role });
      onChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create staff login");
    } finally {
      setSaving(false);
    }
  }
  async function removeStaff(id: string) {
    try {
      await deleteStaff(id);
      toast.success("Staff login removed");
      onChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove staff");
    }
  }
  return (
    <section className="mt-5 rounded-[28px] border border-white/10 bg-zinc-950/80 p-5 text-white">
      <h2 className="flex items-center gap-2 text-2xl font-black">
        <UserCog className="h-5 w-5 text-red-400" /> Staff logins
      </h2>
      <div className="mt-5 grid gap-3 md:grid-cols-5">
        <DarkInput
          label="Name"
          value={form.name}
          onChange={(value) => setForm({ ...form, name: value })}
        />
        <DarkInput
          label="Phone"
          value={form.phone}
          onChange={(value) => setForm({ ...form, phone: value.replace(/\D/g, "").slice(0, 10) })}
        />
        <DarkInput
          label="Password"
          value={form.password}
          onChange={(value) => setForm({ ...form, password: value })}
        />
        <label className="block">
          <span className="mb-1 block text-xs font-black uppercase tracking-widest text-zinc-500">
            Role
          </span>
          <select
            value={form.role}
            onChange={(event) =>
              setForm({ ...form, role: event.target.value as "KITCHEN" | "DELIVERY" | "WAITER" })
            }
            className="h-13 w-full rounded-2xl border border-white/10 bg-black/40 px-3 text-white"
          >
            <option value="DELIVERY">Delivery partner</option>
            <option value="WAITER">Waiter staff</option>
            <option value="KITCHEN">Kitchen staff</option>
          </select>
        </label>
        <button
          onClick={createStaff}
          disabled={saving}
          className="mt-5 min-h-13 rounded-2xl bg-red-600 font-black text-white md:mt-6"
        >
          {saving ? "Creating..." : "Create login"}
        </button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {staff.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 p-4"
          >
            <div>
              <div className="font-black">{member.name}</div>
              <div className="text-sm text-zinc-400">
                {member.phone} · {member.role}
              </div>
            </div>
            {member.role !== "ADMIN" && (
              <button
                onClick={() => removeStaff(member.id)}
                className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-zinc-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function CouponsPanel({
  coupons,
}: {
  coupons: Array<{
    id: string;
    code: string;
    title: string;
    discountType: string;
    discountValue: number;
    active: boolean;
    minOrder: number;
    expiresAt?: string | null;
  }>;
}) {
  return (
    <section className="mt-5 rounded-[28px] border border-white/10 bg-zinc-950/80 p-5 text-white">
      <h2 className="flex items-center gap-2 text-2xl font-black">
        <Ticket className="h-5 w-5 text-red-400" /> Coupons
      </h2>
      <p className="mt-1 text-sm text-zinc-400">
        Coupon editing remains in marketing/store tools; this panel shows current customer coupon
        visibility.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {coupons.length === 0 ? (
          <div className="rounded-2xl bg-white/5 p-6 text-zinc-500">No coupons configured.</div>
        ) : (
          coupons.map((coupon) => (
            <div key={coupon.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-xl font-black text-red-300">{coupon.code}</div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-black ${coupon.active ? "bg-emerald-500/20 text-emerald-200" : "bg-zinc-500/20 text-zinc-300"}`}
                >
                  {coupon.active ? "Active" : "Paused"}
                </span>
              </div>
              <div className="mt-2 font-bold">{coupon.title}</div>
              <div className="mt-1 text-sm text-zinc-400">
                {coupon.discountType === "flat"
                  ? `Rs ${coupon.discountValue}`
                  : `${coupon.discountValue}%`}{" "}
                off · Min Rs {coupon.minOrder}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-zinc-950 p-4">
      <Icon className="h-5 w-5 text-red-400" />
      <div className="mt-3 text-xs font-black uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
}

function Tier({ tier }: { tier: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${tierClass[tier] ?? tierClass.bronze}`}
    >
      <Crown className="h-3 w-3" /> {tier}
    </span>
  );
}

function InfoStack({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-black uppercase tracking-widest text-zinc-500 md:hidden">
        {label}
      </div>
      <div className={`font-black ${accent ? "text-emerald-300" : "text-white"}`}>{value}</div>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <div className="text-xs font-black uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  );
}

function TransactionRow({ tx }: { tx: WalletTransaction }) {
  const positive = tx.amount >= 0;
  return (
    <div className="rounded-2xl bg-white/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold capitalize">{tx.type.replace(/_/g, " ")}</span>
        <span className={`font-black ${positive ? "text-emerald-300" : "text-red-300"}`}>
          {positive ? "+" : "-"}Rs {Math.abs(tx.amount)}
        </span>
      </div>
      <div className="mt-1 text-xs text-zinc-500">
        {tx.reason} · Balance Rs {tx.balanceAfter}
      </div>
    </div>
  );
}

function DarkInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-13 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none focus:border-red-400"
      />
    </label>
  );
}
