// =============================================================
// JK INFOTECH ERP — UI Store (Native Windows version)
// File : src/store/uiStore.ts
// =============================================================

import { create } from "zustand";

interface UIState {
  isSidebarCollapsed: boolean;
  isDarkMode: boolean;
  isGeneratingPDF: boolean;
  activeScreen: string; // Native navigation helper: 'DASHBOARD' | 'SALES' | 'PURCHASE' | 'INVENTORY' | 'BANK_CASH' | 'REPORTS'
  isCreatingInvoice: boolean;
  isPrintPreviewOpen: boolean;
  isFullScreenOpen: boolean;
  globalLoadingMessage: string | null;
  globalLoadingSubtext: string | null;
  activeDatePicker: { value: string; onChange: (v: string) => void; title: string } | null;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleTheme: () => void;
  setIsGeneratingPDF: (generating: boolean) => void;
  setActiveScreen: (screen: string) => void;
  setIsCreatingInvoice: (val: boolean) => void;
  setIsPrintPreviewOpen: (val: boolean) => void;
  setIsFullScreenOpen: (val: boolean) => void;
  setGlobalLoading: (message: string | null, subtext?: string | null) => void;
  setActiveDatePicker: (val: { value: string; onChange: (v: string) => void; title: string } | null) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  isSidebarCollapsed: false,
  isDarkMode: true, // Default to premium dark mode
  isGeneratingPDF: false,
  activeScreen: "DASHBOARD",
  isCreatingInvoice: false,
  isPrintPreviewOpen: false,
  isFullScreenOpen: false,
  globalLoadingMessage: null,
  globalLoadingSubtext: null,
  activeDatePicker: null,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
  setIsGeneratingPDF: (generating) => set({ isGeneratingPDF: generating }),
  setActiveScreen: (screen) => set({ activeScreen: screen }),
  toggleTheme: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
  setIsCreatingInvoice: (val) => set({ isCreatingInvoice: val }),
  setIsPrintPreviewOpen: (val) => set({ isPrintPreviewOpen: val }),
  setIsFullScreenOpen: (val) => set({ isFullScreenOpen: val }),
  setGlobalLoading: (message, subtext = null) => set({ globalLoadingMessage: message, globalLoadingSubtext: subtext }),
  setActiveDatePicker: (val) => set({ activeDatePicker: val }),
}));
