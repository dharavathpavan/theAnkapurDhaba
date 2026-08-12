import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOrder, subscribeToOrderEvents } from "@/services/api";

const ACTIVE_ORDER_KEY = "ankapur:active-order";

export function saveActiveOrder(orderId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_ORDER_KEY, orderId);
  window.dispatchEvent(new CustomEvent("ankapur:active-order-changed"));
}

export function clearActiveOrder(orderId?: string) {
  if (typeof window === "undefined") return;
  const current = localStorage.getItem(ACTIVE_ORDER_KEY);
  if (!orderId || current === orderId) {
    localStorage.removeItem(ACTIVE_ORDER_KEY);
    window.dispatchEvent(new CustomEvent("ankapur:active-order-changed"));
  }
}

export function getActiveOrderId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_ORDER_KEY);
}

export function useActiveOrderTracking() {
  const [orderId, setOrderId] = useState(() => getActiveOrderId());

  useEffect(() => {
    const sync = () => setOrderId(getActiveOrderId());
    window.addEventListener("ankapur:active-order-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ankapur:active-order-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    return subscribeToOrderEvents((event) => {
      if (!event.order || event.order.id !== orderId) return;
      if (["delivered", "cancelled"].includes(event.order.status)) clearActiveOrder(event.order.id);
    });
  }, [orderId]);

  const query = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrder(orderId!),
    enabled: Boolean(orderId),
    refetchInterval: orderId ? 5000 : false,
  });

  useEffect(() => {
    if (query.data && ["delivered", "cancelled"].includes(query.data.status))
      clearActiveOrder(query.data.id);
  }, [query.data]);

  return { orderId, order: query.data, isLoading: query.isLoading };
}
