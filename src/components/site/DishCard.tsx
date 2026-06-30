import type { MenuItem } from "@/data/menu";
import { useCart } from "@/stores/cart";
import { VegDot, SpiceLevel } from "./VegDot";
import { Plus, Minus } from "lucide-react";

interface Props {
  item: MenuItem;
  size?: "sm" | "md" | "lg";
}

export function DishCard({ item, size = "md" }: Props) {
  const lines = useCart((s) => s.lines);
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const line = lines.find((l) => l.id === item.id);

  const aspect = size === "lg" ? "aspect-[4/3]" : size === "sm" ? "aspect-[4/3]" : "aspect-[4/3]";

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface transition-all hover:border-primary/40 hover:shadow-[var(--shadow-card)]">
      <div className={`relative ${aspect} overflow-hidden bg-muted`}>
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          width={800}
          height={600}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        {item.bestseller && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-sm bg-primary px-2 py-1 font-display text-xs tracking-widest text-primary-foreground">
            ★ Bestseller
          </span>
        )}
        <div className="absolute right-3 top-3"><VegDot isVeg={item.isVeg} /></div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-xl leading-tight tracking-wide">{item.name}</h3>
          <SpiceLevel level={item.spiceLevel} />
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="font-display text-2xl text-foreground">
            ₹{item.price}
          </span>
          {line ? (
            <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10">
              <button
                aria-label="Decrease"
                onClick={() => setQty(item.id, line.qty - 1)}
                className="grid h-9 w-9 place-items-center text-primary transition hover:bg-primary/20"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-6 text-center font-display text-lg">{line.qty}</span>
              <button
                aria-label="Increase"
                onClick={() => setQty(item.id, line.qty + 1)}
                className="grid h-9 w-9 place-items-center text-primary transition hover:bg-primary/20"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => add(item)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 font-display text-sm tracking-widest text-primary-foreground transition hover:bg-primary-glow"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
