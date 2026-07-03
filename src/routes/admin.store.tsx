import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Eye, Megaphone, Palette, Pencil, Save, Ticket, Trash2, Upload, Wifi, WifiOff, X } from "lucide-react";
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
import { imageFallback, isVideoUrl, resolveMediaUrl } from "@/lib/media";

export const Route = createFileRoute("/admin/store")({
  head: () => ({ meta: [{ title: "Customer App Setup - Ankapur Dhaba" }] }),
  component: StorePage,
});

const defaultBannerForm: Partial<CustomerBanner> = {
  title: "",
  subtitle: "",
  image: "/assets/hero-biryani.jpg",
  mobileImage: "",
  type: "hero",
  ctaLabel: "Order Now",
  ctaLink: "/menu",
  secondaryCtaLabel: "Your Orders",
  secondaryCtaLink: "/orders",
  priority: 0,
  active: true,
  heightMobile: "compact",
  heightDesktop: "standard",
  textAlign: "left",
  overlayStrength: "dark",
  textColorMode: "light",
  startsAt: null,
  endsAt: null,
};

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

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <BannerManager banners={data.banners} refresh={refresh} />
        <div className="grid gap-6">
          <ContentPanel title="Announcements" items={data.announcements} kind="announcement" refresh={refresh} />
          <ContentPanel title="Coupons" items={data.coupons} kind="coupon" refresh={refresh} />
        </div>
      </section>
    </div>
  );
}

