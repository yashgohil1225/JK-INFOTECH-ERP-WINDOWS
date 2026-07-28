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
  licenseChecked: boolean;
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
  licenseChecked: false,
  activating: false,
  error: null,

  checkLicenseStatus: async (retries = 15) => {
    set({ checking: true, error: null });
    for (let i = 0; i < retries; i++) {
      try {
        const status = await licenseApi.getStatus();
        set({
          isFrozen: status.frozen,
          freezeReason: status.reason || "",
          hwid: status.hwid || "",
          expiresAt: status.expires_at,
          checking: false,
          licenseChecked: true,
        });
        return status;
      } catch (err: any) {
        const resData = err.response?.data;
        if (err.response?.status === 451 || resData?.reason) {
          set({
            isFrozen: true,
            freezeReason: resData?.reason || "SYSTEM_UNREGISTERED",
            checking: false,
            licenseChecked: true,
          });
          throw err;
        }
        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        } else {
          console.warn("Backend not yet responding during cold boot:", err);
          set({ checking: false, licenseChecked: true, isFrozen: false });
          return { frozen: false, hwid: "", reason: "", expires_at: null };
        }
      }
    }
    set({ checking: false, licenseChecked: true, isFrozen: false });
    return { frozen: false, hwid: "", reason: "", expires_at: null };
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
