// =============================================================
// JK INFOTECH ERP — Axios API Client (Native Windows version)
// File : src/api/client.ts
// =============================================================

import axios from "axios";
import { storage } from "../utils/storage";
import { sanitizePayload } from "../utils/serialization";

// For native Windows App SDK, localhost works directly as it runs on the host machine.
const DEFAULT_API_URL = "http://localhost:8000";
const apiClient = axios.create({
  baseURL: DEFAULT_API_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.request.use((config) => {
  // Ensure all /api/... paths are rewritten to /api/v1/...
  if (config.url && config.url.startsWith("/api/") && !config.url.startsWith("/api/v1/")) {
    config.url = config.url.replace("/api/", "/api/v1/");
  }

  // Strip trailing slashes to prevent redirects
  if (config.url && config.url.endsWith("/")) {
    config.url = config.url.slice(0, -1);
  }

  // Sanitize payload variables for C++ backend compat
  if (config.data) {
    config.data = sanitizePayload(config.data);
  }

  const token = storage.getItemSync("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 451 Unavailable for Legal Reasons (System Frozen)
    if (error.response?.status === 451) {
      try {
        const { useLicenseStore } = require("../store/licenseStore");
        useLicenseStore.setState({
          isFrozen: true,
          freezeReason: error.response.data?.reason || "UNKNOWN",
        });
      } catch (err) {
        console.warn("Failed to set license store from API client:", err);
      }
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      const detail = error.response?.data?.detail;
      const isPinError = detail && typeof detail === 'string' && (
        detail.toLowerCase().includes("pin") || 
        detail.toLowerCase().includes("attempt") ||
        detail.toLowerCase().includes("authentication context") ||
        detail.toLowerCase().includes("invalid") ||
        detail.toLowerCase().includes("protocol failure") ||
        detail.includes("AUTH_CONTEXT_MISSING") ||
        detail.includes("INVALID_PIN") ||
        detail.includes("PIN_")
      );

      if (originalRequest.url.includes("/verify-pin") && isPinError) {
        return Promise.reject(error);
      }

      // If refresh request is failing, clean up and logout
      if (originalRequest.url.includes("/refresh")) {
        await storage.clear();
        // Native navigation reset or callback should handle redirect to login
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = storage.getItemSync("refresh_token");
        if (!storedRefreshToken) {
          throw { response: { status: 401 }, message: "No refresh token available" };
        }

        const { data } = await axios.post(
          `${apiClient.defaults.baseURL}/api/auth/refresh`,
          { refresh_token: storedRefreshToken }
        );

        await storage.setItem("access_token", data.access_token);
        await storage.setItem("refresh_token", data.refresh_token);

        apiClient.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`;
        processQueue(null, data.access_token);
        
        return apiClient(originalRequest);
      } catch (refreshError: any) {
        processQueue(refreshError, null);
        
        const isCredentialRejection = refreshError.response && (
          refreshError.response.status === 400 ||
          refreshError.response.status === 401 ||
          refreshError.response.status === 403
        );

        if (isCredentialRejection) {
          await storage.removeItem("access_token");
          await storage.removeItem("refresh_token");
          await storage.removeItem("jk_remember_me");
          await storage.removeItem("jk-erp-auth");
        }
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Auto-retry for timeout / network errors once
    if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
      const config = error.config;
      if (!config._retryCount) {
        config._retryCount = 1;
        console.warn(`[Network] Timeout, retrying request...`);
        return new Promise(resolve => setTimeout(() => resolve(apiClient(config)), 1000));
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
