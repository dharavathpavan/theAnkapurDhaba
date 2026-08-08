import { type MenuItem } from "@/data/menu";
import { io } from "socket.io-client";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "@/stores/auth";

export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
const RAW_SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "";
const SOCKET_URL = isValidSocketIoUrl(RAW_SOCKET_URL) ? RAW_SOCKET_URL : "";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

// Socket connection
const socket = typeof window !== "undefined" && SOCKET_URL ? io(SOCKET_URL) : null;
const realtimeClient =
  typeof window !== "undefined" && !SOCKET_URL && SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { params: { eventsPerSecond: 10 } },
      })
    : null;
let realtimeSubscriptionId = 0;

function isValidSocketIoUrl(url: string) {
  if (!url) return false;
  if (/supabase\.co/i.test(url)) return false;
  if (/functions\/v1\/api/i.test(url)) return false;
  return /^https?:\/\//i.test(url);
}

type ApiFetchInit = RequestInit & { skipAuthRedirect?: boolean };

// Helper to get auth headers from the Zustand store
function authHeaders(): Record<string, string> {
  const token = useAuth.getState().token;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (SUPABASE_PUBLISHABLE_KEY) headers.apikey = SUPABASE_PUBLISHABLE_KEY;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function apiFetch(url: string, init?: ApiFetchInit): Promise<Response> {
  const { skipAuthRedirect, headers, ...fetchInit } = init ?? {};
  const res = await fetch(url, { ...fetchInit, headers: { ...authHeaders(), ...(headers ?? {}) } });
  // Auto-logout on 401/403
  if (!skipAuthRedirect && (res.status === 401 || res.status === 403)) {
    useAuth.getState().logout();
    if (typeof window !== "undefined") window.location.href = "/login";
  }
  return res;
}

// Extract the server's real error message (e.g. `{ error: "..." }`) from a failed response.
async function serverError(res: Response, fallback: string): Promise<Error> {
  try {
    const data = (await res.json()) as { error?: unknown; message?: unknown };
    const detail =
      typeof data?.error === "string" ? data.error : typeof data?.message === "string" ? data.message : "";
    if (detail.trim()) return new Error(detail.trim());
  } catch {
    // body was not JSON
  }
  return new Error(`${fallback} (${res.status})`);
}

export type OrderStatus =
  "received" | "accepted" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";

export type OrderType = "delivery" | "pickup" | "dinein";
export type PaymentMethod = "cod" | "upi" | "cashfree" | "razorpay" | "wallet";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  isVeg: boolean;
  size?: string;
  addons?: Array<{ id?: string; name: string; price?: number }>;
  variants?: Array<{ group: string; option: string; price?: number }>;
  instructions?: string;
}

export interface Order {
  id: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  customer: {
    name: string;
    phone: string;
    address?: string;
    lat?: number | null;
    lng?: number | null;
    landmark?: string;
    notes?: string;
  };
  type: OrderType;
  tableNumber?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  delivery?: DeliveryDetails;
  createdAt: string;
  updatedAt: string;
}

export type CreateOrderInput = Omit<
  Order,
  "id" | "status" | "paymentStatus" | "createdAt" | "updatedAt"
>;

export interface DeliveryLocation {
  lat: number;
  lng: number;
  label?: string;
  updatedAt?: string;
}

export interface DeliveryDetails {
  partnerName?: string;
  partnerPhone?: string;
  vehicleNumber?: string;
  assignedRiderId?: string;
  assignedRiderName?: string;
  reservedBy?: string;
  reservedByName?: string;
  reservedAt?: string;
  reserveExpiresAt?: string | null;
  pickupPin?: string;
  deliveryOtp?: string;
  deliveryStage?:
    | "reserved"
    | "heading_to_restaurant"
    | "arrived_restaurant"
    | "on_the_way"
    | "nearby"
    | "almost_there"
    | "outside"
    | "delivered"
    | string;
  arrivedRestaurantAt?: string;
  pickupVerifiedAt?: string;
  nearbyAt?: string;
  almostThereAt?: string;
  outsideAt?: string;
  etaMinutes?: number;
  currentLocation?: DeliveryLocation;
  orderPlacedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  lastLocationAt?: string;
  restaurantLat?: number;
  restaurantLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  destinationText?: string;
  distanceKm?: number;
  routeProgress?: number;
  gpsAccuracy?: number;
  speed?: number;
  heading?: number;
  trackingPaused?: boolean;
  prepEtaMinutes?: number;
  acceptedAt?: string;
  startedAt?: string;
  readyAt?: string;
  delayReason?: string;
  delayExtraMinutes?: number;
  priority?: "vip" | "express" | "normal" | "scheduled" | string;
  station?: string;
  captainName?: string;
  guestCount?: number;
  pickupToken?: string;
  expectedPickup?: string;
  managerAlert?: boolean;
  kdsNote?: string;
  tip?: number;
  bonus?: number;
  proofOfDelivery?: string;
  recipientName?: string;
  codCollectedAmount?: number;
  sosAlert?: boolean;
  supportMessage?: string;
  batteryLevel?: number;
  pickupChecklist?: Record<string, boolean>;
  batchId?: string;
  batchedOrderIds?: string[];
  riderRating?: number;
  riderReview?: string;
  riderFeedbackAt?: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  radiusKm: number;
  deliveryCharge: number;
  freeDeliveryAbove: number;
  minDeliveryMin: number;
  enabled: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  distanceKm?: number;
}

export type DeliveryPayoutStatus = "requested" | "approved" | "rejected" | "paid" | string;

export interface DeliveryPayout {
  id: string;
  riderId: string;
  riderName?: string;
  amount: number;
  method?: string;
  accountDetails?: string;
  status: DeliveryPayoutStatus;
  note?: string;
  requestedAt: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  paidAt?: string | null;
  approvedBy?: string | null;
  approvedByName?: string | null;
}

export interface DeliveryWalletTransaction {
  id: string;
  type: "earning" | "payout" | "payout_rejected" | string;
  amount: number;
  status?: string;
  orderId?: string;
  note?: string;
  date: string;
}

export interface DeliveryWallet {
  balance: number;
  earned: number;
  paidOut: number;
  requested: number;
  available: number;
  transactions: DeliveryWalletTransaction[];
  payouts: DeliveryPayout[];
}

export interface FleetRider {
  id: string;
  name: string;
  phone: string;
  role?: string;
  online: boolean;
  activeOrders: number;
  load: number;
  currentLocation?: DeliveryLocation | null;
  lastLocationAt?: string | null;
  lastUpdatedAt?: string;
  vehicleNumber?: string | null;
  partnerPhone?: string;
  deliveryStage?: string | null;
  etaMinutes?: number | null;
  distanceKm?: number | null;
  orderIds: string[];
}

export interface RiderPerformance {
  id: string;
  name: string;
  phone: string;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  earnings: number;
  avgEarning: number;
  rating: number;
  ratingCount: number;
  onTimeRate: number;
  completionRate: number;
  acceptanceRate: number;
}

export interface DeliverySettings {
  baseRatePerKm: number;
  batchMax: number;
  surgeEnabled: boolean;
  surgeMultiplier: number;
}

export interface DeliveryProfile {
  user: { id: string; name: string; phone: string; role: string };
  branch: string;
  todayDeliveries: number;
  todayEarnings: number;
  activeOrders: number;
  completedOrders: number;
  averageDeliveryTime: number;
  rating: number;
  acceptanceRate: number;
  completionRate: number;
  distanceTravelled: number;
  bonusEarned: number;
}

