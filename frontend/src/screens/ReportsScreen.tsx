// =============================================================
// JK INFOTECH ERP — Reports Screen (Full Coverage)
// File : src/screens/ReportsScreen.tsx
// Covers every endpoint in /api/v1/reports/*
// =============================================================

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  NativeModules,
  Image,
} from "react-native";
import { useUIStore } from "../store/uiStore";
import { useQuery } from "@tanstack/react-query";
import apiClient from "../api/client";
import { PdfPreviewModal } from "../components/ui/PdfPreviewModal";
import { Button } from "../components/ui/Button";
import { storage } from "../utils/storage";
import { DatePicker } from "../components/ui/DatePicker";
import { ModuleHelpModal as HelpModal } from "../components/ui/ModuleHelpModal";



// ─── Helpers ──────────────────────────────────────────────────
const fmt = (n: number | undefined | null) => {
  if (n == null) return "₹0.00";
  return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtQty = (n: number | undefined | null) => {
  if (n == null) return "0.00";
  return Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const today = () => new Date().toISOString().split("T")[0];
const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
};
const fyStart = () => {
  const d = new Date();
  const yr = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear();
  return `${yr}-04-01`;
};

// ─── Types ────────────────────────────────────────────────────
type ReportKey =
  | "gst_summary" | "trial_balance" | "profit_loss" | "balance_sheet" | "cashflow"
  | "outstanding" | "daybook" | "ledger" | "party_ledger" | "gstr1" | "gstr2"
  | "gstr3b" | "gstr1_summary" | "gstr2_summary" | "sales_by_customer"
  | "sales_by_item" | "item_movement" | "audit_trail" | "stock_valuation" | "low_stock";

interface ReportParams {
  startDate: string;
  endDate: string;
  asOf: string;
  accountId?: string;
  partyId?: string;
  partyType?: string;
}

interface ReportMeta {
  key: ReportKey;
  label: string;
  desc: string;
  hasDateRange: boolean;
  hasAsOf: boolean;
  hasPartySelector: boolean;
  hasAccountSelector: boolean;
  pdfEndpoint?: (p: ReportParams) => string;
  excelEndpoint?: (p: ReportParams) => string;
  dataEndpoint?: (p: ReportParams) => string;
}

interface ReportCategory {
  id: string;
  label: string;
  icon: string;
  reports: ReportMeta[];
}

// ─── Report Definitions ───────────────────────────────────────
const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: "financial",
    label: "Financial Statements",
    icon: "📊",
    reports: [
      {
        key: "profit_loss",
        label: "Profit & Loss",
        desc: "Income vs expenses for a date range.",
        hasDateRange: true, hasAsOf: false, hasPartySelector: false, hasAccountSelector: false,
        dataEndpoint: (p) => `/api/reports/profit-loss?start_date=${p.startDate}&end_date=${p.endDate}`,
        pdfEndpoint: (p) => `/api/reports/profit-loss/pdf?start_date=${p.startDate}&end_date=${p.endDate}`,
        excelEndpoint: (p) => `/api/reports/profit-loss/excel?start_date=${p.startDate}&end_date=${p.endDate}`,
      },
      {
        key: "balance_sheet",
        label: "Balance Sheet",
        desc: "Assets, liabilities and equity as of a date.",
        hasDateRange: false, hasAsOf: true, hasPartySelector: false, hasAccountSelector: false,
        dataEndpoint: (p) => `/api/reports/balance-sheet?as_of=${p.asOf}`,
        pdfEndpoint: (p) => `/api/reports/balance-sheet/pdf?end_date=${p.asOf}`,
        excelEndpoint: (p) => `/api/reports/balance-sheet/excel?end_date=${p.asOf}`,
      },
      {
        key: "trial_balance",
        label: "Trial Balance",
        desc: "All account balances with debit/credit totals.",
        hasDateRange: false, hasAsOf: false, hasPartySelector: false, hasAccountSelector: false,
        dataEndpoint: () => `/api/reports/trial-balance`,
        pdfEndpoint: () => `/api/reports/trial-balance/pdf`,
      },
      {
        key: "cashflow",
        label: "Cash Flow",
        desc: "Cash inflows and outflows for a period.",
        hasDateRange: true, hasAsOf: false, hasPartySelector: false, hasAccountSelector: false,
        dataEndpoint: (p) => `/api/reports/cashflow?start_date=${p.startDate}&end_date=${p.endDate}`,
        pdfEndpoint: (p) => `/api/reports/cashflow/pdf?start_date=${p.startDate}&end_date=${p.endDate}`,
        excelEndpoint: (p) => `/api/reports/cashflow/excel?start_date=${p.startDate}&end_date=${p.endDate}`,
      },
    ],
  },
  {
    id: "gst",
    label: "GST Compliance",
    icon: "🧾",
    reports: [
      {
        key: "gst_summary",
        label: "GST Summary",
        desc: "Output tax, ITC and net GST payable overview.",
        hasDateRange: false, hasAsOf: false, hasPartySelector: false, hasAccountSelector: false,
        dataEndpoint: () => `/api/reports/gst`,
        pdfEndpoint: () => `/api/reports/gst/pdf`,
      },
      {
        key: "gstr1",
        label: "GSTR-1 (Outward)",
        desc: "Outward supply invoice-wise detail for GST filing.",
        hasDateRange: true, hasAsOf: false, hasPartySelector: false, hasAccountSelector: false,
        dataEndpoint: (p) => `/api/reports/gst/gstr1?start_date=${p.startDate}&end_date=${p.endDate}`,
        pdfEndpoint: (p) => `/api/reports/gst/gstr1/pdf?start_date=${p.startDate}&end_date=${p.endDate}`,
        excelEndpoint: (p) => `/api/reports/gst/gstr1/excel?start_date=${p.startDate}&end_date=${p.endDate}`,
      },
      {
        key: "gstr1_summary",
        label: "GSTR-1 Summary",
        desc: "Consolidated annual GSTR-1 HSN/rate-wise summary.",
        hasDateRange: true, hasAsOf: false, hasPartySelector: false, hasAccountSelector: false,
        dataEndpoint: (p) => `/api/reports/gst/gstr1/summary?start_date=${p.startDate}&end_date=${p.endDate}`,
        pdfEndpoint: (p) => `/api/reports/gst/gstr1/summary/pdf?start_date=${p.startDate}&end_date=${p.endDate}`,
        excelEndpoint: (p) => `/api/reports/gst/gstr1/summary/excel?start_date=${p.startDate}&end_date=${p.endDate}`,
      },
      {
        key: "gstr2",
        label: "GSTR-2 (Inward)",
        desc: "Inward supply purchase-wise detail for ITC claims.",
        hasDateRange: true, hasAsOf: false, hasPartySelector: false, hasAccountSelector: false,
        dataEndpoint: (p) => `/api/reports/gst/gstr2?start_date=${p.startDate}&end_date=${p.endDate}`,
        pdfEndpoint: (p) => `/api/reports/gst/gstr2/pdf?start_date=${p.startDate}&end_date=${p.endDate}`,
        excelEndpoint: (p) => `/api/reports/gst/gstr2/excel?start_date=${p.startDate}&end_date=${p.endDate}`,
      },
      {
        key: "gstr2_summary",
        label: "GSTR-2 Summary",
        desc: "Consolidated purchase GST summary by supplier.",
        hasDateRange: true, hasAsOf: false, hasPartySelector: false, hasAccountSelector: false,
        dataEndpoint: (p) => `/api/reports/gst/gstr2/summary?start_date=${p.startDate}&end_date=${p.endDate}`,
        pdfEndpoint: (p) => `/api/reports/gst/gstr2/summary/pdf?start_date=${p.startDate}&end_date=${p.endDate}`,
        excelEndpoint: (p) => `/api/reports/gst/gstr2/summary/excel?start_date=${p.startDate}&end_date=${p.endDate}`,
      },
      {
        key: "gstr3b",
        label: "GSTR-3B",
        desc: "Monthly GST return summary — outward supplies and ITC.",
        hasDateRange: true, hasAsOf: false, hasPartySelector: false, hasAccountSelector: false,
        dataEndpoint: (p) => `/api/reports/gst/gstr3b?start_date=${p.startDate}&end_date=${p.endDate}`,
        pdfEndpoint: (p) => `/api/reports/gst/gstr3b/pdf?start_date=${p.startDate}&end_date=${p.endDate}`,
        excelEndpoint: (p) => `/api/reports/gst/gstr3b/excel?start_date=${p.startDate}&end_date=${p.endDate}`,
      },
    ],
  },
  {
    id: "accounting",
    label: "Ledgers & Day Book",
    icon: "📒",
    reports: [
      {
        key: "daybook",
        label: "Day Book",
        desc: "Chronological listing of all journal entries by date.",
        hasDateRange: true, hasAsOf: false, hasPartySelector: false, hasAccountSelector: false,
        dataEndpoint: (p) => `/api/reports/daybook?start_date=${p.startDate}&end_date=${p.endDate}`,
        pdfEndpoint: (p) => `/api/reports/daybook/pdf?start_date=${p.startDate}&end_date=${p.endDate}`,
        excelEndpoint: (p) => `/api/reports/daybook/excel?start_date=${p.startDate}&end_date=${p.endDate}`,
      },
      {
        key: "ledger",
        label: "Account Ledger",
        desc: "All transactions for a specific chart-of-account ledger.",
        hasDateRange: true, hasAsOf: false, hasPartySelector: false, hasAccountSelector: true,
        dataEndpoint: (p) => `/api/reports/ledger/${p.accountId}?start_date=${p.startDate}&end_date=${p.endDate}`,
        pdfEndpoint: (p) => `/api/reports/ledger/${p.accountId}/pdf?start_date=${p.startDate}&end_date=${p.endDate}`,
        excelEndpoint: (p) => `/api/reports/ledger/${p.accountId}/excel?start_date=${p.startDate}&end_date=${p.endDate}`,
      },
      {
        key: "party_ledger",
        label: "Party Ledger",
        desc: "Balance confirmation and ledger for a customer or supplier.",
        hasDateRange: true, hasAsOf: false, hasPartySelector: true, hasAccountSelector: false,
        dataEndpoint: (p) => `/api/reports/party-ledger/${p.partyType}/${p.partyId}?start_date=${p.startDate}&end_date=${p.endDate}`,
        pdfEndpoint: (p) => `/api/reports/party-ledger/${p.partyType}/${p.partyId}/pdf?start_date=${p.startDate}&end_date=${p.endDate}`,
        excelEndpoint: (p) => `/api/reports/party-ledger/${p.partyType}/${p.partyId}/excel?start_date=${p.startDate}&end_date=${p.endDate}`,
      },
      {
        key: "outstanding",
        label: "Outstanding Summary",
        desc: "All unpaid invoices and bills — receivables and payables.",
        hasDateRange: false, hasAsOf: false, hasPartySelector: false, hasAccountSelector: false,
        dataEndpoint: () => `/api/reports/outstanding`,
        pdfEndpoint: () => `/api/reports/outstanding/pdf`,
      },
    ],
  },
  {
    id: "sales",
    label: "Sales Analysis",
    icon: "📈",
    reports: [
      {
        key: "sales_by_customer",
        label: "Sales by Customer",
        desc: "Revenue, invoice count and tax grouped by customer.",
        hasDateRange: true, hasAsOf: false, hasPartySelector: false, hasAccountSelector: false,
        dataEndpoint: (p) => `/api/reports/sales-by-customer?start_date=${p.startDate}&end_date=${p.endDate}`,
        pdfEndpoint: (p) => `/api/reports/sales-by-customer/pdf?start_date=${p.startDate}&end_date=${p.endDate}`,
      },
      {
        key: "sales_by_item",
        label: "Sales by Item",
        desc: "Quantity sold, average rate and revenue per product.",
        hasDateRange: true, hasAsOf: false, hasPartySelector: false, hasAccountSelector: false,
        dataEndpoint: (p) => `/api/reports/sales-by-item?start_date=${p.startDate}&end_date=${p.endDate}`,
        pdfEndpoint: (p) => `/api/reports/sales-by-item/pdf?start_date=${p.startDate}&end_date=${p.endDate}`,
      },
    ],
  },
  {
    id: "inventory",
    label: "Inventory Reports",
    icon: "📦",
    reports: [
      {
        key: "item_movement",
        label: "Item Movement",
        desc: "Opening, inward, outward and closing stock per product.",
        hasDateRange: true, hasAsOf: false, hasPartySelector: false, hasAccountSelector: false,
        dataEndpoint: (p) => `/api/reports/item-movement?start_date=${p.startDate}&end_date=${p.endDate}`,
        pdfEndpoint: (p) => `/api/reports/item-movement/pdf?start_date=${p.startDate}&end_date=${p.endDate}`,
      },
      {
        key: "stock_valuation",
        label: "Stock Valuation",
        desc: "Quantities and financial valuation of inventory.",
        hasDateRange: false, hasAsOf: false, hasPartySelector: false, hasAccountSelector: false,
        dataEndpoint: () => `/api/inventory/products`,
        pdfEndpoint: () => `/api/reports/stock-valuation/pdf`,
      },
      {
        key: "low_stock",
        label: "Low Stock Alert",
        desc: "Items below defined reorder thresholds.",
        hasDateRange: false, hasAsOf: false, hasPartySelector: false, hasAccountSelector: false,
        dataEndpoint: () => `/api/inventory/products`,
        pdfEndpoint: () => `/api/reports/low-stock/pdf`,
      },
    ],
  },
  {
    id: "audit",
    label: "Audit & Compliance",
    icon: "🔍",
    reports: [
      {
        key: "audit_trail",
        label: "Audit Trail",
        desc: "System-wide log of all data changes by users.",
        hasDateRange: false, hasAsOf: false, hasPartySelector: false, hasAccountSelector: false,
        dataEndpoint: () => `/api/reports/audit-trail?limit=100`,
        pdfEndpoint: () => `/api/reports/audit-trail/pdf`,
      },
    ],
  },
];

