// =============================================================
// JK INFOTECH ERP — License API Client
// File : src/api/license.ts
// =============================================================

import apiClient from "./client";

export interface LicenseStatus {
  frozen: boolean;
  reason: string;
  hwid: string;
  active: boolean;
  expires_at: string | null;
}

export const licenseApi = {
  getStatus: async (): Promise<LicenseStatus> => {
    const response = await apiClient.get<LicenseStatus>("/api/license/status");
    return response.data;
  },

  activate: async (key: string, durationMonths?: string): Promise<{ message: string; success: boolean }> => {
    const response = await apiClient.post<{ message: string; success: boolean }>("/api/license/activate", {
      key,
      duration_months: durationMonths,
    });
    return response.data;
  },
};
