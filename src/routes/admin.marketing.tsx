/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Eye,
  GripVertical,
  ImagePlus,
  Megaphone,
  Monitor,
  Pencil,
  Save,
  Smartphone,
  Sparkles,
  Ticket,
  Trash2,
  Upload,
  X,
} from "lucide-react";
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
  uploadCatalogFile,
  type CustomerAnnouncement,
  type CustomerBanner,
  type CustomerCoupon,
} from "@/services/api";
import { imageFallback, isVideoUrl, resolveMediaUrl } from "@/lib/media";

export const Route = createFileRoute("/admin/marketing")({
  head: () => ({ meta: [{ title: "Marketing - Ankapur Dhaba" }] }),
  component: MarketingPage,
});

const defaultBannerForm: Partial<CustomerBanner> = {
  title: "Banner",
  subtitle: "",
  image: "",
  mobileImage: "",
  type: "hero",
  ctaEnabled: false,
  ctaLabel: "",
  ctaLink: "",
  secondaryCtaEnabled: false,
  secondaryCtaLabel: "",
  secondaryCtaLink: "",
  priority: 0,
  active: true,
  heightMobile: "compact",
  heightDesktop: "standard",
  textAlign: "left",
  overlayStrength: "light",
  textColorMode: "light",
  startsAt: null,
  endsAt: null,
};

function MarketingPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-customer-content"],
    queryFn: getAdminCustomerContent,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-customer-content"] });

  if (isLoading || !data)
    return <div className="p-8 text-muted-foreground">Loading marketing settings...</div>;
  const heroCount = data.banners.filter((banner) => !isAdBanner(banner.type)).length;
  const adCount = data.banners.filter((banner) => isAdBanner(banner.type)).length;
  const activeAnnouncements = data.announcements.filter((item) => item.active).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-wide">Marketing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage app banners, announcements, ad spaces, offers and push-style notifications.
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1.5 font-display text-xs tracking-widest text-primary">
          CUSTOMER APP
        </span>
      </div>

      <section className="mt-8 grid gap-3 md:grid-cols-4">
        <MarketingStat icon={Sparkles} label="Hero Banners" value={heroCount} />
        <MarketingStat icon={Upload} label="Ad Spaces" value={adCount} />
        <MarketingStat icon={Megaphone} label="Announcements" value={activeAnnouncements} />
        <MarketingStat icon={Ticket} label="Coupons" value={data.coupons.length} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <BannerManager banners={data.banners} refresh={refresh} />
        <div className="grid gap-6">
          <AdSpacePanel banners={data.banners} />
          <PushNotificationPanel />
          <ContentPanel
            title="Announcements"
            items={data.announcements}
            kind="announcement"
            refresh={refresh}
          />
          <ContentPanel title="Coupons" items={data.coupons} kind="coupon" refresh={refresh} />
        </div>
      </section>
    </div>
  );
}

function MarketingStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <span className="font-display text-3xl tracking-wide">{value}</span>
      </div>
      <div className="mt-3 font-display text-xs tracking-widest text-muted-foreground">
        {label.toUpperCase()}
      </div>
    </div>
  );
}

function AdSpacePanel({ banners }: { banners: CustomerBanner[] }) {
  const adBanners = banners.filter((banner) => isAdBanner(banner.type));
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 font-display text-xl tracking-widest">
        <Upload className="h-5 w-5 text-primary" /> Ad Space Settings
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Create ads in the banner builder by setting badge/type to ad, brand, or sponsored.
      </p>
      <div className="mt-4 grid gap-3">
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="font-display text-xs tracking-widest text-muted-foreground">
            VISIBLE AREAS
          </div>
          <div className="mt-2 text-sm">
            Order tracking bottom area, offer strips, and sponsored customer placements.
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="font-display text-xs tracking-widest text-muted-foreground">
            ACTIVE AD BANNERS
          </div>
          <div className="mt-2 text-2xl font-black">
            {adBanners.filter((banner) => banner.active).length}
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-sm text-primary">
          For brand ads, upload image/video media and use CTA links for sponsor landing pages.
        </div>
      </div>
    </div>
  );
}

