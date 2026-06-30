export function VegDot({ isVeg, className = "" }: { isVeg: boolean; className?: string }) {
  return (
    <span
      aria-label={isVeg ? "Vegetarian" : "Non-vegetarian"}
      className={`inline-flex h-4 w-4 items-center justify-center border-2 ${className}`}
      style={{ borderColor: isVeg ? "var(--color-veg)" : "var(--color-nonveg)" }}
    >
      <span
        className="block h-1.5 w-1.5 rounded-full"
        style={{ background: isVeg ? "var(--color-veg)" : "var(--color-nonveg)" }}
      />
    </span>
  );
}

export function SpiceLevel({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Spice level ${level}`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className="text-xs"
          style={{ color: i <= level ? "var(--color-primary-glow)" : "var(--color-muted-foreground)" }}
        >
          ▲
        </span>
      ))}
    </span>
  );
}
