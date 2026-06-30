import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeToOrderEvents } from "@/services/api";

export function useOrderRealtime(orderId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    return subscribeToOrderEvents((event) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (orderId) queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      if (event.order?.id) {
        queryClient.invalidateQueries({ queryKey: ["order", event.order.id] });
      }
    });
  }, [queryClient, orderId]);
}