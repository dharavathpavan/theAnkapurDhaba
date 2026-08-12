import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number | string | null | undefined) {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value)) return "₹0";
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
