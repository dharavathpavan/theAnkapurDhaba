import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AdminChromeState {
  navHidden: boolean;
  setNavHidden: (hidden: boolean) => void;
}

export const useAdminChrome = create<AdminChromeState>()(
  persist(
    (set) => ({
      navHidden: false,
      setNavHidden: (hidden) => set({ navHidden: hidden }),
    }),
    { name: "ankapur:admin-chrome" },
  ),
);