function PushNotificationPanel() {
  const [title, setTitle] = useState("Ankapur Dhaba");
  const [message, setMessage] = useState("New offer is live. Order now!");
  const [target, setTarget] = useState("All customers");

  async function sendPreview() {
    if (!message.trim()) {
      toast.error("Add notification message");
      return;
    }
    if (!("Notification" in window)) {
      toast.error("This browser does not support notifications");
      return;
    }
    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    if (permission !== "granted") {
      toast.error("Notification permission not granted");
      return;
    }
    new Notification(title || "Ankapur Dhaba", { body: message, icon: "/favicon.ico" });
    toast.success(`Preview sent to this device for ${target}`);
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 font-display text-xl tracking-widest">
        <Bell className="h-5 w-5 text-primary" /> Push Notifications
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Create a notification message and preview it on this admin device. Real push delivery can
        connect to a provider later.
      </p>
      <div className="mt-4 grid gap-3">
        <MiniInput label="Title" value={title} onChange={setTitle} />
        <MiniInput label="Message" value={message} onChange={setMessage} />
        <SelectField
          label="Target"
          value={target}
          options={["All customers", "Active orders", "Loyalty customers", "Inactive customers"]}
          onChange={setTarget}
        />
        <button
          onClick={sendPreview}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 font-display text-xs tracking-widest text-primary-foreground"
        >
          <Bell className="h-4 w-4" /> SEND PREVIEW
        </button>
      </div>
    </div>
  );
}

function isAdBanner(type?: string | null) {
  return /^(ad|ads|brand|sponsored)$/i.test(type || "");
}

function BannerKindButton({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:border-primary/40"}`}
    >
      <div className="font-display text-xs tracking-widest">{label.toUpperCase()}</div>
      <div className={`mt-1 text-sm ${active ? "text-primary/80" : "text-muted-foreground"}`}>
        {description}
      </div>
    </button>
  );
}

