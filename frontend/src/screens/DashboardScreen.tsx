// =============================================================
// JK INFOTECH ERP — Dashboard Screen (Telemetry Control Panel)
// File : src/screens/DashboardScreen.tsx
// =============================================================

import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  DimensionValue,
  Image,
  DeviceEventEmitter,
} from "react-native";

// Preload dashboard KPI icon assets early for instant rendering and to eliminate flickering
const preloadKpiIcons = () => {
  try {
    const assets = [
      require("../components/total_sales.png"),
      require("../components/total_receivables.png"),
      require("../components/total_payable.png"),
      require("../components/active_customers.png"),
    ];
    assets.forEach((asset) => {
      const resolved = Image.resolveAssetSource(asset);
      if (resolved && resolved.uri) {
        Image.prefetch(resolved.uri).catch(() => { });
      }
    });
  } catch (err) {
    // Fail silently in environments where resolveAssetSource is not fully mockable
  }
};
preloadKpiIcons();
import { useUIStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/client";
import {
  ReportsIcon,
  InvoicesIcon,
  PurchasesIcon,
  CustomersIcon,
  TotalSalesKPIIcon,
  TotalReceivablesKPIIcon,
  TotalPayablesKPIIcon,
  ActiveCustomersKPIIcon,
} from "../components/ui/Icons";

// ─── Helpers ──────────────────────────────────────────────────
const fmt = (n: number | undefined | null) => {
  if (n == null) return "₹0.00";
  return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function DashboardScreen() {
  const { isDarkMode, setActiveScreen, setGlobalSearchOpen } = useUIStore();
  const { company } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["dashboard_kpis"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_sales_trend"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_liquidity"] });
  }, [queryClient]);

  const colors = isDarkMode
    ? {
      background: "#0F172A",
      cardBg: "#1E293B",
      cardBorder: "#334155",
      textPrimary: "#F8FAFC",
      textSecondary: "#94A3B8",
      accent: "#38BDF8",
      accentHover: "#0EA5E9",
      divider: "#334155",
      success: "#4ADE80",
      warning: "#FBBF24",
      error: "#F87171",
      salesBar: "#38BDF8",
      purchaseBar: "#EC4899",
      stripeRow: "#1E293B",
      shortcutBg: "#0F172A",
      shortcutBorder: "#334155",
    }
    : {
      background: "#F8FAFC",
      cardBg: "#FFFFFF",
      cardBorder: "#E2E8F0",
      textPrimary: "#0F172A",
      textSecondary: "#64748B",
      accent: "#0284C7",
      accentHover: "#0369A1",
      divider: "#E2E8F0",
      success: "#16A34A",
      warning: "#D97706",
      error: "#DC2626",
      salesBar: "#0284C7",
      purchaseBar: "#DB2777",
      stripeRow: "#F8FAFC",
      shortcutBg: "#F1F5F9",
      shortcutBorder: "#E2E8F0",
    };

  // ── Data Queries ───────────────────────────────────────────
  const { data: kpis, isLoading: isKpiLoading } = useQuery({
    queryKey: ["dashboard_kpis", company?.id],
    queryFn: async () => {
      const res = await apiClient.get("/api/analytics/kpis");
      return res.data;
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const { data: salesTrend = [], isLoading: isTrendLoading } = useQuery<any[]>({
    queryKey: ["dashboard_sales_trend", company?.id],
    queryFn: async () => {
      const res = await apiClient.get("/api/analytics/sales-trend");
      return res.data;
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const { data: liquidity = [], isLoading: isLiquidityLoading } = useQuery<any[]>({
    queryKey: ["dashboard_liquidity", company?.id],
    queryFn: async () => {
      const res = await apiClient.get("/api/analytics/liquidity");
      return res.data;
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const isLoading = isKpiLoading || isTrendLoading || isLiquidityLoading;

  // ── Hover States ───────────────────────────────────────────
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [hoveredShortcut, setHoveredShortcut] = useState<string | null>(null);

  // ── Custom Bar Graph Calculations ─────────────────────────
  const maxTrendValue = useMemo(() => {
    if (!salesTrend.length) return 1000;
    const vals = salesTrend.flatMap((t) => [t.sales || 0, t.purchase || 0]);
    const maxVal = Math.max(...vals);
    return maxVal > 0 ? maxVal * 1.1 : 1000; // Add 10% headroom
  }, [salesTrend]);

  // ── Liquidity calculations ────────────────────────────────
  const totalLiquidity = useMemo(() => {
    return liquidity.reduce((sum, item) => sum + (item.balance || 0), 0);
  }, [liquidity]);

  if (isLoading) {
    return (
      <View style={[styles.centerBox, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading business overview...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={true}
    >
      {/* ── Screen Header Block ────────────────────────────────── */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 16 }}>
        {/* Left: Title & Subtitle */}
        <View style={styles.header}>
          <Text style={[styles.breadcrumb, { color: colors.accent }]}>
            DASHBOARD / OVERVIEW
          </Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Business Overview & Performance
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Live sales, receivables, payables, and bank & cash balances.
          </Text>
        </View>

        {/* Center: Inline Compact Brand Support Badge (Dead Center) */}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              backgroundColor: colors.cardBg,
              borderWidth: 1,
              borderColor: isDarkMode ? "rgba(56, 189, 248, 0.3)" : "rgba(2, 132, 199, 0.25)",
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 8,
              elevation: 1
            }}
          >
            <Text style={{ fontSize: 18 }}>🎧</Text>
            <View style={{ gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary, fontFamily: "Segoe UI Variable Text" }}>
                  JK INFOTECH SUPPORT
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.accent, fontFamily: "Consolas" }}>
                  ✉️ support@jkinfotech.com
                </Text>
                <Text style={{ fontSize: 13.5, color: colors.textSecondary }}>|</Text>
                <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary, fontFamily: "Segoe UI Variable Text" }}>
                  📞 +91 9714043495
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Upper Right Global Universal Search Widget */}
        <Pressable
          onPress={() => {
            setGlobalSearchOpen(true);
          }}
          style={({ hovered }: any) => [
            {
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.cardBg,
              borderColor: colors.cardBorder,
              borderWidth: 1,
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 10,
              minWidth: 320,
              gap: 10,
              elevation: 2,
              cursor: "pointer" as any,
            },
            hovered && { borderColor: colors.accent, backgroundColor: isDarkMode ? "#334155" : "#F1F5F9" }
          ]}
        >
          <Text style={{ fontSize: 16, color: colors.textSecondary }}>🔍</Text>
          <Text style={{ flex: 1, fontSize: 13.5, color: colors.textSecondary, fontFamily: "Segoe UI Variable Text" }}>
            Search invoices, parties, SKUs, reports...
          </Text>
          <View style={{ backgroundColor: isDarkMode ? "#334155" : "#E2E8F0", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary }}>Ctrl + K</Text>
          </View>
        </Pressable>
      </View>

      {/* ── KPI Cards Grid ────────────────────────────────────── */}
      <View style={styles.kpiGrid}>
        {/* KPI: Sales Revenue */}
        <Pressable
          onPress={() => setActiveScreen("SALES")}
          style={({ hovered }: any) => [
            styles.kpiCard,
            { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
            hovered && { opacity: 0.9, borderColor: colors.accent }
          ]}
        >
          <View style={[styles.iconBadge, { backgroundColor: isDarkMode ? "rgba(56, 189, 248, 0.12)" : "rgba(2, 132, 199, 0.08)" }]}>
            <TotalSalesKPIIcon size={20} />
          </View>
          <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>
            {fmt(kpis?.total_sales)}
          </Text>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
            Total Sales Revenue
          </Text>
          <View style={styles.kpiFooter}>
            {(() => {
              const growth = kpis?.monthly_growth ?? 0;
              const isPositive = growth > 0;
              const isNegative = growth < 0;
              const formatted = isPositive
                ? `▲ +${growth.toFixed(1)}% vs last month`
                : isNegative
                  ? `▼ ${growth.toFixed(1)}% vs last month`
                  : `0.0% vs last month`;
              const growthColor = isPositive ? colors.success : isNegative ? colors.error : colors.textSecondary;
              return (
                <Text style={[styles.kpiFooterText, { color: growthColor }]}>
                  {formatted}
                </Text>
              );
            })()}
          </View>
        </Pressable>

        {/* KPI: Receivables */}
        <Pressable
          onPress={() => setActiveScreen("CUSTOMERS")}
          style={({ hovered }: any) => [
            styles.kpiCard,
            { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
            hovered && { opacity: 0.9, borderColor: colors.accent }
          ]}
        >
          <View style={[styles.iconBadge, { backgroundColor: isDarkMode ? "rgba(251, 191, 36, 0.12)" : "rgba(217, 119, 6, 0.08)" }]}>
            <TotalReceivablesKPIIcon size={20} />
          </View>
          <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>
            {fmt(kpis?.total_receivable)}
          </Text>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
            Total Receivables
          </Text>
          <View style={styles.kpiFooter}>
            <Text style={[styles.kpiFooterText, { color: colors.textSecondary }]}>
              Customer outstanding
            </Text>
          </View>
        </Pressable>

        {/* KPI: Payables */}
        <Pressable
          onPress={() => setActiveScreen("VENDORS")}
          style={({ hovered }: any) => [
            styles.kpiCard,
            { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
            hovered && { opacity: 0.9, borderColor: colors.accent }
          ]}
        >
          <View style={[styles.iconBadge, { backgroundColor: isDarkMode ? "rgba(248, 113, 113, 0.12)" : "rgba(220, 38, 38, 0.08)" }]}>
            <TotalPayablesKPIIcon size={20} />
          </View>
          <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>
            {fmt(kpis?.total_payable)}
          </Text>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
            Total Payables
          </Text>
          <View style={styles.kpiFooter}>
            <Text style={[styles.kpiFooterText, { color: colors.textSecondary }]}>
              Supplier outstanding
            </Text>
          </View>
        </Pressable>

        {/* KPI: Active Customers */}
        <Pressable
          onPress={() => setActiveScreen("CUSTOMERS")}
          style={({ hovered }: any) => [
            styles.kpiCard,
            { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
            hovered && { opacity: 0.9, borderColor: colors.accent }
          ]}
        >
          <View style={[styles.iconBadge, { backgroundColor: isDarkMode ? "rgba(168, 85, 247, 0.12)" : "rgba(147, 51, 234, 0.08)" }]}>
            <ActiveCustomersKPIIcon size={20} />
          </View>
          <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>
            {kpis?.active_customers ?? 0}
          </Text>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
            Active Customers
          </Text>
          <View style={styles.kpiFooter}>
            <Text style={[styles.kpiFooterText, { color: colors.success }]}>
              Active business accounts
            </Text>
          </View>
        </Pressable>
      </View>

      {/* ── Main Analytical Panels (Split View) ────────────────── */}
      <View style={styles.splitRow}>
        {/* Left Card: Sales & Purchase Trends (Fluent Graph) */}
        <View
          style={[
            styles.graphCard,
            { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Sales vs Purchase Trends
            </Text>
            {/* Chart Legend */}
            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.salesBar }]} />
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>Sales</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.purchaseBar }]} />
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>Purchases</Text>
              </View>
            </View>
          </View>

          {/* Bar Graph viewport */}
          <View style={[styles.graphViewport, { borderBottomColor: colors.divider }]}>
            {salesTrend.map((t, idx) => {
              const salesPct = ((t.sales || 0) / maxTrendValue) * 100;
              const purchPct = ((t.purchase || 0) / maxTrendValue) * 100;

              return (
                <View key={idx} style={styles.barColumn}>
                  {/* Bars Container */}
                  <View style={styles.barsInnerContainer}>
                    {/* Sales Bar */}
                    <View
                      style={[
                        styles.barVal,
                        {
                          backgroundColor: colors.salesBar,
                          height: `${Math.max(salesPct, 3)}%` as DimensionValue,
                        },
                      ]}
                    />
                    {/* Purchase Bar */}
                    <View
                      style={[
                        styles.barVal,
                        {
                          backgroundColor: colors.purchaseBar,
                          height: `${Math.max(purchPct, 3)}%` as DimensionValue,
                        },
                      ]}
                    />
                  </View>
                  {/* Label */}
                  <Text style={[styles.columnLabel, { color: colors.textSecondary }]}>
                    {t.date}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Right Card: Liquidity & Bank Balances */}
        <View
          style={[
            styles.liquidityCard,
            { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.textPrimary, marginBottom: 4 }]}>
            Bank & Cash Balances
          </Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary, marginBottom: 12 }]}>
            Current balances across your bank accounts and cash in hand.
          </Text>

          <ScrollView
            style={styles.liquidityList}
            contentContainerStyle={{ paddingRight: 18, paddingBottom: 10 }}
            showsVerticalScrollIndicator={true}
          >

            {liquidity.length > 0 ? (
              liquidity.map((item, idx) => {
                const ratio = totalLiquidity > 0 ? (item.balance || 0) / totalLiquidity : 0;
                const ratioPct = `${Math.min(ratio * 100, 100)}%` as DimensionValue;

                return (
                  <View key={idx} style={[styles.liqRow, { borderBottomColor: colors.divider }]}>
                    <View style={styles.liqMeta}>
                      <View>
                        <Text style={[styles.liqName, { color: colors.textPrimary }]}>
                          {item.account_name}
                        </Text>
                        <Text style={[styles.liqType, { color: colors.textSecondary }]}>
                          {item.type?.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.liqVal, { color: colors.textPrimary }]}>
                        {fmt(item.balance)}
                      </Text>
                    </View>
                    {/* Liquidity Ratio Indicator Bar */}
                    <View style={[styles.ratioBarBg, { backgroundColor: isDarkMode ? "#0F172A" : "#E2E8F0" }]}>
                      <View
                        style={[
                          styles.ratioBarFill,
                          {
                            backgroundColor: item.type === "bank" ? colors.accent : colors.success,
                            width: ratioPct,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.noLiquidityContainer}>
                <Text style={[styles.noLiquidityText, { color: colors.textSecondary }]}>
                  No active bank or cash accounts found.
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={[styles.liqTotalRow, { borderTopColor: colors.divider }]}>
            <Text style={[styles.liqTotalLabel, { color: colors.textSecondary }]}>
              TOTAL BANK & CASH BALANCE
            </Text>
            <Text style={[styles.liqTotalValue, { color: colors.accent }]}>
              {fmt(totalLiquidity)}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Quick Shortcut Navigation Menu ──────────────────────── */}
      <View
        style={[
          styles.shortcutCard,
          { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.textPrimary, marginBottom: 12 }]}>
          Operational Shortcuts
        </Text>
        <View style={styles.shortcutGrid}>
          {[
            {
              id: "SALES",
              icon: "📝",
              title: "Create Invoices",
              desc: "Generate bills and receipts for customers",
              target: "SALES",
              key: "F2",
            },
            {
              id: "PURCHASE",
              icon: "🛒",
              title: "Record Bills",
              desc: "Log inbound bills and vendor purchases",
              target: "PURCHASE",
              key: "F3",
            },
            {
              id: "INVENTORY",
              icon: "📦",
              title: "Check Inventory",
              desc: "Manage product stock levels and reorder values",
              target: "INVENTORY",
              key: "F7",
            },
            {
              id: "BANK_CASH",
              icon: "🏦",
              title: "Bank & Cash",
              desc: "Manage bank accounts, deposits and transfers",
              target: "BANK_CASH",
              key: "F9",
            },
            {
              id: "VENDORS",
              icon: "🏢",
              title: "Vendor Directory",
              desc: "Manage suppliers, payment terms, and vendor payables",
              target: "VENDORS",
              key: "Shift+F8",
            },
            {
              id: "CUSTOMERS",
              icon: "👥",
              title: "Customer Directory",
              desc: "Manage customers, credit limits, and receivables",
              target: "CUSTOMERS",
              key: "F8",
            },
            {
              id: "REPORTS",
              icon: "📊",
              title: "Financial Reports",
              desc: "Run complete P&L statements and tax filings",
              target: "REPORTS",
              key: "F6",
            },
          ].map((sc) => (
            <Pressable
              key={sc.id}
              onPress={() => setActiveScreen(sc.target)}
              onHoverIn={() => setHoveredShortcut(sc.id)}
              onHoverOut={() => setHoveredShortcut(null)}
              style={[
                styles.shortcutItem,
                {
                  backgroundColor:
                    hoveredShortcut === sc.id
                      ? colors.shortcutBg
                      : "transparent",
                  borderColor:
                    hoveredShortcut === sc.id
                      ? colors.accent
                      : colors.shortcutBorder,
                },
              ]}
            >
              <Text style={styles.shortcutIcon}>{sc.icon}</Text>
              <View style={styles.shortcutTextGroup}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                  <Text style={[styles.shortcutTitle, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
                    {sc.title}
                  </Text>
                  <View style={{
                    backgroundColor: isDarkMode ? "rgba(56, 189, 248, 0.22)" : "rgba(2, 132, 199, 0.15)",
                    paddingHorizontal: 9,
                    paddingVertical: 3,
                    borderRadius: 6,
                    borderWidth: 1.5,
                    borderColor: colors.accent,
                    flexShrink: 0,
                  }}>
                    <Text style={{
                      fontSize: 12.5,
                      fontWeight: "800",
                      color: colors.accent,
                      fontFamily: "Segoe UI Variable Display"
                    }}>
                      {sc.key}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.shortcutDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                  {sc.desc}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

// ─── StyleSheet ───────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    gap: 20,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 16.5,
    fontFamily: "Segoe UI Variable Text",
    fontWeight: "500",
  },
  // Header
  header: {
    gap: 4,
  },
  breadcrumb: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    fontFamily: "Segoe UI Variable Display",
    textTransform: "uppercase",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    fontFamily: "Segoe UI Variable Display",
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Segoe UI Variable Text",
  },
  // KPI grid
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  kpiCard: {
    flex: 1,
    minWidth: 200,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    gap: 4,
    shadowColor: "rgba(0,0,0,0.02)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  iconBadge: {
    width: 36,
    height: 40,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 14.5,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
    marginTop: 2,
  },
  kpiIcon: {
    fontSize: 18.5,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: "800",
    fontFamily: "Segoe UI Variable Display",
    letterSpacing: -0.2,
  },
  kpiFooter: {
    marginTop: 6,
  },
  kpiFooterText: {
    fontSize: 13,
    fontFamily: "Segoe UI Variable Text",
    fontWeight: "700",
  },
  // Split panels
  splitRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  graphCard: {
    flex: 1.6,
    minWidth: 400,
    borderRadius: 8,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 17.5,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Display",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  legendContainer: {
    flexDirection: "row",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  graphViewport: {
    flexDirection: "row",
    height: 240,
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: 1.5,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  barsInnerContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    height: "100%",
    gap: 4,
    width: "100%",
  },
  barVal: {
    width: 8,
    borderRadius: 4,
  },
  columnLabel: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Display",
  },
  // Liquidity card
  liquidityCard: {
    flex: 1,
    minWidth: 260,
    borderRadius: 8,
    borderWidth: 1,
    padding: 20,
  },
  cardDesc: {
    fontSize: 14,
    fontFamily: "Segoe UI Variable Text",
  },
  liquidityList: {
    maxHeight: 184,
  },
  liqRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  liqMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  liqName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  liqType: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Display",
  },
  liqVal: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Display",
  },
  ratioBarBg: {
    height: 4,
    borderRadius: 2,
    width: "100%",
    overflow: "hidden",
  },
  ratioBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  noLiquidityContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  noLiquidityText: {
    fontSize: 14,
    fontFamily: "Segoe UI Variable Text",
  },
  liqTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1.5,
  },
  liqTotalLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    fontFamily: "Segoe UI Variable Display",
  },
  liqTotalValue: {
    fontSize: 18.5,
    fontWeight: "800",
    fontFamily: "Segoe UI Variable Display",
  },
  // Shortcuts
  shortcutCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 20,
  },
  shortcutGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  shortcutItem: {
    flex: 1,
    minWidth: 240,
    maxWidth: 320,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  shortcutIcon: {
    fontSize: 25,
  },
  shortcutTextGroup: {
    flex: 1,
  },
  shortcutTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  shortcutDesc: {
    fontSize: 12.5,
    fontFamily: "Segoe UI Variable Text",
    lineHeight: 14,
    marginTop: 1,
  },
});
