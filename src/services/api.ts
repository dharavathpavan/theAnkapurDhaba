import { type MenuItem } from "@/data/menu";
import { io } from "socket.io-client";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "@/stores/auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
const RAW_SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "";
const SOCKET_URL = isValidSocketIoUrl(RAW_SOCKET_URL) ? RAW_SOCKET_URL : "";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

// Socket connection
const socket = typeof window !== 'undefined' && SOCKET_URL ? io(SOCKET_URL) : null;
const realtimeClient =
  typeof window !== 'undefined' && !SOCKET_URL && SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
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
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
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
    if (typeof window !== 'undefined') window.location.href = '/login';
  }
  return res;
}

export type OrderStatus =
  | "received" | "accepted" | "preparing" | "ready"
  | "out_for_delivery" | "delivered" | "cancelled";

export type OrderType = "delivery" | "pickup" | "dinein";
export type PaymentMethod = "cod" | "upi" | "cashfree" | "razorpay";
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

export type CreateOrderInput = Omit<Order, "id" | "status" | "paymentStatus" | "createdAt" | "updatedAt">;

export interface DeliveryLocation {
  lat: number; lng: number; label?: string; updatedAt?: string;
}

export interface DeliveryDetails {
  partnerName?: string; partnerPhone?: string; vehicleNumber?: string;
  assignedRiderId?: string;
  assignedRiderName?: string;
  reservedBy?: string;
  reservedByName?: string;
  reservedAt?: string;
  reserveExpiresAt?: string | null;
  pickupPin?: string;
  deliveryOtp?: string;
  deliveryStage?: "reserved" | "heading_to_restaurant" | "arrived_restaurant" | "on_the_way" | "nearby" | "almost_there" | "outside" | "delivered" | string;
  arrivedRestaurantAt?: string;
  pickupVerifiedAt?: string;
  nearbyAt?: string;
  almostThereAt?: string;
  outsideAt?: string;
  etaMinutes?: number; currentLocation?: DeliveryLocation;
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

export function subscribeToOrderEvents(callback: (event: OrderRealtimeEvent) => void) {
  if (socket) {
    const listener = (event: OrderRealtimeEvent) => callback(event);
    socket.on("orders-changed", listener);
    return () => { socket.off("orders-changed", listener); };
  }

  if (realtimeClient) {
    const channelName = `ankapur-orders-${++realtimeSubscriptionId}`;
    let channel: RealtimeChannel | null = realtimeClient
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Order" },
        () => callback({ type: "sync" })
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
    return () => { socket.off("customer-content-changed", listener); };
  }

  if (realtimeClient) {
    const tables = ["CustomerBanner", "CustomerAnnouncement", "CustomerCoupon", "StoreSetting", "MenuItem", "MenuCategory"];
    const channel = realtimeClient.channel(`ankapur-customer-content-${++realtimeSubscriptionId}`);
    tables.forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        callback({ type: "sync", at: new Date().toISOString() });
      });
    });
    channel.subscribe();
    return () => { realtimeClient.removeChannel(channel); };
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
}

export interface CustomerAddress {
  id: string;
  label: string;
  name: string;
  phone: string;
  address: string;
  landmark?: string | null;
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
  isDefault: boolean;
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
  };
}

