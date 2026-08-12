import { toast } from "sonner";
import { updateDeliveryPortalStatus } from "@/services/api";
import { calculateDrivingRoute } from "@/lib/google-maps";
import type { DeliveryLocation, Order } from "@/services/api";

export function isMine(order: Order, userId?: string, phone?: string) {
  const delivery = order.delivery || {};
  return (
    delivery.assignedRiderId === userId ||
    delivery.reservedBy === userId ||
    delivery.partnerPhone === phone
  );
}

export function reservationExpired(order: Order) {
  const expiry = order.delivery?.reserveExpiresAt;
  if (!expiry) return true;
  return new Date(expiry).getTime() <= Date.now();
}

export function itemCount(order: Order) {
  return order.items.reduce((sum, item) => sum + item.qty, 0);
}

export function deliveryEarning(order: Order) {
  return Number(order.deliveryFee || 0) + Number(order.delivery?.tip || 0) + Number(order.delivery?.bonus || 0);
}

export function nextProgress(order: Order, location: DeliveryLocation) {
  const destination = coordsFrom(order.delivery?.destinationLat, order.delivery?.destinationLng);
  const restaurant = coordsFrom(order.delivery?.restaurantLat, order.delivery?.restaurantLng);
  if (!destination) return Math.max(Number(order.delivery?.routeProgress || 0), 0.15);
  const start = restaurant || destination;
  const total = Math.max(distanceMeters(start.lat, start.lng, destination.lat, destination.lng), 1);
  const left = distanceMeters(location.lat, location.lng, destination.lat, destination.lng);
  const progress = Math.min(0.98, Math.max(0.15, 1 - left / total));
  return Number(progress.toFixed(2));
}

export function estimateDistanceKm(order: Order, location: DeliveryLocation) {
  const destination = coordsFrom(order.delivery?.destinationLat, order.delivery?.destinationLng);
  if (!destination) return Number(order.delivery?.distanceKm || 0);
  return Number((distanceMeters(location.lat, location.lng, destination.lat, destination.lng) / 1000).toFixed(2));
}

export async function liveRoutePatch(
  order: Order,
  location: DeliveryLocation,
): Promise<{ distanceKm?: number; etaMinutes?: number }> {
  const destination = coordsFrom(order.delivery?.destinationLat, order.delivery?.destinationLng);
  if (!destination) return {};
  try {
    return await calculateDrivingRoute(location, destination);
  } catch {
    return {};
  }
}

export async function maybeUpdateGeofence(
  order: Order,
  location: DeliveryLocation,
  stageCache: Record<string, string>,
) {
  const restaurant = coordsFrom(order.delivery?.restaurantLat, order.delivery?.restaurantLng);
  const destination = coordsFrom(order.delivery?.destinationLat, order.delivery?.destinationLng);
  const currentStage = order.delivery?.deliveryStage || "";
  let nextStage: string | null = null;
  if (
    restaurant &&
    ["reserved", "heading_to_restaurant"].includes(currentStage) &&
    distanceMeters(location.lat, location.lng, restaurant.lat, restaurant.lng) <= 100
  ) {
    nextStage = "arrived_restaurant";
  }
  if (destination && ["on_the_way", "nearby", "almost_there"].includes(currentStage)) {
    const meters = distanceMeters(location.lat, location.lng, destination.lat, destination.lng);
    if (meters <= 20) nextStage = "outside";
    else if (meters <= 50) nextStage = "almost_there";
    else if (meters <= 100) nextStage = "nearby";
  }
  if (!nextStage || nextStage === currentStage || stageCache[order.id] === nextStage) return;
  stageCache[order.id] = nextStage;
  await updateDeliveryPortalStatus(order.id, {
    deliveryStage: nextStage,
    etaMinutes: order.delivery?.etaMinutes,
  });
}

export function coordsFrom(lat?: number, lng?: number) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng };
}

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function notifyNewOrder(order: Order) {
  try {
    navigator.vibrate?.([180, 80, 180]);
    if (Notification.permission === "granted") {
      new Notification("New delivery order", {
        body: `Order #${order.id} is ready for delivery.`,
        icon: "/the-ankapure-dhaba-logo.png",
      });
    }
  } catch {
    // Browser notification support varies; ignore safely.
  }
}

export function showMutationError(fallback: string) {
  return (error: unknown) => toast.error(error instanceof Error ? error.message : fallback);
}

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}
