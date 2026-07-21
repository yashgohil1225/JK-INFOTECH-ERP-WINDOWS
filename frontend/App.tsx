// =============================================================
// JK INFOTECH ERP — UWP / WinUI 3 Desktop App Root
// File : App.tsx
// =============================================================

import React, { useEffect, useState, useRef } from "react";
import { StatusBar, StyleSheet, useColorScheme, View, Text, ActivityIndicator, Pressable, LogBox, DeviceEventEmitter } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { storage } from "./src/utils/storage";
import { useAuthStore } from "./src/store/authStore";
import { useUIStore } from "./src/store/uiStore";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

LogBox.ignoreAllLogs();

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
import { Modal } from "./src/components/ui/Modal";
import { UpdateModal } from "./src/components/ui/UpdateModal";

function AppContent() {
  const { isLoggedIn, company, localAutoLogin, isAuthenticating } = useAuthStore();
  const { activeScreen, isDarkMode } = useUIStore();
  const { isFrozen, checkLicenseStatus, checking } = useLicenseStore();

  const rootRef = useRef<any>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    checkLicenseStatus().catch(() => {});
  }, []);

  useEffect(() => {
    let timer: any = null;

    const attemptAutoLogin = () => {
      const state = useAuthStore.getState();
      if (!isFrozen && !state.isLoggedIn && !state.isAuthenticating) {
        localAutoLogin().catch((err) => {
          console.warn("Local auto login failed, retrying in 2.5s...", err);
        });
      }
    };

    if (!isFrozen && !isLoggedIn) {
      attemptAutoLogin();
      timer = setInterval(attemptAutoLogin, 2500);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isFrozen, isLoggedIn, localAutoLogin]);

  // Listen to showKeyboardHelp event
  useEffect(() => {
    const subHelp = DeviceEventEmitter.addListener("showKeyboardHelp", () => {
      setIsHelpOpen(true);
    });
    return () => subHelp.remove();
  }, []);

  const handleGlobalKeyDown = (e: any) => {
    if (!e || !e.nativeEvent) return;
    const { key, ctrlKey, altKey, shiftKey } = e.nativeEvent;
    
    // Broadcast event to screen-local listeners (e.g. to close custom modals on Escape, or save on Ctrl+S)
    DeviceEventEmitter.emit("globalKeyDown", { key, ctrlKey, altKey, shiftKey });

    // Global dialog state manager handles Escape keys
    if (key === "Escape") {
      const ui = useUIStore.getState();
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

    // Ctrl / Alt hotkeys
    if (ctrlKey || altKey) {
      if (altKey && key === "c") {
        useAuthStore.getState().setCompany(null);
      }
      if (altKey && key === "l") {
        useAuthStore.getState().logout();
      }
    } else {
      // Functional Keys
      switch (key) {
        case "F1":
          setIsHelpOpen((prev) => !prev);
          break;
        case "F2":
          useUIStore.getState().setActiveScreen("SALES");
          useUIStore.getState().setIsCreatingInvoice(true);
          break;
        case "F3":
          useUIStore.getState().setActiveScreen("PURCHASE");
          break;
        case "F4":
          useUIStore.getState().toggleSidebar();
          break;
        case "F5":
          DeviceEventEmitter.emit("refreshScreenData");
          break;
        case "F6":
          useUIStore.getState().setActiveScreen("REPORTS");
          break;
        case "F10":
          useUIStore.getState().setActiveScreen("SETTINGS");
          break;
      }
    }
  };

  const themeColors = isDarkMode
    ? { text: "#FFFFFF", bg: "transparent" } // Transparent allows Mica to show
    : { text: "#1A1A1A", bg: "transparent" };

  // Route to the appropriate screen
  const renderActiveScreen = () => {
    const screenName = activeScreen.replace("_", " ");
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
      case "CUSTOMERS":
      case "VENDORS":
        return <PartiesScreen />;
      case "INVENTORY":
        return <InventoryScreen />;
      case "BANK_CASH":
        return <BankingScreen />;
      case "REPORTS":
        return <ReportsScreen />;
      case "SETTINGS":
        return <SettingsScreen />;
      default:
        return (
          <View style={styles.placeholderContainer}>
            <View style={[styles.placeholderCard, { backgroundColor: isDarkMode ? "#1C1C1C" : "#FFFFFF", borderColor: isDarkMode ? "#2C2C2C" : "#E5E5E5" }]}>
              <Text style={[styles.placeholderIcon, { fontFamily: "Segoe MDL2 Assets", color: isDarkMode ? "#60CDFF" : "#0078D4" }]}>
                {"\uE825"} {/* Construction Icon */}
              </Text>
              <Text style={[styles.placeholderTitle, { color: isDarkMode ? "#FFFFFF" : "#1A1A1A" }]}>
                {screenName} Module
              </Text>
              <Text style={[styles.placeholderDesc, { color: isDarkMode ? "#8E8E8E" : "#6E6E6E" }]}>
                This system node is currently undergoing native WinUI integration and will be available in the upcoming compilation.
              </Text>
              <Pressable
                onPress={() => useUIStore.getState().setActiveScreen("DASHBOARD")}
                style={(state?: any) => [
                  styles.backBtn,
                  { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)" },
                  state?.hovered && { opacity: 0.8 }
                ]}
              >
                <Text style={[styles.backBtnText, { color: isDarkMode ? "#FFFFFF" : "#1A1A1A" }]}>
                  Return to Dashboard
                </Text>
              </Pressable>
            </View>
          </View>
        );
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
    return (
      <View style={[styles.loaderContainer, { backgroundColor: isDarkMode ? "#1A1A1A" : "#F3F3F3" }]}>
        <ActivityIndicator size="large" color={isDarkMode ? "#FFFFFF" : "#1A1A1A"} />
        <Text style={[styles.loaderText, { color: isDarkMode ? "#FFFFFF" : "#1A1A1A", marginTop: 12 }]}>
          Connecting to local database...
        </Text>
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
    if (!company) {
      return <CompanySelectScreen />;
    }
    return <MainLayout>{renderActiveScreen()}</MainLayout>;
  };

  return (
    <View
      focusable={false}
      style={{ flex: 1 }}
      {...({
        onKeyDown: handleGlobalKeyDown
      } as any)}
    >
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
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Open / close this shortcuts help guide</Text>
            </View>
            <View style={styles.helpRow}>
              <Text style={[styles.helpKey, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDarkMode ? "#FFFFFF" : "#1C1C1C" }]}>F2</Text>
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Go to Invoices & open New Invoice Form</Text>
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
              <Text style={[styles.helpKey, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", color: isDarkMode ? "#FFFFFF" : "#1C1C1C" }]}>F10</Text>
              <Text style={[styles.helpDesc, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>Go to System Settings Screen</Text>
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
