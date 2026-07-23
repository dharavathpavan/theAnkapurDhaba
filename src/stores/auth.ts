import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "USER" | "ADMIN" | "KITCHEN" | "DELIVERY" | "WAITER";

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  hasRole: (...roles: UserRole[]) => boolean;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      login: (token, user) => set({ token, user: { ...user, role: normalizeRole(user.role) } }),
      logout: () => set({ token: null, user: null }),
      isAuthenticated: () => !!get().token && !!get().user,
      hasRole: (...roles) => {
        const user = get().user;
        if (!user) return false;
        return roles.includes(normalizeRole(user.role));
      },
    }),
    { name: "ankapur:auth" },
  ),
);

function normalizeRole(role: string): UserRole {
  const normalized = role.trim().toUpperCase();
  if (normalized === "ADMIN") return "ADMIN";
  if (normalized === "KITCHEN") return "KITCHEN";
  if (normalized === "DELIVERY") return "DELIVERY";
  if (normalized === "WAITER") return "WAITER";
  return "USER";
}
