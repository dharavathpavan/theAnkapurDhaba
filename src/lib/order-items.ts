import type { CartLine } from "@/stores/cart";
import type { OrderItem } from "@/services/api";

type OptionLike = { name?: string; option?: string; group?: string; price?: number };

function clean(value: unknown) {
  return String(value || "").trim();
}

function optionText(option: OptionLike) {
  if (option.group && option.option) return `${option.group}: ${option.option}`;
  return clean(option.name || option.option);
}

export function buildOrderItemName(line: CartLine) {
  const parts = [
    line.size ? `Size: ${line.size}` : "",
    ...(line.variants || []).map(optionText),
    ...(line.addons || []).map((addon) => `+ ${addon.name}`),
    line.instructions ? `Note: ${line.instructions}` : "",
  ].filter(Boolean);

  const base = clean(line.baseName || line.name);
  return parts.length ? `${base} (${parts.join(" | ")})` : base;
}

export function orderItemDetails(item: Partial<OrderItem>) {
  const details = [
    item.size ? `Size: ${item.size}` : "",
    ...(item.variants || []).map(optionText),
    ...(item.addons || []).map((addon) => `+ ${addon.name}`),
    item.instructions ? `Note: ${item.instructions}` : "",
  ].filter(Boolean);
  return details;
}

export function displayOrderItemName(item: Partial<OrderItem>) {
  return clean(item.name);
}
