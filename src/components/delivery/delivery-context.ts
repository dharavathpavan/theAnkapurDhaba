/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext } from "react";
import type { DeliveryLocation, DeliveryProfile, Order } from "@/services/api";

export interface DeliveryPortalState {
  online: boolean;
  setOnline: (value: boolean) => void;
  gpsState: "idle" | "active" | "blocked";
  lastPosition: DeliveryLocation | null;
  orders: Order[];
  ordersLoading: boolean;
  history: Order[];
  profile?: DeliveryProfile;
  invalidate: () => Promise<void>;
  myOrders: Order[];
  available: Order[];
  activeOrder?: Order;
}

export const DeliveryPortalContext = createContext<DeliveryPortalState | null>(null);

export function useDeliveryPortal(): DeliveryPortalState {
  const ctx = useContext(DeliveryPortalContext);
  if (!ctx) throw new Error("useDeliveryPortal must be used within DeliveryPortalContext");
  return ctx;
}
