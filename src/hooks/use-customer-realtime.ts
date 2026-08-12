import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeToCustomerContent } from "@/services/api";
import { toast } from "sonner";

export function useCustomerRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    return subscribeToCustomerContent((event) => {
      qc.invalidateQueries({ queryKey: ["customer-home"] });
      qc.invalidateQueries({ queryKey: ["customer-menu"] });
      qc.invalidateQueries({ queryKey: ["menu"] });
      qc.invalidateQueries({ queryKey: ["customer-coupons"] });
      qc.invalidateQueries({ queryKey: ["admin-customer-content"] });
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        toast.info(notificationText(event.type));
      }
    });
  }, [qc]);
}

function notificationText(type: string) {
  if (type === "announcement") return "New restaurant announcement";
  if (type === "banner") return "New offer banner is live";
  if (type === "coupon") return "New coupon is available";
  if (type === "store") return "Restaurant status updated";
  return "Customer app updated";
}
