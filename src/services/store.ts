/**
 * Store config + customer/coupon mock service.
 * Persisted in localStorage. Replace with API calls later.
 */

const LS_STORE = "ankapurdhaba:store";
const LS_COUPONS = "ankapurdhaba:coupons";
const LS_CUSTOMER_META = "ankapurdhaba:customer-meta";
const LS_CURRENT_USER = "ankapurdhaba:current-user";

export type StoreStatus = "online" | "offline" | "busy";

export interface StoreConfig {
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  zoneRadiusKm: number;
  status: StoreStatus;
  statusMessage: string;
  openTime: string; // "10:00"
  closeTime: string; // "23:00"
}

const DEFAULT_STORE: StoreConfig = {
  name: "Ankapur Dhaba",
  phone: "+91 9963218601",
  address: "The Ankapure Dhaba, Maisamguda, Telangana 500043",
  lat: 17.5628346,
  lng: 78.4534861,
  zoneRadiusKm: 8,
  status: "online",
  statusMessage: "",
  openTime: "10:00",
  closeTime: "23:00",
};

export type CustomerTier = "bronze" | "silver" | "gold" | "platinum";

export interface CustomerMeta {
  phone: string;
  tier: CustomerTier;
  notes?: string;
  updatedAt: string;
}

export interface Coupon {
  code: string;
  discountPercent: number;
  maxDiscount?: number;
  minOrder?: number;
  assignedTo?: string; // phone, or undefined = public
  minTier?: CustomerTier;
  expiresAt?: string;
  usageLimit?: number;
  usedCount: number;
  active: boolean;
  createdAt: string;
}

/* ---------- Store config ---------- */

export function getStore(): StoreConfig {
  if (typeof window === "undefined") return DEFAULT_STORE;
  const raw = localStorage.getItem(LS_STORE);
  if (!raw) {
    localStorage.setItem(LS_STORE, JSON.stringify(DEFAULT_STORE));
    return DEFAULT_STORE;
  }
  try {
    return { ...DEFAULT_STORE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STORE;
  }
}

export function saveStore(patch: Partial<StoreConfig>): StoreConfig {
  const next = { ...getStore(), ...patch };
  localStorage.setItem(LS_STORE, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("ankapurdhaba:store-changed"));
  return next;
}

export function subscribeStore(cb: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => cb();
  const storage = (e: StorageEvent) => {
    if (e.key === LS_STORE) cb();
  };
  window.addEventListener("ankapurdhaba:store-changed", handler);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener("ankapurdhaba:store-changed", handler);
    window.removeEventListener("storage", storage);
  };
}

/* ---------- Geo ---------- */

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isWithinZone(point: { lat: number; lng: number } | undefined, store = getStore()) {
  if (!point) return true; // unknown coordinates → don't block
  return haversineKm({ lat: store.lat, lng: store.lng }, point) <= store.zoneRadiusKm;
}

/* ---------- Coupons ---------- */

const DEFAULT_COUPONS: Coupon[] = [
  {
    code: "WELCOME10",
    discountPercent: 10,
    maxDiscount: 100,
    minOrder: 199,
    usedCount: 0,
    active: true,
    createdAt: new Date().toISOString(),
  },
];

export function listCoupons(): Coupon[] {
  if (typeof window === "undefined") return DEFAULT_COUPONS;
  const raw = localStorage.getItem(LS_COUPONS);
  if (!raw) {
    localStorage.setItem(LS_COUPONS, JSON.stringify(DEFAULT_COUPONS));
    return DEFAULT_COUPONS;
  }
  try {
    return JSON.parse(raw) as Coupon[];
  } catch {
    return DEFAULT_COUPONS;
  }
}

function saveCoupons(items: Coupon[]) {
  localStorage.setItem(LS_COUPONS, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("ankapurdhaba:coupons-changed"));
}

export function upsertCoupon(coupon: Coupon) {
  const items = listCoupons();
  const idx = items.findIndex((c) => c.code === coupon.code);
  if (idx === -1) items.unshift(coupon);
  else items[idx] = coupon;
  saveCoupons(items);
  return coupon;
}

export function deleteCoupon(code: string) {
  saveCoupons(listCoupons().filter((c) => c.code !== code));
}

export function couponsFor(phone: string | undefined, tier: CustomerTier | undefined) {
  const tierRank: Record<CustomerTier, number> = { bronze: 0, silver: 1, gold: 2, platinum: 3 };
  return listCoupons().filter((c) => {
    if (!c.active) return false;
    if (c.expiresAt && new Date(c.expiresAt) < new Date()) return false;
    if (c.usageLimit && c.usedCount >= c.usageLimit) return false;
    if (c.assignedTo && c.assignedTo !== phone) return false;
    if (c.minTier && (!tier || tierRank[tier] < tierRank[c.minTier])) return false;
    return true;
  });
}

/* ---------- Customer meta (tiers/notes) ---------- */

export function listCustomerMeta(): Record<string, CustomerMeta> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LS_CUSTOMER_META) ?? "{}");
  } catch {
    return {};
  }
}

export function setCustomerMeta(phone: string, patch: Partial<CustomerMeta>) {
  const all = listCustomerMeta();
  const existing = all[phone] ?? { phone, tier: "bronze" as CustomerTier, updatedAt: new Date().toISOString() };
  all[phone] = { ...existing, ...patch, phone, updatedAt: new Date().toISOString() };
  localStorage.setItem(LS_CUSTOMER_META, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent("ankapurdhaba:customers-changed"));
  return all[phone];
}

export function computeTierFromOrders(totalSpend: number, orderCount: number): CustomerTier {
  if (totalSpend >= 10000 || orderCount >= 25) return "platinum";
  if (totalSpend >= 5000 || orderCount >= 12) return "gold";
  if (totalSpend >= 1500 || orderCount >= 4) return "silver";
  return "bronze";
}

/* ---------- Current user (simple phone-based login) ---------- */

export interface CurrentUser {
  phone: string;
  name: string;
}

export function getCurrentUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_CURRENT_USER);
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: CurrentUser | null) {
  if (user) localStorage.setItem(LS_CURRENT_USER, JSON.stringify(user));
  else localStorage.removeItem(LS_CURRENT_USER);
  window.dispatchEvent(new CustomEvent("ankapurdhaba:user-changed"));
}

export function subscribeUser(cb: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => cb();
  window.addEventListener("ankapurdhaba:user-changed", handler);
  return () => window.removeEventListener("ankapurdhaba:user-changed", handler);
}
