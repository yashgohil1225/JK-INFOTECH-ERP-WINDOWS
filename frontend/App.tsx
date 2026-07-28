// =============================================================
// JK INFOTECH ERP — UWP / WinUI 3 Desktop App Root
// File : App.tsx
// =============================================================

import React, { useEffect, useState, useRef, useCallback } from "react";
import { StatusBar, StyleSheet, useColorScheme, View, Text, ActivityIndicator, Pressable, LogBox, DeviceEventEmitter, TextInput } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { storage } from "./src/utils/storage";
import { useAuthStore } from "./src/store/authStore";
import { useUIStore } from "./src/store/uiStore";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

LogBox.ignoreAllLogs();

if (typeof global !== "undefined" && (global as any).ErrorUtils) {
  (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    console.warn("Global Error Handler caught error without crash:", error);
  });
}


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,    // Keep data fresh for 5 minutes
      gcTime: 1000 * 60 * 30,       // Cache garbage collection after 30 minutes
      refetchOnWindowFocus: false,  // Prevents refetching when user switches focus to/from another window
      refetchOnReconnect: true,
    },
  },
});

const RNW_KEY_EVENTS = [
  { key: "F1", code: "F1", isHandledEvent: true }, { key: "F2", code: "F2", isHandledEvent: true },
  { key: "F3", code: "F3", isHandledEvent: true }, { key: "F4", code: "F4", isHandledEvent: true },
  { key: "F5", code: "F5", isHandledEvent: true }, { key: "F6", code: "F6", isHandledEvent: true },
  { key: "F7", code: "F7", isHandledEvent: true }, { key: "F8", code: "F8", isHandledEvent: true },
  { key: "F9", code: "F9", isHandledEvent: true }, { key: "F10", code: "F10", isHandledEvent: true },
  { key: "F11", code: "F11", isHandledEvent: true },
  { key: "f1", isHandledEvent: true }, { key: "f2", isHandledEvent: true },
  { key: "f3", isHandledEvent: true }, { key: "f4", isHandledEvent: true },
  { key: "f5", isHandledEvent: true }, { key: "f6", isHandledEvent: true },
  { key: "f7", isHandledEvent: true }, { key: "f8", isHandledEvent: true },
  { key: "f9", isHandledEvent: true }, { key: "f10", isHandledEvent: true },
  { key: "f11", isHandledEvent: true },
  { key: "Escape", code: "Escape", isHandledEvent: true }
];

// Screens and Layouts
import MainLayout from "./src/components/layout/MainLayout";
import AuthScreen from "./src/screens/AuthScreen";
import CompanySelectScreen from "./src/screens/CompanySelectScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import SalesScreen from "./src/screens/SalesScreen";
import SalesOrdersScreen from "./src/screens/SalesOrdersScreen";
import ReturnsScreen from "./src/screens/ReturnsScreen";
import InventoryScreen from "./src/screens/InventoryScreen";
import BankingScreen from "./src/screens/BankingScreen";
import PurchasesScreen from "./src/screens/PurchasesScreen";
import PartiesScreen from "./src/screens/PartiesScreen";
import ReportsScreen from "./src/screens/ReportsScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import { useLicenseStore } from "./src/store/licenseStore";
import LicenseScreen from "./src/screens/LicenseScreen";
import PinLockScreen from "./src/screens/PinLockScreen";
import { Modal } from "./src/components/ui/Modal";
import { UpdateModal } from "./src/components/ui/UpdateModal";