function BannerManager({ banners, refresh }: { banners: CustomerBanner[]; refresh: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<CustomerBanner>>(defaultBannerForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ image?: string; mobileImage?: string }>({});
  const [uploadingField, setUploadingField] = useState<"image" | "mobileImage" | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [orderedBanners, setOrderedBanners] = useState<CustomerBanner[]>([]);
  const sorted = useMemo(
    () => [...banners].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)),
    [banners],
  );
  const orderChanged = orderedBanners.some((item, index) => item.id !== sorted[index]?.id);
  const previewBanner = {
    ...defaultBannerForm,
    ...form,
    image: previewMedia.image || form.image,
    mobileImage: previewMedia.mobileImage || form.mobileImage,
  } as CustomerBanner;
  const saving = useMutation({
    mutationFn: async () => {
      const payload = bannerPayload(form);
      if (!payload.image.trim()) throw new Error("Upload or paste banner media first.");
      if (editingId) return updateAdminBanner(editingId, payload);
      return createAdminBanner(payload);
    },
    onSuccess: () => {
      setForm({ ...defaultBannerForm });
      setPreviewMedia({});
      setEditingId(null);
      refresh();
      toast.success("Banner published");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save banner"),
  });
  const saveOrder = useMutation({
    mutationFn: async () =>
      Promise.all(
        orderedBanners.map((item, index) => updateAdminBanner(item.id, { priority: index })),
      ),
    onSuccess: () => {
      refresh();
      toast.success("Banner order saved");
    },
  });

  useEffect(() => {
    setOrderedBanners(sorted);
  }, [sorted]);

  async function upload(file: File | undefined, field: "image" | "mobileImage") {
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("Only image and video files are supported.");
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setPreviewMedia((current) => ({ ...current, [field]: localUrl }));
    setUploadingField(field);
    try {
      const result = await uploadCatalogFile(file);
      setForm((current) => ({ ...current, [field]: result.url }));
      setPreviewMedia((current) => ({ ...current, [field]: result.url }));
      toast.success(field === "mobileImage" ? "Mobile media uploaded" : "Media uploaded");
    } catch {
      if (file.type.startsWith("image/") && file.size <= 1_800_000) {
        const embedded = await fileToDataUrl(file);
        setForm((current) => ({ ...current, [field]: embedded }));
        setPreviewMedia((current) => ({ ...current, [field]: embedded }));
        toast.warning("Upload failed, saved as embedded image.");
      } else {
        toast.error("Upload failed. Preview is local only.");
      }
    } finally {
      setUploadingField(null);
    }
  }

  function edit(item: CustomerBanner) {
    setEditingId(item.id);
    setPreviewMedia({});
    setForm({
      ...defaultBannerForm,
      ...item,
      startsAt: toInputDateTime(item.startsAt),
      endsAt: toInputDateTime(item.endsAt),
    });
  }

  async function toggle(item: CustomerBanner) {
    await updateAdminBanner(item.id, { active: !item.active });
    qc.invalidateQueries({ queryKey: ["admin-customer-content"] });
  }

  async function remove(id: string) {
    await deleteAdminBanner(id);
    refresh();
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...defaultBannerForm });
    setPreviewMedia({});
  }

  function moveBanner(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    setOrderedBanners((current) => {
      const next = [...current];
      const from = next.findIndex((item) => item.id === sourceId);
      const to = next.findIndex((item) => item.id === targetId);
      if (from < 0 || to < 0) return current;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl tracking-widest">Banner Space</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload an image or video, choose where it appears, and publish. No title, subtitle or
            CTA setup needed.
          </p>
        </div>
        {editingId && (
          <button
            onClick={resetForm}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
          >
            <X className="h-4 w-4" /> Cancel edit
          </button>
        )}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="overflow-hidden rounded-2xl border border-border bg-background">
          <div className="border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
            <div className="font-display text-xs tracking-widest text-muted-foreground">
              UPLOAD AND PUBLISH
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Images and videos are shown directly on the website/app banner area.
            </div>
          </div>

          <div className="grid gap-5 p-4 sm:p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <MediaDropZone
                icon={Monitor}
                title="Desktop media"
                description="Drop image/video here or click to upload"
                value={previewMedia.image || form.image}
                busy={uploadingField === "image"}
                onFile={(file) => upload(file, "image")}
              />
              <MediaDropZone
                icon={Smartphone}
                title="Mobile media"
                description="Optional. Uses desktop media if empty."
                value={previewMedia.mobileImage || form.mobileImage}
                busy={uploadingField === "mobileImage"}
                onFile={(file) => upload(file, "mobileImage")}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <MiniInput
                label="Desktop media URL"
                value={form.image || ""}
                onChange={(image) => setForm({ ...form, image })}
              />
              <MiniInput
                label="Mobile media URL"
                value={form.mobileImage || ""}
                onChange={(mobileImage) => setForm({ ...form, mobileImage })}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <SelectField
                label="Placement"
                value={isAdBanner(form.type) ? "ad" : "hero"}
                options={["hero", "ad"]}
                onChange={(type) => setForm({ ...form, type })}
              />
              <MiniInput
                label="Priority"
                value={form.priority ?? 0}
                onChange={(priority) => setForm({ ...form, priority: Number(priority) || 0 })}
              />
              <label className="flex items-center justify-between rounded-md border border-border bg-background p-3 text-sm">
                <span>Active</span>
                <input
                  type="checkbox"
                  checked={form.active !== false}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                />
              </label>
              <MiniInput
                label="Starts at"
                type="datetime-local"
                value={toInputDateTime(form.startsAt)}
                onChange={(startsAt) => setForm({ ...form, startsAt: startsAt || null })}
              />
              <MiniInput
                label="Ends at"
                type="datetime-local"
                value={toInputDateTime(form.endsAt)}
                onChange={(endsAt) => setForm({ ...form, endsAt: endsAt || null })}
              />
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                {isAdBanner(form.type)
                  ? "Ad banners appear in sponsored/tracking spaces."
                  : "Home banners appear in the customer carousel."}
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface/95 p-4 backdrop-blur">
            <div className="text-xs text-muted-foreground">
              {uploadingField
                ? "Uploading media..."
                : editingId
                  ? "Editing existing banner"
                  : "Ready to create banner"}
            </div>
            <button
              onClick={() => saving.mutate()}
              disabled={saving.isPending || Boolean(uploadingField)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 font-display text-xs tracking-widest text-primary-foreground disabled:opacity-60"
            >
              <Save className="h-4 w-4" /> {editingId ? "SAVE BANNER" : "PUBLISH BANNER"}
            </button>
          </div>
        </div>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-muted-foreground">
            <Eye className="h-4 w-4" /> Live preview
          </div>
          <BannerPreview banner={previewBanner} />
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl tracking-widest">Saved banners</h3>
          <p className="text-sm text-muted-foreground">
            Drag cards to reorder, then save priorities.
          </p>
        </div>
        {orderChanged && (
          <button
            onClick={() => saveOrder.mutate()}
            disabled={saveOrder.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-display text-xs tracking-widest text-primary-foreground disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> SAVE ORDER
          </button>
        )}
      </div>

      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {orderedBanners.map((item, index) => (
          <li
            key={item.id}
            draggable
            onDragStart={() => setDraggingId(item.id)}
            onDragEnd={() => setDraggingId(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (draggingId) moveBanner(draggingId, item.id);
            }}
            className={`rounded-lg border bg-background p-3 transition ${draggingId === item.id ? "border-primary opacity-60" : "border-border"}`}
          >
            <div className="flex gap-3">
              <div className="flex cursor-grab items-center text-muted-foreground active:cursor-grabbing">
                <GripVertical className="h-5 w-5" />
              </div>
              <MediaThumb url={item.mobileImage || item.image} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate font-display tracking-wide">
                    {isAdBanner(item.type) ? "Ad / Sponsored Space" : "Website / App Home Banner"}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black ${isAdBanner(item.type) ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}
                  >
                    {isAdBanner(item.type) ? "AD SPACE" : "HERO"}
                  </span>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {isAdBanner(item.type) ? "Tracking and sponsored placement" : "Home carousel"}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span>#{index + 1}</span>
                  <span>Priority {item.priority ?? 0}</span>
                  <span>
                    {item.startsAt
                      ? `From ${new Date(item.startsAt).toLocaleDateString()}`
                      : "Starts now"}
                  </span>
                  <span>
                    {item.endsAt
                      ? `Ends ${new Date(item.endsAt).toLocaleDateString()}`
                      : "No end date"}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => toggle(item)}
                className={`rounded-full px-3 py-1 text-xs font-bold ${item.active ? "bg-veg/10 text-veg" : "bg-muted text-muted-foreground"}`}
              >
                {item.active ? "Active" : "Inactive"}
              </button>
              <button
                onClick={() => edit(item)}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
              <button
                onClick={() => remove(item.id)}
                className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContentPanel({
  title,
  items,
  kind,
  refresh,
}: {
  title: string;
  items: Array<CustomerAnnouncement | CustomerCoupon>;
  kind: "announcement" | "coupon";
  refresh: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({});
  const create = useMutation({
    mutationFn: async () => {
      if (kind === "announcement")
        return createAdminAnnouncement({
          message: form.message || "Free delivery today",
          icon: "flame",
          color: form.color || "#C62828",
          priority: Number(form.priority || 0),
          active: true,
        });
      return createAdminCoupon({
        code: form.code || "WELCOME10",
        title: form.title || "Welcome offer",
        description: form.description || "",
        discountType: form.discountType || "percent",
        discountValue: Number(form.discountValue || 10),
        maxDiscount: Number(form.maxDiscount || 100),
        minOrder: Number(form.minOrder || 199),
        active: true,
      });
    },
    onSuccess: () => {
      setForm({});
      refresh();
      toast.success(`${title} synced`);
    },
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
      <h2 className="flex items-center gap-2 font-display text-xl tracking-widest">
        {kind === "announcement" ? (
          <Megaphone className="h-5 w-5" />
        ) : (
          <Ticket className="h-5 w-5" />
        )}
        {title}
      </h2>
      <div className="mt-4 space-y-3">
        {kind === "announcement" && (
          <MiniInput
            label="Message"
            value={form.message || ""}
            onChange={(message) => setForm({ ...form, message })}
          />
        )}
        {kind === "coupon" && (
          <>
            <MiniInput
              label="Code"
              value={form.code || ""}
              onChange={(code) => setForm({ ...form, code: code.toUpperCase() })}
            />
            <MiniInput
              label="Title"
              value={form.title || ""}
              onChange={(title) => setForm({ ...form, title })}
            />
            <MiniInput
              label="Discount"
              value={form.discountValue || ""}
              onChange={(discountValue) => setForm({ ...form, discountValue })}
            />
            <MiniInput
              label="Min order"
              value={form.minOrder || ""}
              onChange={(minOrder) => setForm({ ...form, minOrder })}
            />
          </>
        )}
        <button
          onClick={() => create.mutate()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 font-display text-xs tracking-widest text-primary-foreground"
        >
          <Save className="h-4 w-4" /> ADD
        </button>
      </div>
      <ul className="mt-5 space-y-2">
        {items.map((item: any) => (
          <li key={item.id} className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-display tracking-wide">
                  {item.message || item.code}
                </div>
                <div className="text-xs text-muted-foreground">
                  {item.description || item.category}
                </div>
              </div>
              <button onClick={() => remove(item.id)} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => toggle(item)}
              className={`mt-3 rounded-full px-3 py-1 text-xs font-bold ${item.active ? "bg-veg/10 text-veg" : "bg-muted text-muted-foreground"}`}
            >
              {item.active ? "Active" : "Inactive"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function bannerPayload(
  form: Partial<CustomerBanner>,
): Partial<CustomerBanner> & { title: string; image: string } {
  return {
    title: "Banner",
    subtitle: "",
    image: normalizeBannerMedia(form.image) || "",
    mobileImage: normalizeBannerMedia(form.mobileImage) || null,
    type: isAdBanner(form.type) ? "ad" : "hero",
    ctaEnabled: false,
    ctaLabel: "",
    ctaLink: "",
    secondaryCtaEnabled: false,
    secondaryCtaLabel: null,
    secondaryCtaLink: null,
    priority: Number(form.priority || 0),
    active: form.active !== false,
    startsAt: normalizeDateTime(form.startsAt),
    endsAt: normalizeDateTime(form.endsAt),
    heightMobile: "compact",
    heightDesktop: "standard",
    textAlign: "left",
    overlayStrength: "light",
    textColorMode: "light",
  };
}

function normalizeBannerMedia(value?: string | null) {
  const clean = value?.trim();
  if (!clean) return "";
  if (clean === "/assets/-biryani.jpg" || clean === "-biryani.jpg" || clean === "/-biryani.jpg")
    return "/assets/hero-biryani.jpg";
  return clean;
}

function BannerPreview({ banner }: { banner: CustomerBanner }) {
  return (
    <div className="relative min-h-[230px] overflow-hidden rounded-2xl bg-zinc-950">
      {banner.image ? (
        <MediaFill url={banner.mobileImage || banner.image} />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-muted text-center text-sm text-muted-foreground">
          Upload image or video to preview
        </div>
      )}
      <div className="absolute left-3 top-3 rounded-full bg-black/65 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur">
        {isAdBanner(banner.type) ? "Ad / Sponsored" : "Home Banner"}
      </div>
      {banner.mobileImage ? (
        <div className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-950 shadow">
          Mobile media ready
        </div>
      ) : null}
    </div>
  );
}

function MediaDropZone({
  icon: Icon,
  title,
  description,
  value,
  busy,
  onFile,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  value?: string | null;
  busy: boolean;
  onFile: (file: File) => void;
}) {
  const media = value ? resolveMediaUrl(value) : "";

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <label
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      className="group relative flex min-h-[220px] cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/30 p-4 transition hover:border-primary hover:bg-primary/5"
    >
      {media ? (
        <div className="absolute inset-0">
          {isVideoUrl(media) ? (
            <video
              src={media}
              muted
              autoPlay
              loop
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <img
              src={media}
              alt=""
              onError={imageFallback}
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-black/45" />
        </div>
      ) : null}
      <div className="relative flex items-center justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/90 text-primary shadow-sm">
          <Icon className="h-5 w-5" />
        </span>
        {busy && (
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-black text-primary-foreground">
            Uploading
          </span>
        )}
      </div>
      <div className="relative">
        <div
          className={`font-display text-lg tracking-wide ${media ? "text-white" : "text-foreground"}`}
        >
          {title}
        </div>
        <div className={`mt-1 text-sm ${media ? "text-white/80" : "text-muted-foreground"}`}>
          {description}
        </div>
        <div
          className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${media ? "bg-white text-zinc-950" : "bg-surface text-primary"}`}
        >
          <ImagePlus className="h-4 w-4" /> {media ? "Replace media" : "Choose media"}
        </div>
      </div>
      <input
        type="file"
        className="hidden"
        accept="image/*,video/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.currentTarget.value = "";
        }}
      />
    </label>
  );
}

function MediaFill({ url }: { url?: string | null }) {
  const media = resolveMediaUrl(url || "/assets/hero-biryani.jpg");
  if (isVideoUrl(media))
    return (
      <video
        src={media}
        muted
        autoPlay
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  return (
    <img
      src={media}
      alt=""
      onError={imageFallback}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

function MediaThumb({ url }: { url?: string | null }) {
  const media = resolveMediaUrl(url || "/assets/hero-biryani.jpg");
  if (isVideoUrl(media))
    return (
      <video src={media} muted className="h-16 w-20 shrink-0 rounded-md bg-black object-cover" />
    );
  return (
    <img
      src={media}
      alt=""
      onError={imageFallback}
      className="h-16 w-20 shrink-0 rounded-md bg-muted object-cover"
    />
  );
}

function toInputDateTime(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 16);
}

function normalizeDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value || "");
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block font-display text-xs tracking-widest text-muted-foreground">
        {label.toUpperCase()}
      </span>
      <input
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onChange(draft)}
        className="w-full rounded-md border border-input bg-background px-3 py-2.5"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return <Field label={label} value={String(value)} onChange={(v) => onChange(Number(v) || 0)} />;
}

function MiniInput({
  label,
  value,
  onChange,
  type = "text",
  className = "",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-md border border-border bg-background p-3 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function StatusButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-4 text-left ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"}`}
    >
      <Icon className="h-5 w-5" />
      <div className="mt-2 font-display tracking-widest">{label}</div>
    </button>
  );
}
