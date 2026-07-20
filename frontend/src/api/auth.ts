// =============================================================
// JK INFOTECH ERP — Auth API
// File : src/api/auth.ts
// =============================================================

import apiClient from "./client";

export interface LoginRequest {
  login_id: string;
  password?: string;
  pin?: string;
  otp?: string;
  remember_me?: boolean;
}

export interface RegisterRequest {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface User {
  id: string;
  company_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_superadmin: boolean;
  has_pin: boolean;
  pin_login_enabled: boolean;
  last_login: string | null;
  created_at: string;
}

export interface Company {
  default_gst_rate: any;
  bank_branch: string;
  pincode: string;
  office_address_4: string;
  office_address_3: string;
  office_address_2: string;
  office_address_1: string;
  mobile_no: string;
  tan_no: string;
  pan_number: string;
  version: string;
  id: string;
  name: string;
  gst_number?: string;
  address?: string;
  state?: string;
  industry_type?: string;
  currency: string;
  timezone: string;
  logo_url?: string;
  email?: string;
  phone?: string;
  bank_name?: string;
  account_no?: string;
  ifsc_code?: string;
  default_tax_rate?: number;
  registered_state?: string;
  hsn_sac_type?: string;
  default_hsn_sac_code?: string;
  settings?: any;
  is_gst_applicable?: boolean;
  current_fy_id?: string;
}

export interface Tokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginResponse {
  user: User;
  company: Company;
  tokens: Tokens;
}

export interface RegisterResponse {
  message: string;
  user: User;
  company: Company;
  tokens: Tokens;
}

export interface MeResponse {
  user: User;
  company: Company;
}

export interface SetPinRequest {
  pin: string;
  current_password?: string;
}

export interface UnlockPinRequest {
  login_id: string;
  otp: string;
}

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>("/api/auth/login", data);
    return response.data;
  },

  localAutoLogin: async (): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>("/api/auth/local-auto-login");
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    const response = await apiClient.post<RegisterResponse>("/api/auth/register", data);
    return response.data;
  },

  me: async (): Promise<MeResponse> => {
    const response = await apiClient.get<MeResponse>("/api/auth/me");
    return response.data;
  },

  checkPin: async (login_id: string): Promise<{ has_pin: boolean }> => {
    const response = await apiClient.post<{ has_pin: boolean }>("/api/auth/check-pin", { login_id });
    return response.data;
  },

  logout: async (refresh_token: string): Promise<void> => {
    await apiClient.post("/api/auth/logout", { refresh_token });
  },

  refresh: async (refresh_token: string): Promise<Tokens> => {
    const response = await apiClient.post<Tokens>("/api/auth/refresh", { refresh_token });
    return response.data;
  },

  sendOtp: async (login_id: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>("/api/auth/send-otp", { login_id });
    return response.data;
  },

  changePassword: async (data: any) => {
    const response = await apiClient.post<{ message: string }>("/api/auth/change-password", data);
    return response.data;
  },

  getMyCompanies: async (): Promise<Company[]> => {
    const response = await apiClient.get<Company[]>("/api/auth/my-companies");
    return response.data;
  },

  switchCompany: async (company_id: string): Promise<Tokens> => {
    const response = await apiClient.post<Tokens>("/api/auth/switch-company", { company_id });
    return response.data;
  },

  setPin: async (data: SetPinRequest): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/api/auth/set-pin', data);
    return response.data;
  },

  verifyPin: async (pin: string, login_id?: string, refresh_token?: string): Promise<Tokens> => {
    const response = await apiClient.post<Tokens>('/api/auth/verify-pin', { pin, login_id, refresh_token });
    return response.data;
  },

  unlockPin: async (data: UnlockPinRequest): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/api/auth/unlock-pin', data);
    return response.data;
  },

  updateSecuritySettings: async (data: { pin_login_enabled: boolean }): Promise<User> => {
    const response = await apiClient.patch<User>('/api/auth/security-settings', data);
    return response.data;
  },

  updateCompanyProfile: async (data: Partial<Company>): Promise<Company> => {
    const response = await apiClient.put<Company>("/api/companies/me", data);
    return response.data;
  },

  createCompany: async (data: Partial<Company> & { name: string }): Promise<Company> => {
    const response = await apiClient.post<Company>("/api/companies", data);
    return response.data;
  },

  verifyGST: async (gstin: string): Promise<{ is_valid: boolean; gstin: string }> => {
    const response = await apiClient.get<{ is_valid: boolean; gstin: string }>("/api/companies/verify-gst", {
      params: { gstin }
    });
    return response.data;
  },
};
