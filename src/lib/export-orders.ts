import * as XLSX from "xlsx";
import type { Order } from "@/services/api";

export interface OrderExportRow {
  id: string;
  date: string;
  customer: string;
  phone: string;
  type: string;
  table: string;
  items: string;
  itemCount: number;
  subtotal: number;
  tax: number;
  deliveryFee: number;
  discount: number;
  total: number;
  payment: string;
  paymentStatus: string;
  status: string;
}

export function orderExportRows(orders: Order[]): OrderExportRow[] {
  return orders.map((order) => ({
    id: order.id,
    date: new Date(order.createdAt).toLocaleString("en-IN"),
    customer: order.customer.name || "",
    phone: order.customer.phone || "",
    type: order.type,
    table: order.tableNumber || "",
    items: order.items.map((i) => `${i.name} x${i.qty}`).join(", "),
    itemCount: order.items.reduce((sum, item) => sum + item.qty, 0),
    subtotal: order.subtotal,
    tax: order.tax,
    deliveryFee: order.deliveryFee,
    discount:
      order.total >= 0
        ? Math.max(0, order.subtotal + order.tax + order.deliveryFee - order.total)
        : 0,
    total: order.total,
    payment: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    status: order.status,
  }));
}

export function downloadOrdersCsv(orders: Order[], filename = "order-history") {
  const rows = orderExportRows(orders);
  const headers: (keyof OrderExportRow)[] = [
    "id",
    "date",
    "customer",
    "phone",
    "type",
    "table",
    "items",
    "itemCount",
    "subtotal",
    "tax",
    "deliveryFee",
    "discount",
    "total",
    "payment",
    "paymentStatus",
    "status",
  ];
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
}

export function downloadOrdersExcel(orders: Order[], filename = "order-history") {
  const rows = orderExportRows(orders);
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 10 },
    { wch: 22 },
    { wch: 22 },
    { wch: 14 },
    { wch: 10 },
    { wch: 8 },
    { wch: 60 },
    { wch: 10 },
    { wch: 10 },
    { wch: 8 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Orders");
  const blob = new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, `${filename}.xlsx`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
