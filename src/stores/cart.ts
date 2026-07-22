import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MenuItem } from "@/data/menu";

export interface CartLine {
  id: string;
  lineId: string;
  name: string;
  baseName?: string;
  price: number;
  isVeg: boolean;
  image: string;
  qty: number;
  size?: string;
  addons?: Array<{ id: string; name: string; price: number }>;
  variants?: Array<{ group: string; option: string; price: number }>;
  instructions?: string;
}

interface CartState {
  lines: CartLine[];
  tableNumber: string | null;
  add: (
    item: MenuItem,
    options?: Partial<
      Omit<CartLine, "lineId" | "id" | "name" | "price" | "isVeg" | "image" | "qty">
    > & { price?: number; name?: string },
  ) => void;
  remove: (lineId: string) => void;
  setQty: (lineId: string, qty: number) => void;
  setTable: (table: string | null) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      tableNumber: null,
      add: (item, options = {}) =>
        set((s) => {
          const lineKey = [
            item.id,
            options.size || "",
            JSON.stringify(options.addons || []),
            JSON.stringify(options.variants || []),
            options.instructions || "",
          ].join("::");
          const found = s.lines.find((l) => (l.lineId || l.id) === lineKey);
          if (found) {
            return {
              lines: s.lines.map((l) =>
                (l.lineId || l.id) === lineKey ? { ...l, qty: l.qty + 1 } : l,
              ),
            };
          }
          return {
            lines: [
              ...s.lines,
              {
                id: item.id,
                lineId: lineKey,
                name: options.name || item.name,
                baseName: item.name,
                price: options.price ?? item.price,
                isVeg: item.isVeg,
                image: item.image,
                qty: 1,
                size: options.size,
                addons: options.addons,
                variants: options.variants,
                instructions: options.instructions,
              },
            ],
          };
        }),
      remove: (lineId) =>
        set((s) => ({ lines: s.lines.filter((l) => (l.lineId || l.id) !== lineId) })),
      setQty: (lineId, qty) =>
        set((s) => ({
          lines:
            qty <= 0
              ? s.lines.filter((l) => (l.lineId || l.id) !== lineId)
              : s.lines.map((l) => ((l.lineId || l.id) === lineId ? { ...l, qty } : l)),
        })),
      setTable: (table) => set({ tableNumber: table }),
      clear: () => set({ lines: [], tableNumber: null }),
    }),
    { name: "smartdhaba:cart" },
  ),
);

export const selectCartCount = (s: CartState) => s.lines.reduce((n, l) => n + l.qty, 0);
export const selectCartSubtotal = (s: CartState) =>
  s.lines.reduce((n, l) => n + l.qty * l.price, 0);
