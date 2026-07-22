import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Boxes,
  ChefHat,
  Copy,
  Download,
  EyeOff,
  FileSpreadsheet,
  ImagePlus,
  Layers3,
  PackageCheck,
  Plus,
  QrCode,
  Save,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import {
  adjustInventoryIngredient,
  bulkUpdateCatalogItems,
  createCatalogCategory,
  createCatalogItem,
  createInventoryIngredient,
  deleteCatalogCategory,
  deleteCatalogItem,
  downloadCatalogExport,
  duplicateCatalogItem,
  generateCatalogAi,
  getCatalogSummary,
  importCatalogExcel,
  listCatalogAudit,
  listCatalogCategories,
  listCatalogItems,
  listInventoryIngredients,
  updateCatalogCategory,
  updateCatalogItem,
  uploadCatalogFile,
  type CatalogCategory,
  type CatalogItem,
  type InventoryIngredient,
} from "@/services/api";

export const Route = createFileRoute("/admin/menu")({
  component: AdminMenu,
});

type Tab = "dashboard" | "categories" | "items" | "inventory" | "bulk" | "audit";

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "categories", label: "Categories" },
  { id: "items", label: "Items" },
  { id: "inventory", label: "Inventory" },
  { id: "bulk", label: "Bulk" },
  { id: "audit", label: "Audit" },
];

const EMPTY_ITEM: Partial<CatalogItem> = {
  name: "",
  displayName: "",
  shortName: "",
  description: "",
  richDescription: "",
  ingredientsText: "",
  cookingInstructions: "",
  kitchenNotes: "",
  category: "Uncategorized",
  image: "/assets/hero-biryani.jpg",
  basePrice: 0,
  offerPrice: null,
  costPrice: 0,
  taxRate: 5,
  gstRate: 5,
  serviceCharge: 0,
  deliveryChargeOverride: null,
  dietType: "non-veg",
  isVeg: false,
  spiceLevel: 2,
  bestseller: false,
  available: true,
  hidden: false,
  featured: false,
  trending: false,
  pinned: false,
  recentlyAdded: true,
  tags: [],
  prepTimeMinutes: 15,
  cookingPriority: "medium",
  kitchenStation: "Main Course",
  sku: "",
  barcode: "",
  displayOrder: 0,
  visibility: {
    website: true,
    qrMenu: true,
    mobileApp: true,
    pos: true,
    swiggy: false,
    zomato: false,
    blinkit: false,
    ondc: false,
  },
  availabilityRules: {},
  nutrition: {},
  packaging: {},
  seo: {},
};

