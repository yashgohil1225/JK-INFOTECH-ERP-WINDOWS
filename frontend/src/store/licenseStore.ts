// =============================================================
// JK INFOTECH ERP — License Store
// File : src/store/licenseStore.ts
// =============================================================

import { create } from "zustand";
import { licenseApi, type LicenseStatus } from "../api/license";

interface LicenseState {
  isFrozen: boolean;
  freezeReason: string;
  hwid: string;
  expiresAt: string | null;
  checking: boolean;
  activating: boolean;
  error: string | null;

  checkLicenseStatus: () => Promise<LicenseStatus>;
  activateLicense: (key: string, durationMonths?: string) => Promise<boolean>;
  clearError: () => void;
}

export const useLicenseStore = create<LicenseState>((set) => ({
  isFrozen: false,
  freezeReason: "",
  hwid: "",
  expiresAt: null,
  checking: false,
  activating: false,
  error: null,

  checkLicenseStatus: async () => {
    set({ checking: true, error: null });
    try {
      const status = await licenseApi.getStatus();
      set({
        isFrozen: status.frozen,
        freezeReason: status.reason || "",
        hwid: status.hwid || "",
        expiresAt: status.expires_at,
        checking: false,
      });
      return status;
    } catch (err: any) {
      console.warn("Failed to check license status:", err);
      set({ checking: false });
      throw err;
    }
  },

  activateLicense: async (key: string, durationMonths?: string) => {
    set({ activating: true, error: null });
    try {
      const res = await licenseApi.activate(key, durationMonths);
      if (res.success) {
        // Re-check status on success
        const status = await licenseApi.getStatus();
        set({
          isFrozen: status.frozen,
          freezeReason: status.reason || "",
          hwid: status.hwid || "",
          expiresAt: status.expires_at,
          activating: false,
          error: null,
        });
        return true;
      }
      set({ activating: false, error: res.message || "Activation failed." });
      return false;
    } catch (err: any) {
      const message = err.response?.data?.detail || "Activation failed. Please check the license key.";
      set({ activating: false, error: message });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