function defaultCustomerStore(): CustomerStore {
  return {
    id: "default",
    name: "Ankapur Dhaba",
    phone: "+91 90000 00000",
    address: "Ankapur Village, Nizamabad District, Telangana",
    lat: 18.7283,
    lng: 78.4477,
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

export async function validateCustomerCoupon(input: { code: string; subtotal: number; phone?: string }): Promise<{ coupon: CustomerCoupon; discount: number }> {
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
  const res = await apiFetch(`${API_BASE}/customer/profile`, { method: "PATCH", body: JSON.stringify(patch) });
  if (!res.ok) throw new Error("Failed to update profile");
  return res.json();
}

export async function listCustomerAddresses(): Promise<CustomerAddress[]> {
  const res = await apiFetch(`${API_BASE}/customer/addresses`);
  if (!res.ok) throw new Error("Failed to fetch addresses");
  return res.json();
}

export async function createCustomerAddress(input: Omit<CustomerAddress, "id">): Promise<CustomerAddress> {
  const res = await apiFetch(`${API_BASE}/customer/addresses`, { method: "POST", body: JSON.stringify(input) });
  if (!res.ok) throw new Error("Failed to save address");
  return res.json();
}

export async function listCustomerFavorites(): Promise<Array<{ id: string; itemId: string }>> {
  const res = await apiFetch(`${API_BASE}/customer/favorites`);
  if (!res.ok) throw new Error("Failed to fetch favorites");
  return res.json();
}

export async function addCustomerFavorite(itemId: string) {
  const res = await apiFetch(`${API_BASE}/customer/favorites`, { method: "POST", body: JSON.stringify({ itemId }) });
  if (!res.ok) throw new Error("Failed to add favorite");
  return res.json();
}

export async function removeCustomerFavorite(itemId: string) {
  const res = await apiFetch(`${API_BASE}/customer/favorites/${itemId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove favorite");
}

export async function getCustomerLoyalty(): Promise<{ points: number; lifetimeSpend: number; orderCount: number; tier: string }> {
  const res = await apiFetch(`${API_BASE}/customer/loyalty`);
  if (!res.ok) throw new Error("Failed to fetch loyalty");
  return res.json();
}

export async function getCustomerWallet(): Promise<{ refund: number; gift: number; loyalty: number; transactions: unknown[] }> {
  const res = await apiFetch(`${API_BASE}/customer/wallet`);
  if (!res.ok) throw new Error("Failed to fetch wallet");
  return res.json();
}

export async function getAdminCustomerContent(): Promise<{ store: CustomerStore; banners: CustomerBanner[]; announcements: CustomerAnnouncement[]; coupons: CustomerCoupon[] }> {
  const res = await apiFetch(`${API_BASE}/customer/admin/content`);
  if (!res.ok) throw new Error("Failed to fetch customer app content");
  return res.json();
}

export async function updateAdminCustomerStore(patch: Partial<CustomerStore>): Promise<CustomerStore> {
  const res = await apiFetch(`${API_BASE}/customer/admin/store`, { method: "PATCH", body: JSON.stringify(patch) });
  if (!res.ok) throw new Error("Failed to update store");
  return res.json();
}

export async function createAdminBanner(input: Partial<CustomerBanner> & { title: string; image: string }): Promise<CustomerBanner> {
  const res = await apiFetch(`${API_BASE}/customer/admin/banners`, { method: "POST", body: JSON.stringify(input) });
  if (!res.ok) throw new Error("Failed to create banner");
  return res.json();
}

export async function updateAdminBanner(id: string, patch: Partial<CustomerBanner>): Promise<CustomerBanner> {
  const res = await apiFetch(`${API_BASE}/customer/admin/banners/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  if (!res.ok) throw new Error("Failed to update banner");
  return res.json();
}

export async function deleteAdminBanner(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/customer/admin/banners/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete banner");
}

export async function createAdminAnnouncement(input: Partial<CustomerAnnouncement> & { message: string }): Promise<CustomerAnnouncement> {
  const res = await apiFetch(`${API_BASE}/customer/admin/announcements`, { method: "POST", body: JSON.stringify(input) });
  if (!res.ok) throw new Error("Failed to create announcement");
  return res.json();
}

export async function updateAdminAnnouncement(id: string, patch: Partial<CustomerAnnouncement>): Promise<CustomerAnnouncement> {
  const res = await apiFetch(`${API_BASE}/customer/admin/announcements/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  if (!res.ok) throw new Error("Failed to update announcement");
  return res.json();
}

export async function deleteAdminAnnouncement(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/customer/admin/announcements/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete announcement");
}

export async function createAdminCoupon(input: Partial<CustomerCoupon> & { code: string; title: string; discountValue: number }): Promise<CustomerCoupon> {
  const res = await apiFetch(`${API_BASE}/customer/admin/coupons`, { method: "POST", body: JSON.stringify(input) });
  if (!res.ok) throw new Error("Failed to create coupon");
  return res.json();
}

export async function updateAdminCoupon(id: string, patch: Partial<CustomerCoupon>): Promise<CustomerCoupon> {
  const res = await apiFetch(`${API_BASE}/customer/admin/coupons/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  if (!res.ok) throw new Error("Failed to update coupon");
  return res.json();
}

export async function deleteAdminCoupon(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/customer/admin/coupons/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete coupon");
}

export async function updateMenuItem(id: string, patch: Partial<MenuItem>): Promise<MenuItem> {
  const res = await apiFetch(`${API_BASE}/menu/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
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

export interface CatalogImage { id: string; url: string; kind: string; alt?: string; sortOrder: number; }
export interface CatalogSize { id: string; name: string; price: number; weight?: string; serves?: string; sku?: string; barcode?: string; sortOrder: number; }
export interface CatalogAddon { id: string; name: string; price: number; active: boolean; sortOrder: number; }
export interface CatalogVariantOption { id: string; name: string; price: number; active: boolean; sortOrder: number; }
export interface CatalogVariantGroup { id: string; name: string; required: boolean; sortOrder: number; options: CatalogVariantOption[]; }

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

export async function createCatalogCategory(input: Partial<CatalogCategory> & { name: string }): Promise<CatalogCategory> {
  const res = await apiFetch(`${API_BASE}/catalog/categories`, { method: "POST", body: JSON.stringify(input) });
  if (!res.ok) throw new Error("Failed to create category");
  return res.json();
}

export async function updateCatalogCategory(id: string, patch: Partial<CatalogCategory>): Promise<CatalogCategory> {
  const res = await apiFetch(`${API_BASE}/catalog/categories/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  if (!res.ok) throw new Error("Failed to update category");
  return res.json();
}

export async function deleteCatalogCategory(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/catalog/categories/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete category");
}

export async function listCatalogItems(params: { search?: string; category?: string; status?: string } = {}): Promise<CatalogItem[]> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) qs.set(key, value); });
  const res = await apiFetch(`${API_BASE}/catalog/items${qs.size ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch catalog items");
  return res.json();
}

export async function createCatalogItem(input: Partial<CatalogItem> & { name: string }): Promise<CatalogItem> {
  const res = await apiFetch(`${API_BASE}/catalog/items`, { method: "POST", body: JSON.stringify(input) });
  if (!res.ok) throw new Error("Failed to create item");
  return res.json();
}

export async function updateCatalogItem(id: string, patch: Partial<CatalogItem>): Promise<CatalogItem> {
  const res = await apiFetch(`${API_BASE}/catalog/items/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  if (!res.ok) throw new Error("Failed to update item");
  return res.json();
}

export async function deleteCatalogItem(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/catalog/items/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete item");
}

export async function duplicateCatalogItem(id: string): Promise<CatalogItem> {
  const res = await apiFetch(`${API_BASE}/catalog/items/${id}/duplicate`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to duplicate item");
  return res.json();
}

export async function bulkUpdateCatalogItems(ids: string[], patch: Partial<CatalogItem>): Promise<void> {
  const res = await apiFetch(`${API_BASE}/catalog/items/bulk-update`, { method: "POST", body: JSON.stringify({ ids, patch }) });
  if (!res.ok) throw new Error("Failed to bulk update items");
}

export async function uploadCatalogFile(file: File): Promise<{ url: string; filename: string; originalName: string }> {
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

export async function importCatalogExcel(file: File): Promise<{ created: number; updated: number; totalRows: number }> {
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

export async function generateCatalogAi(task: "description" | "tags" | "seo" | "addons", input: Record<string, unknown>): Promise<{ text: string; model: string }> {
  const res = await apiFetch(`${API_BASE}/catalog/ai/${task}`, { method: "POST", body: JSON.stringify(input) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "AI generation failed");
  return json;
}

export async function listInventoryIngredients(): Promise<InventoryIngredient[]> {
  const res = await apiFetch(`${API_BASE}/catalog/inventory/ingredients`);
  if (!res.ok) throw new Error("Failed to fetch ingredients");
  return res.json();
}

export async function createInventoryIngredient(input: Partial<InventoryIngredient> & { name: string }): Promise<InventoryIngredient> {
  const res = await apiFetch(`${API_BASE}/catalog/inventory/ingredients`, { method: "POST", body: JSON.stringify(input) });
  if (!res.ok) throw new Error("Failed to create ingredient");
  return res.json();
}

export async function adjustInventoryIngredient(id: string, quantity: number, note?: string): Promise<InventoryIngredient> {
  const res = await apiFetch(`${API_BASE}/catalog/inventory/ingredients/${id}/adjust`, { method: "POST", body: JSON.stringify({ quantity, note }) });
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

export async function createCashfreePaymentSession(order: CreateOrderInput): Promise<{ orderId: string; paymentSessionId?: string; mode: "sandbox" | "production"; alreadyPaid?: boolean; order?: Order }> {
  const res = await apiFetch(`${API_BASE}/payments/cashfree/session`, { method: "POST", body: JSON.stringify({ order }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to start Cashfree payment");
  return json;
}

export async function verifyCashfreePayment(orderId: string, order?: CreateOrderInput): Promise<{ status: string; order: Order | null }> {
  const res = await apiFetch(`${API_BASE}/payments/cashfree/verify/${orderId}`, { method: "POST", body: JSON.stringify({ order }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to verify Cashfree payment");
  return json;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  const res = await apiFetch(`${API_BASE}/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
  if (!res.ok) throw new Error("Failed to update order status");
  return res.json();
}

export async function updateOrderDelivery(id: string, delivery: Partial<DeliveryDetails>): Promise<Order> {
  const res = await apiFetch(`${API_BASE}/orders/${id}/delivery`, { method: "PATCH", body: JSON.stringify(delivery) });
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
  return deliveryRequest<Order>("pick", { method: "POST", body: JSON.stringify({ orderId, ...input }) });
}

export async function verifyDeliveryPickup(orderId: string, pickupPin: string): Promise<Order> {
  return deliveryRequest<Order>("pickup-verify", { method: "POST", body: JSON.stringify({ orderId, pickupPin }) });
}

export async function completeDeliveryOrder(
  orderId: string,
  deliveryOtp: string,
  input: Partial<DeliveryDetails> & { currentLocation?: DeliveryLocation } = {},
): Promise<Order> {
  return deliveryRequest<Order>("deliver", { method: "POST", body: JSON.stringify({ orderId, deliveryOtp, ...input }) });
}

export async function updateDeliveryLocation(
  orderId: string,
  input: Partial<DeliveryDetails> & { currentLocation: DeliveryLocation },
): Promise<Order> {
  return deliveryRequest<Order>("location", { method: "PUT", body: JSON.stringify({ orderId, ...input }) });
}

export async function updateDeliveryPortalStatus(
  orderId: string,
  input: Pick<DeliveryDetails, "deliveryStage" | "delayReason" | "etaMinutes">,
): Promise<Order> {
  return deliveryRequest<Order>("status", { method: "POST", body: JSON.stringify({ orderId, ...input }) });
}

export async function updateOrderKds(
  id: string,
  input: { status?: OrderStatus; metadata?: Partial<DeliveryDetails> }
): Promise<Order> {
  const res = await apiFetch(`${API_BASE}/orders/${id}/kds`, { method: "PATCH", body: JSON.stringify(input) });
  if (!res.ok) throw new Error("Failed to update KDS order");
  return res.json();
}

export async function bulkUpdateOrderKds(
  ids: string[],
  input: { status?: OrderStatus; metadata?: Partial<DeliveryDetails> }
): Promise<{ updated: Order[] }> {
  const res = await apiFetch(`${API_BASE}/orders/bulk-status`, { method: "POST", body: JSON.stringify({ ids, ...input }) });
  if (!res.ok) throw new Error("Failed to bulk update KDS orders");
  return res.json();
}

/* ---------------- Auth Staff API (Admin only) ---------------- */
export interface StaffUser { id: string; name: string; phone: string; role: string; createdAt: string; }

export async function listStaff(): Promise<StaffUser[]> {
  const res = await apiFetch(`${API_BASE}/auth/staff`);
  if (!res.ok) throw new Error("Failed to fetch staff");
  return res.json();
}

export async function registerStaff(data: { name: string; phone: string; password: string; role: 'KITCHEN' | 'DELIVERY' }): Promise<StaffUser> {
  const res = await apiFetch(`${API_BASE}/auth/register-staff`, { method: "POST", body: JSON.stringify(data) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to register staff");
  return json.user;
}

export async function deleteStaff(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/auth/staff/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete staff");
}

/* ---------------- Pricing ---------------- */
export function computeTotals(items: OrderItem[], type: OrderType) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = Math.round(subtotal * 0.05);
  const deliveryFee = type === "delivery" && subtotal > 0 ? (subtotal >= 500 ? 0 : 40) : 0;
  const total = subtotal + tax + deliveryFee;
  return { subtotal, tax, deliveryFee, total };
}
