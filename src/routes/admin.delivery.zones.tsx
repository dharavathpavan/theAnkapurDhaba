import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteDeliveryZone,
  getDeliverySettings,
  listAdminDeliveryZones,
  saveDeliveryZone,
  updateDeliverySettings,
  type DeliverySettings,
  type DeliveryZone,
} from "@/services/api";

export const Route = createFileRoute("/admin/delivery/zones")({
  component: AdminZones,
});

const EMPTY: Omit<DeliveryZone, "id"> & { id?: string } = {
  name: "",
  radiusKm: 4,
  deliveryCharge: 30,
  freeDeliveryAbove: 299,
  minDeliveryMin: 20,
  enabled: true,
  sortOrder: 10,
};

function AdminZones() {
  const queryClient = useQueryClient();
  const { data: zones = [], isLoading } = useQuery({
    queryKey: ["admin-delivery-zones"],
    queryFn: listAdminDeliveryZones,
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-delivery-zones"] }),
      queryClient.invalidateQueries({ queryKey: ["delivery-zones"] }),
    ]);
  };

  const save = useMutation({
    mutationFn: (zone: Partial<DeliveryZone> & { id?: string }) => saveDeliveryZone(zone),
    onSuccess: async () => {
      toast.success("Zone saved");
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save zone"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteDeliveryZone(id),
    onSuccess: async () => {
      toast.success("Zone deleted");
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete zone"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-600">Delivery pricing</p>
          <h2 className="text-2xl font-black">Delivery Zones</h2>
          <p className="text-sm text-muted-foreground">
            Radius-based delivery fees and free-delivery thresholds applied at checkout.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => save.mutate(EMPTY)}
            disabled={save.isPending}
            className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white"
          >
            <Plus className="h-4 w-4" /> New Zone
          </button>
          <DeliverySettingsEditor onSaved={invalidate} />
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-border bg-surface p-6 text-sm text-muted-foreground">Loading zones...</div>
      ) : zones.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          No delivery zones yet. Create one to start charging distance-based fees.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {zones.map((zone) => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              onSave={(patch) => save.mutate({ id: zone.id, ...patch })}
              onDelete={() => remove.mutate(zone.id)}
              saving={save.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ZoneCard({
  zone,
  onSave,
  onDelete,
  saving,
}: {
  zone: DeliveryZone;
  onSave: (patch: Partial<DeliveryZone>) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(zone.name);
  const [radiusKm, setRadiusKm] = useState(String(zone.radiusKm));
  const [deliveryCharge, setDeliveryCharge] = useState(String(zone.deliveryCharge));
  const [freeDeliveryAbove, setFreeDeliveryAbove] = useState(String(zone.freeDeliveryAbove));
  const [minDeliveryMin, setMinDeliveryMin] = useState(String(zone.minDeliveryMin));
  const [enabled, setEnabled] = useState(zone.enabled);
  const [sortOrder, setSortOrder] = useState(String(zone.sortOrder));

  const patch = () => ({
    name,
    radiusKm: Number(radiusKm),
    deliveryCharge: Number(deliveryCharge),
    freeDeliveryAbove: Number(freeDeliveryAbove),
    minDeliveryMin: Number(minDeliveryMin),
    enabled,
    sortOrder: Number(sortOrder),
  });

  return (
    <article className="rounded-[24px] border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-100 text-red-600">
            <MapPin className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-transparent bg-transparent px-2 py-1 text-lg font-black outline-none focus:border-border"
              placeholder="Zone name"
            />
            <p className="px-2 text-xs text-muted-foreground">
              {radiusKm} km radius · {deliveryCharge} fee · free above {freeDeliveryAbove}
            </p>
          </div>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-bold">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-red-600" />
          Enabled
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <ZoneField label="Radius (km)" value={radiusKm} onChange={setRadiusKm} />
        <ZoneField label="Delivery fee (Rs)" value={deliveryCharge} onChange={setDeliveryCharge} />
        <ZoneField label="Free above (Rs)" value={freeDeliveryAbove} onChange={setFreeDeliveryAbove} />
        <ZoneField label="Min ETA (min)" value={minDeliveryMin} onChange={setMinDeliveryMin} />
        <ZoneField label="Sort order" value={sortOrder} onChange={setSortOrder} />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onSave(patch())}
          disabled={saving}
          className="flex-1 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          Save Zone
        </button>
        <button
          onClick={onDelete}
          className="grid h-12 w-12 place-items-center rounded-2xl border border-red-200 bg-red-50 text-red-600"
          aria-label="Delete zone"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    </article>
  );
}

function ZoneField({
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
      <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:border-red-400"
      />
    </label>
  );
}

function DeliverySettingsEditor({ onSaved }: { onSaved: () => Promise<void> }) {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["delivery-settings"],
    queryFn: getDeliverySettings,
    staleTime: 60000,
  });
  const [baseRatePerKm, setBaseRatePerKm] = useState(String(settings?.baseRatePerKm ?? 4));
  const [batchMax, setBatchMax] = useState(String(settings?.batchMax ?? 2));
  const [surgeEnabled, setSurgeEnabled] = useState(settings?.surgeEnabled ?? false);
  const [surgeMultiplier, setSurgeMultiplier] = useState(String(settings?.surgeMultiplier ?? 1));

  const save = useMutation({
    mutationFn: (input: Partial<DeliverySettings>) => updateDeliverySettings(input),
    onSuccess: async () => {
      toast.success("Delivery settings saved");
      await onSaved();
      await queryClient.invalidateQueries({ queryKey: ["delivery-settings"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save settings"),
  });

  return (
    <details className="rounded-2xl border border-border bg-surface shadow-sm">
      <summary className="cursor-pointer px-4 py-3 text-sm font-black text-muted-foreground hover:text-foreground">
        Global Settings
      </summary>
      <div className="space-y-2 border-t border-border p-4">
        <SettingsField label="Base rate / km (Rs)" value={baseRatePerKm} onChange={setBaseRatePerKm} />
        <SettingsField label="Batch max orders" value={batchMax} onChange={setBatchMax} />
        <SettingsField label="Surge multiplier" value={surgeMultiplier} onChange={setSurgeMultiplier} />
        <label className="flex items-center gap-2 text-xs font-bold">
          <input type="checkbox" checked={surgeEnabled} onChange={(e) => setSurgeEnabled(e.target.checked)} className="h-4 w-4 accent-red-600" />
          Enable surge pricing
        </label>
        <button
          onClick={() =>
            save.mutate({
              baseRatePerKm: Number(baseRatePerKm),
              batchMax: Number(batchMax),
              surgeEnabled,
              surgeMultiplier: Number(surgeMultiplier),
            })
          }
          disabled={save.isPending}
          className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          Save Settings
        </button>
      </div>
    </details>
  );
}

function SettingsField({
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
      <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:border-red-400"
      />
    </label>
  );
}