function AdminMenu() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<Partial<CatalogItem> | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<CatalogCategory> | null>(null);
  const [ingredientDraft, setIngredientDraft] = useState({
    name: "",
    unit: "kg",
    currentStock: 0,
    minimumStock: 0,
  });

  const summaryQuery = useQuery({ queryKey: ["catalog-summary"], queryFn: getCatalogSummary });
  const categoriesQuery = useQuery({
    queryKey: ["catalog-categories"],
    queryFn: listCatalogCategories,
  });
  const itemsQuery = useQuery({
    queryKey: ["catalog-items", search, categoryFilter, statusFilter],
    queryFn: () => listCatalogItems({ search, category: categoryFilter, status: statusFilter }),
  });
  const ingredientsQuery = useQuery({
    queryKey: ["catalog-ingredients"],
    queryFn: listInventoryIngredients,
  });
  const auditQuery = useQuery({ queryKey: ["catalog-audit"], queryFn: listCatalogAudit });

  const summary = summaryQuery.data;
  const categories = categoriesQuery.data ?? [];
  const items = itemsQuery.data ?? [];
  const ingredients = ingredientsQuery.data ?? [];
  const audits = auditQuery.data ?? [];

  const lowStock = ingredients.filter((item) => item.currentStock <= item.minimumStock);
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds],
  );

  async function refreshCatalog() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["catalog-summary"] }),
      qc.invalidateQueries({ queryKey: ["catalog-categories"] }),
      qc.invalidateQueries({ queryKey: ["catalog-items"] }),
      qc.invalidateQueries({ queryKey: ["catalog-ingredients"] }),
      qc.invalidateQueries({ queryKey: ["catalog-audit"] }),
      qc.invalidateQueries({ queryKey: ["menu"] }),
    ]);
  }

  async function saveItem() {
    if (!editingItem?.name?.trim()) return toast.error("Item name is required");
    try {
      const payload = normalizeItemPayload(editingItem);
      if (editingItem.id) {
        await updateCatalogItem(editingItem.id, payload);
        toast.success("Item updated");
      } else {
        await createCatalogItem(payload as Partial<CatalogItem> & { name: string });
        toast.success("Item created");
      }
      setEditingItem(null);
      await refreshCatalog();
    } catch (error) {
      toast.error("Could not save item");
    }
  }

  async function saveCategory() {
    if (!editingCategory?.name?.trim()) return toast.error("Category name is required");
    try {
      if (editingCategory.id) {
        await updateCatalogCategory(editingCategory.id, editingCategory);
        toast.success("Category updated");
      } else {
        await createCatalogCategory(editingCategory as Partial<CatalogCategory> & { name: string });
        toast.success("Category created");
      }
      setEditingCategory(null);
      await refreshCatalog();
    } catch {
      toast.error("Could not save category");
    }
  }

  async function toggleItem(item: CatalogItem, patch: Partial<CatalogItem>) {
    try {
      await updateCatalogItem(item.id, patch);
      await refreshCatalog();
      toast.success("Item updated");
    } catch {
      toast.error("Could not update item");
    }
  }

  async function runAi(task: "description" | "tags" | "seo" | "addons") {
    if (!editingItem?.name) return toast.error("Enter an item name first");
    try {
      const result = await generateCatalogAi(task, editingItem);
      if (task === "description") {
        setEditingItem((item) => ({
          ...item,
          description: result.text.slice(0, 600),
          richDescription: result.text,
        }));
      } else if (task === "tags") {
        setEditingItem((item) => ({
          ...item,
          tags: result.text
            .split(/[,;\n]/)
            .map((tag) => tag.trim())
            .filter(Boolean)
            .slice(0, 10),
        }));
      } else {
        setEditingItem((item) => ({
          ...item,
          kitchenNotes: `${item?.kitchenNotes || ""}\n${task.toUpperCase()}: ${result.text}`.trim(),
        }));
      }
      toast.success(`AI ${task} generated`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI generation failed");
    }
  }

  async function uploadItemImage(file: File) {
    try {
      const result = await uploadCatalogFile(file);
      setEditingItem((item) => ({ ...item, image: result.url, thumbnail: result.url }));
      toast.success("Image uploaded");
    } catch {
      toast.error("Image upload failed");
    }
  }

  async function importExcel(file: File) {
    try {
      const result = await importCatalogExcel(file);
      await refreshCatalog();
      toast.success(`Imported ${result.created} new and ${result.updated} updated items`);
    } catch {
      toast.error("Excel import failed");
    }
  }

  async function saveIngredient() {
    if (!ingredientDraft.name.trim()) return toast.error("Ingredient name is required");
    try {
      await createInventoryIngredient(ingredientDraft);
      setIngredientDraft({ name: "", unit: "kg", currentStock: 0, minimumStock: 0 });
      await refreshCatalog();
      toast.success("Ingredient created");
    } catch {
      toast.error("Could not create ingredient");
    }
  }

  async function bulkSet(patch: Partial<CatalogItem>, message: string) {
    if (selectedIds.length === 0) return toast.error("Select at least one item");
    try {
      await bulkUpdateCatalogItems(selectedIds, patch);
      setSelectedIds([]);
      await refreshCatalog();
      toast.success(message);
    } catch {
      toast.error("Bulk update failed");
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-wide">Menu & Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Restaurant catalog, pricing, stock, channels, import/export, AI tools, and audit
            history.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setEditingItem({ ...EMPTY_ITEM })}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 font-display text-xs tracking-widest text-primary-foreground hover:bg-primary-glow"
          >
            <Plus className="h-4 w-4" /> ADD ITEM
          </button>
          <button
            onClick={() =>
              setEditingCategory({
                name: "",
                seoUrl: "",
                active: true,
                displayPriority: categories.length + 1,
              })
            }
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 font-display text-xs tracking-widest hover:bg-background"
          >
            <Layers3 className="h-4 w-4" /> ADD CATEGORY
          </button>
          <button
            onClick={() => downloadCatalogExport("excel").catch(() => toast.error("Export failed"))}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 font-display text-xs tracking-widest hover:bg-background"
          >
            <Download className="h-4 w-4" /> EXPORT EXCEL
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 font-display text-xs tracking-widest hover:bg-background">
            <Upload className="h-4 w-4" /> IMPORT EXCEL
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => event.target.files?.[0] && importExcel(event.target.files[0])}
            />
          </label>
        </div>
      </header>

      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-md border border-border bg-surface p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`whitespace-nowrap rounded px-4 py-2 font-display text-xs tracking-widest ${tab === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}
          >
            {item.label.toUpperCase()}
          </button>
        ))}
      </nav>

      {tab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric icon={Layers3} label="Total Categories" value={summary?.totalCategories ?? 0} />
            <Metric
              icon={UtensilsCrossed}
              label="Total Menu Items"
              value={summary?.totalItems ?? 0}
            />
            <Metric
              icon={PackageCheck}
              label="Available Items"
              value={summary?.availableItems ?? 0}
            />
            <Metric icon={EyeOff} label="Hidden Items" value={summary?.hiddenItems ?? 0} />
            <Metric
              icon={AlertTriangle}
              label="Out of Stock"
              value={summary?.outOfStock ?? 0}
              tone="text-destructive"
            />
            <Metric
              icon={Boxes}
              label="Low Stock Items"
              value={summary?.lowStockItems ?? 0}
              tone="text-accent"
            />
            <Metric icon={Sparkles} label="Scheduled Items" value={summary?.scheduledItems ?? 0} />
            <Metric
              icon={ChefHat}
              label="Today's Top Seller"
              value={summary?.todaysTopSeller?.name ?? "None"}
            />
          </div>
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="font-display text-xl tracking-widest">Quick Actions</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <QuickAction
                icon={Plus}
                label="Add Item"
                onClick={() => setEditingItem({ ...EMPTY_ITEM })}
              />
              <QuickAction
                icon={Layers3}
                label="Add Category"
                onClick={() => setEditingCategory({ name: "", seoUrl: "", active: true })}
              />
              <QuickAction
                icon={QrCode}
                label="Generate QR Menu"
                onClick={() => toast.success("QR menu uses existing table QR module")}
              />
              <QuickAction
                icon={Bot}
                label="AI Generate Description"
                onClick={() => setEditingItem({ ...EMPTY_ITEM })}
              />
            </div>
          </section>
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="font-display text-xl tracking-widest">Low Stock Alerts</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {lowStock.map((ingredient) => (
                <IngredientAlert key={ingredient.id} ingredient={ingredient} />
              ))}
              {lowStock.length === 0 && (
                <p className="text-sm text-muted-foreground">No low stock alerts.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === "categories" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <section className="rounded-lg border border-border bg-surface">
            <header className="border-b border-border px-4 py-3 font-display text-xl tracking-widest">
              Category Tree
            </header>
            <div className="divide-y divide-border">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div style={{ paddingLeft: category.parentId ? 24 : 0 }}>
                    <div className="font-display tracking-wide">{category.name}</div>
                    <div className="text-xs text-muted-foreground">
                      /{category.seoUrl} - priority {category.displayPriority} -{" "}
                      {category.active ? "active" : "inactive"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingCategory(category)}
                      className="rounded-md border border-border px-3 py-1 text-xs hover:bg-background"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        await deleteCatalogCategory(category.id);
                        await refreshCatalog();
                      }}
                      className="rounded-md border border-destructive/40 px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <CategoryPanel
            category={editingCategory}
            categories={categories}
            onChange={setEditingCategory}
            onSave={saveCategory}
          />
        </div>
      )}

      {tab === "items" && (
        <div className="space-y-4">
          <CatalogFilters
            search={search}
            setSearch={setSearch}
            category={categoryFilter}
            setCategory={setCategoryFilter}
            status={statusFilter}
            setStatus={setStatusFilter}
            categories={categories}
          />
          <section className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="border-b border-border bg-background/40 font-display text-xs tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Select</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Stock/Prep</th>
                  <th className="px-4 py-3">Channels</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-background/30">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={(event) =>
                          setSelectedIds((ids) =>
                            event.target.checked
                              ? [...ids, item.id]
                              : ids.filter((id) => id !== item.id),
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.thumbnail || item.image}
                          alt={item.name}
                          className="h-12 w-12 rounded object-cover"
                        />
                        <div>
                          <div className="font-display text-base tracking-wide">
                            {item.displayName || item.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.sku || "No SKU"} - {item.dietType} -{" "}
                            {item.tags.slice(0, 3).join(", ") || "no tags"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                    <td className="px-4 py-3">
                      <div className="font-display">Rs {item.offerPrice ?? item.basePrice}</div>
                      <div className="text-xs text-muted-foreground">Cost Rs {item.costPrice}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>
                        {item.prepTimeMinutes} min - {item.kitchenStation}
                      </div>
                      <div className="text-muted-foreground">
                        {item.inventoryLinks.length} linked ingredients
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {Object.entries(item.visibility)
                        .filter(([, on]) => on)
                        .map(([key]) => key)
                        .slice(0, 4)
                        .join(", ")}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleItem(item, { available: !item.available })}
                        className={`rounded-full border px-2 py-1 font-display text-[10px] tracking-widest ${item.available ? "border-veg/40 text-veg" : "border-destructive/40 text-destructive"}`}
                      >
                        {item.available ? "AVAILABLE" : "OFF"}
                      </button>
                      {item.hidden && (
                        <span className="ml-2 rounded-full border border-border px-2 py-1 font-display text-[10px] text-muted-foreground">
                          HIDDEN
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingItem(item)}
                          className="rounded-md border border-border px-3 py-1 text-xs hover:bg-background"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            await duplicateCatalogItem(item.id);
                            await refreshCatalog();
                            toast.success("Item duplicated");
                          }}
                          className="rounded-md border border-border px-2 py-1 hover:bg-background"
                          title="Duplicate"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={async () => {
                            await deleteCatalogItem(item.id);
                            await refreshCatalog();
                            toast.success("Item deleted");
                          }}
                          className="rounded-md border border-destructive/40 px-2 py-1 text-destructive hover:bg-destructive/10"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {tab === "inventory" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <section className="rounded-lg border border-border bg-surface">
            <header className="border-b border-border px-4 py-3 font-display text-xl tracking-widest">
              Ingredient Stock
            </header>
            <div className="divide-y divide-border">
              {ingredients.map((ingredient) => (
                <div
                  key={ingredient.id}
                  className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_auto_auto] md:items-center"
                >
                  <div>
                    <div className="font-display tracking-wide">{ingredient.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Min {ingredient.minimumStock} {ingredient.unit} - Max{" "}
                      {ingredient.maximumStock} {ingredient.unit} -{" "}
                      {ingredient.vendor || "No vendor"}
                    </div>
                  </div>
                  <div
                    className={
                      ingredient.currentStock <= ingredient.minimumStock
                        ? "font-display text-destructive"
                        : "font-display text-veg"
                    }
                  >
                    {ingredient.currentStock} {ingredient.unit}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        await adjustInventoryIngredient(ingredient.id, 1, "Quick add");
                        await refreshCatalog();
                      }}
                      className="rounded-md border border-border px-3 py-1 text-xs hover:bg-background"
                    >
                      +1
                    </button>
                    <button
                      onClick={async () => {
                        await adjustInventoryIngredient(ingredient.id, -1, "Quick deduct");
                        await refreshCatalog();
                      }}
                      className="rounded-md border border-border px-3 py-1 text-xs hover:bg-background"
                    >
                      -1
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="font-display text-xl tracking-widest">Add Ingredient</h2>
            <div className="mt-4 space-y-3">
              <Input
                label="Name"
                value={ingredientDraft.name}
                onChange={(value) => setIngredientDraft((draft) => ({ ...draft, name: value }))}
              />
              <Input
                label="Unit"
                value={ingredientDraft.unit}
                onChange={(value) => setIngredientDraft((draft) => ({ ...draft, unit: value }))}
              />
              <NumberInput
                label="Current Stock"
                value={ingredientDraft.currentStock}
                onChange={(value) =>
                  setIngredientDraft((draft) => ({ ...draft, currentStock: value }))
                }
              />
              <NumberInput
                label="Minimum Stock"
                value={ingredientDraft.minimumStock}
                onChange={(value) =>
                  setIngredientDraft((draft) => ({ ...draft, minimumStock: value }))
                }
              />
              <button
                onClick={saveIngredient}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 font-display text-xs tracking-widest text-primary-foreground hover:bg-primary-glow"
              >
                <Save className="h-4 w-4" /> SAVE INGREDIENT
              </button>
            </div>
          </section>
        </div>
      )}

      {tab === "bulk" && (
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-xl tracking-widest">Bulk Operations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedItems.length} selected items. Select items in the Items tab first.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => bulkSet({ available: true }, "Items enabled")}
              className="rounded-md border border-border px-3 py-2 font-display text-xs tracking-widest hover:bg-background"
            >
              ENABLE
            </button>
            <button
              onClick={() => bulkSet({ available: false }, "Items disabled")}
              className="rounded-md border border-border px-3 py-2 font-display text-xs tracking-widest hover:bg-background"
            >
              DISABLE
            </button>
            <button
              onClick={() => bulkSet({ hidden: true }, "Items hidden")}
              className="rounded-md border border-border px-3 py-2 font-display text-xs tracking-widest hover:bg-background"
            >
              HIDE
            </button>
            <button
              onClick={() => bulkSet({ hidden: false }, "Items visible")}
              className="rounded-md border border-border px-3 py-2 font-display text-xs tracking-widest hover:bg-background"
            >
              SHOW
            </button>
            <button
              onClick={() => bulkSet({ bestseller: true }, "Items marked bestseller")}
              className="rounded-md border border-border px-3 py-2 font-display text-xs tracking-widest hover:bg-background"
            >
              BESTSELLER
            </button>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <button
              onClick={() =>
                downloadCatalogExport("excel").catch(() => toast.error("Export failed"))
              }
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-6 font-display text-xs tracking-widest hover:border-primary/50"
            >
              <FileSpreadsheet className="h-5 w-5" /> EXPORT EXCEL
            </button>
            <button
              onClick={() =>
                downloadCatalogExport("catalog").catch(() => toast.error("Export failed"))
              }
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-6 font-display text-xs tracking-widest hover:border-primary/50"
            >
              <Download className="h-5 w-5" /> DOWNLOAD CATALOG CSV
            </button>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-6 font-display text-xs tracking-widest hover:border-primary/50">
              <Upload className="h-5 w-5" /> UPLOAD BULK MENU
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(event) => event.target.files?.[0] && importExcel(event.target.files[0])}
              />
            </label>
          </div>
        </section>
      )}

      {tab === "audit" && (
        <section className="rounded-lg border border-border bg-surface">
          <header className="border-b border-border px-4 py-3 font-display text-xl tracking-widest">
            Audit Logs
          </header>
          <div className="divide-y divide-border">
            {audits.map((log) => (
              <div key={log.id} className="grid gap-2 px-4 py-3 md:grid-cols-[160px_1fr_180px]">
                <div className="font-display text-xs tracking-widest text-primary">
                  {log.action.toUpperCase()}
                </div>
                <div>
                  <div>
                    {log.entity} - {log.entityId}
                  </div>
                  <div className="text-xs text-muted-foreground">{log.userName || "System"}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {editingItem && (
        <ItemEditor
          item={editingItem}
          categories={categories}
          onChange={setEditingItem}
          onClose={() => setEditingItem(null)}
          onSave={saveItem}
          onAi={runAi}
          onUpload={uploadItemImage}
        />
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "text-primary",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-xs tracking-widest text-muted-foreground">
          {label.toUpperCase()}
        </span>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className="mt-3 truncate font-display text-3xl">{value}</div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-5 font-display text-xs tracking-widest hover:border-primary/50"
    >
      <Icon className="h-4 w-4" /> {label.toUpperCase()}
    </button>
  );
}

function IngredientAlert({ ingredient }: { ingredient: InventoryIngredient }) {
  return (
    <div className="rounded-md border border-accent/40 bg-accent/10 p-3">
      <div className="font-display tracking-wide">{ingredient.name}</div>
      <div className="text-sm text-accent">
        {ingredient.currentStock} {ingredient.unit} remaining
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Warning threshold: {ingredient.minimumStock} {ingredient.unit}
      </div>
    </div>
  );
}

function CatalogFilters(props: {
  search: string;
  setSearch: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  categories: CatalogCategory[];
}) {
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_220px_180px]">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={props.search}
          onChange={(event) => props.setSearch(event.target.value)}
          placeholder="Search by name, SKU, barcode, tag"
          className="h-11 w-full rounded-md border border-input bg-surface pl-10 pr-3 text-sm outline-none focus:border-primary"
        />
      </label>
      <select
        value={props.category}
        onChange={(event) => props.setCategory(event.target.value)}
        className="h-11 rounded-md border border-input bg-surface px-3 text-sm outline-none focus:border-primary"
      >
        <option value="">All categories</option>
        {props.categories.map((category) => (
          <option key={category.id} value={category.name}>
            {category.name}
          </option>
        ))}
      </select>
      <select
        value={props.status}
        onChange={(event) => props.setStatus(event.target.value)}
        className="h-11 rounded-md border border-input bg-surface px-3 text-sm outline-none focus:border-primary"
      >
        <option value="">All status</option>
        <option value="available">Available</option>
        <option value="unavailable">Unavailable</option>
        <option value="hidden">Hidden</option>
      </select>
    </div>
  );
}

function CategoryPanel({
  category,
  categories,
  onChange,
  onSave,
}: {
  category: Partial<CatalogCategory> | null;
  categories: CatalogCategory[];
  onChange: (value: Partial<CatalogCategory> | null) => void;
  onSave: () => void;
}) {
  if (!category)
    return (
      <section className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground">
        Select or add a category.
      </section>
    );
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl tracking-widest">
        {category.id ? "Edit Category" : "Add Category"}
      </h2>
      <div className="mt-4 space-y-3">
        <Input
          label="Name"
          value={category.name || ""}
          onChange={(value) =>
            onChange({ ...category, name: value, seoUrl: category.seoUrl || slugify(value) })
          }
        />
        <Select
          label="Parent"
          value={category.parentId || ""}
          onChange={(value) => onChange({ ...category, parentId: value || null })}
          options={[
            ["", "None"],
            ...categories
              .filter((c) => c.id !== category.id)
              .map((c) => [c.id, c.name] as [string, string]),
          ]}
        />
        <Input
          label="SEO URL"
          value={category.seoUrl || ""}
          onChange={(value) => onChange({ ...category, seoUrl: value })}
        />
        <Input
          label="Image URL"
          value={category.image || ""}
          onChange={(value) => onChange({ ...category, image: value })}
        />
        <Input
          label="Banner URL"
          value={category.banner || ""}
          onChange={(value) => onChange({ ...category, banner: value })}
        />
        <NumberInput
          label="Display Priority"
          value={category.displayPriority || 0}
          onChange={(value) => onChange({ ...category, displayPriority: value })}
        />
        <Toggle
          label="Active"
          checked={category.active ?? true}
          onChange={(value) => onChange({ ...category, active: value })}
        />
        <button
          onClick={onSave}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 font-display text-xs tracking-widest text-primary-foreground hover:bg-primary-glow"
        >
          <Save className="h-4 w-4" /> SAVE CATEGORY
        </button>
      </div>
    </section>
  );
}

function ItemEditor({
  item,
  categories,
  onChange,
  onClose,
  onSave,
  onAi,
  onUpload,
}: {
  item: Partial<CatalogItem>;
  categories: CatalogCategory[];
  onChange: (value: Partial<CatalogItem>) => void;
  onClose: () => void;
  onSave: () => void;
  onAi: (task: "description" | "tags" | "seo" | "addons") => void;
  onUpload: (file: File) => void;
}) {
  const tagsText = (item.tags ?? []).join(", ");
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur">
      <div className="h-full w-full max-w-4xl overflow-y-auto border-l border-border bg-background">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
          <div>
            <div className="font-display text-2xl tracking-widest">
              {item.id ? "Edit Item" : "Add Item"}
            </div>
            <div className="text-xs text-muted-foreground">
              Full catalog setup, pricing, channels, kitchen and SEO fields.
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onSave}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-display text-xs tracking-widest text-primary-foreground hover:bg-primary-glow"
            >
              <Save className="h-4 w-4" /> SAVE
            </button>
            <button
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 font-display text-xs tracking-widest hover:bg-surface"
            >
              CLOSE
            </button>
          </div>
        </header>

        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <EditorSection title="Basic Information">
            <Input
              label="Item Name"
              value={item.name || ""}
              onChange={(value) => onChange({ ...item, name: value })}
            />
            <Input
              label="Display Name"
              value={item.displayName || ""}
              onChange={(value) => onChange({ ...item, displayName: value })}
            />
            <Input
              label="Short Name"
              value={item.shortName || ""}
              onChange={(value) => onChange({ ...item, shortName: value })}
            />
            <Textarea
              label="Description"
              value={item.description || ""}
              onChange={(value) => onChange({ ...item, description: value })}
            />
            <Textarea
              label="Rich Description"
              value={item.richDescription || ""}
              onChange={(value) => onChange({ ...item, richDescription: value })}
            />
            <Textarea
              label="Ingredients"
              value={item.ingredientsText || ""}
              onChange={(value) => onChange({ ...item, ingredientsText: value })}
            />
            <Textarea
              label="Cooking Instructions"
              value={item.cookingInstructions || ""}
              onChange={(value) => onChange({ ...item, cookingInstructions: value })}
            />
            <Textarea
              label="Internal Kitchen Notes"
              value={item.kitchenNotes || ""}
              onChange={(value) => onChange({ ...item, kitchenNotes: value })}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                onClick={() => onAi("description")}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 font-display text-xs tracking-widest hover:bg-surface"
              >
                <Sparkles className="h-4 w-4" /> AI DESCRIPTION
              </button>
              <button
                onClick={() => onAi("tags")}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 font-display text-xs tracking-widest hover:bg-surface"
              >
                <Tag className="h-4 w-4" /> AI TAGS
              </button>
            </div>
          </EditorSection>

          <EditorSection title="Images">
            <div className="flex items-center gap-3">
              <img
                src={item.thumbnail || item.image || "/assets/hero-biryani.jpg"}
                alt=""
                className="h-24 w-24 rounded-md object-cover"
              />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 font-display text-xs tracking-widest hover:bg-surface">
                <ImagePlus className="h-4 w-4" /> UPLOAD
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0])}
                />
              </label>
            </div>
            <Input
              label="Cover Photo URL"
              value={item.image || ""}
              onChange={(value) => onChange({ ...item, image: value })}
            />
            <Input
              label="Thumbnail URL"
              value={item.thumbnail || ""}
              onChange={(value) => onChange({ ...item, thumbnail: value })}
            />
            <Input
              label="Zoom Image URL"
              value={item.zoomImage || ""}
              onChange={(value) => onChange({ ...item, zoomImage: value })}
            />
            <p className="text-xs text-muted-foreground">
              Crop, compression, reorder, and AI enhancement hooks are represented by upload and
              gallery metadata in v1.
            </p>
          </EditorSection>

          <EditorSection title="Pricing">
            <NumberInput
              label="Base Price"
              value={item.basePrice || 0}
              onChange={(value) =>
                onChange({ ...item, basePrice: value, price: item.offerPrice ?? value })
              }
            />
            <NumberInput
              label="Offer Price"
              value={item.offerPrice || 0}
              onChange={(value) =>
                onChange({
                  ...item,
                  offerPrice: value || null,
                  price: value || item.basePrice || 0,
                })
              }
            />
            <NumberInput
              label="Cost Price"
              value={item.costPrice || 0}
              onChange={(value) => onChange({ ...item, costPrice: value })}
            />
            <NumberInput
              label="Tax"
              value={item.taxRate || 0}
              onChange={(value) => onChange({ ...item, taxRate: value })}
            />
            <NumberInput
              label="GST"
              value={item.gstRate || 0}
              onChange={(value) => onChange({ ...item, gstRate: value })}
            />
            <NumberInput
              label="Service Charge"
              value={item.serviceCharge || 0}
              onChange={(value) => onChange({ ...item, serviceCharge: value })}
            />
            <NumberInput
              label="Delivery Charge Override"
              value={item.deliveryChargeOverride || 0}
              onChange={(value) => onChange({ ...item, deliveryChargeOverride: value || null })}
            />
          </EditorSection>

          <EditorSection title="Catalog Settings">
            <Select
              label="Category"
              value={item.category || ""}
              onChange={(value) =>
                onChange({
                  ...item,
                  category: value,
                  categoryId: categories.find((c) => c.name === value)?.id,
                })
              }
              options={[
                ["Uncategorized", "Uncategorized"],
                ...categories.map((c) => [c.name, c.name] as [string, string]),
              ]}
            />
            <Select
              label="Diet Badge"
              value={item.dietType || "non-veg"}
              onChange={(value) => onChange({ ...item, dietType: value, isVeg: value === "veg" })}
              options={[
                ["veg", "Veg"],
                ["non-veg", "Non Veg"],
                ["egg", "Egg"],
              ]}
            />
            <NumberInput
              label="Spice Level"
              value={item.spiceLevel || 1}
              onChange={(value) =>
                onChange({ ...item, spiceLevel: Math.max(1, Math.min(3, value)) as 1 | 2 | 3 })
              }
            />
            <Input
              label="Tags"
              value={tagsText}
              onChange={(value) =>
                onChange({
                  ...item,
                  tags: value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
            />
            <Input
              label="SKU"
              value={item.sku || ""}
              onChange={(value) => onChange({ ...item, sku: value })}
            />
            <Input
              label="Barcode"
              value={item.barcode || ""}
              onChange={(value) => onChange({ ...item, barcode: value })}
            />
            <NumberInput
              label="Display Order"
              value={item.displayOrder || 0}
              onChange={(value) => onChange({ ...item, displayOrder: value })}
            />
          </EditorSection>

          <EditorSection title="Availability & Kitchen">
            <Toggle
              label="Available"
              checked={item.available ?? true}
              onChange={(value) => onChange({ ...item, available: value })}
            />
            <Toggle
              label="Hidden"
              checked={item.hidden ?? false}
              onChange={(value) => onChange({ ...item, hidden: value })}
            />
            <Toggle
              label="Bestseller"
              checked={item.bestseller ?? false}
              onChange={(value) => onChange({ ...item, bestseller: value })}
            />
            <Toggle
              label="Featured"
              checked={item.featured ?? false}
              onChange={(value) => onChange({ ...item, featured: value })}
            />
            <Toggle
              label="Trending"
              checked={item.trending ?? false}
              onChange={(value) => onChange({ ...item, trending: value })}
            />
            <NumberInput
              label="Preparation Time Minutes"
              value={item.prepTimeMinutes || 0}
              onChange={(value) => onChange({ ...item, prepTimeMinutes: value })}
            />
            <Select
              label="Cooking Priority"
              value={item.cookingPriority || "medium"}
              onChange={(value) => onChange({ ...item, cookingPriority: value })}
              options={[
                ["low", "Low"],
                ["medium", "Medium"],
                ["high", "High"],
                ["express", "Express"],
                ["vip", "VIP"],
              ]}
            />
            <Select
              label="Kitchen Station"
              value={item.kitchenStation || "Main Course"}
              onChange={(value) => onChange({ ...item, kitchenStation: value })}
              options={[
                "Grill",
                "Tandoor",
                "Biryani",
                "Juice",
                "Tea",
                "Dessert",
                "Starter",
                "Main Course",
              ].map((s) => [s, s] as [string, string])}
            />
          </EditorSection>

          <EditorSection title="Visibility & AI">
            {["website", "qrMenu", "mobileApp", "pos", "swiggy", "zomato", "blinkit", "ondc"].map(
              (channel) => (
                <Toggle
                  key={channel}
                  label={channel}
                  checked={Boolean(item.visibility?.[channel])}
                  onChange={(value) =>
                    onChange({
                      ...item,
                      visibility: { ...(item.visibility || {}), [channel]: value },
                    })
                  }
                />
              ),
            )}
            <button
              onClick={() => onAi("seo")}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 font-display text-xs tracking-widest hover:bg-surface"
            >
              <Bot className="h-4 w-4" /> AI SEO
            </button>
            <button
              onClick={() => onAi("addons")}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 font-display text-xs tracking-widest hover:bg-surface"
            >
              <Sparkles className="h-4 w-4" /> AI ADD-ONS
            </button>
            <p className="text-xs text-muted-foreground">
              Sizes, add-ons, variants, nutrition, packaging, and SEO are persisted by the backend
              model; v1 editor exposes core fields and AI hooks first.
            </p>
          </EditorSection>
        </div>
      </div>
    </div>
  );
}

function EditorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-3 font-display text-lg tracking-widest">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Input({
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
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function Textarea({
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
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
      >
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeItemPayload(item: Partial<CatalogItem>): Partial<CatalogItem> {
  const basePrice = Number(item.basePrice || item.price || 0);
  const offerPrice = item.offerPrice ? Number(item.offerPrice) : null;
  return {
    ...item,
    name: item.name || "",
    description: item.description || "",
    category: item.category || "Uncategorized",
    image: item.image || "/assets/hero-biryani.jpg",
    basePrice,
    offerPrice,
    price: offerPrice ?? basePrice,
    costPrice: Number(item.costPrice || 0),
    taxRate: Number(item.taxRate || 0),
    gstRate: Number(item.gstRate || 0),
    serviceCharge: Number(item.serviceCharge || 0),
    isVeg: item.dietType === "veg" || Boolean(item.isVeg),
    spiceLevel: Math.max(1, Math.min(3, Number(item.spiceLevel || 1))) as 1 | 2 | 3,
    prepTimeMinutes: Number(item.prepTimeMinutes || 0),
    displayOrder: Number(item.displayOrder || 0),
  };
}