function AppContent() {
  const systemColorScheme = useColorScheme();
  const { isLoggedIn, isLocked, company, localAutoLogin, isAuthenticating } = useAuthStore();
  const { activeScreen, isDarkMode, isCreatingInvoice, updateSystemTheme, setThemeMode } = useUIStore();
  const { isFrozen, checkLicenseStatus, checking, licenseChecked } = useLicenseStore();

  const rootRef = useRef<any>(null);
  const keyInputRef = useRef<any>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Sync system color scheme when mode === "system"
  useEffect(() => {
    updateSystemTheme(systemColorScheme ?? null);
  }, [systemColorScheme]);

  // Preload saved theme on initial mount
  useEffect(() => {
    storage.preload(["jk_theme_mode", "jk-erp-auth", "access_token"]).then(() => {
      const savedTheme = storage.getItemSync("jk_theme_mode") as any;
      if (savedTheme) {
        setThemeMode(savedTheme, systemColorScheme ?? null);
      }
    });
  }, []);

  useEffect(() => {
    checkLicenseStatus().catch(() => {});
  }, []);

  // Only attempt auto-login AFTER license check has completed and system is NOT frozen
  useEffect(() => {
    let timer: any = null;

    const attemptAutoLogin = () => {
      const state = useAuthStore.getState();
      if (!isFrozen && licenseChecked && !state.isLoggedIn && !state.isAuthenticating) {
        localAutoLogin().catch((err) => {
          console.warn("Local auto login failed, retrying in 2.5s...", err);
        });
      }
    };

    if (licenseChecked && !isFrozen && !isLoggedIn) {
      attemptAutoLogin();
      timer = setInterval(attemptAutoLogin, 2500);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isFrozen, isLoggedIn, localAutoLogin, licenseChecked]);

  // Refocus keyInputRef on mount, login, screen change, or modal close
  useEffect(() => {
    if (isLoggedIn && !isCreatingInvoice && !isHelpOpen) {
      const timers = [50, 150, 300, 600, 1200, 2500].map(delay =>
        setTimeout(() => {
          try {
            keyInputRef.current?.focus();
            rootRef.current?.focus();
          } catch (e) {}
        }, delay)
      );
      return () => timers.forEach(t => clearTimeout(t));
    }
  }, [isLoggedIn, company, activeScreen, isCreatingInvoice, isHelpOpen]);

  // Window/Document-level keyboard event capture (for instant hotkey response on app launch before mouse click)
  useEffect(() => {
    const handleNativeWindowKeyDown = (e: any) => {
      if (!e) return;
      handleGlobalKeyDown({
        nativeEvent: {
          key: e.key,
          code: e.code,
          keyCode: e.keyCode,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          shiftKey: e.shiftKey,
        }
      });
    };

    const targetWin: any = typeof window !== "undefined" ? window : null;
    const targetDoc: any = typeof document !== "undefined" ? document : null;

    if (targetWin?.addEventListener) {
      targetWin.addEventListener("keydown", handleNativeWindowKeyDown, true);
    }
    if (targetDoc?.addEventListener) {
      targetDoc.addEventListener("keydown", handleNativeWindowKeyDown, true);
    }

    return () => {
      if (targetWin?.removeEventListener) {
        targetWin.removeEventListener("keydown", handleNativeWindowKeyDown, true);
      }
      if (targetDoc?.removeEventListener) {
        targetDoc.removeEventListener("removeEventListener", handleNativeWindowKeyDown, true);
      }
    };
  }, [handleGlobalKeyDown]);

  // Listen to showKeyboardHelp event
  useEffect(() => {
    const subHelp = DeviceEventEmitter.addListener("showKeyboardHelp", () => {
      setIsHelpOpen(true);
    });
    return () => subHelp.remove();
  }, []);

  const handleGlobalKeyDown = useCallback((e: any) => {
    if (!e) return;
    const ne = e.nativeEvent || e;
    const rawKey = ne.key || "";
    const code = ne.code || "";
    const keyCode = ne.keyCode || 0;
    const ctrlKey = !!ne.ctrlKey;
    const altKey = !!ne.altKey;
    const shiftKey = !!ne.shiftKey;

    const k = rawKey.toUpperCase();
    
    // Broadcast event to screen-local listeners
    DeviceEventEmitter.emit("globalKeyDown", { key: rawKey, code, keyCode, ctrlKey, altKey, shiftKey });

    const ui = useUIStore.getState();

    // Global dialog state manager handles Escape keys
    if (k === "ESCAPE" || k === "ESC" || rawKey === "Escape" || keyCode === 27) {
      if (ui.activeDatePicker) {
        ui.setActiveDatePicker(null);
        return;
      }
      if (ui.isPrintPreviewOpen) {
        ui.setIsPrintPreviewOpen(false);
        return;
      }
      if (ui.isCreatingInvoice) {
        ui.setIsCreatingInvoice(false);
        return;
      }
      if (ui.isFullScreenOpen) {
        ui.setIsFullScreenOpen(false);
        return;
      }
      if (isHelpOpen) {
        setIsHelpOpen(false);
        return;
      }
    }

    // If Create Invoice modal is open, protect inner modal keyboard flow from screen switching
    if (ui.isCreatingInvoice) {
      return;
    }

    // F2 handling with Shift / Ctrl modifiers
    if (k === "F2" || code === "F2" || keyCode === 113) {
      if (shiftKey) {
        ui.setActiveScreen("SALES_ORDERS");
      } else if (ctrlKey) {
        ui.setActiveScreen("RETURNS");
      } else {
        ui.setActiveScreen("SALES");
      }
      return;
    }

    // Ctrl / Alt hotkeys
    if (ctrlKey || altKey) {
      if (altKey && (k === "A" || rawKey === "a" || keyCode === 65)) {
        ui.setActiveScreen("SALES");
        ui.setIsCreatingInvoice(true);
      }
      if (altKey && (k === "C" || rawKey === "c" || keyCode === 67)) {
        useAuthStore.getState().setCompany(null as any);
      }
      if (altKey && (k === "L" || rawKey === "l" || keyCode === 76)) {
        useAuthStore.getState().setLocked(true);
      }
    } else {
      // Functional Keys by key string, code name, or VK keyCode
      if (k === "F1" || code === "F1" || keyCode === 112) {
        ui.setActiveScreen("DASHBOARD");
      } else if (k === "F3" || code === "F3" || keyCode === 114) {
        ui.setActiveScreen("PURCHASE");
      } else if (k === "F4" || code === "F4" || keyCode === 115) {
        ui.toggleSidebar();
      } else if (k === "F5" || code === "F5" || keyCode === 116) {
        DeviceEventEmitter.emit("refreshScreenData");
      } else if (k === "F6" || code === "F6" || keyCode === 117) {
        ui.setActiveScreen("REPORTS");
      } else if (k === "F7" || code === "F7" || keyCode === 118) {
        ui.setActiveScreen("INVENTORY");
      } else if (k === "F8" || code === "F8" || keyCode === 119) {
        if (shiftKey) {
          ui.setActiveScreen("VENDORS");
        } else {
          ui.setActiveScreen("CUSTOMERS");
        }
      } else if (k === "F9" || code === "F9" || keyCode === 120) {
        ui.setActiveScreen("BANK_CASH");
      } else if (k === "F10" || code === "F10" || keyCode === 121) {
        ui.setActiveScreen("SETTINGS");
      } else if (k === "F11" || code === "F11" || keyCode === 122) {
        setIsHelpOpen((prev) => !prev);
      }
    }
  }, [isHelpOpen]);

  const themeColors = isDarkMode
    ? { text: "#FFFFFF", bg: "transparent" } // Transparent allows Mica to show
    : { text: "#1A1A1A", bg: "transparent" };

  // Route to the appropriate screen
  const renderActiveScreen = () => {
    switch (activeScreen) {
      case "DASHBOARD":
        return <DashboardScreen />;
      case "SALES":
        return <SalesScreen />;
      case "SALES_ORDERS":
        return <SalesOrdersScreen />;
      case "RETURNS":
        return <ReturnsScreen />;
      case "PURCHASE":
        return <PurchasesScreen />;
      case "INVENTORY":
        return <InventoryScreen />;
      case "BANK_CASH":
        return <BankingScreen />;
      case "CUSTOMERS":
      case "VENDORS":
        return <PartiesScreen />;
      case "REPORTS":
        return <ReportsScreen />;
      case "SETTINGS":
        return <SettingsScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  if (checking) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: isDarkMode ? "#1A1A1A" : "#F3F3F3" }]}>
        <ActivityIndicator size="large" color={isDarkMode ? "#FFFFFF" : "#1A1A1A"} />
        <Text style={[styles.loaderText, { color: isDarkMode ? "#FFFFFF" : "#1A1A1A", marginTop: 12 }]}>
          Checking system license status...
        </Text>
      </View>
    );
  }

  if (isFrozen) {
    return (
      <View style={{ flex: 1 }}>
        <LicenseScreen />
      </View>
    );
  }

  if (!isLoggedIn) {
    const { error } = useAuthStore.getState();
    return (
      <View style={[styles.loaderContainer, { backgroundColor: isDarkMode ? "#1A1A1A" : "#F3F3F3" }]}>
        <ActivityIndicator size="large" color={isDarkMode ? "#FFFFFF" : "#1A1A1A"} />
        <Text style={[styles.loaderText, { color: isDarkMode ? "#FFFFFF" : "#1A1A1A", marginTop: 12 }]}>
          Connecting to local database...
        </Text>
        {error ? (
          <Text style={{ color: "#EF4444", marginTop: 10, fontSize: 13, fontWeight: "600", textAlign: "center", paddingHorizontal: 24 }}>
            {error}
          </Text>
        ) : null}
        <Pressable
          onPress={() => {
            localAutoLogin().catch(() => {});
          }}
          style={({ hovered }: any) => [
            { marginTop: 20, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: isDarkMode ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)" },
            hovered && { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }
          ]}
        >
          <Text style={{ color: isDarkMode ? "#FFFFFF" : "#1A1A1A", fontWeight: "700" }}>Retry Connection</Text>
        </Pressable>
      </View>
    );
  }

  const renderContentTree = () => {
    if (isLocked) {
      return <PinLockScreen />;
    }
    if (!company) {
      return <CompanySelectScreen />;
    }
    return <MainLayout>{renderActiveScreen()}</MainLayout>;
  };

  return (
    <View
      ref={rootRef}
      focusable={true}
      isTabStop={true}
      autoFocus={true}
      tabIndex={0}
      style={{ flex: 1 }}
      {...({
        keyDownEvents: RNW_KEY_EVENTS,
        onKeyDown: handleGlobalKeyDown
      } as any)}
    >
      <TextInput
        ref={keyInputRef}
        autoFocus={true}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0.01, zIndex: -1, top: 0, left: 0 }}
        showSoftInputOnFocus={false}
        onKeyPress={(e: any) => handleGlobalKeyDown(e)}
      />
      {renderContentTree()}

      {/* Cloud Auto-Update Checker Modal */}
      <UpdateModal checkOnMount={true} />

      {/* Global Keyboard Shortcuts Help Guide */}
      <Modal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title="Keyboard Shortcuts Guide"
        width={550}
      >
        <View style={styles.helpContainer}>
          <Text style={[styles.helpSubtitle, { color: isDarkMode ? "#94A3B8" : "#475569" }]}>
            Quick-reference keyboard hotkeys for JK INFOTECH ERP.
          </Text>
          
          <View style={styles.helpSection}>
            <Text style={[styles.helpSectionTitle, { color: isDarkMode ? "#60CDFF" : "#0078D4" }]}>
              DIALOG & MODAL CONTROLS
            </Text>
            <View style={styles.helpRow}>
              <Text style={[styles.helpKey, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDarkMode ? "#FFFFFF" : "#1C1C1C" }]}>Esc</Text>
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Close current active modal / popup / date picker</Text>
            </View>
            <View style={styles.helpRow}>
              <Text style={[styles.helpKey, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDarkMode ? "#FFFFFF" : "#1C1C1C" }]}>Ctrl + S</Text>
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Save form / submit current transaction</Text>
            </View>
            <View style={styles.helpRow}>
              <Text style={[styles.helpKey, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDarkMode ? "#FFFFFF" : "#1C1C1C" }]}>Ctrl + P</Text>
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Trigger save / print document (in PDF preview)</Text>
            </View>
          </View>

          <View style={styles.helpSection}>
            <Text style={[styles.helpSectionTitle, { color: isDarkMode ? "#60CDFF" : "#0078D4" }]}>
              NAVIGATION SHORTCUTS
            </Text>
            <View style={styles.helpRow}>
              <Text style={[styles.helpKey, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDarkMode ? "#FFFFFF" : "#1C1C1C" }]}>F1</Text>
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Go to Main Dashboard</Text>
            </View>
            <View style={styles.helpRow}>
              <Text style={[styles.helpKey, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDarkMode ? "#FFFFFF" : "#1C1C1C" }]}>F2</Text>
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Go to Invoices screen</Text>
            </View>
            <View style={styles.helpRow}>
              <Text style={[styles.helpKey, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDarkMode ? "#FFFFFF" : "#1C1C1C" }]}>Shift + F2</Text>
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Go to Sales Orders screen</Text>
            </View>
            <View style={styles.helpRow}>
              <Text style={[styles.helpKey, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDarkMode ? "#FFFFFF" : "#1C1C1C" }]}>Ctrl + F2</Text>
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Go to Returns screen</Text>
            </View>
            <View style={styles.helpRow}>
              <Text style={[styles.helpKey, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDarkMode ? "#FFFFFF" : "#1C1C1C" }]}>F3</Text>
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Go to Purchases screen</Text>
            </View>
            <View style={styles.helpRow}>
              <Text style={[styles.helpKey, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDarkMode ? "#FFFFFF" : "#1C1C1C" }]}>F4</Text>
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Toggle Sidebar (expand / collapse navigation)</Text>
            </View>
            <View style={styles.helpRow}>
              <Text style={[styles.helpKey, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDarkMode ? "#FFFFFF" : "#1C1C1C" }]}>F5</Text>
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Refresh current page data context</Text>
            </View>
            <View style={styles.helpRow}>
              <Text style={[styles.helpKey, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDarkMode ? "#FFFFFF" : "#1C1C1C" }]}>F6</Text>
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Go to Reports & Ledger Registers Hub</Text>
            </View>
            <View style={styles.helpRow}>
              <Text style={[styles.helpKey, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDarkMode ? "#FFFFFF" : "#1C1C1C" }]}>F7</Text>
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Go to Inventory & Stock Register</Text>
            </View>
            <View style={styles.helpRow}>
              <Text style={[styles.helpKey, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDarkMode ? "#FFFFFF" : "#1C1C1C" }]}>F8</Text>
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Go to Parties Directory (Customers / Shift+F8 for Vendors)</Text>
            </View>
            <View style={styles.helpRow}>
              <Text style={[styles.helpKey, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDarkMode ? "#FFFFFF" : "#1C1C1C" }]}>F9</Text>
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Go to Banking & Cash Registers</Text>
            </View>
            <View style={styles.helpRow}>
              <Text style={[styles.helpKey, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDarkMode ? "#FFFFFF" : "#1C1C1C" }]}>F10</Text>
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Go to System Settings Screen</Text>
            </View>
            <View style={styles.helpRow}>
              <Text style={[styles.helpKey, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDarkMode ? "#FFFFFF" : "#1C1C1C" }]}>F11</Text>
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Open / close this shortcuts help guide</Text>
            </View>
          </View>

          <View style={styles.helpSection}>
            <Text style={[styles.helpSectionTitle, { color: isDarkMode ? "#60CDFF" : "#0078D4" }]}>
              WORKSPACE & SECURITY
            </Text>
            <View style={styles.helpRow}>
              <Text style={[styles.helpKey, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDarkMode ? "#FFFFFF" : "#1C1C1C" }]}>Alt + C</Text>
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Switch company (return to select workspace hub)</Text>
            </View>
            <View style={styles.helpRow}>
              <Text style={[styles.helpKey, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDarkMode ? "#FFFFFF" : "#1C1C1C" }]}>Alt + L</Text>
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Logout from active user session securely</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function App() {
  const systemDarkMode = useColorScheme() === 'dark';
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 1. Preload local secure credentials cache
    storage.preload(["access_token", "refresh_token", "jk_remember_me", "jk_user_identity_hint"])
      .then(() => {
        // 2. Hydrate theme preferences automatically from system
        useUIStore.setState({ isDarkMode: systemDarkMode });
        setIsReady(true);
      });
  }, [systemDarkMode]);

  if (!isReady) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: systemDarkMode ? "#1A1A1A" : "#F3F3F3" }]}>
        <Text style={[styles.loaderText, { color: systemDarkMode ? "#FFFFFF" : "#1A1A1A" }]}>
          Loading enterprise client...
        </Text>
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <StatusBar barStyle={systemDarkMode ? "light-content" : "dark-content"} />
          <AppContent />
        </View>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  placeholderCard: {
    maxWidth: 420,
    width: "100%",
    padding: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    gap: 16,
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  placeholderIcon: {
    fontSize: 42,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
    textAlign: "center",
  },
  placeholderDesc: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Segoe UI Variable Text",
    textAlign: "center",
  },
  backBtn: {
    height: 32,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  helpContainer: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  helpSubtitle: {
    fontSize: 14.5,
    marginBottom: 20,
    fontFamily: "Segoe UI Variable Text",
  },
  helpSection: {
    marginBottom: 20,
  },
  helpSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 10,
    fontFamily: "Segoe UI Variable Text",
  },
  helpRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 12,
  },
  helpKey: {
    width: 80,
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 3,
    textAlign: "center",
    fontSize: 11.5,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Display",
  },
  helpDesc: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: "Segoe UI Variable Text",
  }
});