export type OrderRealtimeEvent = {
  type: "created" | "updated" | "sync";
  order?: Order;
};

export type CustomerContentEvent = {
  type: string;
  at: string;
};

export type PrinterStatus =
  | "connected"
  | "disconnected"
  | "searching"
  | "printing"
  | "offline"
  | "unsupported"
  | "bridge_required"
  | "error"
  | string;

export type PrinterConnectionType =
  | "browser-print"
  | "web-serial"
  | "web-bluetooth"
  | "android-bridge"
  | "local-bridge"
  | "bridge";

export interface PrinterRecord {
  id: string;
  name: string;
  model: string;
  macAddress?: string | null;
  connectionType: PrinterConnectionType;
  paperWidth: "58mm" | "80mm";
  isDefault: boolean;
  status: PrinterStatus;
  lastConnectedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PrinterDevice {
  id: string;
  name: string;
  model?: string | null;
  macAddress?: string | null;
  connectionType: PrinterConnectionType;
  status: PrinterStatus;
  signalStrength?: number | null;
  batteryLevel?: number | null;
  lastSeenAt?: string | null;
}

export interface PrinterSettings {
  id: string;
  autoPrint: boolean;
  autoReconnect: boolean;
  copies: number;
  paperSize: "58mm" | "80mm";
  showLogo: boolean;
  showQr: boolean;
  showBarcode: boolean;
  sound: boolean;
  footerText?: string | null;
}

export interface KitchenStationPrinter {
  id: string;
  station: string;
  printerId?: string | null;
  printerName?: string | null;
  active: boolean;
}

export interface PrinterHistoryEntry {
  id: string;
  printerId?: string | null;
  orderId?: string | null;
  orderNumber: string;
  jobType: string;
  station?: string | null;
  copies: number;
  paperSize: "58mm" | "80mm";
  status: "queued" | "printing" | "success" | "failed" | "retrying" | "cancelled" | string;
  attempts: number;
  message?: string | null;
  fingerprint?: string | null;
  payload?: Record<string, unknown> | string | null;
  printedByName?: string | null;
  printedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface PrinterBundle {
  printers: PrinterRecord[];
  devices: PrinterDevice[];
  stations: KitchenStationPrinter[];
  settings: PrinterSettings;
}

export function subscribeToOrderEvents(callback: (event: OrderRealtimeEvent) => void) {
  if (socket) {
    const listener = (event: OrderRealtimeEvent) => callback(event);
    socket.on("orders-changed", listener);
    return () => {
      socket.off("orders-changed", listener);
    };
  }

  if (realtimeClient) {
    const channelName = `ankapur-orders-${++realtimeSubscriptionId}`;
    let channel: RealtimeChannel | null = realtimeClient
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "Order" }, () =>
        callback({ type: "sync" }),
      )
      .subscribe();

    return () => {
      if (channel) {
        realtimeClient.removeChannel(channel);
        channel = null;
      }
    };
  }

  return () => undefined;
}

export function subscribeToCustomerContent(callback: (event: CustomerContentEvent) => void) {
  if (socket) {
    const listener = (event: CustomerContentEvent) => callback(event);
    socket.on("customer-content-changed", listener);
    return () => {
      socket.off("customer-content-changed", listener);
    };
  }

  if (realtimeClient) {
    const tables = [
      "CustomerBanner",
      "CustomerAnnouncement",
      "CustomerCoupon",
      "StoreSetting",
      "MenuItem",
      "MenuCategory",
    ];
    const channel = realtimeClient.channel(`ankapur-customer-content-${++realtimeSubscriptionId}`);
    tables.forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        callback({ type: "sync", at: new Date().toISOString() });
      });
    });
    channel.subscribe();
    return () => {
      realtimeClient.removeChannel(channel);
    };
  }

  return () => undefined;
}

/* ---------------- Menu ---------------- */
export async function getMenu(): Promise<MenuItem[]> {
  const res = await fetch(`${API_BASE}/menu`);
  if (!res.ok) throw new Error("Failed to fetch menu");
  return res.json();
}

export interface CustomerStore {
  id: string;
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  zoneRadiusKm: number;
  status: "online" | "offline" | "busy";
  statusMessage: string;
  openTime: string;
  closeTime: string;
  minimumOrder: number;
  deliveryCharge: number;
  freeDeliveryAbove: number;
  averageDeliveryMin: number;
  waitingTimeMin: number;
  packingCharge: number;
  allowDeliveryCod?: boolean;
  holidayNotice: string;
  splashTitle: string;
  splashSubtitle: string;
  theme: Record<string, string>;
}

