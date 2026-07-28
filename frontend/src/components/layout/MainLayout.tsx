// =============================================================
// JK INFOTECH ERP — Main Layout Wrapper (Native Mica Support)
// File : src/components/layout/MainLayout.tsx
// =============================================================

import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, DeviceEventEmitter } from "react-native";
import Sidebar from "./Sidebar";
import { useUIStore } from "../../store/uiStore";
import { useAuthStore } from "../../store/authStore";
import { Modal } from "../ui/Modal";
import { CalendarPicker } from "../ui/DatePicker";
import { GlobalSearchModal } from "../ui/GlobalSearchModal";

import { getCurrentAppVersion, checkForCloudUpdate } from "../../services/CloudUpdateService";
import { UpdateModal } from "../ui/UpdateModal";


interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { isDarkMode, activeScreen, setActiveScreen, isSidebarCollapsed, isCreatingInvoice, isPrintPreviewOpen, isFullScreenOpen, isGlobalSearchOpen, setGlobalSearchOpen, globalLoadingMessage, globalLoadingSubtext, activeDatePicker, setActiveDatePicker } = useUIStore();
  const { user, company } = useAuthStore();
  const rootRef = React.useRef<any>(null);

  // Automatic background update check on application startup
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForCloudUpdate().catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {

    const handleGlobalKey = (e: any) => {
      if (!e) return;
      const key = e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;

      // Ctrl + K -> Global Search
      if (ctrl && (key === "k" || key === "K")) {
        if (e.preventDefault) e.preventDefault();
        setGlobalSearchOpen(true);
        return;
      }

      // F2 -> Sales Invoices (Shift+F2 -> Sales Orders, Ctrl+F2 -> Returns)
      if (key === "F2" || key === "f2") {
        if (e.preventDefault) e.preventDefault();
        if (shift) setActiveScreen("ORDERS");
        else if (ctrl) setActiveScreen("RETURNS");
        else setActiveScreen("SALES");
        return;
      }

      // F3 -> Purchases
      if (key === "F3" || key === "f3") {
        if (e.preventDefault) e.preventDefault();
        setActiveScreen("PURCHASES");
        return;
      }

      // F6 -> Reports
      if (key === "F6" || key === "f6") {
        if (e.preventDefault) e.preventDefault();
        setActiveScreen("REPORTS");
        return;
      }

      // F7 -> Inventory
      if (key === "F7" || key === "f7") {
        if (e.preventDefault) e.preventDefault();
        setActiveScreen("INVENTORY");
        return;
      }

      // F8 -> Parties (Customers / Vendors)
      if (key === "F8" || key === "f8") {
        if (e.preventDefault) e.preventDefault();
        setActiveScreen("PARTIES");
        return;
      }

      // F9 -> Banking
      if (key === "F9" || key === "f9") {
        if (e.preventDefault) e.preventDefault();
        setActiveScreen("BANKING");
        return;
      }

      // F10 -> Settings
      if (key === "F10" || key === "f10") {
        if (e.preventDefault) e.preventDefault();
        setActiveScreen("SETTINGS");
        return;
      }
    };

    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("keydown", handleGlobalKey);
    }

    const sub = DeviceEventEmitter.addListener("globalKeyDown", handleGlobalKey);

    return () => {
      if (typeof window !== "undefined" && window.removeEventListener) {
        window.removeEventListener("keydown", handleGlobalKey);
      }
      sub.remove();
    };
  }, [setActiveScreen, setGlobalSearchOpen]);

  const colors = isDarkMode
    ? {
      mainBg: "#0F172A", // Obsidian Slate dark theme
      headerBg: "#1E293B", // Elevated panel
      cardBg: "#1E293B",
      border: "rgba(255, 255, 255, 0.08)",
      textPrimary: "#F8FAFC",
      textSecondary: "#94A3B8",
      hoverBg: "rgba(255, 255, 255, 0.06)",
      statusBarBg: "#0B1120",
      statusBarText: "#94A3B8",
      accent: "#38BDF8"
    }
    : {
      mainBg: "#F8FAFC", // Crisp Studio light theme
      headerBg: "#FFFFFF", // Elevated white panel
      cardBg: "#FFFFFF",
      border: "rgba(15, 23, 42, 0.08)",
      textPrimary: "#0F172A",
      textSecondary: "#64748B",
      hoverBg: "rgba(15, 23, 42, 0.04)",
      statusBarBg: "#F1F5F9",
      statusBarText: "#64748B",
      accent: "#0284C7"
    };

  return (
    <View style={[styles.container, { backgroundColor: colors.mainBg }]}>

      {/* 3. WORKSPACE CORE */}
      <View focusable={false} style={styles.workspaceWrapper}>
        {/* Navigation Sidebar */}
        {!(isCreatingInvoice || isPrintPreviewOpen || isFullScreenOpen) && <Sidebar />}

        {/* Content Viewport */}
        <View 
          focusable={false}
          style={[
            styles.contentWrapper, 
            { 
              marginLeft: (isCreatingInvoice || isPrintPreviewOpen || isFullScreenOpen) ? 0 : (isSidebarCollapsed ? 64 : 260),
              padding: (isCreatingInvoice || isPrintPreviewOpen || isFullScreenOpen) ? 0 : 16
            }
          ]}
        >
          {children}
        </View>
      </View>

      {/* 4. COHESIVE SYSTEM STATUS BAR */}
      {!(isCreatingInvoice || isPrintPreviewOpen || isFullScreenOpen) && (
        <View style={[styles.statusBar, { backgroundColor: colors.statusBarBg, borderTopColor: colors.border }]}>
          <View style={styles.statusLeft}>
            <View style={styles.statusOnlineDot} />
            <Text style={[styles.statusText, { color: colors.statusBarText, fontWeight: "600" }]}>System Online</Text>
            <View style={styles.statusDivider} />
            <Text style={[styles.statusText, { color: colors.textPrimary, fontWeight: "700" }]}>
              {company?.name || "No Active Workspace"}

            </Text>
          </View>
          <View style={styles.statusRight}>
            <Text style={[styles.statusText, { color: colors.accent, fontWeight: "700" }]}>
              {company?.is_gst_applicable 
                ? `GSTIN: ${company.gst_number || "—"} · ${company.default_gst_rate || company.default_tax_rate || 18}% GST (${company.hsn_sac_type || "Goods"}: ${company.default_hsn_sac_code || "—"})`
                : "GST: Unregistered"}
            </Text>
            <View style={styles.statusDivider} />
            <Pressable 
              onPress={async () => {
                const info = await checkForCloudUpdate();
                if (!info || !info.hasUpdate) {
                  Alert.alert("Software Up To Date", `You are running the latest version v${getCurrentAppVersion()}. No updates available.`);
                }
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.statusText, { color: colors.accent, fontWeight: "700" }]}>
                Check for Updates (v{getCurrentAppVersion()})
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* AUTOMATIC CLOUD UPDATE MODAL */}
      <UpdateModal checkOnMount={true} />


      {/* GLOBAL FULL-WINDOW LOADING OVERLAY */}
      {globalLoadingMessage && (
        <View style={styles.globalLoadingOverlay}>
          <View style={[styles.globalLoadingCard, { backgroundColor: isDarkMode ? "#1E1E1E" : "#FFFFFF", borderColor: isDarkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)" }]}>
            <ActivityIndicator size="large" color={isDarkMode ? "#60CDFF" : "#0078D4"} />
            <Text style={[styles.globalLoadingTitle, { color: isDarkMode ? "#FFFFFF" : "#1A1A1A" }]}>
              {globalLoadingMessage}
            </Text>
            {globalLoadingSubtext && (
              <Text style={[styles.globalLoadingSubtext, { color: isDarkMode ? "#8E8E8E" : "#6E6E6E" }]}>
                {globalLoadingSubtext}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* GLOBAL DATE PICKER MODAL OVERLAY */}
      {activeDatePicker && (
        <Modal
          isOpen={true}
          onClose={() => setActiveDatePicker(null)}
          title={activeDatePicker.title}
          width={330}
        >
          <CalendarPicker
            value={activeDatePicker.value}
            onChange={(val) => {
              activeDatePicker.onChange(val);
              setActiveDatePicker(null);
            }}
          />
        </Modal>
      )}

      {/* Global Universal Search & Command Palette Modal (Ctrl+K) */}
      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
  },
  appHeader: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  appIcon: {
    fontSize: 16.5,
    marginRight: 8,
  },
  logoIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "#0078D4",
    alignItems: "center",
    justifyContent: "center",
  },
  logoIconText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    fontFamily: "Segoe UI Variable Text",
  },
  appNameText: {
    fontSize: 14.5,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
  },
  verticalSeparator: {
    width: 1,
    height: 14,
    marginHorizontal: 12,
  },
  workspaceLabel: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "Segoe UI Variable Text",
  },
  headerRightMenu: {
    flexDirection: "row",
    gap: 4,
  },
  menuBtn: {
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 4,
    justifyContent: "center",
  },
  menuBtnText: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "Segoe UI Variable Text",
  },
  workspaceWrapper: {
    flex: 1,
    flexDirection: "row",
    overflow: "visible",
  },
  contentWrapper: {
    flex: 1,
    padding: 16,
    height: "100%",
    zIndex: 100,
    overflow: "visible",
  },
  statusBar: {
    height: 22,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusOnlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#107C41",
    marginRight: 6,
  },
  statusDivider: {
    width: 1,
    height: 10,
    backgroundColor: "rgba(128, 128, 128, 0.25)",
    marginHorizontal: 10,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Segoe UI Variable Text",
  },
  statusRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  globalLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999999,
    elevation: 999999,
  },
  globalLoadingCard: {
    paddingVertical: 32,
    paddingHorizontal: 40,
    borderRadius: 12,
    borderWidth: 1,
    gap: 14,
    alignItems: "center",
    minWidth: 300,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
  },
  globalLoadingTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  globalLoadingSubtext: {
    fontSize: 13.5,
    fontFamily: "Segoe UI Variable Text",
  },
  topHeader: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Display",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    gap: 8,
  },
  searchChipText: {
    fontSize: 12.5,
    fontFamily: "Segoe UI Variable Text",
  },
  kbdBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  kbdText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Display",
  },
});
