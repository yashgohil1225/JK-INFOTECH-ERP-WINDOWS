// =============================================================
// JK INFOTECH ERP — UI Store (Native Windows version)
// File : src/store/uiStore.ts
// =============================================================

import { create } from "zustand";
import { storage } from "../utils/storage";

export type ThemeMode = "dark" | "light" | "system";

interface UIState {
  isSidebarCollapsed: boolean;
  themeMode: ThemeMode;
  isDarkMode: boolean;
  isGeneratingPDF: boolean;
  activeScreen: string;
  isCreatingInvoice: boolean;
  isPrintPreviewOpen: boolean;
  fullScreenModalCount: number;
  isFullScreenOpen: boolean;
  isGlobalSearchOpen: boolean;
  globalLoadingMessage: string | null;
  globalLoadingSubtext: string | null;
  activeDatePicker: { value: string; onChange: (v: string) => void; title: string } | null;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setThemeMode: (mode: ThemeMode, systemColorScheme?: "dark" | "light" | null) => void;
  updateSystemTheme: (systemColorScheme: "dark" | "light" | null) => void;
  toggleTheme: () => void;
  setIsGeneratingPDF: (generating: boolean) => void;
  setActiveScreen: (screen: string) => void;
  setIsCreatingInvoice: (val: boolean) => void;
  setIsPrintPreviewOpen: (val: boolean) => void;
  setIsFullScreenOpen: (val: boolean) => void;
  setGlobalSearchOpen: (open: boolean) => void;
  setGlobalLoading: (message: string | null, subtext?: string | null) => void;
  setActiveDatePicker: (val: { value: string; onChange: (v: string) => void; title: string } | null) => void;
}

function computeIsDarkMode(mode: ThemeMode, sysScheme?: "dark" | "light" | null): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  if (sysScheme) return sysScheme === "dark";
  return true;
}

const savedThemeMode = (storage.getItemSync("jk_theme_mode") as ThemeMode) || "system";

export const useUIStore = create<UIState>()((set, get) => ({
  isSidebarCollapsed: false,
  themeMode: savedThemeMode,
  isDarkMode: computeIsDarkMode(savedThemeMode),
  isGeneratingPDF: false,
  activeScreen: "DASHBOARD",
  isCreatingInvoice: false,
  isPrintPreviewOpen: false,
  fullScreenModalCount: 0,
  isFullScreenOpen: false,
  isGlobalSearchOpen: false,
  globalLoadingMessage: null,
  globalLoadingSubtext: null,
  activeDatePicker: null,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
  setGlobalSearchOpen: (open) => set({ isGlobalSearchOpen: open }),
  setIsGeneratingPDF: (generating) => set({ isGeneratingPDF: generating }),
  setActiveScreen: (screen) => set({ activeScreen: screen }),
  setThemeMode: (mode, sysScheme) => {
    storage.setItem("jk_theme_mode", mode).catch(() => {});
    set({
      themeMode: mode,
      isDarkMode: computeIsDarkMode(mode, sysScheme)
    });
  },
  updateSystemTheme: (sysScheme) => {
    if (get().themeMode === "system") {
      set({ isDarkMode: computeIsDarkMode("system", sysScheme) });
    }
  },
  toggleTheme: () => {
    const nextMode = get().isDarkMode ? "light" : "dark";
    storage.setItem("jk_theme_mode", nextMode).catch(() => {});
    set({
      themeMode: nextMode,
      isDarkMode: !get().isDarkMode
    });
  },
  setIsCreatingInvoice: (val) => set({ isCreatingInvoice: val }),
  setIsPrintPreviewOpen: (val) => set({ isPrintPreviewOpen: val }),
  setIsFullScreenOpen: (val) => set((state) => {
    const newCount = val ? state.fullScreenModalCount + 1 : Math.max(0, state.fullScreenModalCount - 1);
    return {
      fullScreenModalCount: newCount,
      isFullScreenOpen: newCount > 0
    };
  }),
  setGlobalLoading: (message, subtext = null) => set({ globalLoadingMessage: message, globalLoadingSubtext: subtext }),
  setActiveDatePicker: (val) => set({ activeDatePicker: val }),
}));