function BannerManager({ banners, refresh }: { banners: CustomerBanner[]; refresh: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<CustomerBanner>>(defaultBannerForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const sorted = useMemo(() => [...banners].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)), [banners]);
  const saving = useMutation({
    mutationFn: async () => {
      const payload = bannerPayload(form);
      if (editingId) return updateAdminBanner(editingId, payload);
      return createAdminBanner(payload);
    },
    onSuccess: () => {
      setForm(defaultBannerForm);
      setEditingId(null);
      refresh();
      toast.success("Hero banner synced");
    },
  });

  async function upload(file: File | undefined, field: "image" | "mobileImage") {
    if (!file) return;
    try {
      const result = await uploadCatalogFile(file);
      setForm((current) => ({ ...current, [field]: result.url }));
      toast.success(field === "mobileImage" ? "Mobile media uploaded" : "Media uploaded");
    } catch {
      toast.error("Upload failed");
    }
  }

  function edit(item: CustomerBanner) {
    setEditingId(item.id);
    setForm({ ...defaultBannerForm, ...item, startsAt: toInputDateTime(item.startsAt), endsAt: toInputDateTime(item.endsAt) });
  }

  async function toggle(item: CustomerBanner) {
    await updateAdminBanner(item.id, { active: !item.active });
    qc.invalidateQueries({ queryKey: ["admin-customer-content"] });
  }

  async function remove(id: string) {
    await deleteAdminBanner(id);
    refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl tracking-widest">Hero banners</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create responsive app banners with schedule, CTAs and layout controls.</p>
        </div>
        {editingId && (
          <button onClick={() => { setEditingId(null); setForm(defaultBannerForm); }} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <X className="h-4 w-4" /> Cancel edit
          </button>
        )}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <MiniInput label="Title" value={form.title || ""} onChange={(title) => setForm({ ...form, title })} />
            <MiniInput label="Badge / type" value={form.type || "hero"} onChange={(type) => setForm({ ...form, type })} />
            <MiniInput label="Subtitle" value={form.subtitle || ""} onChange={(subtitle) => setForm({ ...form, subtitle })} className="md:col-span-2" />
            <MiniInput label="Primary CTA label" value={form.ctaLabel || ""} onChange={(ctaLabel) => setForm({ ...form, ctaLabel })} />
            <MiniInput label="Primary CTA link" value={form.ctaLink || ""} onChange={(ctaLink) => setForm({ ...form, ctaLink })} />
            <MiniInput label="Secondary CTA label" value={form.secondaryCtaLabel || ""} onChange={(secondaryCtaLabel) => setForm({ ...form, secondaryCtaLabel })} />
            <MiniInput label="Secondary CTA link" value={form.secondaryCtaLink || ""} onChange={(secondaryCtaLink) => setForm({ ...form, secondaryCtaLink })} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background p-3 text-sm"><Upload className="h-4 w-4" /> Upload desktop media<input type="file" className="hidden" accept="image/*,video/*" onChange={(e) => upload(e.target.files?.[0], "image")} /></label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background p-3 text-sm"><Upload className="h-4 w-4" /> Upload mobile media<input type="file" className="hidden" accept="image/*,video/*" onChange={(e) => upload(e.target.files?.[0], "mobileImage")} /></label>
            <MiniInput label="Desktop media URL" value={form.image || ""} onChange={(image) => setForm({ ...form, image })} />
            <MiniInput label="Mobile media URL" value={form.mobileImage || ""} onChange={(mobileImage) => setForm({ ...form, mobileImage })} />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <SelectField label="Mobile height" value={form.heightMobile || "compact"} options={["compact", "standard", "tall"]} onChange={(heightMobile) => setForm({ ...form, heightMobile })} />
            <SelectField label="Desktop height" value={form.heightDesktop || "standard"} options={["compact", "standard", "tall"]} onChange={(heightDesktop) => setForm({ ...form, heightDesktop })} />
            <SelectField label="Text align" value={form.textAlign || "left"} options={["left", "center", "right"]} onChange={(textAlign) => setForm({ ...form, textAlign })} />
            <SelectField label="Overlay" value={form.overlayStrength || "dark"} options={["light", "medium", "dark"]} onChange={(overlayStrength) => setForm({ ...form, overlayStrength })} />
            <SelectField label="Text color" value={form.textColorMode || "light"} options={["light", "dark"]} onChange={(textColorMode) => setForm({ ...form, textColorMode })} />
            <MiniInput label="Priority" value={form.priority ?? 0} onChange={(priority) => setForm({ ...form, priority: Number(priority) || 0 })} />
            <MiniInput label="Starts at" type="datetime-local" value={toInputDateTime(form.startsAt)} onChange={(startsAt) => setForm({ ...form, startsAt: startsAt || null })} />
            <MiniInput label="Ends at" type="datetime-local" value={toInputDateTime(form.endsAt)} onChange={(endsAt) => setForm({ ...form, endsAt: endsAt || null })} />
            <label className="flex items-center justify-between rounded-md border border-border bg-background p-3 text-sm">
              <span>Active</span>
              <input type="checkbox" checked={form.active !== false} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            </label>
          </div>

          <button onClick={() => saving.mutate()} disabled={saving.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 font-display text-xs tracking-widest text-primary-foreground disabled:opacity-60">
            <Save className="h-4 w-4" /> {editingId ? "SAVE BANNER" : "ADD BANNER"}
          </button>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-muted-foreground"><Eye className="h-4 w-4" /> Preview</div>
          <BannerPreview banner={{ ...defaultBannerForm, ...form } as CustomerBanner} />
        </div>
      </div>

      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {sorted.map((item) => (
          <li key={item.id} className="rounded-lg border border-border bg-background p-3">
            <div className="flex gap-3">
              <MediaThumb url={item.mobileImage || item.image} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display tracking-wide">{item.title}</div>
                <div className="truncate text-xs text-muted-foreground">{item.type} - {item.subtitle}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span>#{item.priority}</span>
                  <span>{item.textAlign || "left"}</span>
                  <span>{item.overlayStrength || "dark"}</span>
                  <span>{item.heightMobile || "compact"}/{item.heightDesktop || "standard"}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => toggle(item)} className={`rounded-full px-3 py-1 text-xs font-bold ${item.active ? "bg-veg/10 text-veg" : "bg-muted text-muted-foreground"}`}>{item.active ? "Active" : "Inactive"}</button>
              <button onClick={() => edit(item)} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground"><Pencil className="h-3 w-3" /> Edit</button>
              <button onClick={() => remove(item.id)} className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive"><Trash2 className="h-3 w-3" /> Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContentPanel({ title, items, kind, refresh }: { title: string; items: Array<CustomerAnnouncement | CustomerCoupon>; kind: "announcement" | "coupon"; refresh: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({});
  const create = useMutation({
    mutationFn: async () => {
      if (kind === "announcement") return createAdminAnnouncement({ message: form.message || "Free delivery today", icon: "flame", color: form.color || "#C62828", priority: Number(form.priority || 0), active: true });
      return createAdminCoupon({ code: form.code || "WELCOME10", title: form.title || "Welcome offer", description: form.description || "", discountType: form.discountType || "percent", discountValue: Number(form.discountValue || 10), maxDiscount: Number(form.maxDiscount || 100), minOrder: Number(form.minOrder || 199), active: true });
    },
    onSuccess: () => { setForm({}); refresh(); toast.success(`${title} synced`); },
  });

  async function toggle(item: any) {
    if (kind === "announcement") await updateAdminAnnouncement(item.id, { active: !item.active });
    if (kind === "coupon") await updateAdminCoupon(item.id, { active: !item.active });
    qc.invalidateQueries({ queryKey: ["admin-customer-content"] });
  }

  async function remove(id: string) {
    if (kind === "announcement") await deleteAdminAnnouncement(id);
    if (kind === "coupon") await deleteAdminCoupon(id);
    refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 font-display text-xl tracking-widest">{kind === "announcement" ? <Megaphone className="h-5 w-5" /> : <Ticket className="h-5 w-5" />}{title}</h2>
      <div className="mt-4 space-y-3">
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
                <div className="truncate font-display tracking-wide">{item.message || item.code}</div>
                <div className="text-xs text-muted-foreground">{item.description || item.category}</div>
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

function bannerPayload(form: Partial<CustomerBanner>): Partial<CustomerBanner> & { title: string; image: string } {
  return {
    title: form.title?.trim() || "New offer",
    subtitle: form.subtitle || "",
    image: form.image || "/assets/hero-biryani.jpg",
    mobileImage: form.mobileImage || null,
    type: form.type || "hero",
    ctaLabel: form.ctaLabel || "Order Now",
    ctaLink: form.ctaLink || "/menu",
    secondaryCtaLabel: form.secondaryCtaLabel || null,
    secondaryCtaLink: form.secondaryCtaLink || null,
    priority: Number(form.priority || 0),
    active: form.active !== false,
    startsAt: form.startsAt || null,
    endsAt: form.endsAt || null,
    heightMobile: form.heightMobile || "compact",
    heightDesktop: form.heightDesktop || "standard",
    textAlign: form.textAlign || "left",
    overlayStrength: form.overlayStrength || "dark",
    textColorMode: form.textColorMode || "light",
  };
}

function BannerPreview({ banner }: { banner: CustomerBanner }) {
  const darkText = banner.textColorMode === "dark";
  const align = banner.textAlign === "center" ? "items-center text-center" : banner.textAlign === "right" ? "items-end text-right" : "items-start text-left";
  const overlay = banner.overlayStrength === "light" ? "bg-black/20" : banner.overlayStrength === "medium" ? "bg-black/45" : "bg-black/70";
  return (
    <div className={`relative min-h-[230px] overflow-hidden rounded-2xl bg-zinc-950 p-4 ${darkText ? "text-zinc-950" : "text-white"}`}>
      <MediaFill url={banner.mobileImage || banner.image} />
      <div className={`absolute inset-0 ${darkText ? "bg-white/70" : overlay}`} />
      <div className={`relative flex min-h-[200px] flex-col justify-end ${align}`}>
        <span className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-black uppercase backdrop-blur">{banner.type || "hero"}</span>
        <div className="mt-3 max-w-[240px] text-2xl font-black">{banner.title || "New offer"}</div>
        <div className={`mt-2 max-w-[240px] text-sm ${darkText ? "text-zinc-700" : "text-white/75"}`}>{banner.subtitle || "Banner subtitle preview"}</div>
        <div className="mt-4 rounded-2xl bg-red-600 px-4 py-2 text-sm font-black text-white">{banner.ctaLabel || "Order Now"}</div>
      </div>
    </div>
  );
}

function MediaFill({ url }: { url?: string | null }) {
  const media = resolveMediaUrl(url || "/assets/hero-biryani.jpg");
  if (isVideoUrl(media)) return <video src={media} muted autoPlay loop playsInline className="absolute inset-0 h-full w-full object-cover" />;
  return <img src={media} alt="" onError={imageFallback} className="absolute inset-0 h-full w-full object-cover" />;
}

function MediaThumb({ url }: { url?: string | null }) {
  const media = resolveMediaUrl(url || "/assets/hero-biryani.jpg");
  if (isVideoUrl(media)) return <video src={media} muted className="h-16 w-20 shrink-0 rounded-md bg-black object-cover" />;
  return <img src={media} alt="" onError={imageFallback} className="h-16 w-20 shrink-0 rounded-md bg-muted object-cover" />;
}

function toInputDateTime(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 16);
}

function Field({ label, value, onChange, type = "text", className = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; className?: string }) {
  const [draft, setDraft] = useState(value || "");
  return <label className={`block ${className}`}><span className="mb-1 block font-display text-xs tracking-widest text-muted-foreground">{label.toUpperCase()}</span><input type={type} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== value && onChange(draft)} className="w-full rounded-md border border-input bg-background px-3 py-2.5" /></label>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <Field label={label} value={String(value)} onChange={(v) => onChange(Number(v) || 0)} />;
}

function MiniInput({ label, value, onChange, type = "text", className = "" }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1 block text-xs text-muted-foreground">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1 block text-xs text-muted-foreground">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function StatusButton({ icon: Icon, label, active, onClick }: { icon: React.ElementType; label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`rounded-lg border p-4 text-left ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"}`}><Icon className="h-5 w-5" /><div className="mt-2 font-display tracking-widest">{label}</div></button>;
}
