// =============================================================
// JK INFOTECH ERP — Fiscal Years API
// File : src/api/fiscalYears.ts
// =============================================================

import apiClient from "./client";

export interface FiscalYear {
  id: string;
  company_id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  closed_at: string | null;
  closing_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FiscalYearCreate {
  label: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
}

export interface AuditCheckResult {
  label: string;
  status: "SUCCESS" | "WARNING" | "ERROR";
  description: string;
}

export interface PreClosingAuditResponse {
  results: AuditCheckResult[];
  can_proceed: boolean;
}

export interface ClosingBalancesResponse {
  net_profit: number;
  liquid_assets: number;
  accounts_receivable: number;
}

export interface SequenceCalibrationResponse {
  document_type: string;
  current_pattern: string;
  proposed_pattern: string;
}

export const fiscalYearsApi = {
  getFiscalYears: async (): Promise<FiscalYear[]> => {
    const response = await apiClient.get<FiscalYear[]>("/api/companies/fiscal-years");
    return response.data;
  },

  createFiscalYear: async (data: FiscalYearCreate): Promise<FiscalYear> => {
    const response = await apiClient.post<FiscalYear>("/api/companies/fiscal-years", data);
    return response.data;
  },

  setCurrentFiscalYear: async (fyId: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/api/companies/fiscal-years/${fyId}/set-current`
    );
    return response.data;
  },

  closeFiscalYear: async (fyId: string, notes: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/api/companies/fiscal-years/${fyId}/close`,
      { closing_notes: notes }
    );
    return response.data;
  },

  getPreClosingAudit: async (): Promise<PreClosingAuditResponse> => {
    const response = await apiClient.get<PreClosingAuditResponse>("/api/audit/pre-closing");
    return response.data;
  },

  getClosingBalances: async (): Promise<ClosingBalancesResponse> => {
    const response = await apiClient.get<ClosingBalancesResponse>("/api/audit/closing-balances");
    return response.data;
  },

  getSequenceCalibration: async (fyId?: string): Promise<SequenceCalibrationResponse[]> => {
    const response = await apiClient.get<SequenceCalibrationResponse[]>("/api/audit/sequence-calibration", {
      params: { fy_id: fyId }
    });
    return response.data;
  },
};
