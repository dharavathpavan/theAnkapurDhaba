import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgePercent,
  Clock3,
  IndianRupee,
  Power,
  Save,
  Store,
  Ticket,
  Trash2,
  Truck,
  UtensilsCrossed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createAdminCoupon,
  deleteAdminCoupon,
  getAdminCustomerContent,
  listCatalogCategories,
  listCatalogItems,
  updateAdminCoupon,
  updateAdminCustomerStore,
  updateCatalogCategory,
  updateCatalogItem,
  type CatalogCategory,
  type CatalogItem,
  type CustomerCoupon,
  type CustomerStore,
} from "@/services/api";
import { TimeScheduleEditor } from "@/components/admin/TimeScheduleEditor";

export const Route = createFileRoute("/admin/business")({
  head: () => ({ meta: [{ title: "Business Settings - The Ankapure Dhaba" }] }),
  component: BusinessSettingsPage,
});

const TIFFIN_WORDS = ["tiffin", "tiffins", "breakfast", "idly", "idli", "dosa", "vada"];
const TIFFIN_RULE = {
  scheduled: true,
  startTime: "05:00",
  endTime: "12:00",
  days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  closedMessage: "Tiffins available from 5 AM to 12 PM",
};

function BusinessSettingsPage() {
  const qc = useQueryClient();
  const contentQuery = useQuery({
    queryKey: ["admin-customer-content"],
    queryFn: getAdminCustomerContent,
  });
  const categoriesQuery = useQuery({
    queryKey: ["catalog-categories"],
    queryFn: listCatalogCategories,
  });
  const itemsQuery = useQuery({
    queryKey: ["catalog-items", "business"],
    queryFn: () => listCatalogItems({}),
  });
  const [couponForm, setCouponForm] = useState({
    code: "",
    title: "",
    discountType: "percent" as "percent" | "flat",
    discountValue: 10,
    maxDiscount: 100,
    minOrder: 199,
    expiresAt: "",
  });
  const [taxRate, setTaxRate] = useState(5);

  const store = contentQuery.data?.store;
  const coupons = contentQuery.data?.coupons ?? [];
  const categories = categoriesQuery.data ?? [];
  const items = itemsQuery.data ?? [];
  const tiffinCategories = categories.filter(isTiffinCategory);
  const dhabaCategories = categories.filter((category) => !isTiffinCategory(category));
  const tiffinItems = items.filter(isTiffinItem);
  const dhabaItems = items.filter((item) => !isTiffinItem(item));
  const tiffinsOn = groupIsOn(tiffinCategories, tiffinItems);
  const dhabaOn = groupIsOn(dhabaCategories, dhabaItems);
  const tiffinSchedule = useMemo(
    () => tiffinCategories[0]?.availabilityRules || tiffinItems[0]?.availabilityRules || TIFFIN_RULE,
    [tiffinCategories, tiffinItems],
  );

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin-customer-content"] }),
      qc.invalidateQueries({ queryKey: ["customer-home"] }),
      qc.invalidateQueries({ queryKey: ["customer-menu"] }),
      qc.invalidateQueries({ queryKey: ["catalog-categories"] }),
      qc.invalidateQueries({ queryKey: ["catalog-items"] }),
    ]);
  };

  const saveStore = useMutation({
    mutationFn: updateAdminCustomerStore,
    onSuccess: async () => {
      await refresh();
      toast.success("Business settings saved");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save"),
  });

  const createCoupon = useMutation({
    mutationFn: () =>
      createAdminCoupon({
        ...couponForm,
        code: couponForm.code.trim().toUpperCase() || "OFFER10",
        title: couponForm.title.trim() || "Dhaba offer",
        description: "",
        discountValue: Number(couponForm.discountValue || 0),
        maxDiscount: Number(couponForm.maxDiscount || 0),
        minOrder: Number(couponForm.minOrder || 0),
        expiresAt: couponForm.expiresAt || null,
        active: true,
      }),
    onSuccess: async () => {
      setCouponForm({
        code: "",
        title: "",
        discountType: "percent",
        discountValue: 10,
        maxDiscount: 100,
        minOrder: 199,
        expiresAt: "",
      });
      await refresh();
      toast.success("Coupon published");
    },
  });

  async function toggleMenuGroup(group: "dhaba" | "tiffins", enabled: boolean) {
    const targetCategories = group === "tiffins" ? tiffinCategories : dhabaCategories;
    const targetItems = group === "tiffins" ? tiffinItems : dhabaItems;
    try {
      await Promise.all([
        ...targetCategories.map((category) => updateCatalogCategory(category.id, { active: enabled })),
        ...targetItems.map((item) => updateCatalogItem(item.id, { hidden: !enabled, available: enabled })),
      ]);
      await refresh();
      toast.success(`${group === "tiffins" ? "Tiffins" : "Dhaba"} menu ${enabled ? "turned on" : "turned off"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Menu update failed");
    }
  }

  async function saveTiffinSchedule(availabilityRules: Record<string, unknown>) {
    try {
      await Promise.all([
        ...tiffinCategories.map((category) => updateCatalogCategory(category.id, { availabilityRules })),
        ...(tiffinCategories.length ? [] : tiffinItems.map((item) => updateCatalogItem(item.id, { availabilityRules }))),
      ]);
      await refresh();
      toast.success("Tiffins timing saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save timing");
    }
  }

  async function applyTaxToAllItems() {
    try {
      await Promise.all(items.map((item) => updateCatalogItem(item.id, { taxRate, gstRate: taxRate })));
      await refresh();
      toast.success(`GST ${taxRate}% applied to menu items`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update GST");
    }
  }

  if (contentQuery.isLoading || !store) {
    return <div className="p-8 text-muted-foreground">Loading business settings...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">
            The Ankapure Dhaba
          </p>
          <h1 className="mt-2 text-3xl font-black md:text-5xl">Business Settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Control menu visibility, Tiffins timing, tax, delivery charges and coupon offers from one place.
          </p>
        </div>
        <StatusPill status={store.status} />
      </header>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={UtensilsCrossed} label="Dhaba items" value={dhabaItems.length} />
        <Metric icon={Clock3} label="Tiffins items" value={tiffinItems.length} />
        <Metric icon={Truck} label="Delivery charge" value={`Rs ${store.deliveryCharge}`} />
        <Metric icon={Ticket} label="Coupons" value={coupons.length} />
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <Panel title="Menu switches" icon={Power}>
            <div className="grid gap-3 md:grid-cols-2">
              <MenuToggle
                title="Dhaba menu"
                description="Biryani, curries, starters, meals, desserts and regular menu."
                enabled={dhabaOn}
                onToggle={(enabled) => toggleMenuGroup("dhaba", enabled)}
              />
              <MenuToggle
                title="Tiffins menu"
                description="Breakfast/tiffin items. Use timing below for 5 AM to 12 PM."
                enabled={tiffinsOn}
                onToggle={(enabled) => toggleMenuGroup("tiffins", enabled)}
              />
            </div>
            <div className="mt-4">
              <TimeScheduleEditor value={tiffinSchedule} onChange={saveTiffinSchedule} />
            </div>
          </Panel>

          <Panel title="Business data fields" icon={Store}>
            <div className="grid gap-3 md:grid-cols-2">
              <TextField label="Restaurant name" value={store.name} onSave={(name) => saveStore.mutate({ name })} />
              <TextField label="Phone" value={store.phone} onSave={(phone) => saveStore.mutate({ phone })} />
              <TextField label="Address" value={store.address} onSave={(address) => saveStore.mutate({ address })} wide />
              <TextField label="Open time" type="time" value={store.openTime} onSave={(openTime) => saveStore.mutate({ openTime })} />
              <TextField label="Close time" type="time" value={store.closeTime} onSave={(closeTime) => saveStore.mutate({ closeTime })} />
              <NumberControl label="Minimum order" value={store.minimumOrder} money onSave={(minimumOrder) => saveStore.mutate({ minimumOrder })} />
              <NumberControl label="Delivery charge" value={store.deliveryCharge} money onSave={(deliveryCharge) => saveStore.mutate({ deliveryCharge })} />
              <NumberControl label="Free delivery above" value={store.freeDeliveryAbove} money onSave={(freeDeliveryAbove) => saveStore.mutate({ freeDeliveryAbove })} />
              <NumberControl label="Average delivery min" value={store.averageDeliveryMin} onSave={(averageDeliveryMin) => saveStore.mutate({ averageDeliveryMin })} />
              <NumberControl label="Packing charge" value={store.packingCharge} money onSave={(packingCharge) => saveStore.mutate({ packingCharge })} />
              <NumberControl label="Delivery radius KM" value={store.zoneRadiusKm} onSave={(zoneRadiusKm) => saveStore.mutate({ zoneRadiusKm })} />
              <ToggleLine label="Allow delivery COD" checked={store.allowDeliveryCod === true} onChange={(allowDeliveryCod) => saveStore.mutate({ allowDeliveryCod })} />
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Tax settings" icon={BadgePercent}>
            <p className="text-sm text-muted-foreground">
              Default GST is stored per item. Use this to quickly apply a common GST to the whole menu.
            </p>
            <div className="mt-4 flex gap-2">
              <input
                type="number"
                value={taxRate}
                onChange={(event) => setTaxRate(Number(event.target.value || 0))}
                className="h-12 min-w-0 flex-1 rounded-2xl border border-input bg-background px-4 font-black outline-none focus:border-primary"
              />
              <button
                onClick={applyTaxToAllItems}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 font-black text-primary-foreground"
              >
                <Save className="h-4 w-4" /> Apply
              </button>
            </div>
          </Panel>

          <Panel title="Coupons" icon={Ticket}>
            <div className="grid gap-3">
              <TextInput label="Code" value={couponForm.code} onChange={(code) => setCouponForm({ ...couponForm, code: code.toUpperCase() })} />
              <TextInput label="Title" value={couponForm.title} onChange={(title) => setCouponForm({ ...couponForm, title })} />
              <select
                value={couponForm.discountType}
                onChange={(event) => setCouponForm({ ...couponForm, discountType: event.target.value as "percent" | "flat" })}
                className="h-12 rounded-2xl border border-input bg-background px-4 font-bold outline-none focus:border-primary"
              >
                <option value="percent">Percent discount</option>
                <option value="flat">Flat discount</option>
              </select>
              <NumberInput label="Discount value" value={couponForm.discountValue} onChange={(discountValue) => setCouponForm({ ...couponForm, discountValue })} />
              <NumberInput label="Max discount" value={couponForm.maxDiscount} onChange={(maxDiscount) => setCouponForm({ ...couponForm, maxDiscount })} />
              <NumberInput label="Min order" value={couponForm.minOrder} onChange={(minOrder) => setCouponForm({ ...couponForm, minOrder })} />
              <TextInput label="Expiry date" type="date" value={couponForm.expiresAt} onChange={(expiresAt) => setCouponForm({ ...couponForm, expiresAt })} />
              <button
                onClick={() => createCoupon.mutate()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary font-black text-primary-foreground"
              >
                <Ticket className="h-4 w-4" /> Publish Coupon
              </button>
            </div>
            <CouponList coupons={coupons} refresh={refresh} />
          </Panel>
        </div>
      </section>
    </div>
  );
}

function isTiffinCategory(category: CatalogCategory) {
  const text = `${category.name} ${category.seoUrl || ""}`.toLowerCase();
  return TIFFIN_WORDS.some((word) => text.includes(word));
}

function isTiffinItem(item: CatalogItem) {
  const text = `${item.name} ${item.category} ${(item.tags || []).join(" ")}`.toLowerCase();
  return TIFFIN_WORDS.some((word) => text.includes(word));
}

function groupIsOn(categories: CatalogCategory[], items: CatalogItem[]) {
  if (!categories.length && !items.length) return false;
  return categories.every((category) => category.active !== false) && items.every((item) => !item.hidden && item.available !== false);
}

function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-xl font-black">
        <Icon className="h-5 w-5 text-primary" /> {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return (
    <div className="rounded-[24px] border border-border bg-surface p-4 shadow-sm">
      <Icon className="h-5 w-5 text-primary" />
      <div className="mt-3 text-2xl font-black">{value}</div>
      <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
    </div>
  );
}

function MenuToggle({ title, description, enabled, onToggle }: { title: string; description: string; enabled: boolean; onToggle: (enabled: boolean) => void }) {
  return (
    <div className="rounded-3xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-black">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <button
          onClick={() => onToggle(!enabled)}
          className={`relative h-8 w-16 rounded-full transition ${enabled ? "bg-green-600" : "bg-zinc-500"}`}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${enabled ? "left-9" : "left-1"}`} />
        </button>
      </div>
      <div className={`mt-3 rounded-full px-3 py-1 text-xs font-black ${enabled ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
        {enabled ? "Visible to customers" : "Hidden from customers"}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: CustomerStore["status"] }) {
  return (
    <span className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest ${status === "online" ? "bg-green-500/10 text-green-600" : status === "busy" ? "bg-yellow-500/10 text-yellow-600" : "bg-red-500/10 text-red-600"}`}>
      {status}
    </span>
  );
}

function TextField({ label, value, onSave, type = "text", wide = false }: { label: string; value: string; type?: string; wide?: boolean; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value || "");
  return (
    <label className={`block ${wide ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
      <input value={draft} type={type} onChange={(event) => setDraft(event.target.value)} onBlur={() => draft !== value && onSave(draft)} className="mt-2 h-12 w-full rounded-2xl border border-input bg-background px-4 font-bold outline-none focus:border-primary" />
    </label>
  );
}

function NumberControl({ label, value, money = false, onSave }: { label: string; value: number; money?: boolean; onSave: (value: number) => void }) {
  const [draft, setDraft] = useState(Number(value || 0));
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
      <div className="mt-2 flex h-12 items-center rounded-2xl border border-input bg-background px-4">
        {money ? <IndianRupee className="mr-2 h-4 w-4 text-muted-foreground" /> : null}
        <input value={draft} type="number" onChange={(event) => setDraft(Number(event.target.value || 0))} onBlur={() => draft !== value && onSave(draft)} className="min-w-0 flex-1 bg-transparent font-bold outline-none" />
      </div>
    </label>
  );
}

function ToggleLine({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-background p-4">
      <span className="font-black">{label}</span>
      <button onClick={() => onChange(!checked)} className={`h-8 w-16 rounded-full p-1 transition ${checked ? "bg-green-600" : "bg-zinc-500"}`}>
        <span className={`block h-6 w-6 rounded-full bg-white transition ${checked ? "translate-x-8" : ""}`} />
      </button>
    </div>
  );
}

function TextInput({ label, value, onChange, type = "text" }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
      <input value={value} type={type} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-input bg-background px-4 font-bold outline-none focus:border-primary" />
    </label>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
      <input value={value} type="number" onChange={(event) => onChange(Number(event.target.value || 0))} className="mt-2 h-12 w-full rounded-2xl border border-input bg-background px-4 font-bold outline-none focus:border-primary" />
    </label>
  );
}

function CouponList({ coupons, refresh }: { coupons: CustomerCoupon[]; refresh: () => void }) {
  async function toggle(coupon: CustomerCoupon) {
    await updateAdminCoupon(coupon.id, { active: !coupon.active });
    await refresh();
  }
  async function remove(coupon: CustomerCoupon) {
    await deleteAdminCoupon(coupon.id);
    await refresh();
  }
  return (
    <div className="mt-5 space-y-2">
      {coupons.length === 0 ? <div className="rounded-2xl bg-background p-4 text-sm text-muted-foreground">No coupons yet.</div> : null}
      {coupons.map((coupon) => (
        <div key={coupon.id} className="rounded-2xl border border-border bg-background p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-black">{coupon.code}</div>
              <div className="text-sm text-muted-foreground">{coupon.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">Min Rs {coupon.minOrder} | {coupon.discountType === "flat" ? "Rs" : ""}{coupon.discountValue}{coupon.discountType === "percent" ? "%" : ""} off</div>
            </div>
            <button onClick={() => remove(coupon)} className="text-red-500">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <button onClick={() => toggle(coupon)} className={`mt-3 rounded-full px-3 py-1 text-xs font-black ${coupon.active ? "bg-green-500/10 text-green-600" : "bg-zinc-500/10 text-zinc-500"}`}>
            {coupon.active ? "Active" : "Inactive"}
          </button>
        </div>
      ))}
    </div>
  );
}
