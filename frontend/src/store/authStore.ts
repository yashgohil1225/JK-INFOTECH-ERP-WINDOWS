// =============================================================
// JK INFOTECH ERP — Auth Store (Native Windows version)
// File : src/store/authStore.ts
// =============================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, type User, type Company, type LoginRequest, type RegisterRequest } from "../api/auth";
import { type KPIs, type TrendPoint, type LiquidityItem } from "../api/analytics";
import apiClient from "../api/client";
import { storage } from "../utils/storage";

const TOKEN_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const REMEMBER_KEY = "jk_remember_me";

export function getAccessToken(): string | null {
  return storage.getItemSync(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return storage.getItemSync(REFRESH_KEY);
}

async function setTokens(accessToken: string, refreshToken: string, rememberMe: boolean): Promise<void> {
  await storage.setItem(REMEMBER_KEY, rememberMe ? "true" : "false");
  await storage.setItem(TOKEN_KEY, accessToken);
  await storage.setItem(REFRESH_KEY, refreshToken);
}

async function clearTokens(): Promise<void> {
  await storage.removeItem(TOKEN_KEY);
  await storage.removeItem(REFRESH_KEY);
  await storage.removeItem(REMEMBER_KEY);
}

interface AuthState {
  user:       User    | null;
  company:    Company | null;
  availableCompanies: Company[];
  dashboardData: {
    kpis: KPIs | null;
    trend: TrendPoint[];
    liquidity: LiquidityItem[];
  } | null;
  rememberMe: boolean;
  loginAt:    string  | null;
  isLoggedIn: boolean;
  isLoading:  boolean;
  isSwitching: boolean;
  isAuthenticating: boolean;
  isHydrated: boolean;
  isLocked: boolean;
  sessionVerified: boolean;
  lockMode: 'pin' | 'otp';
  isOtpSent: boolean;
  error:      string  | null;

  // Actions
  login:   (data: LoginRequest) => Promise<void>;
  localAutoLogin: () => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout:  () => Promise<void>;
  loadMe:  () => Promise<void>;
  clearError: () => void;
  sendOtp: (login_id: string) => Promise<void>;
  switchActiveCompany: (company_id: string) => Promise<void>;
  loadAvailableCompanies: () => Promise<void>;
  deleteCompany: (company_id: string) => Promise<void>;
  setCompany: (company: Company) => void;
  setLocked: (locked: boolean) => void;
  setLockMode: (mode: 'pin' | 'otp') => void;
  setIsOtpSent: (sent: boolean) => void;
  verifyPin: (pin: string) => Promise<void>;
  unlockPin: (login_id: string, otp: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:       null,
      company:    null,
      availableCompanies: [],
      dashboardData: null,
      rememberMe: false,
      loginAt:    null,
      isLoggedIn: false,
      isLoading:  false,
      isAuthenticating: false,
      isHydrated: false,
      isSwitching: false,
      isLocked: false,
      sessionVerified: false,
      lockMode: 'pin',
      isOtpSent: false,
      error:      null,

      // —— Login —————————————————————————————————————————————————
      login: async (data: LoginRequest) => {
        set({ isAuthenticating: true, isLoading: true, error: null });
        
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Authentication timed out")), 35000)
        );

        try {
          const result = await Promise.race([
            (async () => {
              const response = await authApi.login(data);
              const shouldRemember = data.remember_me ?? false;
              await setTokens(response.tokens.access_token, response.tokens.refresh_token, shouldRemember);
              apiClient.defaults.headers.common["Authorization"] = `Bearer ${response.tokens.access_token}`;

              const cos = await authApi.getMyCompanies().catch(() => [] as any[]);
              return { response, cos };
            })(),
            timeout,
          ]);

          await new Promise(resolve => setTimeout(resolve, 800));
          
          const login_id = result.response.user.email || result.response.user.phone;
          if (login_id) {
            await storage.setItem("jk_user_identity_hint", login_id);
          }

          set({ 
            user:       result.response.user,
            company:    result.response.company,
            availableCompanies: result.cos,
            dashboardData: null,
            rememberMe: data.remember_me ?? false,
            loginAt:    new Date().toISOString(),
            isLoading:  false,
            isAuthenticating: false, 
            isLoggedIn: true,
            isLocked: false,
            sessionVerified: true
          });
        } catch (err: any) {
          let message = "Login failed. Please check your credentials.";
          if (err.message === "Authentication timed out") {
            message = "Server is taking too long to respond. Please try again.";
          } else if (err.response?.data?.detail) {
            const detail = err.response.data.detail;
            if (typeof detail === "string") {
              message = detail;
            } else if (Array.isArray(detail)) {
              message = detail[0].msg || message;
            } else if (typeof detail === "object" && detail.msg) {
              message = detail.msg;
            }
          }
          
          set({ isLoading: false, isAuthenticating: false, error: message, isLoggedIn: false });
          throw err;
        }
      },

      localAutoLogin: async () => {
        set({ isAuthenticating: true, isLoading: true, error: null });
        try {
          const response = await authApi.localAutoLogin();
          await setTokens(response.tokens.access_token, response.tokens.refresh_token, true);
          apiClient.defaults.headers.common["Authorization"] = `Bearer ${response.tokens.access_token}`;

          const cos = await authApi.getMyCompanies().catch(() => [] as Company[]);

          const userPinEnabled = !!response.user.pin_login_enabled;
          const sessionVerified = get().sessionVerified;
          const shouldLock = userPinEnabled && !sessionVerified;

          set({
            user: response.user,
            company: response.company,
            availableCompanies: cos,
            dashboardData: null,
            rememberMe: true,
            loginAt: new Date().toISOString(),
            isLoading: false,
            isAuthenticating: false,
            isLoggedIn: true,
            isLocked: shouldLock,
            sessionVerified: sessionVerified && !shouldLock
          });
        } catch (err: any) {
          console.warn("[authStore] localAutoLogin failed:", err);
          set({ isLoading: false, isAuthenticating: false, error: err.message, isLoggedIn: false });
        }
      },

      // —— Register ——————————————————————————————————————————————
      register: async (data: RegisterRequest) => {
        set({ isAuthenticating: true, isLoading: true, error: null });
        
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Registration timed out")), 35000)
        );

        try {
          const result = await Promise.race([
            (async () => {
              const response = await authApi.register(data);
              await setTokens(response.tokens.access_token, response.tokens.refresh_token, true);
              apiClient.defaults.headers.common["Authorization"] = `Bearer ${response.tokens.access_token}`;

              const cos = await authApi.getMyCompanies().catch(() => [] as any[]);
              return { response, cos };
            })(),
            timeout,
          ]);

          await new Promise(resolve => setTimeout(resolve, 800));
          const autoCompany = result.cos.length > 0 ? result.cos[0] : null;

          set({ 
             user:       result.response.user,
             company:    autoCompany,
             availableCompanies: result.cos,
             dashboardData: null,
             rememberMe: true,
             loginAt:    new Date().toISOString(),
             isLoading:  false,
             isAuthenticating: false, 
             isLoggedIn: true,
             isLocked: false,
             sessionVerified: true
          });
        } catch (err: any) {
          let message = "Registration failed. Please check your details.";
          if (err.message === "Registration timed out") {
            message = "Server is taking too long to respond. Please try again.";
          } else if (err.response?.data?.detail) {
             const detail = err.response.data.detail;
             if (typeof detail === "string") {
                 message = detail;
             } else if (Array.isArray(detail)) {
                 message = detail[0].msg || message;
             } else if (typeof detail === "object" && detail.msg) {
                 message = detail.msg;
             }
          }

          set({ isLoading: false, isAuthenticating: false, error: message, isLoggedIn: false });
          throw err;
        }
      },

      // —— Logout ————————————————————————————————————————————————
      logout: async () => {
        try {
          const refreshToken = getRefreshToken();
          if (refreshToken) {
            await authApi.logout(refreshToken);
          }
        } catch {
          // Sync logout
        }
        await clearTokens();
        set({
          user:       null,
          company:    null,
          availableCompanies: [],
          rememberMe: false,
          loginAt:    null,
          isLoggedIn: false,
          error:      null,
          isLocked:   false,
          isOtpSent:  false,
          lockMode:   'pin',
          sessionVerified: false
        });
        await storage.removeItem("jk-erp-auth");
        await storage.removeItem("jk_user_identity_hint");
      },

      // —— Load current user from /me ————————————————————————————
      loadMe: async () => {
        set({ isLoading: true });
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Session restore timeout")), 35000)
        );

        try {
          const result = await Promise.race([
            (async () => {
              const response = await authApi.me();
              const cos = await authApi.getMyCompanies().catch((err) => {
                console.warn("[loadMe] getMyCompanies failed:", err);
                return [] as any[];
              });
              return { response, cos };
            })(),
            timeout,
          ]);

          const currentCo = get().company;
          const updatedCo = result.cos.find((c: any) => c.id === currentCo?.id);
          set({
            user:       result.response.user,
            company:    updatedCo || (result.cos.length > 0 ? result.cos[0] : null),
            availableCompanies: result.cos,
            isLoggedIn: true,
            isLoading:  false,
            isLocked:   result.response.user.pin_login_enabled && !get().sessionVerified
          });

          const login_id = result.response.user.email || result.response.user.phone;
          if (login_id) {
            await storage.setItem("jk_user_identity_hint", login_id);
          }
        } catch (err: any) {
          console.warn("[loadMe] failed:", err);
          if (get().isLocked) {
            set({ isLoading: false, isLoggedIn: false });
            return;
          }

          await clearTokens();
          await storage.removeItem("jk-erp-auth");
          set({
            user:       null,
            company:    null,
            availableCompanies: [],
            rememberMe: false,
            isLoggedIn: false,
            isLoading:  false,
          });
        }
      },

      sendOtp: async (login_id: string) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.sendOtp(login_id);
          set({ isLoading: false, error: null });
        } catch (err: any) {
          const message = err.response?.data?.detail || "Failed to send OTP. Please try again.";
          set({ isLoading: false, error: message });
          throw err;
        }
      },

      clearError: () => set({ error: null }),

      loadAvailableCompanies: async () => {
        try {
          const companies = await authApi.getMyCompanies();
          set({ availableCompanies: companies });
          const currentCo = get().company;
          if (currentCo && !companies.some((c: any) => c.id === currentCo.id)) {
            set({ company: companies.length > 0 ? companies[0] : null });
          }
        } catch (error) {
          console.error("Failed to load available companies", error);
        }
      },

      switchActiveCompany: async (company_id: string) => {
        set({ isSwitching: true, error: null });
        try {
          const tokens = await authApi.switchCompany(company_id);
          const currentRemember = get().rememberMe || storage.getItemSync(REMEMBER_KEY) === "true";
          await setTokens(tokens.access_token, tokens.refresh_token, currentRemember);
          apiClient.defaults.headers.common["Authorization"] = `Bearer ${tokens.access_token}`;
          
          const meResult = await authApi.me();
          const cos = await authApi.getMyCompanies().catch(() => [] as any[]);

          set({
            company: meResult.company,
            user: meResult.user,
            availableCompanies: cos,
            isLocked: false,
            sessionVerified: true,
            isSwitching: false
          });
        } catch (error: any) {
          set({ isSwitching: false, error: error.response?.data?.detail || "Failed to switch company" });
          throw error;
        }
      },

      deleteCompany: async (company_id: string) => {
        try {
          await authApi.deleteCompany(company_id);
          const cos = await authApi.getMyCompanies().catch(() => []);
          const currentCo = get().company;
          const nextCo = currentCo?.id === company_id ? (cos.length > 0 ? cos[0] : null) : currentCo;
          set({
            company: nextCo,
            availableCompanies: cos
          });
        } catch (error: any) {
          console.error("Failed to delete company", error);
          throw error;
        }
      },

      setCompany: (company: Company) => set({ company }),

      setLocked: (locked: boolean) => {
        if (locked) {
          storage.removeItem("access_token").catch(() => {});
          delete apiClient.defaults.headers.common["Authorization"];
        }
        set({ 
          isLocked: locked,
          sessionVerified: !locked,
          lockMode: locked ? get().lockMode : 'pin',
          isOtpSent: locked ? get().isOtpSent : false
        });
      },

      setLockMode: (mode: 'pin' | 'otp') => set({ lockMode: mode }),
      setIsOtpSent: (sent: boolean) => set({ isOtpSent: sent }),

      verifyPin: async (pin: string) => {
        console.log("[AUTH-SEQ] verifyPin started");
        set({ isLoading: true, error: null });
        try {
          const user = get().user;
          const login_id = user?.email || user?.phone || storage.getItemSync("jk_user_identity_hint") || undefined;
          const refresh_token = getRefreshToken() || undefined;
          
          console.log(`[AUTH-SEQ] Calling verifyPin API... login_id=${login_id}, hasRefreshToken=${!!refresh_token}`);
          
          if (!login_id && !refresh_token) {
            console.warn("[AUTH-SEQ] No login_id or refresh_token available. Triggering local auto-login.");
            await clearTokens();
            await storage.removeItem("jk-erp-auth");
            set({
              user: null, company: null, availableCompanies: [],
              isLoggedIn: false, isLoading: false, isLocked: false,
              sessionVerified: false, error: "Session expired. Re-connecting..."
            });
            get().localAutoLogin().catch(() => {});
            return;
          }
          
          const tokens = await authApi.verifyPin(pin, login_id, refresh_token);
          const currentRemember = get().rememberMe || storage.getItemSync(REMEMBER_KEY) === "true";
          await setTokens(tokens.access_token, tokens.refresh_token, currentRemember);
          apiClient.defaults.headers.common["Authorization"] = `Bearer ${tokens.access_token}`;
          
          await get().loadMe();
          set({ isLocked: false, sessionVerified: true, isLoading: false });
        } catch (err: any) {
          console.warn("[AUTH-SEQ] verifyPin failed:", err);
          const status = err.response?.status;
          const detail = err.response?.data?.detail || "";
          
          const isSessionError = status === 500 || 
            detail.toLowerCase().includes("session") ||
            detail.toLowerCase().includes("expired") ||
            detail.toLowerCase().includes("refresh token") ||
            detail.toLowerCase().includes("internal server error") ||
            detail.toLowerCase().includes("protocol failure");
          
          if (isSessionError) {
            console.warn("[AUTH-SEQ] Session-level failure during PIN verify. Triggering local auto-login.");
            await clearTokens();
            await storage.removeItem("jk-erp-auth");
            set({
              user: null, company: null, availableCompanies: [],
              isLoggedIn: false, isLoading: false, isLocked: false,
              sessionVerified: false, error: "Session expired. Re-connecting..."
            });
            get().localAutoLogin().catch(() => {});
            return;
          }
          
          set({ error: detail || "PIN verification failed", isLoading: false });
          throw err;
        }
      },

      unlockPin: async (login_id: string, otp: string) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.unlockPin({ login_id, otp });
          set({ isLoading: false, isLocked: false, sessionVerified: true });
        } catch (err: any) {
          set({ error: err.response?.data?.detail || "Unlock failed", isLoading: false });
          throw err;
        }
      },
    }),
    {
      name: "jk-erp-auth",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user:       state.user,
        company:    state.company,
        rememberMe: state.rememberMe,
        loginAt:    state.loginAt,
        isLoggedIn: state.isLoggedIn,
        isLocked:   state.isLocked,
        lockMode:   state.lockMode,
        isOtpSent:  state.isOtpSent
      }),
    }
  )
);
