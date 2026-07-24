// =============================================================
// JK INFOTECH ERP — Main Layout Wrapper (Native Mica Support)
// File : src/components/layout/MainLayout.tsx
// =============================================================

import React from "react";
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from "react-native";
import Sidebar from "./Sidebar";
import { useUIStore } from "../../store/uiStore";
import { useAuthStore } from "../../store/authStore";
import { Modal } from "../ui/Modal";
import { CalendarPicker } from "../ui/DatePicker";

import { getCurrentAppVersion } from "../../services/CloudUpdateService";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { isDarkMode, activeScreen, isSidebarCollapsed, isCreatingInvoice, isPrintPreviewOpen, isFullScreenOpen, globalLoadingMessage, globalLoadingSubtext, activeDatePicker, setActiveDatePicker } = useUIStore();
  const { user, company } = useAuthStore();

  const colors = isDarkMode
    ? {
      mainBg: "#121212", // Clean dark theme background
      headerBg: "#1C1C1C", // Panel background
      border: "rgba(255, 255, 255, 0.08)",
      textPrimary: "#FFFFFF",
      textSecondary: "#8E8E8E",
      hoverBg: "rgba(255, 255, 255, 0.06)",
      statusBarBg: "#1C1C1C",
      statusBarText: "#A0A0A0",
      accent: "#60CDFF"
    }
    : {
      mainBg: "#F9F9F9", // Sleek light theme background
      headerBg: "#FFFFFF", // Panel background
      border: "rgba(0, 0, 0, 0.06)",
      textPrimary: "#1C1C1C",
      textSecondary: "#6E6E6E",
      hoverBg: "rgba(0, 0, 0, 0.04)",
      statusBarBg: "#F3F3F3",
      statusBarText: "#5F5F5F",
      accent: "#0078D4"
    };

  return (
    <View focusable={false} style={[styles.container, { backgroundColor: colors.mainBg }]}>

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
              {company?.name || "UPENDRABHAI KAINAIYALAL GOHIL"}
            </Text>
          </View>
          <View style={styles.statusRight}>
            <Text style={[styles.statusText, { color: colors.accent, fontWeight: "700" }]}>
              {company?.is_gst_applicable 
                ? `GSTIN: ${company.gst_number || "—"} · ${company.default_gst_rate || company.default_tax_rate || 18}% GST (${company.hsn_sac_type || "Goods"}: ${company.default_hsn_sac_code || "—"})`
                : "GST: Unregistered"}
            </Text>
            <View style={styles.statusDivider} />
            <Text style={[styles.statusText, { color: colors.statusBarText, fontWeight: "600" }]}>
              v{getCurrentAppVersion()}
            </Text>
          </View>
        </View>
      )}

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
});
