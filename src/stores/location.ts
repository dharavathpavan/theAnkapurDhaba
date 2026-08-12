import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CustomerAddress } from "@/services/api";

type SelectedLocationState = {
  selectedAddressId: string | null;
  selectedAddress: CustomerAddress | null;
  etaLabel: string | null;
  distanceKm: number | null;
  inZone: boolean;
  setSelectedAddress: (address: CustomerAddress | null) => void;
  setEta: (input: { etaLabel: string | null; distanceKm: number | null; inZone: boolean }) => void;
  clearLocation: () => void;
};

export const useSelectedLocation = create<SelectedLocationState>()(
  persist(
    (set) => ({
      selectedAddressId: null,
      selectedAddress: null,
      etaLabel: null,
      distanceKm: null,
      inZone: true,
      setSelectedAddress: (address) =>
        set({
          selectedAddress: address,
          selectedAddressId: address?.id ?? null,
        }),
      setEta: (input) => set(input),
      clearLocation: () =>
        set({ selectedAddressId: null, selectedAddress: null, etaLabel: null, distanceKm: null }),
    }),
    { name: "ankapur:selected-location" },
  ),
);
