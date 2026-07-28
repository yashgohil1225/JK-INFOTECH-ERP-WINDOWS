// =============================================================
// JK INFOTECH ERP — Navigation Sidebar (Segoe MDL2 Assets)
// File : src/components/layout/Sidebar.tsx
// =============================================================

import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, Image } from "react-native";
import { useUIStore } from "../../store/uiStore";
import { useAuthStore } from "../../store/authStore";
import {
  DashboardIcon,
  InvoicesIcon,
  SalesOrdersIcon,
  ReturnsIcon,
  CustomersIcon,
  VendorsIcon,
  InventoryIcon,
  PurchasesIcon,
  BankIcon,
  ReportsIcon,
  BrandTextLogo,
  SettingsIcon,
  BrandMonogram
} from "../ui/Icons";

// Segoe MDL2 Assets Unicode Glyph Constants
const GLYPHS = {
  MENU: "\uE700",
  DASHBOARD: "\uE80F",
  SALES: "\uEC15",
  PURCHASE: "\uE7BF",
  INVENTORY: "\uF158",
  BANK_CASH: "\uE8C7",
  REPORTS: "\uE9D2",
  PROFILE: "\uE77B",
  LOGOUT: "\uE7E8",
  CHEVRON_LEFT: "\uE76B",
  CHEVRON_RIGHT: "\uE76C",
  COMPANY: "\uE719"
};

function getSidebarIcon(id: string, size = 24) {
  switch (id) {
    case "DASHBOARD": return <DashboardIcon size={size} />;
    case "SALES": return <InvoicesIcon size={size} />;
    case "SALES_ORDERS": return <SalesOrdersIcon size={size} />;
    case "RETURNS": return <ReturnsIcon size={size} />;
    case "CUSTOMERS": return <CustomersIcon size={size} />;
    case "VENDORS": return <VendorsIcon size={size} />;
    case "INVENTORY": return <InventoryIcon size={size} />;
    case "PURCHASE": return <PurchasesIcon size={size} />;
    case "BANK_CASH": return <BankIcon size={size} />;
    case "REPORTS": return <ReportsIcon size={size} />;
    case "SETTINGS": return <SettingsIcon size={size} />;
    default: return null;
  }
}

interface SidebarMenuItemProps {
  item: {
    id: string;
    label: string;
    glyph: string;
    color?: string;
    badge?: number;
    shortcutKey?: string;
  };
  isActive: boolean;
  isSidebarCollapsed: boolean;
  onPress: () => void;
  colors: any;
}

