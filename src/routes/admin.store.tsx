import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Megaphone, Palette, Save, Ticket, Trash2, Upload, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import {
  createAdminAnnouncement,
  createAdminBanner,
  createAdminCoupon,
  deleteAdminAnnouncement,
  deleteAdminBanner,
  deleteAdminCoupon,
  getAdminCustomerContent,
  updateAdminAnnouncement,
  updateAdminBanner,
  updateAdminCoupon,
  updateAdminCustomerStore,
  uploadCatalogFile,
  type CustomerAnnouncement,
  type CustomerBanner,
  type CustomerCoupon,
} from "@/services/api";

export const Route = createFileRoute("/admin/store")({
  head: () => ({ meta: [{ title: "Customer App Setup - Ankapur Dhaba" }] }),
  component: StorePage,
});

function StorePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-customer-content"], queryFn: getAdminCustomerContent });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-customer-content"] });
  const saveStore = useMutation({ mutationFn: updateAdminCustomerStore, onSuccess: () => { refresh(); toast.success("Customer app synced"); } });

  if (isLoading || !data) return <div className="p-8 text-muted-foreground">Loading customer app settings...</div>;
  const store = data.store;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-wide">Customer App Setup</h1>
          <p className="mt-1 text-sm text-muted-foreground">Control banners, announcements, coupons, store status, delivery rules and theme in real time.</p>
        </div>
        <span className={`rounded-full px-3 py-1.5 font-display text-xs tracking-widest ${store.status === "online" ? "bg-veg/10 text-veg" : store.status === "busy" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}>
          {store.status.toUpperCase()}
        </span>
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="font-display text-2xl tracking-wide">Store & delivery rules</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Restaurant name" value={store.name} onChange={(name) => saveStore.mutate({ name })} />
            <Field label="Phone" value={store.phone} onChange={(phone) => saveStore.mutate({ phone })} />
            <Field label="Address" value={store.address} onChange={(address) => saveStore.mutate({ address })} className="md:col-span-2" />
            <Field label="Open time" value={store.openTime} onChange={(openTime) => saveStore.mutate({ openTime })} type="time" />
            <Field label="Close time" value={store.closeTime} onChange={(closeTime) => saveStore.mutate({ closeTime })} type="time" />
            <NumberField label="Min order" value={store.minimumOrder} onChange={(minimumOrder) => saveStore.mutate({ minimumOrder })} />
            <NumberField label="Delivery charge" value={store.deliveryCharge} onChange={(deliveryCharge) => saveStore.mutate({ deliveryCharge })} />
            <NumberField label="Free delivery above" value={store.freeDeliveryAbove} onChange={(freeDeliveryAbove) => saveStore.mutate({ freeDeliveryAbove })} />
            <NumberField label="Average delivery min" value={store.averageDeliveryMin} onChange={(averageDeliveryMin) => saveStore.mutate({ averageDeliveryMin })} />
            <NumberField label="Packing charge" value={store.packingCharge} onChange={(packingCharge) => saveStore.mutate({ packingCharge })} />
            <NumberField label="Radius KM" value={store.zoneRadiusKm} onChange={(zoneRadiusKm) => saveStore.mutate({ zoneRadiusKm })} />
            <Field label="Status message" value={store.statusMessage} onChange={(statusMessage) => saveStore.mutate({ statusMessage })} className="md:col-span-2" />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <StatusButton icon={Wifi} label="Online" active={store.status === "online"} onClick={() => saveStore.mutate({ status: "online", statusMessage: "" })} />
            <StatusButton icon={Megaphone} label="Busy" active={store.status === "busy"} onClick={() => saveStore.mutate({ status: "busy", statusMessage: "Kitchen is busy. Expect a little delay." })} />
            <StatusButton icon={WifiOff} label="Offline" active={store.status === "offline"} onClick={() => saveStore.mutate({ status: "offline", statusMessage: "We are closed right now. See you soon!" })} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="flex items-center gap-2 font-display text-2xl tracking-wide"><Palette className="h-5 w-5 text-primary" /> Theme & splash</h2>
          <div className="mt-5 grid gap-4">
            <Field label="Splash title" value={store.splashTitle} onChange={(splashTitle) => saveStore.mutate({ splashTitle })} />
            <Field label="Splash subtitle" value={store.splashSubtitle} onChange={(splashSubtitle) => saveStore.mutate({ splashSubtitle })} />
            {(["primary", "secondary", "accent", "background"] as const).map((key) => (
              <label key={key} className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                <span className="font-display text-xs tracking-widest text-muted-foreground">{key.toUpperCase()}</span>
                <input type="color" value={store.theme[key] || "#C62828"} onChange={(e) => saveStore.mutate({ theme: { ...store.theme, [key]: e.target.value } })} />
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <ContentPanel title="Hero banners" items={data.banners} kind="banner" refresh={refresh} />
        <ContentPanel title="Announcements" items={data.announcements} kind="announcement" refresh={refresh} />
        <ContentPanel title="Coupons" items={data.coupons} kind="coupon" refresh={refresh} />
      </section>
    </div>
  );
}

function ContentPanel({ title, items, kind, refresh }: { title: string; items: Array<CustomerBanner | CustomerAnnouncement | CustomerCoupon>; kind: "banner" | "announcement" | "coupon"; refresh: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({});
  const create = useMutation({
    mutationFn: async () => {
      if (kind === "banner") return createAdminBanner({ title: form.title || "New offer", subtitle: form.subtitle || "", image: form.image || "/assets/hero-biryani.jpg", type: form.type || "hero", ctaLabel: form.ctaLabel || "Order Now", ctaLink: form.ctaLink || "/menu", priority: Number(form.priority || 0), active: true });
      if (kind === "announcement") return createAdminAnnouncement({ message: form.message || "Free delivery today", icon: "flame", color: form.color || "#C62828", priority: Number(form.priority || 0), active: true });
      return createAdminCoupon({ code: form.code || "WELCOME10", title: form.title || "Welcome offer", description: form.description || "", discountType: form.discountType || "percent", discountValue: Number(form.discountValue || 10), maxDiscount: Number(form.maxDiscount || 100), minOrder: Number(form.minOrder || 199), active: true });
    },
    onSuccess: () => { setForm({}); refresh(); toast.success(`${title} synced`); },
  });

  async function upload(file?: File) {
    if (!file) return;
    try {
      const result = await uploadCatalogFile(file);
      setForm((f) => ({ ...f, image: result.url }));
      toast.success("Media uploaded");
    } catch {
      toast.error("Upload failed");
    }
  }

  async function toggle(item: any) {
    if (kind === "banner") await updateAdminBanner(item.id, { active: !item.active });
    if (kind === "announcement") await updateAdminAnnouncement(item.id, { active: !item.active });
    if (kind === "coupon") await updateAdminCoupon(item.id, { active: !item.active });
    qc.invalidateQueries({ queryKey: ["admin-customer-content"] });
  }

  async function remove(id: string) {
    if (kind === "banner") await deleteAdminBanner(id);
    if (kind === "announcement") await deleteAdminAnnouncement(id);
    if (kind === "coupon") await deleteAdminCoupon(id);
    refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-display text-xl tracking-widest">{title}</h2>
      <div className="mt-4 space-y-3">
        {kind === "banner" && (
          <>
            <MiniInput label="Title" value={form.title || ""} onChange={(title) => setForm({ ...form, title })} />
            <MiniInput label="Subtitle" value={form.subtitle || ""} onChange={(subtitle) => setForm({ ...form, subtitle })} />
            <MiniInput label="Type (hero or ad)" value={form.type || "hero"} onChange={(type) => setForm({ ...form, type })} />
            <MiniInput label="CTA link" value={form.ctaLink || ""} onChange={(ctaLink) => setForm({ ...form, ctaLink })} />
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background p-3 text-sm"><Upload className="h-4 w-4" /> Upload image or video<input type="file" className="hidden" accept="image/*,video/*" onChange={(e) => upload(e.target.files?.[0])} /></label>
            {form.image && <MediaPreview url={form.image} />}
          </>
        )}
        {kind === "announcement" && <MiniInput label="Message" value={form.message || ""} onChange={(message) => setForm({ ...form, message })} />}
        {kind === "coupon" && (
          <>
            <MiniInput label="Code" value={form.code || ""} onChange={(code) => setForm({ ...form, code: code.toUpperCase() })} />
            <MiniInput label="Title" value={form.title || ""} onChange={(title) => setForm({ ...form, title })} />
            <MiniInput label="Discount" value={form.discountValue || ""} onChange={(discountValue) => setForm({ ...form, discountValue })} />
            <MiniInput label="Min order" value={form.minOrder || ""} onChange={(minOrder) => setForm({ ...form, minOrder })} />
          </>
        )}
        <button onClick={() => create.mutate()} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 font-display text-xs tracking-widest text-primary-foreground"><Save className="h-4 w-4" /> ADD</button>
      </div>
      <ul className="mt-5 space-y-2">
        {items.map((item: any) => (
          <li key={item.id} className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-display tracking-wide">{item.title || item.message || item.code}</div>
                <div className="text-xs text-muted-foreground">{item.type ? `${item.type} - ` : ""}{item.subtitle || item.description || item.category}</div>
              </div>
              <button onClick={() => remove(item.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
            <button onClick={() => toggle(item)} className={`mt-3 rounded-full px-3 py-1 text-xs font-bold ${item.active ? "bg-veg/10 text-veg" : "bg-muted text-muted-foreground"}`}>{item.active ? "Active" : "Inactive"}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", className = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; className?: string }) {
  const [draft, setDraft] = useState(value || "");
  return <label className={`block ${className}`}><span className="mb-1 block font-display text-xs tracking-widest text-muted-foreground">{label.toUpperCase()}</span><input type={type} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== value && onChange(draft)} className="w-full rounded-md border border-input bg-background px-3 py-2.5" /></label>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <Field label={label} value={String(value)} onChange={(v) => onChange(Number(v) || 0)} />;
}

function MiniInput({ label, value, onChange }: { label: string; value: string | number; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1 block text-xs text-muted-foreground">{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></label>;
}

function MediaPreview({ url }: { url: string }) {
  if (isVideo(url)) return <video src={url} muted controls className="h-32 w-full rounded-md bg-black object-cover" />;
  return <img src={url} alt="" className="h-32 w-full rounded-md bg-background object-cover" />;
}

function isVideo(url: string) {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

function StatusButton({ icon: Icon, label, active, onClick }: { icon: React.ElementType; label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`rounded-lg border p-4 text-left ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"}`}><Icon className="h-5 w-5" /><div className="mt-2 font-display tracking-widest">{label}</div></button>;
}