export interface CustomerBanner {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  mobileImage?: string | null;
  type: string;
  ctaEnabled?: boolean | null;
  ctaLabel: string;
  ctaLink: string;
  secondaryCtaEnabled?: boolean | null;
  secondaryCtaLabel?: string | null;
  secondaryCtaLink?: string | null;
  heightMobile?: "compact" | "standard" | "tall" | string;
  heightDesktop?: "compact" | "standard" | "tall" | string;
  textAlign?: "left" | "center" | "right" | string;
  overlayStrength?: "light" | "medium" | "dark" | string;
  textColorMode?: "light" | "dark" | string;
  priority: number;
  active: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface CustomerAnnouncement {
  id: string;
  message: string;
  icon: string;
  color: string;
  priority: number;
  active: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface CustomerCoupon {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  discountType: "percent" | "flat";
  discountValue: number;
  maxDiscount?: number | null;
  minOrder: number;
  active: boolean;
  expiresAt?: string | null;
}

export interface CustomerHome {
  store: CustomerStore;
  banners: CustomerBanner[];
  announcements: CustomerAnnouncement[];
  categories: CatalogCategory[];
  collections: Array<{ id: string; title: string; items: MenuItem[] }>;
  recommended: MenuItem[];
  coupons: CustomerCoupon[];
  reviews: CustomerReview[];
}

export interface CustomerAddress {
  id: string;
  type?: "Home" | "Work" | "Other" | string;
  label: string;
  name: string;
  phone: string;
  address: string;
  formattedAddress?: string | null;
  houseNumber?: string | null;
  landmark?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  category: string;
  read: boolean;
  createdAt: string;
}

export async function getCustomerHome(): Promise<CustomerHome> {
  const res = await fetch(`${API_BASE}/customer/home?t=${Date.now()}`, {
    cache: "no-store",
    headers: SUPABASE_PUBLISHABLE_KEY ? { apikey: SUPABASE_PUBLISHABLE_KEY } : undefined,
  });
  if (!res.ok) throw new Error("Failed to fetch customer home");
  const data = await res.json();
  return {
    ...data,
    store: data.store ?? defaultCustomerStore(),
    banners: data.banners ?? [],
    announcements: data.announcements ?? [],
    categories: data.categories ?? [],
    collections: data.collections ?? [],
    recommended: data.recommended ?? [],
    coupons: data.coupons ?? [],
    reviews: data.reviews ?? [],
  };
}

export interface CustomerReview {
  id: string;
  userId: string;
  userName?: string | null;
  userPhone?: string | null;
  itemId?: string | null;
  orderId?: string | null;
  foodRating: number;
  deliveryRating: number;
  packagingRating: number;
  comment: string;
  photos: string[];
  helpfulCount: number;
  published?: boolean;
  adminNote?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  order?: Order | null;
}

export async function createCustomerReview(input: {
  itemId?: string | null;
  orderId?: string | null;
  foodRating: number;
  deliveryRating: number;
  packagingRating: number;
  comment: string;
  photos?: string[];
}): Promise<CustomerReview> {
  const res = await apiFetch(`${API_BASE}/customer/reviews`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to save review");
  return json;
}

export async function listMyCustomerReviews(): Promise<CustomerReview[]> {
  const res = await apiFetch(`${API_BASE}/customer/reviews`);
  if (!res.ok) throw new Error("Failed to fetch reviews");
  return res.json();
}

function defaultCustomerStore(): CustomerStore {
  return {
    id: "default",
    name: "Ankapur Dhaba",
    phone: "+91 9963218601",
    address: "The Ankapure Dhaba, Maisamguda, Telangana 500043",
    lat: 17.562861,
    lng: 78.453472,
    zoneRadiusKm: 8,
    status: "online",
    statusMessage: "",
    openTime: "10:00",
    closeTime: "23:00",
    minimumOrder: 199,
    deliveryCharge: 40,
    freeDeliveryAbove: 499,
    averageDeliveryMin: 30,
    waitingTimeMin: 20,
    packingCharge: 10,
    allowDeliveryCod: false,
    holidayNotice: "",
    splashTitle: "Ankapur Dhaba",
    splashSubtitle: "Telangana classics, delivered hot",
    theme: { primary: "#C62828", secondary: "#F6B51E", accent: "#16A34A", background: "#F8F9FB" },
  };
}

export async function getCustomerMenu(): Promise<MenuItem[]> {
  const res = await fetch(`${API_BASE}/customer/menu`);
  if (!res.ok) throw new Error("Failed to fetch menu");
  return res.json();
}

export async function listCustomerCoupons(phone?: string): Promise<CustomerCoupon[]> {
  const qs = phone ? `?phone=${encodeURIComponent(phone)}` : "";
  const res = await fetch(`${API_BASE}/customer/coupons${qs}`);
  if (!res.ok) throw new Error("Failed to fetch coupons");
  return res.json();
}

export async function validateCustomerCoupon(input: {
  code: string;
  subtotal: number;
  phone?: string;
}): Promise<{ coupon: CustomerCoupon; discount: number }> {
  const res = await fetch(`${API_BASE}/customer/coupons/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Invalid coupon");
  return json;
}

export async function getCustomerProfile() {
  const res = await apiFetch(`${API_BASE}/customer/profile`);
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

export async function updateCustomerProfile(patch: Record<string, unknown>) {
  const res = await apiFetch(`${API_BASE}/customer/profile`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update profile");
  return res.json();
}

export async function listCustomerAddresses(): Promise<CustomerAddress[]> {
  const res = await apiFetch(`${API_BASE}/customer/addresses`);
  if (!res.ok) throw new Error("Failed to fetch addresses");
  return res.json();
}

export async function createCustomerAddress(
  input: Omit<CustomerAddress, "id">,
): Promise<CustomerAddress> {
  const res = await apiFetch(`${API_BASE}/customer/addresses`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to save address");
  return res.json();
}

export async function updateCustomerAddress(
  id: string,
  input: Partial<Omit<CustomerAddress, "id">>,
): Promise<CustomerAddress> {
  const res = await apiFetch(`${API_BASE}/customer/addresses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to update address");
  return res.json();
}

export async function deleteCustomerAddress(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/customer/addresses/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete address");
}

export async function listCustomerNotifications(): Promise<CustomerNotification[]> {
  const res = await apiFetch(`${API_BASE}/customer/notifications`);
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json();
}

export async function markCustomerNotificationRead(id: string): Promise<CustomerNotification> {
  const res = await apiFetch(`${API_BASE}/customer/notifications/${id}/read`, { method: "PATCH" });
  if (!res.ok) throw new Error("Failed to update notification");
  return res.json();
}

export async function markAllCustomerNotificationsRead(): Promise<{ success: boolean }> {
  const res = await apiFetch(`${API_BASE}/customer/notifications/read-all`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to update notifications");
  return res.json();
}

export async function registerCustomerPushToken(input: {
  token: string;
  platform?: string;
  userAgent?: string;
}): Promise<{ success: boolean }> {
  const res = await apiFetch(`${API_BASE}/customer/notifications/push-token`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to register notification device");
  return json;
}

export async function sendAdminPushNotification(input: {
  title: string;
  message: string;
  target?: string;
  url?: string;
}): Promise<{
  success: boolean;
  inAppCreated: number;
  pushSent: number;
  pushFailed: number;
  setupRequired?: boolean;
}> {
  const res = await apiFetch(`${API_BASE}/customer/admin/notifications/send`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to send notification");
  return json;
}

export type AdminRangePreset = "today" | "yesterday" | "week" | "month" | "year" | "custom";

export interface AdminDateRange {
  preset: string;
  start: string;
  end: string;
}

export interface AdminDashboardData {
  range: AdminDateRange;
  kpis: Record<string, number>;
  ordersByStatus: Array<{ status: string; count: number }>;
  paymentBreakdown: Array<{ method: string; count: number; amount: number; pending: number; refunded: number }>;
  expenseBreakdown: Array<{ label: string; amount: number; count: number }>;
  inventoryStatus: { available: number; low: number; out: number };
  latestOrders: Order[];
  lowStock: InventoryIngredient[];
}

export interface ExpenseCategory {
  id: string;
  name: string;
  active: boolean;
}

export interface Expense {
  id: string;
  date: string;
  categoryId?: string | null;
  categoryName: string;
  amount: number;
  paymentMethod: string;
  description: string;
  receiptUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpensePayload {
  date: string;
  categoryId?: string | null;
  categoryName: string;
  amount: number;
  paymentMethod: string;
  description?: string;
  receiptUrl?: string | null;
}

export interface ExpensesData {
  categories: ExpenseCategory[];
  expenses: Expense[];
  summary: {
    total: number;
    today: number;
    byCategory: Array<{ label: string; amount: number; count: number }>;
  };
}

export interface AdminSalesData {
  range: AdminDateRange;
  summary: {
    totalSales: number;
    onlineSales: number;
    cashSales: number;
    expenseTotal: number;
    profit: number;
    avgOrderValue: number;
    orderCount: number;
    completedCount: number;
  };
  paymentBreakdown: AdminDashboardData["paymentBreakdown"];
  bestSellingItem: { name: string; qty: number; revenue: number } | null;
  topItems: Array<{ name: string; qty: number; revenue: number }>;
  dailySales: Array<{ date: string; amount: number }>;
}

export interface AdminPaymentsData {
  range: AdminDateRange;
  summary: { total: number; pending: number; paid: number; refunds: number };
  breakdown: AdminDashboardData["paymentBreakdown"];
  pendingOrders: Order[];
  refundedOrders: Order[];
}

export interface AdminInventoryData {
  items: InventoryIngredient[];
  movements: Array<{
    id: string;
    ingredientId: string;
    type: string;
    quantity: number;
    note?: string | null;
    createdAt: string;
  }>;
  summary: { total: number; available: number; low: number; out: number; recentlyAdded: InventoryIngredient[] };
}

export interface StaffSalary {
  id: string;
  employeeName: string;
  employeePhone?: string | null;
  role: string;
  salary: number;
  advance: number;
  bonus: number;
  deduction: number;
  finalSalary: number;
  status: "paid" | "pending" | string;
  period: string;
  paidAt?: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryData {
  period: string;
  salaries: StaffSalary[];
  summary: {
    totalSalary: number;
    advances: number;
    bonuses: number;
    deductions: number;
    finalPayable: number;
    paid: number;
    pending: number;
  };
}

export interface AdminReportsData {
  range: AdminDateRange;
  available: string[];
  summary: Record<string, unknown>;
}

function adminQuery(params: { range?: AdminRangePreset; from?: string; to?: string; type?: string; period?: string } = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) qs.set(key, value);
  });
  return qs.size ? `?${qs.toString()}` : "";
}

export async function getAdminDashboard(params?: { range?: AdminRangePreset; from?: string; to?: string }): Promise<AdminDashboardData> {
  const res = await apiFetch(`${API_BASE}/dashboard${adminQuery(params)}`);
  if (!res.ok) throw new Error("Failed to fetch dashboard");
  return res.json();
}

export async function getAdminSales(params?: { range?: AdminRangePreset; from?: string; to?: string }): Promise<AdminSalesData> {
  const res = await apiFetch(`${API_BASE}/sales${adminQuery(params)}`);
  if (!res.ok) throw new Error("Failed to fetch sales");
  return res.json();
}

export async function getAdminPayments(params?: { range?: AdminRangePreset; from?: string; to?: string }): Promise<AdminPaymentsData> {
  const res = await apiFetch(`${API_BASE}/payments${adminQuery(params)}`);
  if (!res.ok) throw new Error("Failed to fetch payments");
  return res.json();
}

export async function listExpenses(params?: { range?: AdminRangePreset; from?: string; to?: string }): Promise<ExpensesData> {
  const res = await apiFetch(`${API_BASE}/expenses${adminQuery(params)}`);
  if (!res.ok) throw new Error("Failed to fetch expenses");
  return res.json();
}

export async function createExpense(input: ExpensePayload): Promise<Expense> {
  const res = await apiFetch(`${API_BASE}/expenses`, { method: "POST", body: JSON.stringify(input) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to save expense");
  return json;
}

export async function updateExpense(id: string, input: Partial<ExpensePayload>): Promise<Expense> {
  const res = await apiFetch(`${API_BASE}/expenses/${id}`, { method: "PUT", body: JSON.stringify(input) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to update expense");
  return json;
}

export async function deleteExpense(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/expenses/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete expense");
}

export async function getAdminInventory(): Promise<AdminInventoryData> {
  const res = await apiFetch(`${API_BASE}/inventory`);
  if (!res.ok) throw new Error("Failed to fetch inventory");
  return res.json();
}

export async function updateAdminInventory(input: { id: string; action?: "add" | "reduce" | "update"; quantity?: number; note?: string } & Partial<InventoryIngredient>): Promise<InventoryIngredient> {
  const res = await apiFetch(`${API_BASE}/inventory`, { method: "PUT", body: JSON.stringify(input) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to update inventory");
  return json;
}

export async function getAdminSalary(params?: { period?: string }): Promise<SalaryData> {
  const res = await apiFetch(`${API_BASE}/salary${adminQuery(params)}`);
  if (!res.ok) throw new Error("Failed to fetch salary");
  return res.json();
}

export async function saveAdminSalary(input: Omit<StaffSalary, "id" | "finalSalary" | "createdAt" | "updatedAt"> & { id?: string }): Promise<StaffSalary> {
  const { id, ...payload } = input;
  const res = await apiFetch(`${API_BASE}/salary${id ? `/${id}` : ""}`, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to save salary");
  return json;
}

export async function getAdminReports(params?: { range?: AdminRangePreset; from?: string; to?: string }): Promise<AdminReportsData> {
  const res = await apiFetch(`${API_BASE}/reports${adminQuery(params)}`);
  if (!res.ok) throw new Error("Failed to fetch reports");
  return res.json();
}

export function adminReportDownloadUrl(format: "csv" | "excel" | "pdf", params: { type: string; range?: AdminRangePreset; from?: string; to?: string }) {
  return `${API_BASE}/reports/${format}${adminQuery(params)}`;
}

export async function listCustomerFavorites(): Promise<Array<{ id: string; itemId: string }>> {
  const res = await apiFetch(`${API_BASE}/customer/favorites`);
  if (!res.ok) throw new Error("Failed to fetch favorites");
  return res.json();
}

export async function addCustomerFavorite(itemId: string) {
  const res = await apiFetch(`${API_BASE}/customer/favorites`, {
    method: "POST",
    body: JSON.stringify({ itemId }),
  });
  if (!res.ok) throw new Error("Failed to add favorite");
  return res.json();
}

export async function removeCustomerFavorite(itemId: string) {
  const res = await apiFetch(`${API_BASE}/customer/favorites/${itemId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove favorite");
}

export async function getCustomerLoyalty(): Promise<{
  points: number;
  lifetimeSpend: number;
  orderCount: number;
  tier: string;
}> {
  const res = await apiFetch(`${API_BASE}/customer/loyalty`);
  if (!res.ok) throw new Error("Failed to fetch loyalty");
  return res.json();
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  balanceAfter: number;
  reason: string;
  source: string;
  orderId?: string | null;
  paymentId?: string | null;
  createdByName?: string | null;
  createdAt: string;
}

export interface CustomerWallet {
  balance: number;
  refund?: number;
  gift?: number;
  loyalty?: number;
  transactions: WalletTransaction[];
}

export async function getCustomerWallet(): Promise<CustomerWallet> {
  const res = await apiFetch(`${API_BASE}/customer/wallet`);
  if (!res.ok) throw new Error("Failed to fetch wallet");
  return res.json();
}

export async function createWalletTopupSession(
  amount: number,
): Promise<{ orderId: string; paymentSessionId?: string; mode: "sandbox" | "production" }> {
  const res = await apiFetch(`${API_BASE}/customer/wallet/topup/create`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to start wallet top-up");
  return json;
}

export async function verifyWalletTopup(
  orderId: string,
  amount: number,
): Promise<{ status: string; wallet: { balance: number; transaction: WalletTransaction } | null }> {
  const res = await apiFetch(`${API_BASE}/customer/wallet/topup/verify`, {
    method: "POST",
    body: JSON.stringify({ orderId, amount }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to verify wallet top-up");
  return json;
}

export interface AdminCustomerUser {
  id: string;
  name: string;
  phone: string;
  role: string;
  email?: string | null;
  photo?: string | null;
  createdAt: string;
  updatedAt?: string;
  loyaltyPoints: number;
  tier: string;
  orderCount: number;
  totalSpend: number;
  lastOrder?: string | null;
  walletBalance: number;
  walletTransactions: WalletTransaction[];
  addresses: CustomerAddress[];
  favorites: Array<{ id: string; itemId: string; createdAt?: string }>;
  reviews: Array<{
    id: string;
    foodRating?: number;
    deliveryRating?: number;
    packagingRating?: number;
    comment?: string;
    createdAt: string;
  }>;
  notifications: Array<{
    id: string;
    title: string;
    body: string;
    category: string;
    read: boolean;
    createdAt: string;
  }>;
  orders: Order[];
  profile?: Record<string, unknown>;
}

export async function listAdminUsers(): Promise<AdminCustomerUser[]> {
  const res = await apiFetch(`${API_BASE}/customer/admin/users`);
  if (!res.ok) throw new Error("Failed to fetch customers");
  return res.json();
}

export async function getAdminUser(id: string): Promise<AdminCustomerUser> {
  const res = await apiFetch(`${API_BASE}/customer/admin/users/${id}`);
  if (!res.ok) throw new Error("Failed to fetch customer");
  return res.json();
}

export async function adjustAdminUserWallet(
  id: string,
  input: {
    amount: number;
    direction: "credit" | "debit";
    type?: string;
    reason: string;
    orderId?: string | null;
  },
): Promise<{ balance: number; transaction: WalletTransaction }> {
  const res = await apiFetch(`${API_BASE}/customer/admin/users/${id}/wallet/adjust`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to update wallet");
  return json;
}

export async function refundAdminUserWallet(
  id: string,
  input: { amount: number; reason: string; orderId?: string | null },
): Promise<{ balance: number; transaction: WalletTransaction }> {
  const res = await apiFetch(`${API_BASE}/customer/admin/users/${id}/wallet/refund`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to refund wallet");
  return json;
}

export async function listAdminUserWalletTransactions(id: string): Promise<WalletTransaction[]> {
  const res = await apiFetch(`${API_BASE}/customer/admin/users/${id}/wallet/transactions`);
  if (!res.ok) throw new Error("Failed to fetch wallet transactions");
  return res.json();
}

export type SupportStatus = "open" | "waiting_customer" | "in_review" | "resolved" | "closed";
export type SupportPriority = "low" | "normal" | "high" | "urgent";

export interface SupportFaq {
  id: string;
  category: string;
  question: string;
  answer: string;
  keywords: string[];
  priority: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  userId?: string | null;
  sender: "customer" | "admin" | string;
  message: string;
  media: string[];
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  category: string;
  subject: string;
  description: string;
  orderId?: string | null;
  priority: SupportPriority;
  status: SupportStatus;
  resolution?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; phone: string; role: string };
  messages: SupportTicketMessage[];
}

export async function listSupportFaqs(): Promise<SupportFaq[]> {
  const res = await apiFetch(`${API_BASE}/customer/support/faqs`, { skipAuthRedirect: true });
  if (!res.ok) throw new Error("Failed to fetch support FAQs");
  return res.json();
}

export async function listSupportTickets(): Promise<SupportTicket[]> {
  const res = await apiFetch(`${API_BASE}/customer/support/tickets`);
  if (!res.ok) throw new Error("Failed to fetch support tickets");
  return res.json();
}

export async function createSupportTicket(input: {
  category: string;
  subject: string;
  description: string;
  orderId?: string | null;
  priority?: SupportPriority;
  media?: string[];
}): Promise<SupportTicket> {
  const res = await apiFetch(`${API_BASE}/customer/support/tickets`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to create support ticket");
  return json;
}

export async function getSupportTicket(id: string): Promise<SupportTicket> {
  const res = await apiFetch(`${API_BASE}/customer/support/tickets/${id}`);
  if (!res.ok) throw new Error("Failed to fetch support ticket");
  return res.json();
}

export async function addSupportTicketMessage(
  id: string,
  input: { message: string; media?: string[] },
): Promise<{ message: SupportTicketMessage; ticket: SupportTicket }> {
  const res = await apiFetch(`${API_BASE}/customer/support/tickets/${id}/messages`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to send message");
  return json;
}

export async function uploadSupportFile(
  file: File,
): Promise<{ url: string; filename: string; originalName: string }> {
  const form = new FormData();
  form.append("file", file);
  const token = useAuth.getState().token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (SUPABASE_PUBLISHABLE_KEY) headers.apikey = SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(`${API_BASE}/customer/support/uploads`, {
    method: "POST",
    headers,
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (file.type.startsWith("image/") && file.size <= 2 * 1024 * 1024) {
      return {
        url: await fileToDataUrl(file),
        filename: `inline-${Date.now()}-${file.name}`,
        originalName: file.name,
      };
    }
    throw new Error(json.error || "Failed to upload support media");
  }
  return json;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

export async function listAdminSupportTickets(
  status?: SupportStatus | "all",
): Promise<SupportTicket[]> {
  const qs = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
  const res = await apiFetch(`${API_BASE}/customer/admin/support/tickets${qs}`);
  if (!res.ok) throw new Error("Failed to fetch support tickets");
  return res.json();
}

export async function updateAdminSupportTicket(
  id: string,
  patch: Partial<Pick<SupportTicket, "status" | "priority" | "resolution">>,
): Promise<SupportTicket> {
  const res = await apiFetch(`${API_BASE}/customer/admin/support/tickets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to update ticket");
  return json;
}

export async function addAdminSupportTicketMessage(
  id: string,
  input: { message: string; media?: string[] },
): Promise<{ message: SupportTicketMessage; ticket: SupportTicket }> {
  const res = await apiFetch(`${API_BASE}/customer/admin/support/tickets/${id}/messages`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to send reply");
  return json;
}

export async function listAdminSupportFaqs(): Promise<SupportFaq[]> {
  const res = await apiFetch(`${API_BASE}/customer/admin/support/faqs`);
  if (!res.ok) throw new Error("Failed to fetch support FAQs");
  return res.json();
}

export async function createAdminSupportFaq(
  input: Partial<SupportFaq> & { category: string; question: string; answer: string },
): Promise<SupportFaq> {
  const res = await apiFetch(`${API_BASE}/customer/admin/support/faqs`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to create FAQ");
  return json;
}

export async function updateAdminSupportFaq(
  id: string,
  patch: Partial<SupportFaq>,
): Promise<SupportFaq> {
  const res = await apiFetch(`${API_BASE}/customer/admin/support/faqs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to update FAQ");
  return json;
}

export async function deleteAdminSupportFaq(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/customer/admin/support/faqs/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete FAQ");
}

export async function getAdminCustomerContent(): Promise<{
  store: CustomerStore;
  banners: CustomerBanner[];
  announcements: CustomerAnnouncement[];
  coupons: CustomerCoupon[];
}> {
  const res = await apiFetch(`${API_BASE}/customer/admin/content`);
  if (!res.ok) throw new Error("Failed to fetch customer app content");
  return res.json();
}

export async function updateAdminCustomerStore(
  patch: Partial<CustomerStore>,
): Promise<CustomerStore> {
  const res = await apiFetch(`${API_BASE}/customer/admin/store`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update store");
  return res.json();
}

export async function createAdminBanner(
  input: Partial<CustomerBanner> & { title: string; image: string },
): Promise<CustomerBanner> {
  const res = await apiFetch(`${API_BASE}/customer/admin/banners`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to create banner");
  return res.json();
}

export async function updateAdminBanner(
  id: string,
  patch: Partial<CustomerBanner>,
): Promise<CustomerBanner> {
  const res = await apiFetch(`${API_BASE}/customer/admin/banners/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update banner");
  return res.json();
}

export async function deleteAdminBanner(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/customer/admin/banners/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete banner");
}

export async function createAdminAnnouncement(
  input: Partial<CustomerAnnouncement> & { message: string },
): Promise<CustomerAnnouncement> {
  const res = await apiFetch(`${API_BASE}/customer/admin/announcements`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to create announcement");
  return res.json();
}

export async function updateAdminAnnouncement(
  id: string,
  patch: Partial<CustomerAnnouncement>,
): Promise<CustomerAnnouncement> {
  const res = await apiFetch(`${API_BASE}/customer/admin/announcements/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update announcement");
  return res.json();
}

export async function deleteAdminAnnouncement(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/customer/admin/announcements/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete announcement");
}

export async function createAdminCoupon(
  input: Partial<CustomerCoupon> & { code: string; title: string; discountValue: number },
): Promise<CustomerCoupon> {
  const res = await apiFetch(`${API_BASE}/customer/admin/coupons`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to create coupon");
  return res.json();
}

export async function updateAdminCoupon(
  id: string,
  patch: Partial<CustomerCoupon>,
): Promise<CustomerCoupon> {
  const res = await apiFetch(`${API_BASE}/customer/admin/coupons/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update coupon");
  return res.json();
}

export async function deleteAdminCoupon(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/customer/admin/coupons/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete coupon");
}

export async function listAdminReviews(status: "all" | "published" | "pending" = "all"): Promise<CustomerReview[]> {
  const qs = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
  const res = await apiFetch(`${API_BASE}/customer/admin/reviews${qs}`);
  if (!res.ok) throw new Error("Failed to fetch reviews");
  return res.json();
}

export async function updateAdminReview(
  id: string,
  patch: { published?: boolean; adminNote?: string | null },
): Promise<CustomerReview> {
  const res = await apiFetch(`${API_BASE}/customer/admin/reviews/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to update review");
  return json;
}

export async function updateMenuItem(id: string, patch: Partial<MenuItem>): Promise<MenuItem> {
  const res = await apiFetch(`${API_BASE}/menu/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update menu item");
  return res.json();
}

/* ---------------- Catalog Admin ---------------- */
export interface CatalogSummary {
  totalCategories: number;
  totalItems: number;
  availableItems: number;
  outOfStock: number;
  hiddenItems: number;
  todaysTopSeller: { name: string; qty: number } | null;
  lowStockItems: number;
  scheduledItems: number;
}

export interface CatalogCategory {
  id: string;
  name: string;
  parentId?: string | null;
  image?: string | null;
  banner?: string | null;
  icon?: string | null;
  displayPriority: number;
  seoUrl: string;
  active: boolean;
  availabilityRules: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogImage {
  id: string;
  url: string;
  kind: string;
  alt?: string;
  sortOrder: number;
}
export interface CatalogSize {
  id: string;
  name: string;
  price: number;
  weight?: string;
  serves?: string;
  sku?: string;
  barcode?: string;
  sortOrder: number;
}
export interface CatalogAddon {
  id: string;
  name: string;
  price: number;
  active: boolean;
  sortOrder: number;
}
export interface CatalogVariantOption {
  id: string;
  name: string;
  price: number;
  active: boolean;
  sortOrder: number;
}
export interface CatalogVariantGroup {
  id: string;
  name: string;
  required: boolean;
  sortOrder: number;
  options: CatalogVariantOption[];
}

export interface InventoryIngredient {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  purchaseCost: number;
  vendor?: string | null;
  expiryDate?: string | null;
  batchNumber?: string | null;
  warehouse?: string | null;
  storageLocation?: string | null;
}

export interface CatalogInventoryLink {
  id: string;
  quantity: number;
  unit: string;
  ingredient: InventoryIngredient;
}

export interface CatalogItem extends MenuItem {
  displayName?: string | null;
  shortName?: string | null;
  richDescription: string;
  ingredientsText: string;
  cookingInstructions: string;
  kitchenNotes: string;
  basePrice: number;
  offerPrice?: number | null;
  costPrice: number;
  taxRate: number;
  gstRate: number;
  serviceCharge: number;
  deliveryChargeOverride?: number | null;
  categoryId?: string | null;
  thumbnail?: string | null;
  zoomImage?: string | null;
  dietType: "veg" | "non-veg" | "egg" | string;
  hidden: boolean;
  featured: boolean;
  trending: boolean;
  pinned: boolean;
  recentlyAdded: boolean;
  tags: string[];
  availabilityRules: Record<string, unknown>;
  visibility: Record<string, boolean>;
  nutrition: Record<string, unknown>;
  packaging: Record<string, unknown>;
  seo: Record<string, unknown>;
  prepTimeMinutes: number;
  cookingPriority: string;
  kitchenStation: string;
  sku?: string | null;
  barcode?: string | null;
  displayOrder: number;
  views: number;
  orderCount: number;
  revenue: number;
  rating: number;
  reviewCount: number;
  images: CatalogImage[];
  sizes: CatalogSize[];
  addons: CatalogAddon[];
  variantGroups: CatalogVariantGroup[];
  inventoryLinks: CatalogInventoryLink[];
  createdAt: string;
  updatedAt: string;
}

export interface CatalogAuditLog {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  before?: string | null;
  after?: string | null;
  userName?: string | null;
  createdAt: string;
}

export async function getCatalogSummary(): Promise<CatalogSummary> {
  const res = await apiFetch(`${API_BASE}/catalog/summary`);
  if (!res.ok) throw new Error("Failed to fetch catalog summary");
  return res.json();
}

export async function listCatalogCategories(): Promise<CatalogCategory[]> {
  const res = await apiFetch(`${API_BASE}/catalog/categories`);
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

export async function createCatalogCategory(
  input: Partial<CatalogCategory> & { name: string },
): Promise<CatalogCategory> {
  const res = await apiFetch(`${API_BASE}/catalog/categories`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await serverError(res, "Failed to create category");
  return res.json();
}

export async function updateCatalogCategory(
  id: string,
  patch: Partial<CatalogCategory>,
): Promise<CatalogCategory> {
  const res = await apiFetch(`${API_BASE}/catalog/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw await serverError(res, "Failed to update category");
  return res.json();
}

export async function deleteCatalogCategory(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/catalog/categories/${id}`, { method: "DELETE" });
  if (!res.ok) throw await serverError(res, "Failed to delete category");
}

export async function listCatalogItems(
  params: { search?: string; category?: string; status?: string } = {},
): Promise<CatalogItem[]> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) qs.set(key, value);
  });
  const res = await apiFetch(`${API_BASE}/catalog/items${qs.size ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch catalog items");
  return res.json();
}

export async function createCatalogItem(
  input: Partial<CatalogItem> & { name: string },
): Promise<CatalogItem> {
  const res = await apiFetch(`${API_BASE}/catalog/items`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await serverError(res, "Failed to create item");
  return res.json();
}

export async function updateCatalogItem(
  id: string,
  patch: Partial<CatalogItem>,
): Promise<CatalogItem> {
  const res = await apiFetch(`${API_BASE}/catalog/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw await serverError(res, "Failed to update item");
  return res.json();
}

export async function deleteCatalogItem(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/catalog/items/${id}`, { method: "DELETE" });
  if (!res.ok) throw await serverError(res, "Failed to delete item");
}

export async function duplicateCatalogItem(id: string): Promise<CatalogItem> {
  const res = await apiFetch(`${API_BASE}/catalog/items/${id}/duplicate`, { method: "POST" });
  if (!res.ok) throw await serverError(res, "Failed to duplicate item");
  return res.json();
}

export async function bulkUpdateCatalogItems(
  ids: string[],
  patch: Partial<CatalogItem>,
): Promise<void> {
  const res = await apiFetch(`${API_BASE}/catalog/items/bulk-update`, {
    method: "POST",
    body: JSON.stringify({ ids, patch }),
  });
  if (!res.ok) throw new Error("Failed to bulk update items");
}

export async function uploadCatalogFile(
  file: File,
): Promise<{ url: string; filename: string; originalName: string }> {
  const form = new FormData();
  form.append("file", file);
  const token = useAuth.getState().token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (SUPABASE_PUBLISHABLE_KEY) headers.apikey = SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(`${API_BASE}/catalog/uploads`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!res.ok) throw new Error("Failed to upload file");
  return res.json();
}

export async function importCatalogExcel(
  file: File,
): Promise<{ created: number; updated: number; totalRows: number }> {
  const form = new FormData();
  form.append("file", file);
  const token = useAuth.getState().token;
  const res = await fetch(`${API_BASE}/catalog/import/excel`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!res.ok) throw new Error("Failed to import Excel");
  return res.json();
}

export function catalogExportUrl(kind: "excel" | "catalog") {
  return `${API_BASE}/catalog/export/${kind}`;
}

export async function downloadCatalogExport(kind: "excel" | "catalog"): Promise<void> {
  const token = useAuth.getState().token;
  const res = await fetch(catalogExportUrl(kind), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error("Failed to download catalog");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = kind === "excel" ? "catalog.xlsx" : "catalog.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function generateCatalogAi(
  task: "description" | "tags" | "seo" | "addons",
  input: Record<string, unknown>,
): Promise<{ text: string; model: string }> {
  const res = await apiFetch(`${API_BASE}/catalog/ai/${task}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "AI generation failed");
  return json;
}

export async function listInventoryIngredients(): Promise<InventoryIngredient[]> {
  const res = await apiFetch(`${API_BASE}/catalog/inventory/ingredients`);
  if (!res.ok) throw new Error("Failed to fetch ingredients");
  return res.json();
}

export async function createInventoryIngredient(
  input: Partial<InventoryIngredient> & { name: string },
): Promise<InventoryIngredient> {
  const res = await apiFetch(`${API_BASE}/catalog/inventory/ingredients`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to create ingredient");
  return res.json();
}

export async function adjustInventoryIngredient(
  id: string,
  quantity: number,
  note?: string,
): Promise<InventoryIngredient> {
  const res = await apiFetch(`${API_BASE}/catalog/inventory/ingredients/${id}/adjust`, {
    method: "POST",
    body: JSON.stringify({ quantity, note }),
  });
  if (!res.ok) throw new Error("Failed to adjust stock");
  return res.json();
}

export async function listCatalogAudit(): Promise<CatalogAuditLog[]> {
  const res = await apiFetch(`${API_BASE}/catalog/audit`);
  if (!res.ok) throw new Error("Failed to fetch audit logs");
  return res.json();
}

/* ---------------- Orders ---------------- */
export async function listOrders(): Promise<Order[]> {
  const res = await apiFetch(`${API_BASE}/orders`);
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json();
}

export async function listMyOrders(): Promise<Order[]> {
  const res = await apiFetch(`${API_BASE}/orders/my`);
  if (!res.ok) throw new Error("Failed to fetch your orders");
  return res.json();
}

export async function getOrder(id: string): Promise<Order | null> {
  const res = await apiFetch(`${API_BASE}/orders/${id}`, { skipAuthRedirect: true });
  if (res.status === 401 || res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch order");
  return res.json();
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const res = await apiFetch(`${API_BASE}/orders`, { method: "POST", body: JSON.stringify(input) });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to create order");
  }
  return res.json();
}

export async function createCashfreePaymentSession(order: CreateOrderInput): Promise<{
  orderId: string;
  paymentSessionId?: string;
  mode: "sandbox" | "production";
}> {
  const res = await apiFetch(`${API_BASE}/payments/cashfree/session`, {
    method: "POST",
    body: JSON.stringify({ order }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to start Cashfree payment");
  return json;
}

export async function verifyCashfreePayment(
  orderId: string,
): Promise<{ status: string; order: Order | null; draftId?: string }> {
  const res = await apiFetch(`${API_BASE}/payments/cashfree/verify/${orderId}`, {
    method: "POST",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to verify Cashfree payment");
  return json;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  const res = await apiFetch(`${API_BASE}/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update order status");
  return res.json();
}

export async function updateOrderDelivery(
  id: string,
  delivery: Partial<DeliveryDetails>,
): Promise<Order> {
  const res = await apiFetch(`${API_BASE}/orders/${id}/delivery`, {
    method: "PATCH",
    body: JSON.stringify(delivery),
  });
  if (!res.ok) throw new Error("Failed to update delivery info");
  return res.json();
}

async function deliveryRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(`${API_BASE}/delivery/${path}`, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Delivery request failed");
  return json;
}

export async function listDeliveryOrders(): Promise<Order[]> {
  return deliveryRequest<Order[]>("orders");
}

export async function listDeliveryHistory(): Promise<Order[]> {
  return deliveryRequest<Order[]>("history");
}

export async function getDeliveryProfile(): Promise<DeliveryProfile> {
  return deliveryRequest<DeliveryProfile>("profile");
}

export async function reserveDeliveryOrder(orderId: string): Promise<Order> {
  return deliveryRequest<Order>("reserve", { method: "POST", body: JSON.stringify({ orderId }) });
}

export async function pickDeliveryOrder(
  orderId: string,
  input: Partial<DeliveryDetails> & { currentLocation?: DeliveryLocation } = {},
): Promise<Order> {
  return deliveryRequest<Order>("pick", {
    method: "POST",
    body: JSON.stringify({ orderId, ...input }),
  });
}

export async function verifyDeliveryPickup(orderId: string, pickupPin: string): Promise<Order> {
  return deliveryRequest<Order>("pickup-verify", {
    method: "POST",
    body: JSON.stringify({ orderId, pickupPin }),
  });
}

export async function completeDeliveryOrder(
  orderId: string,
  deliveryOtp: string,
  input: Partial<DeliveryDetails> & { currentLocation?: DeliveryLocation } = {},
): Promise<Order> {
  return deliveryRequest<Order>("deliver", {
    method: "POST",
    body: JSON.stringify({ orderId, deliveryOtp, ...input }),
  });
}

export async function updateDeliveryLocation(
  orderId: string,
  input: Partial<DeliveryDetails> & { currentLocation: DeliveryLocation },
): Promise<Order> {
  return deliveryRequest<Order>("location", {
    method: "PUT",
    body: JSON.stringify({ orderId, ...input }),
  });
}

export async function updateDeliveryPortalStatus(
  orderId: string,
  input: Pick<DeliveryDetails, "deliveryStage" | "delayReason" | "etaMinutes">,
): Promise<Order> {
  return deliveryRequest<Order>("status", {
    method: "POST",
    body: JSON.stringify({ orderId, ...input }),
  });
}

export async function updateOrderKds(
  id: string,
  input: { status?: OrderStatus; metadata?: Partial<DeliveryDetails> },
): Promise<Order> {
  const res = await apiFetch(`${API_BASE}/orders/${id}/kds`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to update KDS order");
  return res.json();
}

export async function bulkUpdateOrderKds(
  ids: string[],
  input: { status?: OrderStatus; metadata?: Partial<DeliveryDetails> },
): Promise<{ updated: Order[] }> {
  const res = await apiFetch(`${API_BASE}/orders/bulk-status`, {
    method: "POST",
    body: JSON.stringify({ ids, ...input }),
  });
  if (!res.ok) throw new Error("Failed to bulk update KDS orders");
  return res.json();
}

export async function closeTableOrders(input: {
  tableNumber: string;
  orderIds: string[];
  paymentMethod: "cash" | "card" | "upi" | "phonepe" | "gpay" | "paytm" | "split" | "partial";
  amountPaid?: number;
  note?: string;
}): Promise<{
  updated: Order[];
  invoice: { tableNumber: string; paymentMethod: string; paidAt: string; totalPaid: number };
}> {
  const res = await apiFetch(`${API_BASE}/orders/table/close`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to close table");
  return json;
}

/* ---------------- Kitchen Printer API ---------------- */
async function printerRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(`${API_BASE}/printers${path}`, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Printer request failed");
  return json;
}

export async function getPrinters(): Promise<PrinterBundle> {
  return printerRequest<PrinterBundle>("");
}

export async function getPrinterSettings(): Promise<PrinterSettings> {
  return printerRequest<PrinterSettings>("/settings");
}

export async function savePrinterSettings(input: Partial<PrinterSettings>): Promise<PrinterSettings> {
  return printerRequest<PrinterSettings>("/settings", { method: "POST", body: JSON.stringify(input) });
}

export async function savePrinter(input: Partial<PrinterRecord> & { name: string }): Promise<PrinterRecord> {
  return printerRequest<PrinterRecord>("/save", { method: "POST", body: JSON.stringify(input) });
}

export async function setDefaultPrinter(printerId: string): Promise<PrinterRecord> {
  return printerRequest<PrinterRecord>("/default", {
    method: "PUT",
    body: JSON.stringify({ printerId }),
  });
}

export async function logPrinterConnection(input: {
  printerId?: string | null;
  message?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; status: string }> {
  return printerRequest<{ ok: boolean; status: string }>("/connect-log", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function logPrinterDisconnect(input: {
  printerId?: string | null;
  message?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; status: string }> {
  return printerRequest<{ ok: boolean; status: string }>("/disconnect-log", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listPrinterHistory(params?: {
  status?: string;
  orderId?: string;
}): Promise<PrinterHistoryEntry[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.orderId) search.set("orderId", params.orderId);
  const suffix = search.toString() ? `/history?${search}` : "/history";
  return printerRequest<PrinterHistoryEntry[]>(suffix);
}

export async function createPrinterHistory(
  input: Partial<PrinterHistoryEntry> & { orderNumber: string },
): Promise<PrinterHistoryEntry> {
  return printerRequest<PrinterHistoryEntry>("/history", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updatePrinterHistory(
  id: string,
  input: Partial<PrinterHistoryEntry>,
): Promise<PrinterHistoryEntry> {
  return printerRequest<PrinterHistoryEntry>(`/history/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function listStationPrinters(): Promise<KitchenStationPrinter[]> {
  return printerRequest<KitchenStationPrinter[]>("/stations");
}

export async function saveStationPrinter(
  input: Partial<KitchenStationPrinter> & { station: string },
): Promise<KitchenStationPrinter> {
  return printerRequest<KitchenStationPrinter>("/stations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateStationPrinter(
  id: string,
  input: Partial<KitchenStationPrinter>,
): Promise<KitchenStationPrinter> {
  return printerRequest<KitchenStationPrinter>(`/stations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteStationPrinter(id: string): Promise<void> {
  await printerRequest<{ ok: boolean }>(`/stations/${id}`, { method: "DELETE" });
}

/* ---------------- Auth Staff API (Admin only) ---------------- */
export interface StaffUser {
  id: string;
  name: string;
  phone: string;
  role: string;
  createdAt: string;
}

export async function listStaff(): Promise<StaffUser[]> {
  const res = await apiFetch(`${API_BASE}/auth/staff`);
  if (!res.ok) throw new Error("Failed to fetch staff");
  return res.json();
}

export async function registerStaff(data: {
  name: string;
  phone: string;
  password: string;
  role: "KITCHEN" | "DELIVERY" | "WAITER";
}): Promise<StaffUser> {
  const res = await apiFetch(`${API_BASE}/auth/register-staff`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to register staff");
  return json.user;
}

export async function deleteStaff(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/auth/staff/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete staff");
}

/* ---------------- Pricing ---------------- */
export function itemTaxRate(
  item: { taxRate?: number | null; gstRate?: number | null } | null | undefined,
  fallback = 5,
) {
  const rate = Number(item?.taxRate ?? item?.gstRate ?? fallback);
  return Number.isFinite(rate) ? rate : fallback;
}

export interface PricedCartItem {
  price: number;
  qty: number;
  taxRate?: number | null;
  gstRate?: number | null;
}

export function computeTotals(
  items: PricedCartItem[],
  type: OrderType,
  fallbackTaxRate = 5,
  delivery?: { charge?: number; freeAbove?: number },
) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = Math.round(
    items.reduce((s, i) => s + (i.price * i.qty * itemTaxRate(i, fallbackTaxRate)) / 100, 0),
  );
  const deliveryFee =
    type === "delivery" && subtotal > 0
      ? subtotal >= (delivery?.freeAbove ?? 500)
        ? 0
        : (delivery?.charge ?? 40)
      : 0;
  const total = subtotal + tax + deliveryFee;
  return { subtotal, tax, deliveryFee, total };
}

/* ---------------- Delivery Wallet & Payouts ---------------- */
export async function getDeliveryWallet(): Promise<DeliveryWallet> {
  return deliveryRequest<DeliveryWallet>("wallet");
}

export async function requestDeliveryPayout(input: {
  amount: number;
  method?: string;
  accountDetails?: string;
  note?: string;
}): Promise<DeliveryPayout> {
  return deliveryRequest<DeliveryPayout>("wallet/payout-request", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/* ---------------- Delivery Fleet & Zones ---------------- */
export async function listDeliveryFleet(): Promise<FleetRider[]> {
  return deliveryRequest<FleetRider[]>("fleet");
}

export async function listDeliveryZones(): Promise<DeliveryZone[]> {
  const res = await apiFetch(`${API_BASE}/delivery/zones`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to fetch delivery zones");
  return json;
}

export async function listAdminDeliveryZones(): Promise<DeliveryZone[]> {
  return deliveryRequest<DeliveryZone[]>("admin/zones");
}

export async function saveDeliveryZone(
  input: Partial<DeliveryZone> & { id?: string },
): Promise<DeliveryZone> {
  const id = input.id;
  const { id: _ignore, ...payload } = input;
  return deliveryRequest<DeliveryZone>(id ? `admin/zones/${id}` : "admin/zones", {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteDeliveryZone(id: string): Promise<void> {
  await deliveryRequest<{ ok: boolean }>(`admin/zones/${id}`, { method: "DELETE" });
}

/* ---------------- Delivery Admin: Payouts, Performance, Settings ---------------- */
export async function listAdminPayouts(status?: string): Promise<DeliveryPayout[]> {
  const query = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
  return deliveryRequest<DeliveryPayout[]>(`admin/payouts${query}`);
}

export async function approveDeliveryPayout(id: string, note?: string): Promise<DeliveryPayout> {
  return deliveryRequest<DeliveryPayout>(`admin/payouts/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function rejectDeliveryPayout(id: string, note?: string): Promise<DeliveryPayout> {
  return deliveryRequest<DeliveryPayout>(`admin/payouts/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function getRiderPerformance(): Promise<RiderPerformance[]> {
  return deliveryRequest<RiderPerformance[]>("admin/rider-performance");
}

export async function updateDeliverySettings(
  input: Partial<DeliverySettings>,
): Promise<DeliverySettings> {
  const res = await apiFetch(`${API_BASE}/delivery/admin/settings`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to update delivery settings");
  return json;
}
