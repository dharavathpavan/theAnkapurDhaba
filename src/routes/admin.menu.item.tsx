import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ImagePlus, Save, Star, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createCatalogItem,
  listCatalogCategories,
  listCatalogItems,
  updateCatalogItem,
  uploadCatalogFile,
  type CatalogItem,
} from "@/services/api";
import { imageFallback, resolveMediaUrl } from "@/lib/media";
import { TimeScheduleEditor } from "@/components/admin/TimeScheduleEditor";
import { isRuleAvailableNow } from "@/lib/menu-availability";

export const Route = createFileRoute("/admin/menu/item")({
  validateSearch: (search: Record<string, unknown>): { itemId?: string } => ({
    itemId: typeof search.itemId === "string" ? search.itemId : undefined,
  }),
  component: MenuItemBuilderPage,
});

const NEW_ITEM: Partial<CatalogItem> = {
  name: "",
  displayName: "",
  description: "",
  category: "Uncategorized",
  image: "/assets/hero-biryani.jpg",
  basePrice: 0,
  offerPrice: null,
  costPrice: 0,
  taxRate: 5,
  gstRate: 5,
  dietType: "non-veg",
  isVeg: false,
  spiceLevel: 2,
  bestseller: false,
  available: true,
  hidden: false,
  featured: false,
  trending: false,
  pinned: false,
  prepTimeMinutes: 15,
  cookingPriority: "medium",
  kitchenStation: "Main Course",
  tags: [],
  visibility: {
    website: true,
    delivery: true,
    pickup: true,
    dineIn: true,
    qrMenu: true,
    mobileApp: true,
    pos: true,
  },
  availabilityRules: {},
};

const KITCHEN_STATIONS = ["Main Course", "Biryani", "Tandoor", "Starter", "Dessert", "Juice", "Tea"];

function MenuItemBuilderPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { itemId } = Route.useSearch();
  const isEdit = Boolean(itemId);
  const [item, setItem] = useState<Partial<CatalogItem>>(NEW_ITEM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: ["catalog-categories"],
    queryFn: listCatalogCategories,
    staleTime: 30_000,
  });
  const itemsQuery = useQuery({
    queryKey: ["catalog-items", "builder"],
    queryFn: () => listCatalogItems({}),
    enabled: isEdit,
    staleTime: 30_000,
  });

  const sourceItem = useMemo(
    () => itemsQuery.data?.find((entry) => entry.id === itemId),
    [itemsQuery.data, itemId],
  );

  useEffect(() => {
    if (sourceItem) setItem({ ...NEW_ITEM, ...sourceItem });
  }, [sourceItem]);

  function update(patch: Partial<CatalogItem>) {
    setItem((current) => ({ ...current, ...patch }));
  }

  async function saveItem() {
    if (!item.name?.trim()) {
      toast.error("Enter item name");
      document.getElementById("item-name")?.focus();
      return;
    }
    if (!Number(item.basePrice || item.price || 0)) {
      toast.error("Enter item price");
      document.getElementById("item-price")?.focus();
      return;
    }
    setSaving(true);
    try {
      const payload = normalizePayload(item);
      if (item.id) await updateCatalogItem(item.id, payload);
      else await createCatalogItem(payload as Partial<CatalogItem> & { name: string });
      await qc.invalidateQueries({ queryKey: ["catalog-items"] });
      await qc.invalidateQueries({ queryKey: ["customer-menu"] });
      toast.success(item.id ? "Item updated" : "Item created");
      navigate({ to: "/admin/menu" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save item");
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const result = await uploadCatalogFile(file);
      update({ image: result.url, thumbnail: result.url });
      toast.success("Image uploaded");
    } catch {
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
    }
  }

  const categories = categoriesQuery.data || [];
  const currentPrice = Number(item.offerPrice || item.basePrice || item.price || 0);
  const schedulePreview = isRuleAvailableNow(item.availabilityRules);

  return (
    <div className="min-h-screen bg-background px-3 py-4 text-foreground md:px-6">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate({ to: "/admin/menu" })}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-black"
          >
            <ArrowLeft className="h-4 w-4" /> Back to menu
          </button>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">
              The Ankapure Dhaba
            </p>
            <h1 className="text-2xl font-black md:text-4xl">{isEdit ? "Edit Item" : "Create Item"}</h1>
          </div>
        </div>
        <button
          onClick={saveItem}
          disabled={saving || uploading}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Item"}
        </button>
      </header>

      <main className="mx-auto mt-4 grid max-w-7xl gap-4 lg:grid-cols-[1fr_390px]">
        <section className="rounded-[28px] border border-border bg-surface p-4 shadow-2xl shadow-black/10 md:p-5">
          <div className="space-y-6">
            <Section step="1" title="Basics">
              <Field
                id="item-name"
                label="Item name"
                value={item.name || ""}
                onChange={(value) => update({ name: value, displayName: item.displayName || value })}
                placeholder="Chicken Biryani"
              />
              <Field
                label="Display name"
                value={item.displayName || ""}
                onChange={(value) => update({ displayName: value })}
                placeholder="Special Chicken Biryani"
              />
              <DietSelector
                value={String(item.dietType || (item.isVeg ? "veg" : "non-veg"))}
                onChange={(value) => update({ dietType: value, isVeg: value === "veg" })}
              />
              <TextArea
                label="Description"
                value={item.description || ""}
                onChange={(value) => update({ description: value })}
                placeholder="Write a simple customer-facing description"
              />
              <Field
                label="Tags"
                value={(item.tags || []).join(", ")}
                onChange={(value) =>
                  update({
                    tags: value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="spicy, bestseller, family pack"
              />
            </Section>

            <Section step="2" title="Photo">
              <label className="flex cursor-pointer items-center gap-4">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-dashed border-primary/40 bg-background">
                  {item.image ? (
                    <img
                      src={resolveMediaUrl(item.image)}
                      alt=""
                      onError={imageFallback}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImagePlus className="h-8 w-8 text-primary" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="inline-flex items-center gap-2 text-sm font-black">
                    <UploadCloud className="h-4 w-4" /> {uploading ? "Uploading..." : "Upload dish photo"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Optional — a placeholder image is shown if left empty.
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => event.target.files?.[0] && uploadImage(event.target.files[0])}
                />
              </label>
            </Section>

            <Section step="3" title="Category & Price">
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  label="Category"
                  value={item.category || ""}
                  onChange={(value) =>
                    update({
                      category: value,
                      categoryId: categories.find((category) => category.name === value)?.id,
                    })
                  }
                  options={["Uncategorized", ...categories.map((category) => category.name)]}
                />
                <NumberField
                  id="item-price"
                  label="Base price (Rs)"
                  value={Number(item.basePrice || 0)}
                  onChange={(value) => update({ basePrice: value, price: item.offerPrice || value })}
                />
                <NumberField
                  label="Offer price (Rs)"
                  value={Number(item.offerPrice || 0)}
                  onChange={(value) =>
                    update({ offerPrice: value || null, price: value || item.basePrice || 0 })
                  }
                />
                <NumberField
                  label="Preparation time (min)"
                  value={Number(item.prepTimeMinutes || 15)}
                  onChange={(value) => update({ prepTimeMinutes: value })}
                />
              </div>
            </Section>

            <Section step="4" title="Availability">
              <div className="grid gap-2 sm:grid-cols-2">
                <ToggleCard
                  label="Available for sale"
                  checked={item.available !== false}
                  onChange={(value) => update({ available: value })}
                />
                <ToggleCard
                  label="Show in Delivery"
                  checked={item.visibility?.delivery !== false}
                  onChange={(value) => update({ visibility: { ...(item.visibility || {}), delivery: value } })}
                />
                <ToggleCard
                  label="Show in Pickup"
                  checked={item.visibility?.pickup !== false}
                  onChange={(value) => update({ visibility: { ...(item.visibility || {}), pickup: value } })}
                />
                <ToggleCard
                  label="Show in Dine-in"
                  checked={item.visibility?.dineIn !== false}
                  onChange={(value) => update({ visibility: { ...(item.visibility || {}), dineIn: value } })}
                />
              </div>
            </Section>

            <section>
              <button
                type="button"
                onClick={() => setShowAdvanced((current) => !current)}
                className="flex w-full items-center justify-between rounded-2xl border border-border bg-background px-4 py-3"
              >
                <span className="text-sm font-black">Advanced settings</span>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                />
              </button>
              {showAdvanced && (
                <div className="mt-4 space-y-4">
                  <SelectField
                    label="Kitchen station"
                    value={item.kitchenStation || "Main Course"}
                    onChange={(value) => update({ kitchenStation: value })}
                    options={KITCHEN_STATIONS}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <ToggleCard
                      label="Bestseller badge"
                      checked={Boolean(item.bestseller)}
                      onChange={(value) => update({ bestseller: value })}
                    />
                    <ToggleCard
                      label="Priority display"
                      checked={Boolean(item.pinned || item.featured)}
                      onChange={(value) => update({ pinned: value, featured: value })}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <NumberField
                      label="Cost price (Rs)"
                      value={Number(item.costPrice || 0)}
                      onChange={(value) => update({ costPrice: value })}
                    />
                    <NumberField
                      label="Tax (%)"
                      value={Number(item.taxRate || item.gstRate || 5)}
                      onChange={(value) => update({ taxRate: value, gstRate: value })}
                    />
                    <NumberField
                      label="GST (%)"
                      value={Number(item.gstRate || item.taxRate || 5)}
                      onChange={(value) => update({ gstRate: value })}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field
                      label="Short name"
                      value={item.shortName || ""}
                      onChange={(value) => update({ shortName: value })}
                    />
                    <Field
                      label="SKU"
                      value={item.sku || ""}
                      onChange={(value) => update({ sku: value })}
                    />
                    <Field
                      label="Barcode"
                      value={item.barcode || ""}
                      onChange={(value) => update({ barcode: value })}
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-black">Serving schedule</p>
                    <TimeScheduleEditor
                      value={item.availabilityRules}
                      onChange={(availabilityRules) => update({ availabilityRules })}
                    />
                  </div>
                </div>
              )}
            </section>
          </div>

          <footer className="sticky bottom-3 mt-6 flex items-center justify-end gap-3 rounded-3xl border border-border bg-background/95 p-3 backdrop-blur">
            <button
              onClick={() => navigate({ to: "/admin/menu" })}
              className="rounded-2xl border border-border px-5 py-3 text-sm font-black"
            >
              Cancel
            </button>
            <button
              onClick={saveItem}
              disabled={saving || uploading}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground disabled:opacity-60"
            >
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Item"}
            </button>
          </footer>
        </section>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-[32px] border border-border bg-surface p-4 shadow-2xl shadow-black/10">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">
              Instant Preview
            </p>
            <article className="mt-4 overflow-hidden rounded-[28px] bg-white text-zinc-950 shadow-xl">
              <div className="relative aspect-[4/3] bg-zinc-100">
                <img
                  src={resolveMediaUrl(item.image || "/assets/hero-biryani.jpg")}
                  alt={item.name || "Item preview"}
                  onError={imageFallback}
                  className="h-full w-full object-cover"
                />
                {item.bestseller ? (
                  <span className="absolute left-3 top-3 rounded-full bg-yellow-400 px-3 py-1 text-xs font-black text-black">
                    Bestseller
                  </span>
                ) : null}
                {item.pinned || item.featured ? (
                  <span className="absolute right-3 top-3 rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white">
                    Priority
                  </span>
                ) : null}
              </div>
              <div className="p-4">
                <h2 className="line-clamp-2 text-xl font-black">
                  {item.displayName || item.name || "Your item name"}
                </h2>
                <p className="mt-2 line-clamp-2 text-sm text-zinc-500">
                  {item.description || "Your description appears here while you create the item."}
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-zinc-500">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> 4.6
                  <span>•</span>
                  <span>{item.prepTimeMinutes || 15} min</span>
                  <span>•</span>
                  <span>{item.isVeg ? "Veg" : "Non Veg"}</span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-black">Rs {currentPrice || 0}</div>
                    {item.offerPrice ? (
                      <div className="text-sm text-zinc-400 line-through">Rs {item.basePrice || 0}</div>
                    ) : null}
                  </div>
                  <button
                    onClick={saveItem}
                    disabled={saving || uploading}
                    className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "ADD"}
                  </button>
                </div>
              </div>
            </article>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black">
              {[
                ["Delivery", item.visibility?.delivery !== false],
                ["Pickup", item.visibility?.pickup !== false],
                ["Dine-in", item.visibility?.dineIn !== false],
              ].map(([label, on]) => (
                <div
                  key={String(label)}
                  className={`rounded-2xl px-2 py-3 ${on ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-400"}`}
                >
                  {String(label)}
                </div>
              ))}
            </div>
            {item.availabilityRules && Object.keys(item.availabilityRules).length > 0 ? (
              <div
                className={`mt-3 rounded-2xl px-3 py-2 text-xs font-black ${
                  schedulePreview.available
                    ? "bg-green-50 text-green-700"
                    : "bg-yellow-50 text-yellow-800"
                }`}
              >
                {schedulePreview.available
                  ? `Available now - ${schedulePreview.windowLabel}`
                  : schedulePreview.message}
              </div>
            ) : null}
            <p className="mt-4 text-xs text-muted-foreground">
              Preview updates instantly as you type. Save publishes the item to the customer menu.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}

function Section(props: { step?: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 font-display text-xl tracking-widest">
        {props.step ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
            {props.step}
          </span>
        ) : null}
        {props.title}
      </h2>
      <div className="mt-4 space-y-4">{props.children}</div>
    </section>
  );
}

function DietSelector(props: { value: string; onChange: (value: "veg" | "non-veg" | "egg") => void }) {
  const options: Array<{ value: "veg" | "non-veg" | "egg"; label: string }> = [
    { value: "veg", label: "Veg" },
    { value: "non-veg", label: "Non Veg" },
    { value: "egg", label: "Egg" },
  ];
  return (
    <div>
      <span className="text-sm font-black">Food type</span>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => props.onChange(option.value)}
            className={`rounded-2xl px-3 py-3 text-sm font-black ${
              props.value === option.value ? "bg-primary text-primary-foreground" : "bg-background"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function normalizePayload(item: Partial<CatalogItem>) {
  return {
    ...item,
    name: item.name?.trim() || "New Item",
    displayName: item.displayName || item.name,
    description: item.description || "",
    category: item.category || "Uncategorized",
    basePrice: Number(item.basePrice || item.price || 0),
    offerPrice: item.offerPrice ? Number(item.offerPrice) : null,
    costPrice: Number(item.costPrice || 0),
    taxRate: Number(item.taxRate || item.gstRate || 5),
    gstRate: Number(item.gstRate || item.taxRate || 5),
    price: Number(item.offerPrice || item.basePrice || item.price || 0),
    tags: item.tags || [],
    visibility: {
      website: true,
      qrMenu: true,
      mobileApp: true,
      pos: true,
      ...(item.visibility || {}),
    },
    availabilityRules: item.availabilityRules || {},
  };
}

function Field(props: {
  id?: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black">{props.label}</span>
      <input
        id={props.id}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-2xl border border-input bg-background px-4 outline-none focus:border-primary"
      />
    </label>
  );
}

function TextArea(props: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black">{props.label}</span>
      <textarea
        value={props.value}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
        rows={4}
        className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 outline-none focus:border-primary"
      />
    </label>
  );
}

function NumberField(props: {
  id?: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black">{props.label}</span>
      <input
        id={props.id}
        type="number"
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value || 0))}
        className="mt-2 h-12 w-full rounded-2xl border border-input bg-background px-4 outline-none focus:border-primary"
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black">{props.label}</span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-2xl border border-input bg-background px-4 outline-none focus:border-primary"
      >
        {props.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleCard(props: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => props.onChange(!props.checked)}
      className={`flex items-center justify-between rounded-3xl border p-4 text-left transition ${
        props.checked
          ? "border-green-500/40 bg-green-500/10 text-green-600"
          : "border-border bg-background text-muted-foreground"
      }`}
    >
      <span className="font-black">{props.label}</span>
      <span className={`h-7 w-12 rounded-full p-1 ${props.checked ? "bg-green-600" : "bg-muted"}`}>
        <span
          className={`block h-5 w-5 rounded-full bg-white transition ${
            props.checked ? "translate-x-5" : ""
          }`}
        />
      </span>
    </button>
  );
}