// ─── KVRow component ──────────────────────────────────────────
function KVRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.kvRow}>
      <Text style={[styles.kvLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.kvValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}



// ─── Main Screen ──────────────────────────────────────────────
export default function ReportsScreen() {
  const { isDarkMode } = useUIStore();

  const colors = isDarkMode
    ? {
        background: "#0F172A", cardBg: "#1E293B", cardBorder: "#334155",
        textPrimary: "#F8FAFC", textSecondary: "#94A3B8", accent: "#38BDF8",
        inputBg: "#1E293B", inputBorder: "#334155", divider: "#334155",
        tableHeaderBg: "#1E293B", activeRowBg: "#0C4A6E",
        btnSecondaryBg: "#334155", btnSecondaryText: "#F8FAFC",
        categoryHeaderBg: "#0F172A", pdfBtnBg: "#BE123C", excelBtnBg: "#166534",
        stripeRow: "#111827",
      }
    : {
        background: "#F8FAFC", cardBg: "#FFFFFF", cardBorder: "#E2E8F0",
        textPrimary: "#0F172A", textSecondary: "#64748B", accent: "#0284C7",
        inputBg: "#FFFFFF", inputBorder: "#CBD5E1", divider: "#CBD5E1",
        tableHeaderBg: "#EBF3FA", activeRowBg: "#E0F2FE",
        btnSecondaryBg: "#E2E8F0", btnSecondaryText: "#0F172A",
        categoryHeaderBg: "#F8FAFC", pdfBtnBg: "#BE123C", excelBtnBg: "#166534",
        stripeRow: "#F8FAFC",
      };

  // ── State ──────────────────────────────────────────────────
  const [selectedReport, setSelectedReport] = useState<ReportMeta | null>(REPORT_CATEGORIES[0].reports[0]);
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(today());
  const [asOf, setAsOf] = useState(today());
  const [accountId, setAccountId] = useState("");
  const [partyId, setPartyId] = useState("");
  const [partyType, setPartyType] = useState<"customer" | "supplier">("customer");
  const [reportData, setReportData] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>("financial");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);



  // ── Data Queries ───────────────────────────────────────────
  const { data: accounts = [] } = useQuery<any[]>({
    queryKey: ["accounts_for_reports"],
    queryFn: async () => {
      try {
        const res = await apiClient.get("/api/v1/banking/accounts/all");
        return res.data;
      } catch (e) {
        const res = await apiClient.get("/api/v1/banking/accounts");
        return res.data;
      }
    },
  });
  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["customers_for_reports"],
    queryFn: async () => (await apiClient.get("/api/customers")).data,
  });
  const { data: gstSummaryKpi } = useQuery<any>({
    queryKey: ["gst_summary_kpi_header"],
    queryFn: async () => {
      try {
        const res = await apiClient.get("/api/v1/reports/gst");
        return res.data;
      } catch (e) {
        return null;
      }
    },
    staleTime: 60000,
  });
  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ["suppliers_for_reports"],
    queryFn: async () => (await apiClient.get("/api/suppliers")).data,
  });

  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      setAccountId(accounts[0].id);
    }
  }, [accounts]);

  const currentParams: ReportParams = { startDate, endDate, asOf, accountId, partyId, partyType };

  // ── Handlers ──────────────────────────────────────────────
  const handleSelectReport = (report: ReportMeta) => {
    setSelectedReport(report);
    setReportData(null);
    setDataError(null);
    if (report.hasAccountSelector && accounts.length > 0) {
      if (!accountId || !accounts.some((a: any) => a.id === accountId)) {
        setAccountId(accounts[0].id);
      }
    }
    if (report.key === "gstr1_summary" || report.key === "gstr2_summary") {
      setStartDate(fyStart());
      setEndDate(today());
    } else if (report.hasDateRange) {
      setStartDate(monthStart());
      setEndDate(today());
    }
  };

  const handleViewData = async () => {
    if (!selectedReport?.dataEndpoint) {
      Alert.alert("Info", "Use PDF or Excel export for this report.");
      return;
    }
    if (selectedReport.hasAccountSelector && !accountId) {
      Alert.alert("Select Account", "Please select an account first."); return;
    }
    if (selectedReport.hasPartySelector && !partyId) {
      Alert.alert("Select Party", "Please select a party first."); return;
    }
    let endpoint = selectedReport.dataEndpoint(currentParams);

    setIsLoadingData(true); setDataError(null); setReportData(null);
    try {
      const res = await apiClient.get(endpoint);
      setReportData(res.data);
    } catch (e: any) {
      setDataError(e.response?.data?.detail || e.message || "Failed to load report.");
    } finally {
      setIsLoadingData(false);
    }
  };

  const handlePdf = async () => {
    if (!selectedReport?.pdfEndpoint) return;
    if (selectedReport.hasAccountSelector && !accountId) { Alert.alert("Select Account", "Please select an account first."); return; }
    if (selectedReport.hasPartySelector && !partyId) { Alert.alert("Select Party", "Please select a party first."); return; }
    setIsPreviewOpen(true);
  };

  // ── Data Preview Renderer ────────────────────────────────
  const renderDataPreview = () => {
    if (isLoadingData) return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading report data...</Text>
      </View>
    );
    if (dataError) return (
      <View style={[styles.errorBox, { borderColor: "#F87171", backgroundColor: isDarkMode ? "#450A0A" : "#FEF2F2" }]}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={[styles.errorText, { color: "#F87171" }]}>{dataError}</Text>
      </View>
    );
    if (!reportData) return null;
    const key = selectedReport?.key;


    // Trial Balance
    if (key === "trial_balance" && Array.isArray(reportData)) {
      const totD = reportData.reduce((s: number, r: any) => s + r.total_debit, 0);
      const totC = reportData.reduce((s: number, r: any) => s + r.total_credit, 0);
      return (
        <View style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>Trial Balance ({reportData.length} accounts)</Text>
          <View style={[styles.tableHeader, { backgroundColor: colors.tableHeaderBg }]}>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 3 }]}>Account</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Debit</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Credit</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Net</Text>
          </View>
          <ScrollView style={{ maxHeight: 300 }}>
            {reportData.map((r: any, i: number) => (
              <View key={r.account_id} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? colors.stripeRow : "transparent" }]}>
                <View style={{ flex: 3 }}>
                  <Text style={[styles.td, { color: colors.textPrimary }]}>{r.account_name}</Text>
                  <Text style={[styles.tdSub, { color: colors.textSecondary }]}>{r.account_type}</Text>
                </View>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmt(r.total_debit)}</Text>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmt(r.total_credit)}</Text>
                <Text style={[styles.td, { color: r.net_balance >= 0 ? colors.textPrimary : "#F87171", flex: 1.5, textAlign: "right" }]}>{fmt(r.net_balance)}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={[styles.totalRow, { borderTopColor: colors.divider }]}>
            <Text style={[styles.totalLabel, { color: colors.textPrimary, flex: 3 }]}>Totals</Text>
            <Text style={[styles.totalValue, { color: colors.accent, flex: 1.5, textAlign: "right" }]}>{fmt(totD)}</Text>
            <Text style={[styles.totalValue, { color: colors.accent, flex: 1.5, textAlign: "right" }]}>{fmt(totC)}</Text>
            <Text style={[styles.totalValue, { color: colors.accent, flex: 1.5, textAlign: "right" }]}>{fmt(totD - totC)}</Text>
          </View>
        </View>
      );
    }

    // Profit & Loss
    if (key === "profit_loss") {
      const d = reportData;
      const netProfit = (d.total_income ?? 0) - (d.total_expenses ?? 0);
      return (
        <View style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>Profit & Loss Statement</Text>
          <Text style={[styles.sectionLabel, { color: colors.accent }]}>Income</Text>
          {(d.income_items || []).map((item: any, i: number) => <KVRow key={i} label={item.name} value={fmt(item.amount)} colors={colors} />)}
          <KVRow label="Total Income" value={fmt(d.total_income)} colors={colors} />
          <Text style={[styles.sectionLabel, { color: colors.accent, marginTop: 12 }]}>Expenses</Text>
          {(d.expense_items || []).map((item: any, i: number) => <KVRow key={i} label={item.name} value={fmt(item.amount)} colors={colors} />)}
          <KVRow label="Total Expenses" value={fmt(d.total_expenses)} colors={colors} />
          <View style={[styles.totalRow, { borderTopColor: colors.divider }]}>
            <Text style={[styles.totalLabel, { color: colors.textPrimary }]}>Net Profit / (Loss)</Text>
            <Text style={[styles.totalValue, { color: netProfit >= 0 ? "#4ADE80" : "#F87171" }]}>{fmt(netProfit)}</Text>
          </View>
        </View>
      );
    }

    // Balance Sheet
    if (key === "balance_sheet") {
      const d = reportData;
      return (
        <View style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>Balance Sheet</Text>
          <Text style={[styles.sectionLabel, { color: colors.accent }]}>Assets</Text>
          {(d.assets || []).map((item: any, i: number) => <KVRow key={i} label={item.name} value={fmt(item.amount)} colors={colors} />)}
          <KVRow label="Total Assets" value={fmt(d.total_assets)} colors={colors} />
          <Text style={[styles.sectionLabel, { color: colors.accent, marginTop: 12 }]}>Liabilities & Equity</Text>
          {(d.liabilities || []).map((item: any, i: number) => <KVRow key={i} label={item.name} value={fmt(item.amount)} colors={colors} />)}
          <KVRow label="Total Liabilities" value={fmt(d.total_liabilities)} colors={colors} />
        </View>
      );
    }

    // Cash Flow
    if (key === "cashflow") {
      const d = reportData;
      return (
        <View style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>Cash Flow Statement</Text>
          <Text style={[styles.sectionLabel, { color: colors.accent }]}>Operating Activities</Text>
          {(d.operating || []).map((item: any, i: number) => <KVRow key={i} label={item.name} value={fmt(item.amount)} colors={colors} />)}
          <KVRow label="Net Operating" value={fmt(d.net_operating)} colors={colors} />
          <Text style={[styles.sectionLabel, { color: colors.accent, marginTop: 12 }]}>Investing Activities</Text>
          {(d.investing || []).map((item: any, i: number) => <KVRow key={i} label={item.name} value={fmt(item.amount)} colors={colors} />)}
          <KVRow label="Net Investing" value={fmt(d.net_investing)} colors={colors} />
          <Text style={[styles.sectionLabel, { color: colors.accent, marginTop: 12 }]}>Financing Activities</Text>
          {(d.financing || []).map((item: any, i: number) => <KVRow key={i} label={item.name} value={fmt(item.amount)} colors={colors} />)}
          <View style={[styles.totalRow, { borderTopColor: colors.divider }]}>
            <Text style={[styles.totalLabel, { color: colors.textPrimary }]}>Net Cash Change</Text>
            <Text style={[styles.totalValue, { color: colors.accent }]}>{fmt(d.net_cash_change)}</Text>
          </View>
        </View>
      );
    }

    // Outstanding
    if (key === "outstanding") {
      const d = reportData || {};
      const recParties = Array.isArray(d.receivables) ? d.receivables : (d.receivables?.parties || []);
      const payParties = Array.isArray(d.payables) ? d.payables : (d.payables?.parties || []);
      const totRec = d.total_receivable ?? d.receivables?.total ?? 0;
      const totPay = d.total_payable ?? d.payables?.total ?? 0;

      return (
        <View style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>Outstanding Summary</Text>
          <Text style={[styles.sectionLabel, { color: colors.accent }]}>Receivables (Customers) — {recParties.length} parties</Text>
          {recParties.map((r: any, i: number) => (
            <KVRow key={i} label={r.party_name || r.name} value={fmt(r.total_due ?? r.outstanding_amount ?? r.amount)} colors={colors} />
          ))}
          <KVRow label="Total Receivable" value={fmt(totRec)} colors={colors} />

          <Text style={[styles.sectionLabel, { color: colors.accent, marginTop: 12 }]}>Payables (Suppliers) — {payParties.length} parties</Text>
          {payParties.map((r: any, i: number) => (
            <KVRow key={i} label={r.party_name || r.name} value={fmt(r.total_due ?? r.outstanding_amount ?? r.amount)} colors={colors} />
          ))}
          <KVRow label="Total Payable" value={fmt(totPay)} colors={colors} />
        </View>
      );
    }

    // Day Book / Ledger / Party Ledger
    if (key === "daybook" || key === "ledger" || key === "party_ledger") {
      const entries = Array.isArray(reportData)
        ? reportData
        : (reportData?.transactions || reportData?.entries || []);
      const title = key === "daybook"
        ? "Day Book (Daily Journal)"
        : key === "ledger"
        ? `Account Ledger ${reportData?.account_name ? `— ${reportData.account_name}` : ""}`
        : `Party Ledger ${reportData?.party_name ? `— ${reportData.party_name}` : ""}`;

      return (
        <View style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>
              {title} ({entries.length} transactions)
            </Text>
            {key === "ledger" && reportData?.closing_balance !== undefined ? (
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  Opening: <Text style={{ fontWeight: "700", color: colors.textPrimary }}>{fmt(reportData.opening_balance)}</Text>
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  Closing: <Text style={{ fontWeight: "700", color: colors.accent }}>{fmt(reportData.closing_balance)}</Text>
                </Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.tableHeader, { backgroundColor: colors.tableHeaderBg }]}>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.2 }]}>Date</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5 }]}>Voucher / Ref</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 2.5 }]}>Narration / Particulars</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Debit (DR)</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Credit (CR)</Text>
            {key === "ledger" ? (
              <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Balance</Text>
            ) : null}
          </View>
          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingRight: 12 }}>
            {entries.map((r: any, i: number) => (
              <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? colors.stripeRow : "transparent" }]}>
                <Text style={[styles.td, { color: colors.textSecondary, flex: 1.2 }]}>{r.entry_date || r.date || ""}</Text>
                <View style={{ flex: 1.5 }}>
                  <Text style={[styles.td, { color: colors.textPrimary, fontWeight: "600" }]}>{r.entry_number || r.voucher_no || r.ref || ""}</Text>
                  {r.reference_type ? <Text style={[styles.tdSub, { color: colors.accent }]}>{r.reference_type}</Text> : null}
                </View>
                <View style={{ flex: 2.5 }}>
                  <Text style={[styles.td, { color: colors.textPrimary }]}>{r.description || r.narration || ""}</Text>
                  {(r.lines || []).map((l: any, idx: number) => (
                    <Text key={idx} style={[styles.tdSub, { color: colors.textSecondary }]}>
                      • {l.account_name} ({l.debit > 0 ? `DR: ${fmt(l.debit)}` : `CR: ${fmt(l.credit)}`})
                    </Text>
                  ))}
                </View>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmt(r.total_debit ?? r.debit)}</Text>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmt(r.total_credit ?? r.credit)}</Text>
                {key === "ledger" ? (
                  <Text style={[styles.td, { color: colors.accent, flex: 1.5, textAlign: "right", fontWeight: "600" }]}>
                    {fmt(r.balance ?? r.running_balance)}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      );
    }

    // GSTR-1 / GSTR-2
    if ((key === "gstr1" || key === "gstr2") && reportData && (Array.isArray(reportData.b2b) || Array.isArray(reportData))) {
      const records = Array.isArray(reportData) ? reportData : (reportData.b2b || []);
      return (
        <View style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>{key === "gstr1" ? "GSTR-1" : "GSTR-2"} — {records.length} records</Text>
          <View style={[styles.tableHeader, { backgroundColor: colors.tableHeaderBg }]}>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.2 }]}>Date</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5 }]}>Number</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 2 }]}>Party</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Taxable</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Tax</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Total</Text>
          </View>
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ paddingRight: 12 }}>
            {records.map((r: any, i: number) => {
              const dateVal = r.date || r.invoice_date || r.bill_date || "";
              const docNo = r.inv_no || r.bill_no || r.invoice_number || r.bill_number || "";
              const partyName = r.receiver_name || r.supplier_name || r.customer_name || "";
              const taxable = r.taxable_value || r.subtotal || 0;
              const tax = r.total_tax || (Number(r.cgst || 0) + Number(r.sgst || 0) + Number(r.igst || 0)) || r.tax_amount || 0;
              const totalVal = r.value || r.total || 0;
              return (
                <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? colors.stripeRow : "transparent" }]}>
                  <Text style={[styles.td, { color: colors.textSecondary, flex: 1.2 }]}>{dateVal}</Text>
                  <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5 }]}>{docNo}</Text>
                  <Text style={[styles.td, { color: colors.textPrimary, flex: 2 }]} numberOfLines={1}>{partyName}</Text>
                  <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmt(taxable)}</Text>
                  <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmt(tax)}</Text>
                  <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmt(totalVal)}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    // GSTR-1/2 Summary
    if ((key === "gstr1_summary" || key === "gstr2_summary") && Array.isArray(reportData)) {
      return (
        <View style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>{key === "gstr1_summary" ? "GSTR-1 Summary" : "GSTR-2 Summary"} — {reportData.length} months</Text>
          <View style={[styles.tableHeader, { backgroundColor: colors.tableHeaderBg }]}>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 2 }]}>Month</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1, textAlign: "center" }]}>Count</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Taxable</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Tax</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Total</Text>
          </View>
          <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ paddingRight: 12 }}>
            {reportData.map((r: any, i: number) => (
              <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? colors.stripeRow : "transparent" }]}>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 2 }]}>{r.month || r.period || ""}</Text>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1, textAlign: "center" }]}>{r.count || r.invoice_count || ""}</Text>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmt(r.taxable_value || r.subtotal)}</Text>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmt(r.tax_amount)}</Text>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmt(r.total)}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      );
    }

    // Sales by Customer
    if (key === "sales_by_customer" && Array.isArray(reportData)) {
      const total = reportData.reduce((s: number, r: any) => s + (r.total_sales || 0), 0);
      return (
        <View style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>Sales by Customer — {reportData.length} customers</Text>
          <View style={[styles.tableHeader, { backgroundColor: colors.tableHeaderBg }]}>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 3 }]}>Customer</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1, textAlign: "center" }]}>Invoices</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Subtotal</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Tax</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Total</Text>
          </View>
          <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ paddingRight: 12 }}>
            {reportData.map((r: any, i: number) => (
              <View key={r.customer_id || i} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? colors.stripeRow : "transparent" }]}>
                <View style={{ flex: 3 }}>
                  <Text style={[styles.td, { color: colors.textPrimary }]}>{r.customer_name}</Text>
                  {r.mobile ? <Text style={[styles.tdSub, { color: colors.textSecondary }]}>{r.mobile}</Text> : null}
                </View>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1, textAlign: "center" }]}>{r.invoice_count}</Text>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmt(r.subtotal)}</Text>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmt(r.tax_amount)}</Text>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmt(r.total_sales)}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={[styles.totalRow, { borderTopColor: colors.divider }]}>
            <Text style={[styles.totalLabel, { color: colors.textPrimary, flex: 3 }]}>Grand Total</Text>
            <Text style={[styles.totalLabel, { color: colors.textPrimary, flex: 1 }]}></Text>
            <Text style={[styles.totalLabel, { color: colors.textPrimary, flex: 1.5 }]}></Text>
            <Text style={[styles.totalLabel, { color: colors.textPrimary, flex: 1.5 }]}></Text>
            <Text style={[styles.totalValue, { color: colors.accent, flex: 1.5, textAlign: "right" }]}>{fmt(total)}</Text>
          </View>
        </View>
      );
    }

    // Sales by Item
    if (key === "sales_by_item" && Array.isArray(reportData)) {
      const total = reportData.reduce((s: number, r: any) => s + (r.total_sales_value || 0), 0);
      return (
        <View style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>Sales by Item — {reportData.length} products</Text>
          <View style={[styles.tableHeader, { backgroundColor: colors.tableHeaderBg }]}>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 3 }]}>Product</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1 }]}>Unit</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Qty Sold</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Avg Rate</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Revenue</Text>
          </View>
          <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ paddingRight: 12 }}>
            {reportData.map((r: any, i: number) => (
              <View key={r.product_id || i} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? colors.stripeRow : "transparent" }]}>
                <View style={{ flex: 3 }}>
                  <Text style={[styles.td, { color: colors.textPrimary }]}>{r.product_name}</Text>
                  {r.sku ? <Text style={[styles.tdSub, { color: colors.textSecondary }]}>SKU: {r.sku}</Text> : null}
                </View>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1 }]}>{r.unit}</Text>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmtQty(r.total_quantity)}</Text>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmt(r.avg_rate)}</Text>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmt(r.total_sales_value)}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={[styles.totalRow, { borderTopColor: colors.divider }]}>
            <Text style={[styles.totalLabel, { color: colors.textPrimary, flex: 3 }]}>Grand Total</Text>
            <Text style={[styles.totalLabel, { color: colors.textPrimary, flex: 1 }]}></Text>
            <Text style={[styles.totalLabel, { color: colors.textPrimary, flex: 1.5 }]}></Text>
            <Text style={[styles.totalLabel, { color: colors.textPrimary, flex: 1.5 }]}></Text>
            <Text style={[styles.totalValue, { color: colors.accent, flex: 1.5, textAlign: "right" }]}>{fmt(total)}</Text>
          </View>
        </View>
      );
    }

    // Item Movement
    if (key === "item_movement" && Array.isArray(reportData)) {
      return (
        <View style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>Item Movement — {reportData.length} products</Text>
          <View style={[styles.tableHeader, { backgroundColor: colors.tableHeaderBg }]}>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 3 }]}>Product</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.2, textAlign: "right" }]}>Opening</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.2, textAlign: "right" }]}>Inward</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.2, textAlign: "right" }]}>Outward</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.2, textAlign: "right" }]}>Closing</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Value</Text>
          </View>
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ paddingRight: 12 }}>
            {reportData.map((r: any, i: number) => (
              <View key={r.product_id || i} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? colors.stripeRow : "transparent" }]}>
                <View style={{ flex: 3 }}>
                  <Text style={[styles.td, { color: colors.textPrimary }]}>{r.product_name}</Text>
                  <Text style={[styles.tdSub, { color: colors.textSecondary }]}>{r.category_name} · {r.unit}</Text>
                </View>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.2, textAlign: "right" }]}>{fmtQty(r.opening_stock)}</Text>
                <Text style={[styles.td, { color: "#4ADE80", flex: 1.2, textAlign: "right" }]}>{fmtQty(r.inward_qty)}</Text>
                <Text style={[styles.td, { color: "#F87171", flex: 1.2, textAlign: "right" }]}>{fmtQty(r.outward_qty)}</Text>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.2, textAlign: "right" }]}>{fmtQty(r.closing_stock)}</Text>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmt(r.valuation)}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      );
    }

    // Stock Valuation
    if (key === "stock_valuation" && Array.isArray(reportData)) {
      const totalValuation = reportData.reduce((s: number, r: any) => s + (Number(r.current_stock || 0) * Number(r.purchase_price || 0)), 0);
      return (
        <View style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>Stock Valuation Summary</Text>
          <View style={[styles.tableHeader, { backgroundColor: colors.tableHeaderBg }]}>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 3 }]}>Product</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.2, textAlign: "right" }]}>Stock</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Price</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.8, textAlign: "right" }]}>Valuation</Text>
          </View>
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ paddingRight: 12 }}>
            {reportData.map((r: any, i: number) => {
              const val = Number(r.current_stock || 0) * Number(r.purchase_price || 0);
              return (
                <View key={r.id || i} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? colors.stripeRow : "transparent" }]}>
                  <View style={{ flex: 3 }}>
                    <Text style={[styles.td, { color: colors.textPrimary }]}>{r.name}</Text>
                    {r.sku ? <Text style={[styles.tdSub, { color: colors.textSecondary }]}>SKU: {r.sku}</Text> : null}
                  </View>
                  <Text style={[styles.td, { color: colors.textPrimary, flex: 1.2, textAlign: "right" }]}>{fmtQty(r.current_stock)}</Text>
                  <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmt(r.purchase_price)}</Text>
                  <Text style={[styles.td, { color: colors.textPrimary, flex: 1.8, textAlign: "right" }]}>{fmt(val)}</Text>
                </View>
              );
            })}
          </ScrollView>
          <View style={[styles.totalRow, { borderTopColor: colors.divider }]}>
            <Text style={[styles.totalLabel, { color: colors.textPrimary, flex: 3 }]}>Total Valuation</Text>
            <Text style={[styles.totalLabel, { color: colors.textPrimary, flex: 1.2 }]}></Text>
            <Text style={[styles.totalLabel, { color: colors.textPrimary, flex: 1.5 }]}></Text>
            <Text style={[styles.totalValue, { color: colors.accent, flex: 1.8, textAlign: "right" }]}>{fmt(totalValuation)}</Text>
          </View>
        </View>
      );
    }

    // Low Stock Alert
    if (key === "low_stock" && Array.isArray(reportData)) {
      const lowStockItems = reportData.filter((r: any) => Number(r.current_stock || 0) <= Number(r.reorder_level || 0));
      return (
        <View style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>Low Stock Alerts — {lowStockItems.length} items</Text>
          <View style={[styles.tableHeader, { backgroundColor: colors.tableHeaderBg }]}>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 3 }]}>Product</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Current Stock</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Reorder Level</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Shortage</Text>
          </View>
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ paddingRight: 12 }}>
            {lowStockItems.map((r: any, i: number) => {
              const shortage = Number(r.reorder_level || 0) - Number(r.current_stock || 0);
              return (
                <View key={r.id || i} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? colors.stripeRow : "transparent" }]}>
                  <View style={{ flex: 3 }}>
                    <Text style={[styles.td, { color: colors.textPrimary }]}>{r.name}</Text>
                    {r.sku ? <Text style={[styles.tdSub, { color: colors.textSecondary }]}>SKU: {r.sku}</Text> : null}
                  </View>
                  <Text style={[styles.td, { color: "#F87171", flex: 1.5, textAlign: "right" }]}>{fmtQty(r.current_stock)}</Text>
                  <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmtQty(r.reorder_level)}</Text>
                  <Text style={[styles.td, { color: "#F87171", flex: 1.5, textAlign: "right" }]}>{fmtQty(shortage)}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    // Audit Trail
    if (key === "audit_trail" && Array.isArray(reportData)) {
      return (
        <View style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>Audit Trail — {reportData.length} events</Text>
          <View style={[styles.tableHeader, { backgroundColor: colors.tableHeaderBg }]}>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.8 }]}>Timestamp</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.2 }]}>Action</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5 }]}>Table</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 2 }]}>User</Text>
          </View>
          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingRight: 12 }}>
            {reportData.map((r: any, i: number) => (
              <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? colors.stripeRow : "transparent" }]}>
                <Text style={[styles.td, { color: colors.textSecondary, flex: 1.8 }]} numberOfLines={2}>{r.timestamp || r.created_at || ""}</Text>
                <View style={{ flex: 1.2, justifyContent: "center" }}>
                  <Text style={[styles.actionTag, {
                    backgroundColor: r.action === "CREATE" ? "#166534" : r.action === "DELETE" ? "#7F1D1D" : "#1E3A5F",
                    color: "#FFFFFF"
                  }]}>{r.action}</Text>
                </View>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5 }]}>{r.table_name || r.entity_type || ""}</Text>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 2 }]}>{r.user_email || r.changed_by || ""}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      );
    }

    // GST Summary Overview
    if (key === "gst_summary" && reportData && typeof reportData === "object") {
      const d = reportData;
      return (
        <View style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>GST Summary Overview</Text>
          <KVRow label="Total Sales Value" value={fmt(d.total_sales_value)} colors={colors} />
          <KVRow label="Output Tax Liability" value={fmt(d.output_tax)} colors={colors} />
          <KVRow label="Total Purchases Value" value={fmt(d.total_purchases_value)} colors={colors} />
          <KVRow label="Input Tax Credit (ITC Claimed)" value={fmt(d.itc_claimed)} colors={colors} />
          <View style={[styles.totalRow, { borderTopColor: colors.divider }]}>
            <Text style={[styles.totalLabel, { color: colors.textPrimary }]}>Net GST Payable / (Refund)</Text>
            <Text style={[styles.totalValue, { color: (d.net_tax_payable ?? 0) >= 0 ? colors.accent : "#4ADE80" }]}>{fmt(d.net_tax_payable)}</Text>
          </View>
        </View>
      );
    }

    // GSTR-1 Summary & GSTR-2 Summary (Category & Monthly Grid)
    if ((key === "gstr1_summary" || key === "gstr2_summary") && reportData && typeof reportData === "object" && reportData.data) {
      const d = reportData;
      const categories = Object.keys(d.data || {});
      const months: string[] = d.months || [];
      return (
        <View style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>
            {key === "gstr1_summary" ? "GSTR-1 Outward Summary" : "GSTR-2 Inward Summary"}
          </Text>
          {d.period ? (
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12, fontFamily: "Segoe UI Variable Text" }}>
              Period: {d.period.start} to {d.period.end}
            </Text>
          ) : null}

          {categories.map((catKey) => {
            const catObj = d.data[catKey] || {};
            const subTypes = Object.keys(catObj);
            return (
              <View key={catKey} style={{ marginBottom: 16 }}>
                <Text style={[styles.sectionLabel, { color: colors.accent, marginBottom: 6 }]}>Category: {catKey}</Text>
                <View style={[styles.tableHeader, { backgroundColor: colors.tableHeaderBg }]}>
                  <Text style={[styles.th, { color: colors.textSecondary, flex: 2 }]}>Type</Text>
                  {months.map((m) => (
                    <Text key={m} style={[styles.th, { color: colors.textSecondary, flex: 1, textAlign: "right" }]}>{m}</Text>
                  ))}
                  <Text style={[styles.th, { color: colors.textSecondary, flex: 1.2, textAlign: "right" }]}>TOTAL</Text>
                </View>
                {subTypes.map((subType, idx) => {
                  const monthVals = catObj[subType] || {};
                  return (
                    <View key={subType} style={[styles.tableRow, { backgroundColor: idx % 2 === 1 ? colors.stripeRow : "transparent" }]}>
                      <Text style={[styles.td, { color: colors.textPrimary, flex: 2, fontWeight: subType === "TOTAL" ? "bold" : "normal" }]}>
                        {subType}
                      </Text>
                      {months.map((m) => (
                        <Text key={m} style={[styles.td, { color: colors.textPrimary, flex: 1, textAlign: "right" }]}>
                          {fmt(monthVals[m])}
                        </Text>
                      ))}
                      <Text style={[styles.td, { color: colors.accent, flex: 1.2, textAlign: "right", fontWeight: "bold" }]}>
                        {fmt(monthVals["TOTAL"])}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      );
    }

    // GSTR-3B Return Summary
    if (key === "gstr3b" && reportData && typeof reportData === "object") {
      const d = reportData;
      const outward = d.outward_supplies || {};
      const inward = d.inward_supplies_itc || {};
      return (
        <View style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>GSTR-3B Monthly Return Summary</Text>
          {d.period ? (
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12, fontFamily: "Segoe UI Variable Text" }}>
              Period: {d.period.start} to {d.period.end}
            </Text>
          ) : null}

          <Text style={[styles.sectionLabel, { color: colors.accent }]}>3.1 Outward Supplies (Output Tax Liability)</Text>
          <KVRow label="Taxable Value" value={fmt(outward.taxable_value)} colors={colors} />
          <KVRow label="Integrated Tax (IGST)" value={fmt(outward.igst)} colors={colors} />
          <KVRow label="Central Tax (CGST)" value={fmt(outward.cgst)} colors={colors} />
          <KVRow label="State/UT Tax (SGST)" value={fmt(outward.sgst)} colors={colors} />
          <KVRow label="Total Output Tax" value={fmt(outward.total_tax)} colors={colors} />

          <Text style={[styles.sectionLabel, { color: colors.accent, marginTop: 14 }]}>4. Eligible ITC (Inward Supplies)</Text>
          <KVRow label="Taxable Value" value={fmt(inward.taxable_value)} colors={colors} />
          <KVRow label="Integrated Tax (IGST)" value={fmt(inward.igst)} colors={colors} />
          <KVRow label="Central Tax (CGST)" value={fmt(inward.cgst)} colors={colors} />
          <KVRow label="State/UT Tax (SGST)" value={fmt(inward.sgst)} colors={colors} />
          <KVRow label="Total ITC Available" value={fmt(inward.itc_available)} colors={colors} />

          <View style={[styles.totalRow, { borderTopColor: colors.divider, marginTop: 14 }]}>
            <Text style={[styles.totalLabel, { color: colors.textPrimary }]}>Net Tax Payable in Cash</Text>
            <Text style={[styles.totalValue, { color: (d.net_tax_payable ?? 0) >= 0 ? colors.accent : "#4ADE80" }]}>
              {fmt(d.net_tax_payable)}
            </Text>
          </View>
        </View>
      );
    }

    // GSTR-1 / GSTR-2 Supplies Table
    if ((key === "gstr1" || key === "gstr2") && Array.isArray(reportData)) {
      return (
        <View style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>
            {key === "gstr1" ? "GSTR-1 Outward Supplies" : "GSTR-2 Inward Supplies"} — {reportData.length} entries
          </Text>
          <View style={[styles.tableHeader, { backgroundColor: colors.tableHeaderBg }]}>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5 }]}>Date</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 2 }]}>Document / Party</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Taxable</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.2, textAlign: "right" }]}>CGST</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.2, textAlign: "right" }]}>SGST</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.2, textAlign: "right" }]}>IGST</Text>
            <Text style={[styles.th, { color: colors.textSecondary, flex: 1.5, textAlign: "right" }]}>Total</Text>
          </View>
          <ScrollView style={{ maxHeight: 320 }}>
            {reportData.map((r: any, i: number) => (
              <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? colors.stripeRow : "transparent" }]}>
                <Text style={[styles.td, { color: colors.textSecondary, flex: 1.5 }]}>{r.date || r.invoice_date || r.bill_date || ""}</Text>
                <View style={{ flex: 2 }}>
                  <Text style={[styles.td, { color: colors.textPrimary }]}>{r.invoice_number || r.bill_number || r.party_name || ""}</Text>
                  {r.gstin || r.customer_name ? <Text style={[styles.tdSub, { color: colors.textSecondary }]}>{r.customer_name || r.vendor_name || ""} {r.gstin ? `(${r.gstin})` : ""}</Text> : null}
                </View>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmt(r.taxable_value || r.subtotal)}</Text>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.2, textAlign: "right" }]}>{fmt(r.cgst || r.cgst_amount)}</Text>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.2, textAlign: "right" }]}>{fmt(r.sgst || r.sgst_amount)}</Text>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.2, textAlign: "right" }]}>{fmt(r.igst || r.igst_amount)}</Text>
                <Text style={[styles.td, { color: colors.textPrimary, flex: 1.5, textAlign: "right" }]}>{fmt(r.total || r.total_amount)}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      );
    }

    // Smart Fallback
    if (reportData && typeof reportData === "object") {
      const keys = Object.keys(reportData);
      const primitiveKeys = keys.filter(k => {
        const v = reportData[k];
        return typeof v === "number" || typeof v === "string" || typeof v === "boolean";
      });

      if (primitiveKeys.length > 0) {
        return (
          <View style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>{selectedReport?.label || "Report Data"}</Text>
            {primitiveKeys.map((k) => (
              <KVRow key={k} label={k.replace(/_/g, " ").toUpperCase()} value={typeof reportData[k] === "number" ? fmt(reportData[k]) : String(reportData[k])} colors={colors} />
            ))}
          </View>
        );
      }
    }

    return (
      <View style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>Report Data Loaded</Text>
        <Text style={[styles.td, { color: colors.textSecondary }]}>
          {Array.isArray(reportData)
            ? `${reportData.length} records returned.`
            : "Report data loaded successfully."}
        </Text>
      </View>
    );
  };

  // ─── Render ──────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Left Panel: Report Categories ─────────────── */}
      <View style={[
        styles.leftPanel,
        { backgroundColor: colors.cardBg, borderRightColor: selectedReport ? colors.divider : "transparent" }
      ]}>
        {/* Header — per AGENTS.md standard */}
        <View style={styles.masterHeader}>
          <Text style={[styles.breadcrumb, { color: colors.accent }]}>ERP / REPORTS</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 4 }}>
            <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Reports Centre</Text>
            <Button
              title="❓ Help & Guide"
              onPress={() => setIsHelpModalOpen(true)}
              variant="secondary"
              size="medium"
            />
          </View>
          <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
            Financial, GST, CA & Communication, ledger and inventory reports
          </Text>
        </View>


        <ScrollView style={styles.categoryList} showsVerticalScrollIndicator={true}>
          {REPORT_CATEGORIES.map((cat) => (
            <View key={cat.id}>
              <Pressable
                onPress={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
                style={[styles.categoryHeader, { backgroundColor: colors.categoryHeaderBg }]}
              >
                <View style={styles.catHeaderRow}>
                  <Text style={styles.catIcon}>{cat.icon}</Text>
                  <Text style={[styles.catLabel, { color: colors.textPrimary }]}>{cat.label}</Text>
                  <Text style={[styles.catChevron, { color: colors.textSecondary }]}>
                    {expandedCategory === cat.id ? "▲" : "▼"}
                  </Text>
                </View>
              </Pressable>

              {expandedCategory === cat.id && cat.reports.map((report) => {
                const isActive = selectedReport?.key === report.key;
                return (
                  <Pressable
                    key={report.key}
                    onPress={() => handleSelectReport(report)}
                    onHoverIn={() => setHoveredCard(report.key)}
                    onHoverOut={() => setHoveredCard(null)}
                    style={[
                      styles.reportItem,
                      {
                        backgroundColor: isActive ? colors.activeRowBg : hoveredCard === report.key ? colors.tableHeaderBg : "transparent",
                        borderLeftColor: isActive ? colors.accent : "transparent",
                      },
                    ]}
                  >
                    <Text style={[styles.reportItemLabel, { color: isActive ? colors.accent : colors.textPrimary }]}>
                      {report.label}
                    </Text>
                    <Text style={[styles.reportItemDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                      {report.desc}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      {/* ── Right Panel: Controls + Preview ──────────── */}
      {selectedReport ? (
        <ScrollView style={styles.rightPanel} contentContainerStyle={styles.rightPanelContent}>
          {/* Executive Summary KPI Bar */}
          <View style={[styles.kpiBar, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>TOTAL SALES</Text>
              <Text style={[styles.kpiValue, { color: "#10B981" }]}>{fmt(gstSummaryKpi?.total_sales_value)}</Text>
            </View>
            <View style={[styles.kpiDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>OUTPUT TAX (GST)</Text>
              <Text style={[styles.kpiValue, { color: "#3B82F6" }]}>{fmt(gstSummaryKpi?.output_tax)}</Text>
            </View>
            <View style={[styles.kpiDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>ITC CLAIMED</Text>
              <Text style={[styles.kpiValue, { color: "#8B5CF6" }]}>{fmt(gstSummaryKpi?.itc_claimed)}</Text>
            </View>
            <View style={[styles.kpiDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>NET TAX PAYABLE</Text>
              <Text style={[styles.kpiValue, { color: (gstSummaryKpi?.net_tax_payable ?? 0) >= 0 ? colors.accent : "#10B981" }]}>
                {fmt(gstSummaryKpi?.net_tax_payable)}
              </Text>
            </View>
          </View>

          {/* Report Title */}
          <View>
            <Text style={[styles.breadcrumb, { color: colors.accent }]}>
              REPORTS / {selectedReport.label.toUpperCase()}
            </Text>
            <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>{selectedReport.label}</Text>
            <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>{selectedReport.desc}</Text>
          </View>

          {/* Parameters Card */}
          <View style={[styles.filterCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Text style={[styles.filterTitle, { color: colors.textSecondary }]}>REPORT PARAMETERS</Text>

            {/* Date Range */}
            {selectedReport.hasDateRange && (
              <View style={styles.filterRow}>
                <View style={styles.filterGroup}>
                  <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>From Date</Text>
                  <DatePicker
                    style={{ width: 160 }}
                    value={startDate}
                    onChange={setStartDate}
                  />
                </View>
                <View style={styles.filterGroup}>
                  <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>To Date</Text>
                  <DatePicker
                    style={{ width: 160 }}
                    value={endDate}
                    onChange={setEndDate}
                  />
                </View>
                <View style={styles.filterGroup}>
                  <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Quick Set</Text>
                  <View style={styles.presetRow}>
                    <Pressable onPress={() => { setStartDate(monthStart()); setEndDate(today()); }}
                      style={[styles.presetBtn, { backgroundColor: colors.btnSecondaryBg }]}>
                      <Text style={[styles.presetBtnText, { color: colors.btnSecondaryText }]}>This Month</Text>
                    </Pressable>
                    <Pressable onPress={() => { setStartDate(fyStart()); setEndDate(today()); }}
                      style={[styles.presetBtn, { backgroundColor: colors.btnSecondaryBg }]}>
                      <Text style={[styles.presetBtnText, { color: colors.btnSecondaryText }]}>This FY</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {/* As-Of Date */}
            {selectedReport.hasAsOf && (
              <View style={styles.filterRow}>
                <View style={styles.filterGroup}>
                  <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>As of Date</Text>
                  <DatePicker
                    style={{ width: 160 }}
                    value={asOf}
                    onChange={setAsOf}
                  />
                </View>
              </View>
            )}

            {/* Account Selector */}
            {selectedReport.hasAccountSelector && (
              <View>
                <Text style={[styles.filterLabel, { color: colors.textSecondary, marginBottom: 6 }]}>Select Account</Text>
                <ScrollView style={[styles.selectorList, { borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]} contentContainerStyle={{ paddingRight: 12 }}>
                  {accounts.map((acc: any) => (
                    <Pressable key={acc.id} onPress={() => setAccountId(acc.id)}
                      style={[styles.selectorItem, { backgroundColor: accountId === acc.id ? colors.activeRowBg : "transparent" }]}>
                      <Text style={[styles.selectorItemText, { color: accountId === acc.id ? colors.accent : colors.textPrimary }]}>
                        {acc.name || acc.account_name}
                      </Text>
                      <Text style={[styles.selectorItemSub, { color: colors.textSecondary }]}>{acc.account_type || acc.type}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Party Selector */}
            {selectedReport.hasPartySelector && (
              <View style={{ gap: 10 }}>
                <View>
                  <Text style={[styles.filterLabel, { color: colors.textSecondary, marginBottom: 6 }]}>Party Type</Text>
                  <View style={styles.toggleRow}>
                    {(["customer", "supplier"] as const).map((pt) => (
                      <Pressable key={pt} onPress={() => { setPartyType(pt); setPartyId(""); }}
                        style={[styles.toggleBtn, { backgroundColor: partyType === pt ? colors.accent : colors.btnSecondaryBg }]}>
                        <Text style={[styles.toggleBtnText, { color: partyType === pt ? "#FFFFFF" : colors.btnSecondaryText }]}>
                          {pt === "customer" ? "Customer" : "Supplier"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View>
                  <Text style={[styles.filterLabel, { color: colors.textSecondary, marginBottom: 6 }]}>
                    Select {partyType === "customer" ? "Customer" : "Supplier"}
                  </Text>
                  <ScrollView style={[styles.selectorList, { borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]} contentContainerStyle={{ paddingRight: 12 }}>
                    {(partyType === "customer" ? customers : suppliers).map((p: any) => (
                      <Pressable key={p.id} onPress={() => setPartyId(p.id)}
                        style={[styles.selectorItem, { backgroundColor: partyId === p.id ? colors.activeRowBg : "transparent" }]}>
                        <Text style={[styles.selectorItemText, { color: partyId === p.id ? colors.accent : colors.textPrimary }]}>{p.name}</Text>
                        {p.phone ? <Text style={[styles.selectorItemSub, { color: colors.textSecondary }]}>{p.phone}</Text> : null}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              {selectedReport.dataEndpoint && (
                <Pressable onPress={handleViewData} style={[styles.actionBtn, { backgroundColor: colors.accent }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {isLoadingData && <ActivityIndicator size="small" color="#FFFFFF" style={{ width: 18, height: 18 }} />}
                    <Text style={styles.actionBtnText}>👁  View Data</Text>
                  </View>
                </Pressable>
              )}
              {selectedReport.pdfEndpoint && (
                <Pressable onPress={handlePdf} style={[styles.actionBtn, { backgroundColor: colors.pdfBtnBg }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {isPdfLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" style={{ width: 18, height: 18 }} />
                    ) : (
                      <Image
                        source={require("../components/print_icon_for_print_preview.png")}
                        style={{ width: 18, height: 18 }}
                        resizeMode="contain"
                      />
                    )}
                    <Text style={styles.actionBtnText}>Print / Preview</Text>
                  </View>
                </Pressable>
              )}

            </View>
          </View>

          {/* Data Preview */}
          {renderDataPreview()}
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Select a Report</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Choose a report from the left panel to{"\n"}view data, export PDF or download Excel.
          </Text>
        </View>
      )}

      {/* NATIVE PDF PREVIEW MODAL */}
      <PdfPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={`Print Preview — ${selectedReport?.label || ""}`}
        subtitle={selectedReport ? `Review, configure, and output ${selectedReport.label}` : ""}
        breadcrumb="reports / preview"
        reportKey={`${selectedReport?.key || "report"}`}
        defaultOrientation={
          selectedReport && ["gstr1", "gstr2", "gstr3b", "gstr1_summary", "gstr2_summary", "daybook", "trial_balance", "cdn_register", "stock_valuation", "sales_by_customer", "sales_by_item"].includes(selectedReport.key)
            ? "landscape"
            : "portrait"
        }
        getPdfUrl={(orientation, search, theme, copyType) => {
          if (!selectedReport || !selectedReport.pdfEndpoint) return "";
          const baseEndpoint = selectedReport.pdfEndpoint(currentParams);
          const sep = baseEndpoint.includes("?") ? "&" : "?";
          return `${apiClient.defaults.baseURL}${baseEndpoint}${sep}orientation=${orientation}&search=${encodeURIComponent(search)}`;
        }}
        getExcelUrl={selectedReport?.excelEndpoint ? () => {
          if (!selectedReport?.excelEndpoint) return "";
          return `${apiClient.defaults.baseURL}${selectedReport.excelEndpoint(currentParams)}`;
        } : undefined}
      />

      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        defaultCategory="REPORTS_GUIDE"
      />
    </View>

  );
}

// ─── StyleSheet ───────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: "row" },
  // Left panel
  leftPanel: { width: 296, flexShrink: 0, borderRightWidth: 1 },
  masterHeader: { padding: 24, gap: 4 },
  breadcrumb: { fontSize: 12, fontWeight: "700", letterSpacing: 1.2, fontFamily: "Segoe UI Variable Display", textTransform: "uppercase" },
  screenTitle: { fontSize: 28, fontWeight: "800", fontFamily: "Segoe UI Variable Display", letterSpacing: 0.3 },
  screenSubtitle: { fontSize: 14, fontFamily: "Segoe UI Variable Text", marginTop: 2 },
  categoryList: { flex: 1 },
  categoryHeader: { paddingHorizontal: 16, paddingVertical: 10 },
  catHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  catIcon: { fontSize: 18.5 },
  catLabel: { flex: 1, fontSize: 13, fontWeight: "700", fontFamily: "Segoe UI Variable Display", letterSpacing: 0.3, textTransform: "uppercase" },
  catChevron: { fontSize: 12 },
  reportItem: { paddingHorizontal: 20, paddingVertical: 10, borderLeftWidth: 3 },
  reportItemLabel: { fontSize: 15, fontWeight: "600", fontFamily: "Segoe UI Variable Display" },
  reportItemDesc: { fontSize: 13, fontFamily: "Segoe UI Variable Text", marginTop: 2, lineHeight: 16 },
  // Right panel
  rightPanel: { flex: 1 },
  rightPanelContent: { padding: 24, gap: 20 },
  // Filters card
  filterCard: { borderWidth: 1, borderRadius: 10, padding: 20, gap: 16 },
  filterTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1, fontFamily: "Segoe UI Variable Display", textTransform: "uppercase" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-end" },
  filterGroup: { gap: 6 },
  filterLabel: { fontSize: 13, fontWeight: "600", fontFamily: "Segoe UI Variable Text", textTransform: "uppercase", letterSpacing: 0.5 },
  dateInput: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, fontFamily: "Segoe UI Variable Text", width: 150 },
  presetRow: { flexDirection: "row", gap: 8 },
  presetBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  presetBtnText: { fontSize: 14, fontFamily: "Segoe UI Variable Text", fontWeight: "600" },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  toggleBtnText: { fontSize: 14, fontWeight: "700", fontFamily: "Segoe UI Variable Text" },
  selectorList: { borderWidth: 1, borderRadius: 6, maxHeight: 180 },
  selectorItem: { paddingLeft: 12, paddingRight: 24, paddingVertical: 8 },
  selectorItemText: { fontSize: 15, fontFamily: "Segoe UI Variable Text", fontWeight: "600" },
  selectorItemSub: { fontSize: 13, fontFamily: "Segoe UI Variable Text" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, minWidth: 130 },
  actionBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", fontFamily: "Segoe UI Variable Display" },
  // Preview
  previewCard: { borderWidth: 1, borderRadius: 10, padding: 20, gap: 8 },
  previewTitle: { fontSize: 18.5, fontWeight: "700", fontFamily: "Segoe UI Variable Display", marginBottom: 4 },
  sectionLabel: { fontSize: 13, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", fontFamily: "Segoe UI Variable Display", marginTop: 4 },
  kvGrid: { gap: 0 },
  kvRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(128,128,128,0.15)" },
  kvLabel: { fontSize: 15, fontFamily: "Segoe UI Variable Text" },
  kvValue: { fontSize: 15, fontWeight: "700", fontFamily: "Segoe UI Variable Display" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 12, marginTop: 8, borderTopWidth: 2 },
  totalLabel: { fontSize: 15, fontWeight: "700", fontFamily: "Segoe UI Variable Display" },
  totalValue: { fontSize: 18.5, fontWeight: "800", fontFamily: "Segoe UI Variable Display" },
  // Tables
  tableHeader: { flexDirection: "row", paddingLeft: 12, paddingRight: 26, paddingVertical: 8, borderRadius: 6, marginBottom: 2 },
  th: { fontSize: 13, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", fontFamily: "Segoe UI Variable Display" },
  tableRow: { flexDirection: "row", paddingLeft: 12, paddingRight: 14, paddingVertical: 8, alignItems: "center" },
  td: { fontSize: 14, fontFamily: "Segoe UI Variable Text" },
  tdSub: { fontSize: 12, fontFamily: "Segoe UI Variable Text", marginTop: 1 },
  actionTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 12, fontWeight: "700", fontFamily: "Segoe UI Variable Display", alignSelf: "flex-start" },
  // States
  centerBox: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 15, fontFamily: "Segoe UI Variable Text" },
  errorBox: { borderWidth: 1, borderRadius: 8, padding: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  errorIcon: { fontSize: 23 },
  errorText: { flex: 1, fontSize: 15, fontFamily: "Segoe UI Variable Text" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 23, fontWeight: "700", fontFamily: "Segoe UI Variable Display" },
  emptySubtitle: { fontSize: 15, fontFamily: "Segoe UI Variable Text", textAlign: "center", lineHeight: 20 },
  formGroup: { gap: 8 },
  inputLabel: {
    fontSize: 14.5,
    fontWeight: "700",
    letterSpacing: 0.5,
    fontFamily: "Segoe UI Variable Text",
  },
  textInputUWP: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    fontFamily: "Segoe UI Variable Text",
  },
  kpiBar: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    justifyContent: "space-between",
    alignItems: "center",
  },
  kpiItem: {
    flex: 1,
    gap: 4,
  },
  kpiLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    fontFamily: "Segoe UI Variable Display",
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "800",
    fontFamily: "Segoe UI Variable Display",
  },
  kpiDivider: {
    width: 1,
    height: 36,
    marginHorizontal: 16,
  },
});
