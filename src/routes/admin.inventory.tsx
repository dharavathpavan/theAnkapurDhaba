import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getAdminInventory, updateAdminInventory, type InventoryIngredient } from "@/services/api";
import { AlertTriangle, Boxes, Minus, Plus, RefreshCcw } from "lucide-react";

export const Route = createFileRoute("/admin/inventory")({
  component: InventoryPage,
});

function InventoryPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<InventoryIngredient | null>(null);
  const [quantity, setQuantity] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ["admin-inventory"], queryFn: getAdminInventory });
  const update = useMutation({
    mutationFn: (input: { id: string; action?: "add" | "reduce" | "update"; quantity?: number; note?: string }) => updateAdminInventory(input),
    onSuccess: () => {
      toast.success("Inventory updated");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["admin-inventory"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update stock"),
  });

  const items = (data?.items ?? []).filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
  const low = items.filter((item) => item.currentStock <= item.minimumStock && item.currentStock > 0);
  const out = items.filter((item) => item.currentStock <= 0);

  return (
    <main className="space-y-5 p-4 md:p-6 lg:p-8">
      <section className="rounded-[28px] bg-[#120d0e] p-5 text-white shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-red-200">Stock Control</p>
        <h1 className="mt-2 text-3xl font-black">Inventory</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/65">Track available stock, low stock, out-of-stock ingredients and recent stock movement.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total Items" value={data?.summary.total ?? 0} />
        <Metric label="Available" value={data?.summary.available ?? 0} tone="green" />
        <Metric label="Low Stock" value={data?.summary.low ?? 0} tone="amber" />
        <Metric label="Out Of Stock" value={data?.summary.out ?? 0} tone="red" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="rounded-[24px] border border-border bg-surface p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-black">Available Stock</h2>
            <input className="h-11 rounded-2xl border border-border bg-background px-4 font-bold md:w-80" placeholder="Search inventory item" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {isLoading ? <div className="h-48 animate-pulse rounded-2xl bg-background" /> : items.length === 0 ? <Empty text="No inventory found." /> : (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {items.map((item) => {
                const status = item.currentStock <= 0 ? "Out" : item.currentStock <= item.minimumStock ? "Low" : "Good";
                return (
                  <button key={item.id} onClick={() => setSelected(item)} className="rounded-[22px] border border-border bg-background p-4 text-left transition hover:border-red-200 hover:bg-red-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-lg font-black">{item.name}</div>
                        <div className="text-xs font-bold text-muted-foreground">{item.vendor || "No supplier"}</div>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black ${status === "Good" ? "bg-emerald-50 text-emerald-700" : status === "Low" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{status}</span>
                    </div>
                    <div className="mt-4 text-2xl font-black">{item.currentStock} {item.unit}</div>
                    <div className="mt-1 text-xs font-bold text-muted-foreground">Minimum {item.minimumStock} {item.unit}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-[24px] border border-border bg-surface p-4 shadow-sm">
            <h2 className="text-xl font-black">Stock Action</h2>
            {selected ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-background p-4">
                  <div className="font-black">{selected.name}</div>
                  <div className="text-sm text-muted-foreground">Current: {selected.currentStock} {selected.unit}</div>
                </div>
                <input type="number" min="0" className="h-12 w-full rounded-2xl border border-border bg-background px-3 font-bold" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
                <div className="grid grid-cols-2 gap-2">
                  <button disabled={update.isPending} onClick={() => update.mutate({ id: selected.id, action: "add", quantity })} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 font-black text-white"><Plus className="h-4 w-4" /> Add</button>
                  <button disabled={update.isPending} onClick={() => update.mutate({ id: selected.id, action: "reduce", quantity })} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-red-600 font-black text-white"><Minus className="h-4 w-4" /> Reduce</button>
                </div>
              </div>
            ) : <Empty text="Select an item to update stock." />}
          </div>

          <AlertPanel title="Low Stock" items={low} />
          <AlertPanel title="Out Of Stock" items={out} danger />
        </aside>
      </section>

      <section className="rounded-[24px] border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-4 text-xl font-black">Recent History</h2>
        <div className="space-y-2">
          {(data?.movements ?? []).slice(0, 12).map((movement) => (
            <div key={movement.id} className="flex items-center justify-between rounded-2xl bg-background p-3">
              <div className="flex items-center gap-2 font-bold"><RefreshCcw className="h-4 w-4 text-red-600" /> {movement.type}</div>
              <div className="text-sm font-black">{movement.quantity}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, tone = "slate" }: { label: string; value: number; tone?: string }) {
  const color = tone === "green" ? "text-emerald-600 bg-emerald-50" : tone === "amber" ? "text-amber-600 bg-amber-50" : tone === "red" ? "text-red-600 bg-red-50" : "text-slate-700 bg-slate-100";
  return <div className="rounded-[22px] border border-border bg-surface p-4 shadow-sm"><span className={`grid h-10 w-10 place-items-center rounded-2xl ${color}`}><Boxes className="h-5 w-5" /></span><div className="mt-3 text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-1 text-3xl font-black">{value}</div></div>;
}

function AlertPanel({ title, items, danger = false }: { title: string; items: InventoryIngredient[]; danger?: boolean }) {
  return <div className="rounded-[24px] border border-border bg-surface p-4 shadow-sm"><h3 className="mb-3 flex items-center gap-2 font-black"><AlertTriangle className={`h-4 w-4 ${danger ? "text-red-600" : "text-amber-600"}`} /> {title}</h3>{items.length === 0 ? <p className="text-sm font-bold text-muted-foreground">None</p> : <div className="space-y-2">{items.slice(0, 6).map((item) => <div key={item.id} className="rounded-2xl bg-background p-3 text-sm font-bold">{item.name} · {item.currentStock} {item.unit}</div>)}</div>}</div>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-background p-6 text-center text-sm font-bold text-muted-foreground">{text}</p>;
}
