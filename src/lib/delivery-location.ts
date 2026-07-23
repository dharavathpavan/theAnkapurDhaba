import {
  calculateDrivingRoute,
  distanceMeters,
  fallbackEtaMinutes,
  type LatLngLiteral,
} from "@/lib/google-maps";
import type { CustomerAddress, CustomerStore } from "@/services/api";

export type DeliveryEta = {
  distanceKm: number;
  driveMinutes: number;
  etaMinutes: number;
  etaLabel: string;
  inZone: boolean;
};

export function addressCoords(address?: Pick<CustomerAddress, "lat" | "lng"> | null) {
  if (typeof address?.lat !== "number" || typeof address?.lng !== "number") return null;
  return { lat: address.lat, lng: address.lng };
}

export function restaurantCoords(store?: Pick<CustomerStore, "lat" | "lng"> | null): LatLngLiteral {
  return {
    lat: typeof store?.lat === "number" ? store.lat : 17.562861,
    lng: typeof store?.lng === "number" ? store.lng : 78.453472,
  };
}

export function shortAddress(address?: CustomerAddress | null) {
  if (!address) return "Select delivery location";
  return (
    address.city ||
    address.landmark ||
    address.formattedAddress?.split(",")[0] ||
    address.address.split(",")[0] ||
    "Saved address"
  );
}

export function zoneFallback(
  store: CustomerStore | undefined,
  destination: LatLngLiteral | null,
): DeliveryEta | null {
  if (!destination) return null;
  const origin = restaurantCoords(store);
  const distanceKm = Math.round((distanceMeters(origin, destination) / 1000) * 10) / 10;
  const driveMinutes = fallbackEtaMinutes(distanceKm);
  const etaMinutes = Math.max(store?.averageDeliveryMin ?? 30, driveMinutes + 10);
  const radius = store?.zoneRadiusKm ?? 8;
  return {
    distanceKm,
    driveMinutes,
    etaMinutes,
    etaLabel: etaRangeLabel(etaMinutes),
    inZone: distanceKm <= radius,
  };
}

export async function calculateDeliveryEta(
  store: CustomerStore | undefined,
  destination: LatLngLiteral | null,
) {
  const fallback = zoneFallback(store, destination);
  if (!destination || !fallback) return null;
  try {
    const route = await calculateDrivingRoute(restaurantCoords(store), destination);
    const etaMinutes = Math.max(store?.averageDeliveryMin ?? 30, route.etaMinutes + 10);
    return {
      distanceKm: route.distanceKm,
      driveMinutes: route.etaMinutes,
      etaMinutes,
      etaLabel: etaRangeLabel(etaMinutes),
      inZone: route.distanceKm <= (store?.zoneRadiusKm ?? 8),
    };
  } catch {
    return fallback;
  }
}

export function etaRangeLabel(minutes: number) {
  const low = Math.max(10, Math.round(minutes / 5) * 5);
  return `${low}-${low + 10} mins`;
}
