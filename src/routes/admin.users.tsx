import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crown, Plus, Trash2, Tag, Ticket } from "lucide-react";
import { listOrders } from "@/services/api";
import {
  computeTierFromOrders,
  deleteCoupon,
  listCoupons,
  listCustomerMeta,
  setCustomerMeta,
  upsertCoupon,
  type Coupon,
  type CustomerTier,
} from "@/services/store";
import { useOrderRealtime } from "@/hooks/use-order-realtime";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Users & Coupons · Ankapur Dhaba" }] }),
  component: UsersPage,
});

const TIERS: CustomerTier[] = ["bronze", "silver", "gold", "platinum"];
const TIER_CLS: Record<CustomerTier, string> = {
  bronze: "bg-amber-700/20 text-amber-500 border-amber-600/40",
  silver: "bg-zinc-400/20 text-zinc-300 border-zinc-400/40",
  gold: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  platinum: "bg-sky-400/20 text-sky-300 border-sky-400/40",
};

function UsersPage() {
  useOrderRealtime();
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: listOrders, refetchInterval: 5000 });
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);

  const meta = listCustomerMeta();
  const coupons = listCoupons();

  type Row = {
    phone: string;
    name: string;
    orderCount: number;
    totalSpend: number;
    lastOrder: string;
    tier: CustomerTier;
    autoTier: CustomerTier;
  };

  const rows: Row[] = useMemo(() => {
    const map = new Map<string, Row>();
    for (const o of orders) {
      const phone = o.customer.phone;
      const existing = map.get(phone);
      const totalSpend = (existing?.totalSpend ?? 0) + o.total;
      const orderCount = (existing?.orderCount ?? 0) + 1;
      const autoTier = computeTierFromOrders(totalSpend, orderCount);
      map.set(phone, {
        phone,
        name: existing?.name ?? o.customer.name,
        orderCount,
        totalSpend,
        lastOrder: o.createdAt,
        autoTier,
        tier: meta[phone]?.tier ?? autoTier,
      });
    }
    return Array.from(map.values()).sort((a, b) => b.totalSpend - a.totalSpend);
  }, [orders, meta]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <h1 className="font-display text-4xl tracking-wide">Users & Coupons</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tier customers by spend and assign reward coupons.
      </p>

      <section className="mt-8 rounded-xl border border-border bg-surface">
        <header className="border-b border-border px-6 py-4">
          <h2 className="font-display text-xl tracking-widest">CUSTOMERS · {rows.length}</h2>
        </header>
        {rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">No customers yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background/40 text-left text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-3 py-3">Orders</th>
                  <th className="px-3 py-3">Spend</th>
                  <th className="px-3 py-3">Tier</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.phone}>
                    <td className="px-6 py-3">
                      <div className="font-display tracking-wide">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.phone}</div>
                    </td>
                    <td className="px-3 py-3">{r.orderCount}</td>
                    <td className="px-3 py-3">₹{r.totalSpend}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-display text-[10px] tracking-widest ${TIER_CLS[r.tier]}`}>
                        <Crown className="h-3 w-3" /> {r.tier.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={r.tier}
                        onChange={(e) => {
                          setCustomerMeta(r.phone, { tier: e.target.value as CustomerTier });
                          refresh();
                          toast.success(`${r.name} → ${e.target.value}`);
                        }}
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                      >
                        {TIERS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CouponsSection
        coupons={coupons}
        customers={rows.map((r) => ({ phone: r.phone, name: r.name }))}
        onChange={refresh}
      />
    </div>
  );
}

function CouponsSection({
  coupons, customers, onChange,
}: {
  coupons: Coupon[];
  customers: { phone: string; name: string }[];
  onChange: () => void;
}) {
  const [form, setForm] = useState<Coupon>({
    code: "",
    discountPercent: 10,
    maxDiscount: 150,
    minOrder: 0,
    minTier: undefined,
    assignedTo: undefined,
    usageLimit: undefined,
    usedCount: 0,
    active: true,
    createdAt: new Date().toISOString(),
  });

  function add() {
    if (!form.code.trim()) return toast.error("Coupon code is required");
    upsertCoupon({ ...form, code: form.code.trim().toUpperCase() });
    toast.success("Coupon saved");
    setForm({ ...form, code: "" });
    onChange();
  }

  return (
    <section className="mt-8 rounded-xl border border-border bg-surface">
      <header className="border-b border-border px-6 py-4">
        <h2 className="flex items-center gap-2 font-display text-xl tracking-widest">
          <Ticket className="h-5 w-5 text-primary" /> COUPONS
        </h2>
      </header>

      <div className="grid gap-4 border-b border-border p-6 md:grid-cols-6">
        <Input label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} />
        <Input
          label="Discount %"
          value={String(form.discountPercent)}
          onChange={(v) => setForm({ ...form, discountPercent: Math.max(0, Math.min(100, parseFloat(v) || 0)) })}
        />
        <Input
          label="Max ₹"
          value={form.maxDiscount ? String(form.maxDiscount) : ""}
          onChange={(v) => setForm({ ...form, maxDiscount: parseFloat(v) || undefined })}
        />
        <Input
          label="Min order ₹"
          value={form.minOrder ? String(form.minOrder) : ""}
          onChange={(v) => setForm({ ...form, minOrder: parseFloat(v) || 0 })}
        />
        <label className="block">
          <span className="mb-1.5 block font-display text-xs tracking-widest text-muted-foreground">MIN TIER</span>
          <select
            value={form.minTier ?? ""}
            onChange={(e) => setForm({ ...form, minTier: (e.target.value || undefined) as CustomerTier | undefined })}
            className="w-full rounded-md border border-input bg-background px-2 py-2.5"
          >
            <option value="">Any</option>
            {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block font-display text-xs tracking-widest text-muted-foreground">ASSIGN TO</span>
          <select
            value={form.assignedTo ?? ""}
            onChange={(e) => setForm({ ...form, assignedTo: e.target.value || undefined })}
            className="w-full rounded-md border border-input bg-background px-2 py-2.5"
          >
            <option value="">Everyone</option>
            {customers.map((c) => (
              <option key={c.phone} value={c.phone}>{c.name} · {c.phone}</option>
            ))}
          </select>
        </label>
        <div className="md:col-span-6 flex justify-end">
          <button
            onClick={add}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 font-display text-sm tracking-widest text-primary-foreground hover:bg-primary-glow"
          >
            <Plus className="h-4 w-4" /> ADD / UPDATE COUPON
          </button>
        </div>
      </div>

      {coupons.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-muted-foreground">No coupons yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {coupons.map((c) => (
            <li key={c.code} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div>
                <div className="flex items-center gap-2 font-display text-lg tracking-wide text-primary">
                  <Tag className="h-4 w-4" /> {c.code}
                </div>
                <div className="text-xs text-muted-foreground">
                  {c.discountPercent}% off
                  {c.maxDiscount ? ` · max ₹${c.maxDiscount}` : ""}
                  {c.minOrder ? ` · min ₹${c.minOrder}` : ""}
                  {c.minTier ? ` · tier ≥ ${c.minTier}` : ""}
                  {c.assignedTo ? ` · for ${c.assignedTo}` : " · public"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    upsertCoupon({ ...c, active: !c.active });
                    onChange();
                  }}
                  className={`rounded-md border px-3 py-1.5 font-display text-xs tracking-widest ${
                    c.active ? "border-veg/40 text-veg" : "border-border text-muted-foreground"
                  }`}
                >
                  {c.active ? "ACTIVE" : "PAUSED"}
                </button>
                <button
                  onClick={() => { deleteCoupon(c.code); onChange(); }}
                  className="rounded-md border border-border p-2 text-muted-foreground hover:text-primary"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-display text-xs tracking-widest text-muted-foreground">
        {label.toUpperCase()}
      </span>
      <input
        className="w-full rounded-md border border-input bg-background px-3 py-2.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
