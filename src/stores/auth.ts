import { create } from "zustand";

export type UserRole = "USER" | "ADMIN" | "KITCHEN" | "DELIVERY" | "WAITER";

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  ready: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
  isAuthenticated: () => boolean;
  hasRole: (...roles: UserRole[]) => boolean;
}

export const useAuth = create<AuthState>()((set, get) => ({
  token: null,
  user: null,
  ready: false,
  login: (token, user) => set({ token, user: { ...user, role: normalizeRole(user.role) } }),
  logout: () => {
    // Best-effort server-side cookie clear (token is HttpOnly; JS cannot clear it directly).
    if (typeof window !== "undefined") {
      void fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: SUPABASE_PUBLISHABLE_KEY ? { apikey: SUPABASE_PUBLISHABLE_KEY } : undefined,
      }).catch(() => undefined);
    }
    set({ token: null, user: null });
  },
  // Restores the session from the HttpOnly cookie on app boot.
  hydrate: async () => {
    try {
      if (typeof window === "undefined") {
        set({ ready: true });
        return;
      }
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: "GET",
        credentials: "include",
        headers: SUPABASE_PUBLISHABLE_KEY ? { apikey: SUPABASE_PUBLISHABLE_KEY } : undefined,
      });
      if (res.ok) {
        const data = (await res.json()) as AuthUser;
        set({
          token: null,
          user: { id: data.id, name: data.name, phone: data.phone, role: normalizeRole(data.role) },
        });
      }
    } catch {
      // No valid session; stay logged out.
    } finally {
      set({ ready: true });
    }
  },
  isAuthenticated: () => !!get().user,
  hasRole: (...roles) => {
    const user = get().user;
    if (!user) return false;
    return roles.includes(normalizeRole(user.role));
  },
}));

function normalizeRole(role: string): UserRole {
  const normalized = role.trim().toUpperCase();
  if (normalized === "ADMIN") return "ADMIN";
  if (normalized === "KITCHEN") return "KITCHEN";
  if (normalized === "DELIVERY") return "DELIVERY";
  if (normalized === "WAITER") return "WAITER";
  return "USER";
}