function SidebarMenuItem({ item, isActive, isSidebarCollapsed, onPress, colors }: SidebarMenuItemProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      style={[
        styles.menuItem,
        isActive && { backgroundColor: colors.activeBg },
        isHovered && !isActive && { backgroundColor: colors.hoverBg }
      ]}
    >
      <View style={styles.menuGlyph}>
        {getSidebarIcon(item.id, 24)}
      </View>
      {!isSidebarCollapsed && (
        <View style={styles.menuLabelContainer}>
          <Text
            style={[
              styles.menuLabel,
              {
                color: isActive ? colors.activeAccent : colors.textPrimary,
                fontWeight: isActive ? "700" : "500",
                flex: 1
              }
            ]}
          >
            {item.label}
          </Text>
          {item.shortcutKey && (
            <View style={[styles.shortcutTag, { backgroundColor: colors.shortcutTagBg, borderColor: colors.shortcutTagBorder }]}>
              <Text style={[styles.shortcutTagText, { color: colors.shortcutTagText }]}>
                {item.shortcutKey}
              </Text>
            </View>
          )}
          {item.badge !== undefined && (
            <View style={[styles.badge, { backgroundColor: colors.badgeBg }]}>
              <Text style={styles.badgeText}>{item.badge}</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

export default function Sidebar() {
  const { isSidebarCollapsed, toggleSidebar, activeScreen, setActiveScreen, isDarkMode } = useUIStore();
  const { user, company, logout } = useAuthStore();

  const [isToggleHovered, setIsToggleHovered] = React.useState(false);
  const [isProfileHovered, setIsProfileHovered] = React.useState(false);
  const [isLogoutHovered, setIsLogoutHovered] = React.useState(false);

  const navigationGroups = [
    {
      title: "MAIN",
      items: [
        { id: "DASHBOARD", label: "Dashboard", glyph: GLYPHS.DASHBOARD, color: "#0078D4", shortcutKey: "F1" }
      ]
    },
    {
      title: "SALES",
      items: [
        { id: "SALES", label: "Invoices", glyph: GLYPHS.SALES, color: "#E81123", shortcutKey: "F2" },
        { id: "SALES_ORDERS", label: "Sales Orders", glyph: "\uE81C", color: "#107C41", shortcutKey: "Shift+F2" },
        { id: "RETURNS", label: "Returns", glyph: "\uE7A7", color: "#F7630C", shortcutKey: "Ctrl+F2" }
      ]
    },
    {
      title: "PARTIES",
      items: [
        { id: "CUSTOMERS", label: "Customers", glyph: "\uE77B", color: "#8764B8", shortcutKey: "F8" },
        { id: "VENDORS", label: "Vendors", glyph: "\uE13D", color: "#008272", shortcutKey: "Shift+F8" }
      ]
    },
    {
      title: "STOCK",
      items: [
        { id: "INVENTORY", label: "Inventory", glyph: GLYPHS.INVENTORY, color: "#FFB900", shortcutKey: "F7" },
        { id: "PURCHASE", label: "Purchases", glyph: GLYPHS.PURCHASE, color: "#B4009E", shortcutKey: "F3" }
      ]
    },
    {
      title: "FINANCE",
      items: [
        { id: "BANK_CASH", label: "Bank & Cash", glyph: GLYPHS.BANK_CASH, color: "#00B7C3", shortcutKey: "F9" },
        { id: "REPORTS", label: "Reports", glyph: GLYPHS.REPORTS, color: "#8764B8", shortcutKey: "F6" }
      ]
    },
    {
      title: "SYSTEM",
      items: [
        { id: "SETTINGS", label: "Settings", glyph: "\uE713", color: "#64748B", shortcutKey: "F10" }
      ]
    }
  ];

  // Fluent design palette based on Dark/Light mode
  const colors = isDarkMode
    ? {
      sidebarBg: "#1E293B", // Premium dark slate background
      textPrimary: "#F1F5F9",
      textSecondary: "#8A94A6",
      sectionHeader: "#64748B",
      hoverBg: "#334155", // Slate-type dark hover
      activeBg: "#0C4A6E", // Premium soft light blue active tab background
      activeAccent: "#38BDF8", // Fluent active text blue
      divider: "rgba(255, 255, 255, 0.08)",
      badgeBg: "#38BDF8",
      badgeText: "#000000",
      shortcutTagBg: "rgba(56, 189, 248, 0.16)",
      shortcutTagBorder: "rgba(56, 189, 248, 0.4)",
      shortcutTagText: "#38BDF8",
    }
    : {
      sidebarBg: "#F3F4F6", // Premium light grey background
      textPrimary: "#374151",
      textSecondary: "#6B7280",
      sectionHeader: "#9CA3AF",
      hoverBg: "#E2E8F0", // Slate-type light hover
      activeBg: "#BAE6FD", // Deep sky blue active tab background — clearly visible
      activeAccent: "#0284C7", // Corporate active text blue
      divider: "rgba(0, 0, 0, 0.08)",
      badgeBg: "#0284C7",
      badgeText: "#FFFFFF",
      shortcutTagBg: "rgba(2, 132, 199, 0.12)",
      shortcutTagBorder: "rgba(2, 132, 199, 0.4)",
      shortcutTagText: "#0284C7",
    };

  return (
    <View style={[styles.sidebar, { backgroundColor: colors.sidebarBg, width: isSidebarCollapsed ? 64 : 260, borderRightColor: colors.divider }]}>
      {/* Header Menu Toggle */}
      <View style={[styles.header, { paddingHorizontal: isSidebarCollapsed ? 8 : 16 }]}>
        {isSidebarCollapsed ? (
          <Pressable
            onPress={toggleSidebar}
            onHoverIn={() => setIsToggleHovered(true)}
            onHoverOut={() => setIsToggleHovered(false)}
            style={[
              styles.logoContainer,
              {
                justifyContent: "center",
                alignItems: "center",
                width: 44,
                height: 44,
                borderRadius: 8,
                alignSelf: "center",
                flex: 0
              },
              isToggleHovered && { backgroundColor: colors.hoverBg }
            ]}
          >
            <Image
              source={require("../logo_monogram.png")}
              style={{ width: 28, height: 28, resizeMode: "contain" }}
              fadeDuration={0}
            />
          </Pressable>
        ) : (
          <>
            <View style={[styles.logoContainer, { height: 48 }]}>
              <Image
                source={require("../logo_text.png")}
                style={{
                  width: 145,
                  height: 40,
                  resizeMode: "contain",
                  tintColor: isDarkMode ? "#38BDF8" : "#1B4D7A"
                }}
                fadeDuration={0}
              />
            </View>
            <Pressable
              onPress={toggleSidebar}
              onHoverIn={() => setIsToggleHovered(true)}
              onHoverOut={() => setIsToggleHovered(false)}
              style={[
                styles.toggleBtn,
                isToggleHovered && { backgroundColor: colors.hoverBg }
              ]}
            >
              <Text style={[styles.glyphIcon, { fontFamily: "Segoe MDL2 Assets", color: colors.textPrimary }]}>
                {GLYPHS.CHEVRON_LEFT}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.divider }]} />

      {/* Grouped Menu Options */}
      <ScrollView
        style={[styles.scrollContainer, { paddingRight: isSidebarCollapsed ? 0 : 8 }]}
        showsVerticalScrollIndicator={!isSidebarCollapsed}
        indicatorStyle={isDarkMode ? "white" : "black"}
      >

        {navigationGroups.map((group, groupIdx) => (
          <View key={groupIdx} style={styles.groupContainer}>
            {!isSidebarCollapsed && (
              <Text style={[styles.groupHeader, { color: colors.sectionHeader }]}>
                {group.title}
              </Text>
            )}
            <View style={styles.groupItems}>
              {group.items.map((item) => (
                <SidebarMenuItem
                  key={item.id}
                  item={item}
                  isActive={activeScreen === item.id}
                  isSidebarCollapsed={isSidebarCollapsed}
                  onPress={() => setActiveScreen(item.id)}
                  colors={colors}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Footer Profile */}
      <View style={[styles.footer, { borderTopColor: colors.divider }]}>
        <Pressable
          onPress={() => {
            Alert.alert(
              "Workspace Options",
              `User: ${user?.full_name || "Enterprise User"}\nActive Workspace: ${company?.name || "None"}\n\nWould you like to switch to another company workspace?`,
              [
                { text: "Stay here", style: "cancel" },
                {
                  text: "Switch Workspace",
                  onPress: () => {
                    useAuthStore.getState().setCompany(null as any);
                  }
                }
              ]
            );
          }}
          onHoverIn={() => setIsProfileHovered(true)}
          onHoverOut={() => setIsProfileHovered(false)}
          style={[
            styles.profileContainer,
            { borderRadius: 4, padding: 4 },
            isProfileHovered && { backgroundColor: colors.hoverBg }
          ]}
        >
          <Text style={[styles.footerGlyph, { fontFamily: "Segoe MDL2 Assets", color: colors.textSecondary }]}>
            {GLYPHS.PROFILE}
          </Text>
          {!isSidebarCollapsed && (
            <View style={styles.profileDetails}>
              <Text style={[styles.profileName, { color: colors.textPrimary }]} numberOfLines={1}>
                {user?.full_name || "Enterprise User"}
              </Text>
              <Text style={[styles.profileRole, { color: colors.textSecondary }]} numberOfLines={1}>
                {user?.is_superadmin ? "Administrator" : "Standard User"}
              </Text>
            </View>
          )}
        </Pressable>
        {!isSidebarCollapsed && !!(user?.has_pin && user?.pin_login_enabled) && (
          <Pressable
            onPress={() => useAuthStore.getState().setLocked(true)}
            onHoverIn={() => setIsLogoutHovered(true)}
            onHoverOut={() => setIsLogoutHovered(false)}
            style={[
              styles.logoutBtn,
              isLogoutHovered && { backgroundColor: colors.hoverBg }
            ]}
          >
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>🔒</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRightWidth: 1,
    paddingVertical: 12,
    flexDirection: "column",
    zIndex: 99,
  },
  header: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
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
  companyGlyph: {
    fontSize: 21,
  },
  brandText: {
    fontSize: 16.5,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  toggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  glyphIcon: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginHorizontal: 12,
    marginVertical: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  groupContainer: {
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  groupHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    fontFamily: "Segoe UI Variable Text",
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  groupItems: {
    gap: 2,
  },
  menuItem: {
    height: 44,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    position: "relative",
  },
  activeIndicator: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  menuGlyph: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  menuLabelContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuLabel: {
    fontSize: 17,
    fontFamily: "Segoe UI Variable Text",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  shortcutTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1.5,
    marginLeft: 6,
  },
  shortcutTagText: {
    fontSize: 11,
    fontWeight: "900",
    fontFamily: "Segoe UI Variable Display",
    letterSpacing: 0.10,
  },
  footer: {
    paddingTop: 12,
    borderTopWidth: 1,
    marginHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  profileContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  footerGlyph: {
    fontSize: 21,
    width: 24,
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 13.5,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  profileRole: {
    fontSize: 11.5,
    fontFamily: "Segoe UI Variable Text",
  },
  logoutBtn: {
    width: 32,
    height: 32,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  }
});
