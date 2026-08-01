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

export function buildTestPrintHtml(settings?: Partial<PrinterSettings>): string {
  const widthMm = settings?.paperSize === "80mm" ? "80mm" : "58mm";
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    @page { size: ${widthMm} auto; margin: 0; }
    body { font-family: monospace; width: ${widthMm}; padding: 8px; margin: 0; font-size: 13px; color: #000; }
    .text-center { text-align: center; }
    .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
    .bold { font-weight: bold; }
  </style>
</head>
<body>
  <div class="text-center bold" style="font-size: 16px;">THE ANKAPUR DHABA</div>
  <div class="text-center">Bluetooth Thermal Printer Test</div>
  <div class="divider"></div>
  <div><b>Printer:</b> EZO 58D</div>
  <div><b>Paper:</b> ${widthMm}</div>
  <div><b>Copies:</b> ${settings?.copies || 1}</div>
  <div><b>Date:</b> ${new Date().toLocaleString()}</div>
  <div class="divider"></div>
  <div class="text-center bold">Print Successful</div>
</body>
</html>`;
}

export function buildKotPrintHtml(order: Order, settings?: Partial<PrinterSettings>, mode: "kot" | "kitchen-copy" = "kot"): string {
  const widthMm = settings?.paperSize === "80mm" ? "80mm" : "58mm";
  const table = order.tableNumber ? `Table ${order.tableNumber}` : order.type.toUpperCase();
  const itemsHtml = order.items
    .map((item) => {
      const notes = item.instructions ? `<div style="padding-left:12px;font-size:11px;">Note: ${item.instructions}</div>` : "";
      const addons = item.addons?.length
        ? `<div style="padding-left:12px;font-size:11px;">+ ${item.addons.map((a) => a.name).join(", ")}</div>`
        : "";
      return `<div style="margin-bottom:4px;"><b>${item.qty} x ${item.name}</b>${addons}${notes}</div>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    @page { size: ${widthMm} auto; margin: 0; }
    body { font-family: monospace; width: ${widthMm}; padding: 8px; margin: 0; font-size: 13px; color: #000; }
    .text-center { text-align: center; }
    .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
    .bold { font-weight: bold; font-size: 15px; }
  </style>
</head>
<body>
  <div class="text-center bold">THE ANKAPUR DHABA</div>
  <div class="text-center">${mode === "kot" ? "Kitchen Order Ticket" : "Kitchen Copy"}</div>
  <div class="divider"></div>
  <div><b>KOT #:</b> ${kotNumber(order)}</div>
  <div><b>Order ID:</b> ${order.id}</div>
  <div><b>Date:</b> ${new Date(order.createdAt).toLocaleString()}</div>
  <div><b>Type:</b> ${table}</div>
  ${order.delivery?.station ? `<div><b>Station:</b> ${order.delivery.station}</div>` : ""}
  <div class="divider"></div>
  ${itemsHtml}
  <div class="divider"></div>
  <div><b>Items:</b> ${order.items.reduce((sum, item) => sum + item.qty, 0)}</div>
  <div><b>Total:</b> ${money(order.total)}</div>
  <div class="divider"></div>
  <div class="text-center">${settings?.footerText || "THANK YOU"}</div>
</body>
</html>`;
}

export function triggerBrowserPrint(htmlContent: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";

      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        document.body.removeChild(iframe);
        resolve(false);
        return;
      }

      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
            resolve(true);
          }, 1000);
        } catch {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          resolve(false);
        }
      }, 300);
    } catch {
      resolve(false);
    }
  });
}

export function kotNumber(order: Order) {
  return order.delivery?.pickupToken || order.id.slice(-6);
}

export function kotFingerprint(order: Order, mode: string) {
  const itemKey = order.items.map((item) => `${item.id}:${item.name}:${item.qty}:${item.instructions || ""}`).join("|");
  return `${order.id}:${mode}:${itemKey}:${order.updatedAt}`;
}
