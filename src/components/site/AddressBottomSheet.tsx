import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Home,
  LocateFixed,
  MapPin,
  Navigation,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  getCustomerHome,
  listCustomerAddresses,
  updateCustomerAddress,
  type CustomerAddress,
} from "@/services/api";
import { useAuth } from "@/stores/auth";
import { useSelectedLocation } from "@/stores/location";
import { LocationPicker } from "@/components/site/LocationPicker";
import {
  addressCoords,
  calculateDeliveryEta,
  restaurantCoords,
  shortAddress,
  zoneFallback,
  type DeliveryEta,
} from "@/lib/delivery-location";
import type { LatLngLiteral, ParsedAddress } from "@/lib/google-maps";

type AddressDraft = Omit<CustomerAddress, "id" | "createdAt" | "updatedAt">;

const emptyDraft: AddressDraft = {
  type: "Home",
  label: "Home",
  name: "",
  phone: "",
  address: "",
  formattedAddress: "",
  houseNumber: "",
  landmark: "",
  city: "",
  state: "Telangana",
  country: "India",
  postalCode: "",
  notes: "",
  lat: null,
  lng: null,
  isDefault: false,
};

export function AddressBottomSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const setSelectedAddress = useSelectedLocation((state) => state.setSelectedAddress);
  const setEta = useSelectedLocation((state) => state.setEta);
  const [mode, setMode] = useState<"saved" | "confirm">("saved");
  const [snap, setSnap] = useState<"compact" | "roomy" | "full">("roomy");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AddressDraft>({ ...emptyDraft });
  const [draftEta, setDraftEta] = useState<DeliveryEta | null>(null);
  const [addressEtas, setAddressEtas] = useState<Record<string, DeliveryEta>>({});

  const { data: home } = useQuery({
    queryKey: ["customer-home"],
    queryFn: getCustomerHome,
    staleTime: 30_000,
  });
  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["customer-addresses"],
    queryFn: listCustomerAddresses,
    enabled: isAuthenticated(),
  });

  useEffect(() => {
    if (!open) return;
    setMode(addresses.length ? "saved" : "confirm");
    if (!addresses.length) startNewAddress();
  }, [open, addresses.length]);

  useEffect(() => {
    if (!open || !home?.store || !addresses.length) return;
    let cancelled = false;
    Promise.all(
      addresses.map(async (address) => {
        const eta =
          (await calculateDeliveryEta(home.store, addressCoords(address))) ||
          zoneFallback(home.store, addressCoords(address));
        return [address.id, eta] as const;
      }),
    ).then((rows) => {
      if (cancelled) return;
      setAddressEtas(
        rows.reduce<Record<string, DeliveryEta>>((next, [id, eta]) => {
          if (eta) next[id] = eta;
          return next;
        }, {}),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [open, addresses, home?.store]);

  useEffect(() => {
    const coords =
      typeof draft.lat === "number" && typeof draft.lng === "number"
        ? { lat: draft.lat, lng: draft.lng }
        : null;
    if (!home?.store || !coords) {
      setDraftEta(null);
      return;
    }
    let cancelled = false;
    calculateDeliveryEta(home.store, coords).then((eta) => {
      if (!cancelled) setDraftEta(eta);
    });
    return () => {
      cancelled = true;
    };
  }, [draft.lat, draft.lng, home?.store]);

  const saveAddress = useMutation({
    mutationFn: async () => {
      const payload: AddressDraft = {
        ...draft,
        name: draft.name.trim() || user?.name || "Customer",
        phone: draft.phone.trim() || user?.phone || "",
        label: draft.type === "Other" ? draft.label || "Other" : draft.type || draft.label,
        address: draft.address.trim() || draft.formattedAddress || "",
        isDefault: draft.isDefault || addresses.length === 0,
      };
      if (!payload.phone || payload.phone.length < 10)
        throw new Error("Enter a valid phone number");
      if (!payload.address || payload.address.length < 5) throw new Error("Choose a full address");
      if (editingId) return updateCustomerAddress(editingId, payload);
      return createCustomerAddress(payload);
    },
    onSuccess: async (address) => {
      await qc.invalidateQueries({ queryKey: ["customer-addresses"] });
      await selectAddress(address);
      toast.success("Delivery address saved");
      setMode("saved");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Address not saved"),
  });

  const removeAddress = useMutation({
    mutationFn: deleteCustomerAddress,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-addresses"] });
      toast.success("Address deleted");
    },
    onError: () => toast.error("Could not delete address"),
  });

  function startNewAddress() {
    setEditingId(null);
    setDraft({
      ...emptyDraft,
      name: user?.name || "",
      phone: user?.phone || "",
      isDefault: addresses.length === 0,
    });
    setDraftEta(null);
    setMode("confirm");
  }

  function editAddress(address: CustomerAddress) {
    setEditingId(address.id);
    setDraft({
      ...emptyDraft,
      ...address,
      type: address.type || address.label || "Home",
      label: address.label || address.type || "Home",
      formattedAddress: address.formattedAddress || address.address,
      houseNumber: address.houseNumber || "",
      city: address.city || "",
      state: address.state || "Telangana",
      country: address.country || "India",
      postalCode: address.postalCode || "",
      lat: address.lat ?? null,
      lng: address.lng ?? null,
    });
    setMode("confirm");
  }

  async function selectAddress(address: CustomerAddress) {
    const eta =
      (await calculateDeliveryEta(home?.store, addressCoords(address))) ||
      zoneFallback(home?.store, addressCoords(address));
    setSelectedAddress(address);
    setEta({
      etaLabel: eta?.etaLabel ?? null,
      distanceKm: eta?.distanceKm ?? null,
      inZone: eta?.inZone ?? true,
    });
    if (eta && !eta.inZone) toast.error("Pickup is available. Delivery is outside our radius.");
  }

  function onPinChange(input: { coords: LatLngLiteral; address?: string; parsed?: ParsedAddress }) {
    setDraft((current) => ({
      ...current,
      address: input.address || current.address,
      formattedAddress: input.parsed?.formattedAddress || input.address || current.formattedAddress,
      landmark: input.parsed?.landmark || current.landmark,
      city: input.parsed?.city || current.city,
      state: input.parsed?.state || current.state,
      country: input.parsed?.country || current.country,
      postalCode: input.parsed?.postalCode || current.postalCode,
      houseNumber: input.parsed?.houseNumber || current.houseNumber,
      lat: input.coords.lat,
      lng: input.coords.lng,
    }));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label="Close address selector"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-zinc-950/35 backdrop-blur-sm"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Choose delivery location"
        className={`absolute inset-x-0 bottom-0 mx-auto max-w-3xl overflow-hidden rounded-t-[34px] bg-[#F8F9FB] shadow-2xl transition-all duration-300 md:bottom-6 md:rounded-[34px] ${
          snap === "compact"
            ? "h-[40vh]"
            : snap === "full"
              ? "h-[100vh] md:h-[92vh]"
              : "h-[80vh] md:h-[82vh]"
        }`}
      >
        <div className="sticky top-0 z-10 border-b border-zinc-100 bg-white/92 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-zinc-300" />
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-600">
                Delivering to
              </p>
              <h2 className="text-2xl font-black">Choose Delivery Location</h2>
            </div>
            <div className="flex items-center gap-2">
              <SnapButton snap={snap} setSnap={setSnap} />
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="grid h-11 w-11 place-items-center rounded-2xl bg-zinc-100 text-zinc-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="h-[calc(100%-82px)] overflow-y-auto px-4 pb-28 pt-4">
          {mode === "saved" ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={startNewAddress}
                className="flex min-h-16 w-full items-center justify-between rounded-[24px] bg-zinc-950 px-4 text-left font-black text-white shadow-lg shadow-zinc-950/15"
              >
                <span className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/12">
                    <Plus className="h-5 w-5" />
                  </span>
                  Add current or searched location
                </span>
                <LocateFixed className="h-5 w-5" />
              </button>

              <div className="space-y-3">
                {isLoading ? (
                  <div className="h-28 animate-pulse rounded-[26px] bg-white" />
                ) : addresses.length ? (
                  addresses.slice(0, 10).map((address) => (
                    <SavedAddressCard
                      key={address.id}
                      address={address}
                      eta={addressEtas[address.id]}
                      onDeliver={async () => {
                        await selectAddress(address);
                        onOpenChange(false);
                      }}
                      onEdit={() => editAddress(address)}
                      onDelete={() => removeAddress.mutate(address.id)}
                    />
                  ))
                ) : (
                  <EmptyAddressState onAdd={startNewAddress} />
                )}
              </div>
            </div>
          ) : (
            <ConfirmAddressForm
              draft={draft}
              setDraft={setDraft}
              eta={draftEta}
              store={home?.store}
              saving={saveAddress.isPending}
              onPinChange={onPinChange}
              onBack={() => setMode("saved")}
              onSave={() => saveAddress.mutate()}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function SavedAddressCard({
  address,
  eta,
  onDeliver,
  onEdit,
  onDelete,
}: {
  address: CustomerAddress;
  eta?: DeliveryEta;
  onDeliver: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = address.label?.toLowerCase().includes("work") ? BriefcaseBusiness : Home;
  return (
    <article className="rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-zinc-100">
      <div className="flex gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-600">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black">{address.label || address.type || "Home"}</h3>
            {address.isDefault && (
              <span className="rounded-full bg-green-50 px-2 py-1 text-[10px] font-black text-green-700">
                Default
              </span>
            )}
            {eta && !eta.inZone && (
              <span className="rounded-full bg-yellow-50 px-2 py-1 text-[10px] font-black text-yellow-700">
                Pickup only
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-zinc-600">{address.address}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-zinc-500">
            {eta && (
              <>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1">
                  {eta.distanceKm.toFixed(1)} km
                </span>
                <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-700">
                  ETA {eta.etaLabel}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
        <button
          type="button"
          onClick={onDeliver}
          className="min-h-12 rounded-2xl bg-red-600 px-4 text-sm font-black text-white"
        >
          Deliver Here
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="grid h-12 w-12 place-items-center rounded-2xl bg-zinc-100"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function ConfirmAddressForm({
  draft,
  setDraft,
  eta,
  store,
  saving,
  onPinChange,
  onBack,
  onSave,
}: {
  draft: AddressDraft;
  setDraft: Dispatch<SetStateAction<AddressDraft>>;
  eta: DeliveryEta | null;
  store?: Awaited<ReturnType<typeof getCustomerHome>>["store"];
  saving: boolean;
  onPinChange: (input: { coords: LatLngLiteral; address?: string; parsed?: ParsedAddress }) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  const coords = useMemo(
    () =>
      typeof draft.lat === "number" && typeof draft.lng === "number"
        ? { lat: draft.lat, lng: draft.lng }
        : null,
    [draft.lat, draft.lng],
  );
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-black text-zinc-600"
      >
        <ChevronDown className="h-4 w-4 rotate-90" /> Saved addresses
      </button>

      <div className="rounded-[28px] bg-white p-3 shadow-sm ring-1 ring-zinc-100">
        <LocationPicker
          compact
          value={coords}
          address={draft.formattedAddress || draft.address}
          restaurant={restaurantCoords(store)}
          onChange={onPinChange}
        />
      </div>

      <div className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-zinc-100">
        <div className="flex flex-wrap gap-2">
          {(["Home", "Work", "Other"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setDraft((current) => ({ ...current, type, label: type }))}
              className={`min-h-11 rounded-2xl px-4 text-sm font-black ${
                draft.type === type ? "bg-red-600 text-white" : "bg-zinc-100 text-zinc-700"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <SheetField
            label="House / flat number"
            value={draft.houseNumber || ""}
            onChange={(houseNumber) => setDraft((current) => ({ ...current, houseNumber }))}
          />
          <SheetField
            label="Landmark"
            value={draft.landmark || ""}
            onChange={(landmark) => setDraft((current) => ({ ...current, landmark }))}
          />
          <SheetField
            label="Contact name"
            value={draft.name}
            onChange={(name) => setDraft((current) => ({ ...current, name }))}
          />
          <SheetField
            label="Phone"
            value={draft.phone}
            onChange={(phone) => setDraft((current) => ({ ...current, phone }))}
          />
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-black text-zinc-700">Full address</span>
          <textarea
            value={draft.address || draft.formattedAddress || ""}
            onChange={(event) =>
              setDraft((current) => ({ ...current, address: event.target.value }))
            }
            rows={3}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-semibold outline-none focus:border-red-400"
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-black text-zinc-700">Delivery notes</span>
          <input
            value={draft.notes || ""}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Ring bell, leave at door..."
            className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold outline-none focus:border-red-400"
          />
        </label>
        <label className="mt-3 flex items-center gap-3 rounded-2xl bg-zinc-50 p-3 text-sm font-black">
          <input
            type="checkbox"
            checked={draft.isDefault}
            onChange={(event) =>
              setDraft((current) => ({ ...current, isDefault: event.target.checked }))
            }
          />
          Make this my default delivery address
        </label>
      </div>

      <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-zinc-100">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-green-50 text-green-700">
            {eta?.inZone === false ? (
              <MapPin className="h-5 w-5" />
            ) : (
              <Navigation className="h-5 w-5" />
            )}
          </span>
          <div>
            <p className="font-black">
              {eta
                ? eta.inZone
                  ? `Delivery ETA ${eta.etaLabel}`
                  : "Outside delivery radius"
                : "Waiting for pin"}
            </p>
            <p className="text-sm font-semibold text-zinc-500">
              {eta
                ? `${eta.distanceKm.toFixed(1)} km from The Ankapure Dhaba`
                : "Select current location or search an address"}
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="fixed bottom-5 left-4 right-4 z-20 mx-auto min-h-14 max-w-2xl rounded-3xl bg-red-600 font-black text-white shadow-2xl shadow-red-600/25 disabled:bg-zinc-300 md:absolute"
      >
        {saving ? "Saving..." : "Save Address & Deliver Here"}
      </button>
    </div>
  );
}

function SheetField({
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
      <span className="mb-1 block text-sm font-black text-zinc-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold outline-none focus:border-red-400"
      />
    </label>
  );
}

function EmptyAddressState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-[28px] bg-white p-6 text-center shadow-sm ring-1 ring-zinc-100">
      <MapPin className="mx-auto h-10 w-10 text-red-600" />
      <h3 className="mt-3 text-xl font-black">No saved address yet</h3>
      <p className="mt-1 text-sm font-semibold text-zinc-500">
        Add your delivery spot to see accurate ETA and availability.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 min-h-12 rounded-2xl bg-red-600 px-5 text-sm font-black text-white"
      >
        Add address
      </button>
    </div>
  );
}

function SnapButton({
  snap,
  setSnap,
}: {
  snap: "compact" | "roomy" | "full";
  setSnap: (snap: "compact" | "roomy" | "full") => void;
}) {
  return (
    <button
      type="button"
      onClick={() => setSnap(snap === "compact" ? "roomy" : snap === "roomy" ? "full" : "compact")}
      className="grid h-11 w-11 place-items-center rounded-2xl bg-zinc-100 text-zinc-700"
      aria-label="Resize address sheet"
    >
      <ChevronDown className={`h-5 w-5 transition ${snap === "full" ? "" : "rotate-180"}`} />
    </button>
  );
}
