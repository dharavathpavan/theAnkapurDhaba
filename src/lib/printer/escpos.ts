import type { Order, PrinterSettings } from "@/services/api";

const encoder = new TextEncoder();

function bytes(...chunks: Array<string | Uint8Array>) {
  const parts = chunks.map((chunk) => (typeof chunk === "string" ? encoder.encode(chunk) : chunk));
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

function line(width: number) {
  return `${"-".repeat(width)}\n`;
}

function money(value: number) {
  return `Rs ${Math.round(value)}`;
}

function center(text: string, width: number) {
  const clean = text.slice(0, width);
  const left = Math.max(0, Math.floor((width - clean.length) / 2));
  return `${" ".repeat(left)}${clean}\n`;
}

export function escPosToBase64(data: Uint8Array) {
  let binary = "";
  data.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function buildTestPrint(settings?: Partial<PrinterSettings>) {
  const width = settings?.paperSize === "80mm" ? 42 : 32;
  return bytes(
    "\x1b@",
    "\x1ba\x01",
    center("THE ANKAPUR DHABA", width),
    center("Bluetooth Printer Test", width),
    "\x1ba\x00",
    line(width),
    `Printer : EZO 58D\n`,
    `Paper   : ${settings?.paperSize || "58mm"}\n`,
    `Copies  : ${settings?.copies || 1}\n`,
    `Date    : ${new Date().toLocaleString()}\n`,
    line(width),
    center("Print Successful", width),
    "\n\n\n\x1dV\x00",
  );
}

export function buildKotPrint(order: Order, settings?: Partial<PrinterSettings>, mode: "kot" | "kitchen-copy" = "kot") {
  const width = settings?.paperSize === "80mm" ? 42 : 32;
  const table = order.tableNumber ? `Table ${order.tableNumber}` : order.type.toUpperCase();
  const items = order.items
    .map((item) => {
      const notes = item.instructions ? `\n  Note: ${item.instructions}` : "";
      const addons = item.addons?.length ? `\n  + ${item.addons.map((a) => a.name).join(", ")}` : "";
      return `${item.qty} x ${item.name}${addons}${notes}`;
    })
    .join("\n");

  return bytes(
    "\x1b@",
    "\x1ba\x01",
    center("THE ANKAPUR DHABA", width),
    center(mode === "kot" ? "Kitchen Order Ticket" : "Kitchen Copy", width),
    "\x1ba\x00",
    line(width),
    `KOT      : ${kotNumber(order)}\n`,
    `Order    : ${order.id}\n`,
    `Date     : ${new Date(order.createdAt).toLocaleString()}\n`,
    `Type     : ${table}\n`,
    order.delivery?.station ? `Station  : ${order.delivery.station}\n` : "",
    line(width),
    `${items}\n`,
    line(width),
    `Items    : ${order.items.reduce((sum, item) => sum + item.qty, 0)}\n`,
    `Total    : ${money(order.total)}\n`,
    line(width),
    center(settings?.footerText || "THANK YOU", width),
    "\n\n\n\x1dV\x00",
  );
}

export function kotNumber(order: Order) {
  return order.delivery?.pickupToken || order.id.slice(-6);
}

export function kotFingerprint(order: Order, mode: string) {
  const itemKey = order.items.map((item) => `${item.id}:${item.name}:${item.qty}:${item.instructions || ""}`).join("|");
  return `${order.id}:${mode}:${itemKey}:${order.updatedAt}`;
}
