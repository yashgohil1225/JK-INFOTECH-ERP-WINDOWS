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
import { useAuthStore } from "../store/authStore";
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
const formatYYYYMMDD = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const today = (): string => formatYYYYMMDD(new Date());

const monthStart = (): string => {
  const d = new Date();
  return formatYYYYMMDD(new Date(d.getFullYear(), d.getMonth(), 1));
};

const monthEnd = (): string => {
  const d = new Date();
  return formatYYYYMMDD(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};

const lastMonthStart = (): string => {
  const d = new Date();
  return formatYYYYMMDD(new Date(d.getFullYear(), d.getMonth() - 1, 1));
};

const lastMonthEnd = (): string => {
  const d = new Date();
  return formatYYYYMMDD(new Date(d.getFullYear(), d.getMonth(), 0));
};

const fyStart = (): string => {
  const d = new Date();
  const yr = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear();
  return `${yr}-04-01`;
};

const fyEnd = (): string => {
  const d = new Date();
  const yr = d.getMonth() < 3 ? d.getFullYear() : d.getFullYear() + 1;
  return `${yr}-03-31`;
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
  const { company } = useAuthStore();

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
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(monthEnd());
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
    queryKey: ["accounts_for_reports", company?.id],
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
    queryKey: ["customers_for_reports", company?.id],
    queryFn: async () => (await apiClient.get("/api/customers")).data,
  });
  const { data: gstSummaryKpi } = useQuery<any>({
    queryKey: ["gst_summary_kpi_header", company?.id],
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
    queryKey: ["suppliers_for_reports", company?.id],
    queryFn: async () => (await apiClient.get("/api/suppliers")).data,
  });

  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      setAccountId(accounts[0].id);
    }
  }, [accounts]);

  // Auto-refresh active report when parameters or date range change
  useEffect(() => {
    if (selectedReport && reportData) {
      handleViewData();
    }
  }, [startDate, endDate, asOf, accountId, partyId, partyType]);

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
      setEndDate(monthEnd());
    }
  };

  const handleViewData = async (overrideParams?: Partial<ReportParams>) => {
    if (!selectedReport?.dataEndpoint && !selectedReport?.pdfEndpoint) {
      Alert.alert("Info", "No preview endpoint available for this report.");
      return;
    }
    const params: ReportParams = {
      startDate, endDate, asOf, accountId, partyId, partyType,
      ...overrideParams
    };
    if (selectedReport?.hasAccountSelector && !params.accountId) {
      Alert.alert("Select Account", "Please select an account first."); return;
    }
    if (selectedReport?.hasPartySelector && !params.partyId) {
      Alert.alert("Select Party", "Please select a party first."); return;
    }

    setIsLoadingData(true); setDataError(null); setReportData(null);

    try {
      if (selectedReport.dataEndpoint) {
        let endpoint = selectedReport.dataEndpoint(params);
        const res = await apiClient.get(endpoint);
        setReportData(res.data);
      }
    } catch (e: any) {
      console.warn("View Data Error:", e);
      setDataError(e.response?.data?.detail || e.message || "Failed to load report.");
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleQuickSet = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    handleViewData({ startDate: start, endDate: end });
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

    const companyName = company?.name || "JK INFOTECH PVT LTD.";
    const gstinNum = company?.gst_number || "URP";

    const HeaderDoc = ({ title, periodText }: { title: string; periodText?: string }) => (
      <View style={{ alignItems: "center", marginBottom: 16, borderBottomWidth: 2, borderBottomColor: "#0F172A", paddingBottom: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A", letterSpacing: 0.5, fontFamily: "Segoe UI Variable Display" }}>
          {companyName}
        </Text>
        <Text style={{ fontSize: 12, fontWeight: "700", color: "#475569", marginTop: 2, fontFamily: "Segoe UI Variable Text" }}>
          GSTIN: {gstinNum}
        </Text>
        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accent, marginTop: 4, fontFamily: "Segoe UI Variable Display", textTransform: "uppercase" }}>
          {title} {periodText ? periodText : `FROM : ${startDate} TO : ${endDate}`}
        </Text>
      </View>
    );


    // 1. Trial Balance
    if (key === "trial_balance" && Array.isArray(reportData)) {
      const totD = reportData.reduce((s: number, r: any) => s + Number(r.total_debit || 0), 0);
      const totC = reportData.reduce((s: number, r: any) => s + Number(r.total_credit || 0), 0);
      return (
        <View style={[styles.previewCard, { backgroundColor: "#FFFFFF", borderColor: colors.cardBorder, padding: 20 }]}>
          <HeaderDoc title="TRIAL BALANCE STATEMENT" />
          <View style={[styles.tableHeader, { backgroundColor: "#F1F5F9" }]}>
            <Text style={[styles.reportTh, { flex: 3 }]}>ACCOUNT NAME</Text>
            <Text style={[styles.reportTh, { flex: 2 }]}>GROUP / TYPE</Text>
            <Text style={[styles.reportTh, { flex: 1.5, textAlign: "right" }]}>DEBIT (DR) RS.</Text>
            <Text style={[styles.reportTh, { flex: 1.5, textAlign: "right" }]}>CREDIT (CR) RS.</Text>
            <Text style={[styles.reportTh, { flex: 1.5, textAlign: "right" }]}>NET BALANCE RS.</Text>
          </View>
          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingRight: 12 }}>
            {reportData.map((r: any, i: number) => (
              <View key={r.account_id || i} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }]}>
                <Text style={[styles.reportTd, { flex: 3, fontWeight: "600" }]}>{r.account_name}</Text>
                <Text style={[styles.reportTd, { flex: 2, color: "#64748B" }]}>{r.account_type}</Text>
                <Text style={[styles.reportTd, { flex: 1.5, textAlign: "right" }]}>{fmt(r.total_debit)}</Text>
                <Text style={[styles.reportTd, { flex: 1.5, textAlign: "right" }]}>{fmt(r.total_credit)}</Text>
                <Text style={[styles.reportTd, { flex: 1.5, textAlign: "right", fontWeight: "700", color: r.net_balance >= 0 ? "#0F172A" : "#EF4444" }]}>{fmt(r.net_balance)}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: "row", backgroundColor: "#0F172A", paddingVertical: 8, marginTop: 8 }}>
            <Text style={{ flex: 5, fontSize: 12, fontWeight: "800", color: "#FFFFFF", paddingLeft: 12, fontFamily: "Segoe UI Variable Display" }}>TOTALS RS.:</Text>
            <Text style={{ flex: 1.5, fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "right", fontFamily: "Consolas" }}>{fmt(totD)}</Text>
            <Text style={{ flex: 1.5, fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "right", fontFamily: "Consolas" }}>{fmt(totC)}</Text>
            <Text style={{ flex: 1.5, fontSize: 12, fontWeight: "800", color: "#38BDF8", textAlign: "right", paddingRight: 12, fontFamily: "Consolas" }}>{fmt(totD - totC)}</Text>
          </View>
        </View>
      );
    }

    // 2. Profit & Loss
    if (key === "profit_loss") {
      const d = reportData || {};
      const netProfit = (d.total_income ?? 0) - (d.total_expenses ?? 0);
      return (
        <View style={[styles.previewCard, { backgroundColor: "#FFFFFF", borderColor: colors.cardBorder, padding: 20 }]}>
          <HeaderDoc title="PROFIT & LOSS STATEMENT" />
          <View style={{ backgroundColor: "#E2E8F0", paddingVertical: 6, paddingHorizontal: 8, marginBottom: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#0F172A", fontFamily: "Segoe UI Variable Display" }}>INCOME ACCOUNTS</Text>
          </View>
          {(d.income_items || []).map((item: any, i: number) => <KVRow key={i} label={item.name} value={fmt(item.amount)} colors={colors} />)}
          <KVRow label="TOTAL REVENUE / INCOME" value={fmt(d.total_income)} colors={colors} />

          <View style={{ backgroundColor: "#E2E8F0", paddingVertical: 6, paddingHorizontal: 8, marginTop: 14, marginBottom: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#0F172A", fontFamily: "Segoe UI Variable Display" }}>EXPENSE ACCOUNTS</Text>
          </View>
          {(d.expense_items || []).map((item: any, i: number) => <KVRow key={i} label={item.name} value={fmt(item.amount)} colors={colors} />)}
          <KVRow label="TOTAL OPERATING EXPENSES" value={fmt(d.total_expenses)} colors={colors} />

          <View style={{ flexDirection: "row", backgroundColor: "#0F172A", paddingVertical: 10, paddingHorizontal: 12, marginTop: 16 }}>
            <Text style={{ flex: 1, fontSize: 13, fontWeight: "800", color: "#FFFFFF", fontFamily: "Segoe UI Variable Display" }}>NET PROFIT / (NET LOSS) RS.:</Text>
            <Text style={{ fontSize: 14, fontWeight: "800", color: netProfit >= 0 ? "#4ADE80" : "#F87171", fontFamily: "Consolas" }}>{fmt(netProfit)}</Text>
          </View>
        </View>
      );
    }

    // 3. Balance Sheet
    if (key === "balance_sheet") {
      const d = reportData || {};
      return (
        <View style={[styles.previewCard, { backgroundColor: "#FFFFFF", borderColor: colors.cardBorder, padding: 20 }]}>
          <HeaderDoc title="BALANCE SHEET STATEMENT" periodText={`AS OF : ${asOf}`} />
          <View style={{ backgroundColor: "#E2E8F0", paddingVertical: 6, paddingHorizontal: 8, marginBottom: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#0F172A", fontFamily: "Segoe UI Variable Display" }}>ASSETS</Text>
          </View>
          {(d.assets || []).map((item: any, i: number) => <KVRow key={i} label={item.name} value={fmt(item.amount)} colors={colors} />)}
          <KVRow label="TOTAL ASSETS" value={fmt(d.total_assets)} colors={colors} />

          <View style={{ backgroundColor: "#E2E8F0", paddingVertical: 6, paddingHorizontal: 8, marginTop: 14, marginBottom: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#0F172A", fontFamily: "Segoe UI Variable Display" }}>LIABILITIES & EQUITY</Text>
          </View>
          {(d.liabilities || []).map((item: any, i: number) => <KVRow key={i} label={item.name} value={fmt(item.amount)} colors={colors} />)}
          <KVRow label="TOTAL LIABILITIES & CAPITAL" value={fmt(d.total_liabilities)} colors={colors} />
        </View>
      );
    }

    // 4. Cash Flow
    if (key === "cashflow") {
      const d = reportData || {};
      return (
        <View style={[styles.previewCard, { backgroundColor: "#FFFFFF", borderColor: colors.cardBorder, padding: 20 }]}>
          <HeaderDoc title="CASH FLOW STATEMENT" />
          <View style={{ backgroundColor: "#E2E8F0", paddingVertical: 6, paddingHorizontal: 8, marginBottom: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#0F172A", fontFamily: "Segoe UI Variable Display" }}>OPERATING ACTIVITIES</Text>
          </View>
          {(d.operating || []).map((item: any, i: number) => <KVRow key={i} label={item.name} value={fmt(item.amount)} colors={colors} />)}
          <KVRow label="NET OPERATING CASH FLOW" value={fmt(d.net_operating)} colors={colors} />

          <View style={{ backgroundColor: "#E2E8F0", paddingVertical: 6, paddingHorizontal: 8, marginTop: 12, marginBottom: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#0F172A", fontFamily: "Segoe UI Variable Display" }}>INVESTING ACTIVITIES</Text>
          </View>
          {(d.investing || []).map((item: any, i: number) => <KVRow key={i} label={item.name} value={fmt(item.amount)} colors={colors} />)}
          <KVRow label="NET INVESTING CASH FLOW" value={fmt(d.net_investing)} colors={colors} />

          <View style={{ backgroundColor: "#E2E8F0", paddingVertical: 6, paddingHorizontal: 8, marginTop: 12, marginBottom: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#0F172A", fontFamily: "Segoe UI Variable Display" }}>FINANCING ACTIVITIES</Text>
          </View>
          {(d.financing || []).map((item: any, i: number) => <KVRow key={i} label={item.name} value={fmt(item.amount)} colors={colors} />)}

          <View style={{ flexDirection: "row", backgroundColor: "#0F172A", paddingVertical: 10, paddingHorizontal: 12, marginTop: 16 }}>
            <Text style={{ flex: 1, fontSize: 13, fontWeight: "800", color: "#FFFFFF", fontFamily: "Segoe UI Variable Display" }}>NET CHANGE IN CASH RS.:</Text>
            <Text style={{ fontSize: 14, fontWeight: "800", color: "#38BDF8", fontFamily: "Consolas" }}>{fmt(d.net_cash_change)}</Text>
          </View>
        </View>
      );
    }

    // 5. Outstanding Summary
    if (key === "outstanding") {
      const d = reportData || {};
      const recParties = Array.isArray(d.receivables) ? d.receivables : (d.receivables?.parties || []);
      const payParties = Array.isArray(d.payables) ? d.payables : (d.payables?.parties || []);
      const totRec = d.total_receivable ?? d.receivables?.total ?? 0;
      const totPay = d.total_payable ?? d.payables?.total ?? 0;

      return (
        <View style={[styles.previewCard, { backgroundColor: "#FFFFFF", borderColor: colors.cardBorder, padding: 20 }]}>
          <HeaderDoc title="OUTSTANDING RECEIVABLES & PAYABLES SUMMARY" periodText={`AS OF : ${endDate}`} />
          
          <View style={{ backgroundColor: "#E2E8F0", paddingVertical: 6, paddingHorizontal: 8, marginTop: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#0F172A", fontFamily: "Segoe UI Variable Display" }}>
              RECEIVABLES (CUSTOMERS) — {recParties.length} PARTIES
            </Text>
          </View>
          {recParties.map((r: any, i: number) => (
            <KVRow key={i} label={r.party_name || r.name} value={fmt(r.total_due ?? r.outstanding_amount ?? r.amount)} colors={colors} />
          ))}
          <View style={{ flexDirection: "row", backgroundColor: "#F1F5F9", paddingVertical: 6, paddingHorizontal: 8, marginBottom: 16 }}>
            <Text style={{ flex: 1, fontSize: 12, fontWeight: "800", color: "#0F172A" }}>TOTAL RECEIVABLE RS.:</Text>
            <Text style={{ fontSize: 13, fontWeight: "800", color: colors.accent }}>{fmt(totRec)}</Text>
          </View>

          <View style={{ backgroundColor: "#E2E8F0", paddingVertical: 6, paddingHorizontal: 8, marginTop: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#0F172A", fontFamily: "Segoe UI Variable Display" }}>
              PAYABLES (SUPPLIERS) — {payParties.length} PARTIES
            </Text>
          </View>
          {payParties.map((r: any, i: number) => (
            <KVRow key={i} label={r.party_name || r.name} value={fmt(r.total_due ?? r.outstanding_amount ?? r.amount)} colors={colors} />
          ))}
          <View style={{ flexDirection: "row", backgroundColor: "#F1F5F9", paddingVertical: 6, paddingHorizontal: 8 }}>
            <Text style={{ flex: 1, fontSize: 12, fontWeight: "800", color: "#0F172A" }}>TOTAL PAYABLE RS.:</Text>
            <Text style={{ fontSize: 13, fontWeight: "800", color: colors.accent }}>{fmt(totPay)}</Text>
          </View>
        </View>
      );
    }

    // 6. Day Book / Ledger / Party Ledger
    if (key === "daybook" || key === "ledger" || key === "party_ledger") {
      const entries = Array.isArray(reportData)
        ? reportData
        : (reportData?.transactions || reportData?.entries || []);
      const title = key === "daybook"
        ? "DAY BOOK (DAILY JOURNAL REGISTER)"
        : key === "ledger"
        ? `ACCOUNT LEDGER STATEMENT ${reportData?.account_name ? `(${reportData.account_name.toUpperCase()})` : ""}`
        : `PARTY LEDGER STATEMENT ${reportData?.party_name ? `(${reportData.party_name.toUpperCase()})` : ""}`;

      const totDr = entries.reduce((s: number, r: any) => s + Number(r.total_debit ?? r.debit ?? 0), 0);
      const totCr = entries.reduce((s: number, r: any) => s + Number(r.total_credit ?? r.credit ?? 0), 0);

      return (
        <View style={[styles.previewCard, { backgroundColor: "#FFFFFF", borderColor: colors.cardBorder, padding: 20 }]}>
          <HeaderDoc title={title} />
          {key === "ledger" && reportData?.closing_balance !== undefined ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: "#F1F5F9", padding: 10, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: colors.accent }}>
              <Text style={{ fontSize: 12, color: "#334155" }}>
                OPENING BALANCE: <Text style={{ fontWeight: "700", color: "#0F172A" }}>{fmt(reportData.opening_balance)}</Text>
              </Text>
              <Text style={{ fontSize: 12, color: "#334155" }}>
                CLOSING BALANCE: <Text style={{ fontWeight: "800", color: colors.accent }}>{fmt(reportData.closing_balance)}</Text>
              </Text>
            </View>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ flexDirection: "column" }}>
            <View style={{ minWidth: 850 }}>
              <View style={[styles.tableHeader, { backgroundColor: "#F1F5F9" }]}>
                <Text style={[styles.reportTh, { width: 90 }]}>DATE</Text>
                <Text style={[styles.reportTh, { width: 120 }]}>VOUCHER / REF</Text>
                <Text style={[styles.reportTh, { width: 280 }]}>NARRATION / PARTICULAR</Text>
                <Text style={[styles.reportTh, { width: 120, textAlign: "right" }]}>DEBIT (DR) RS.</Text>
                <Text style={[styles.reportTh, { width: 120, textAlign: "right" }]}>CREDIT (CR) RS.</Text>
                {key === "ledger" && <Text style={[styles.reportTh, { width: 120, textAlign: "right" }]}>BALANCE RS.</Text>}
              </View>
              <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingRight: 12 }}>
                {entries.map((r: any, i: number) => (
                  <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }]}>
                    <Text style={[styles.reportTd, { width: 90 }]}>{r.entry_date || r.date || ""}</Text>
                    <Text style={[styles.reportTd, { width: 120, fontWeight: "600" }]}>{r.entry_number || r.voucher_no || r.ref || ""}</Text>
                    <Text style={[styles.reportTd, { width: 280 }]} numberOfLines={2}>{r.description || r.narration || ""}</Text>
                    <Text style={[styles.reportTd, { width: 120, textAlign: "right" }]}>{fmt(r.total_debit ?? r.debit)}</Text>
                    <Text style={[styles.reportTd, { width: 120, textAlign: "right" }]}>{fmt(r.total_credit ?? r.credit)}</Text>
                    {key === "ledger" && (
                      <Text style={[styles.reportTd, { width: 120, textAlign: "right", fontWeight: "700", color: colors.accent }]}>
                        {fmt(r.balance ?? r.running_balance)}
                      </Text>
                    )}
                  </View>
                ))}
              </ScrollView>
              <View style={{ flexDirection: "row", backgroundColor: "#0F172A", paddingVertical: 8, marginTop: 4 }}>
                <Text style={{ width: 490, fontSize: 12, fontWeight: "800", color: "#FFFFFF", paddingLeft: 8, fontFamily: "Segoe UI Variable Display" }}>TOTALS RS.:</Text>
                <Text style={{ width: 120, fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "right", fontFamily: "Consolas" }}>{fmt(totDr)}</Text>
                <Text style={{ width: 120, fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "right", fontFamily: "Consolas" }}>{fmt(totCr)}</Text>
                {key === "ledger" && <Text style={{ width: 120, fontSize: 12, fontWeight: "800", color: "#38BDF8", textAlign: "right", fontFamily: "Consolas" }}>{fmt(totDr - totCr)}</Text>}
              </View>
            </View>
          </ScrollView>
        </View>
      );
    }

    // 7. Sales by Customer
    if (key === "sales_by_customer" && Array.isArray(reportData)) {
      const total = reportData.reduce((s: number, r: any) => s + Number(r.total_sales || 0), 0);
      const totSub = reportData.reduce((s: number, r: any) => s + Number(r.subtotal || 0), 0);
      const totTax = reportData.reduce((s: number, r: any) => s + Number(r.tax_amount || 0), 0);

      return (
        <View style={[styles.previewCard, { backgroundColor: "#FFFFFF", borderColor: colors.cardBorder, padding: 20 }]}>
          <HeaderDoc title="SALES BY CUSTOMER ANALYSIS REPORT" />
          <View style={[styles.tableHeader, { backgroundColor: "#F1F5F9" }]}>
            <Text style={[styles.reportTh, { flex: 3 }]}>CUSTOMER NAME</Text>
            <Text style={[styles.reportTh, { flex: 1.2, textAlign: "center" }]}>INVOICES</Text>
            <Text style={[styles.reportTh, { flex: 1.5, textAlign: "right" }]}>SUBTOTAL RS.</Text>
            <Text style={[styles.reportTh, { flex: 1.5, textAlign: "right" }]}>TAX RS.</Text>
            <Text style={[styles.reportTh, { flex: 1.8, textAlign: "right" }]}>TOTAL SALES RS.</Text>
          </View>
          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingRight: 12 }}>
            {reportData.map((r: any, i: number) => (
              <View key={r.customer_id || i} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }]}>
                <Text style={[styles.reportTd, { flex: 3, fontWeight: "600" }]}>{r.customer_name}</Text>
                <Text style={[styles.reportTd, { flex: 1.2, textAlign: "center" }]}>{r.invoice_count}</Text>
                <Text style={[styles.reportTd, { flex: 1.5, textAlign: "right" }]}>{fmt(r.subtotal)}</Text>
                <Text style={[styles.reportTd, { flex: 1.5, textAlign: "right" }]}>{fmt(r.tax_amount)}</Text>
                <Text style={[styles.reportTd, { flex: 1.8, textAlign: "right", fontWeight: "700" }]}>{fmt(r.total_sales)}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: "row", backgroundColor: "#0F172A", paddingVertical: 8, marginTop: 4 }}>
            <Text style={{ flex: 4.2, fontSize: 12, fontWeight: "800", color: "#FFFFFF", paddingLeft: 8, fontFamily: "Segoe UI Variable Display" }}>GRAND TOTALS RS.:</Text>
            <Text style={{ flex: 1.5, fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "right", fontFamily: "Consolas" }}>{fmt(totSub)}</Text>
            <Text style={{ flex: 1.5, fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "right", fontFamily: "Consolas" }}>{fmt(totTax)}</Text>
            <Text style={{ flex: 1.8, fontSize: 12, fontWeight: "800", color: "#38BDF8", textAlign: "right", paddingRight: 12, fontFamily: "Consolas" }}>{fmt(total)}</Text>
          </View>
        </View>
      );
    }

    // 8. Sales by Item
    if (key === "sales_by_item" && Array.isArray(reportData)) {
      const total = reportData.reduce((s: number, r: any) => s + Number(r.total_sales_value || 0), 0);
      const totQty = reportData.reduce((s: number, r: any) => s + Number(r.total_quantity || 0), 0);

      return (
        <View style={[styles.previewCard, { backgroundColor: "#FFFFFF", borderColor: colors.cardBorder, padding: 20 }]}>
          <HeaderDoc title="SALES BY ITEM PRODUCT REPORT" />
          <View style={[styles.tableHeader, { backgroundColor: "#F1F5F9" }]}>
            <Text style={[styles.reportTh, { flex: 3 }]}>PRODUCT / ITEM NAME</Text>
            <Text style={[styles.reportTh, { flex: 1 }]}>UNIT</Text>
            <Text style={[styles.reportTh, { flex: 1.5, textAlign: "right" }]}>QTY SOLD</Text>
            <Text style={[styles.reportTh, { flex: 1.5, textAlign: "right" }]}>AVG RATE RS.</Text>
            <Text style={[styles.reportTh, { flex: 1.8, textAlign: "right" }]}>REVENUE RS.</Text>
          </View>
          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingRight: 12 }}>
            {reportData.map((r: any, i: number) => (
              <View key={r.product_id || i} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }]}>
                <Text style={[styles.reportTd, { flex: 3, fontWeight: "600" }]}>{r.product_name}</Text>
                <Text style={[styles.reportTd, { flex: 1 }]}>{r.unit}</Text>
                <Text style={[styles.reportTd, { flex: 1.5, textAlign: "right" }]}>{fmtQty(r.total_quantity)}</Text>
                <Text style={[styles.reportTd, { flex: 1.5, textAlign: "right" }]}>{fmt(r.avg_rate)}</Text>
                <Text style={[styles.reportTd, { flex: 1.8, textAlign: "right", fontWeight: "700" }]}>{fmt(r.total_sales_value)}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: "row", backgroundColor: "#0F172A", paddingVertical: 8, marginTop: 4 }}>
            <Text style={{ flex: 4, fontSize: 12, fontWeight: "800", color: "#FFFFFF", paddingLeft: 8, fontFamily: "Segoe UI Variable Display" }}>GRAND TOTALS:</Text>
            <Text style={{ flex: 1.5, fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "right", fontFamily: "Consolas" }}>{fmtQty(totQty)}</Text>
            <Text style={{ flex: 1.5, fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "right", fontFamily: "Consolas" }}>-</Text>
            <Text style={{ flex: 1.8, fontSize: 12, fontWeight: "800", color: "#38BDF8", textAlign: "right", paddingRight: 12, fontFamily: "Consolas" }}>{fmt(total)}</Text>
          </View>
        </View>
      );
    }

    // 9. Item Movement
    if (key === "item_movement" && Array.isArray(reportData)) {
      return (
        <View style={[styles.previewCard, { backgroundColor: "#FFFFFF", borderColor: colors.cardBorder, padding: 20 }]}>
          <HeaderDoc title="ITEM MOVEMENT & STOCK REGISTER" />
          <View style={[styles.tableHeader, { backgroundColor: "#F1F5F9" }]}>
            <Text style={[styles.reportTh, { flex: 3 }]}>PRODUCT NAME</Text>
            <Text style={[styles.reportTh, { flex: 1.2, textAlign: "right" }]}>OPENING</Text>
            <Text style={[styles.reportTh, { flex: 1.2, textAlign: "right" }]}>INWARD</Text>
            <Text style={[styles.reportTh, { flex: 1.2, textAlign: "right" }]}>OUTWARD</Text>
            <Text style={[styles.reportTh, { flex: 1.2, textAlign: "right" }]}>CLOSING</Text>
            <Text style={[styles.reportTh, { flex: 1.5, textAlign: "right" }]}>VALUATION RS.</Text>
          </View>
          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingRight: 12 }}>
            {reportData.map((r: any, i: number) => (
              <View key={r.product_id || i} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }]}>
                <Text style={[styles.reportTd, { flex: 3, fontWeight: "600" }]}>{r.product_name}</Text>
                <Text style={[styles.reportTd, { flex: 1.2, textAlign: "right" }]}>{fmtQty(r.opening_stock)}</Text>
                <Text style={[styles.reportTd, { flex: 1.2, textAlign: "right", color: "#16A34A" }]}>{fmtQty(r.inward_qty)}</Text>
                <Text style={[styles.reportTd, { flex: 1.2, textAlign: "right", color: "#DC2626" }]}>{fmtQty(r.outward_qty)}</Text>
                <Text style={[styles.reportTd, { flex: 1.2, textAlign: "right", fontWeight: "700" }]}>{fmtQty(r.closing_stock)}</Text>
                <Text style={[styles.reportTd, { flex: 1.5, textAlign: "right" }]}>{fmt(r.valuation)}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      );
    }

    // 10. Stock Valuation
    if (key === "stock_valuation" && Array.isArray(reportData)) {
      const totalValuation = reportData.reduce((s: number, r: any) => s + (Number(r.current_stock || 0) * Number(r.purchase_price || 0)), 0);
      return (
        <View style={[styles.previewCard, { backgroundColor: "#FFFFFF", borderColor: colors.cardBorder, padding: 20 }]}>
          <HeaderDoc title="STOCK VALUATION STATEMENT" periodText={`AS OF : ${endDate}`} />
          <View style={[styles.tableHeader, { backgroundColor: "#F1F5F9" }]}>
            <Text style={[styles.reportTh, { flex: 3 }]}>PRODUCT NAME</Text>
            <Text style={[styles.reportTh, { flex: 1.2, textAlign: "right" }]}>STOCK QTY</Text>
            <Text style={[styles.reportTh, { flex: 1.5, textAlign: "right" }]}>PURCHASE PRICE RS.</Text>
            <Text style={[styles.reportTh, { flex: 1.8, textAlign: "right" }]}>TOTAL VALUATION RS.</Text>
          </View>
          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingRight: 12 }}>
            {reportData.map((r: any, i: number) => {
              const val = Number(r.current_stock || 0) * Number(r.purchase_price || 0);
              return (
                <View key={r.id || i} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }]}>
                  <Text style={[styles.reportTd, { flex: 3, fontWeight: "600" }]}>{r.name}</Text>
                  <Text style={[styles.reportTd, { flex: 1.2, textAlign: "right" }]}>{fmtQty(r.current_stock)}</Text>
                  <Text style={[styles.reportTd, { flex: 1.5, textAlign: "right" }]}>{fmt(r.purchase_price)}</Text>
                  <Text style={[styles.reportTd, { flex: 1.8, textAlign: "right", fontWeight: "700" }]}>{fmt(val)}</Text>
                </View>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: "row", backgroundColor: "#0F172A", paddingVertical: 8, marginTop: 4 }}>
            <Text style={{ flex: 5.7, fontSize: 12, fontWeight: "800", color: "#FFFFFF", paddingLeft: 8, fontFamily: "Segoe UI Variable Display" }}>TOTAL VALUATION RS.:</Text>
            <Text style={{ flex: 1.8, fontSize: 12, fontWeight: "800", color: "#38BDF8", textAlign: "right", paddingRight: 12, fontFamily: "Consolas" }}>{fmt(totalValuation)}</Text>
          </View>
        </View>
      );
    }

    // 11. Low Stock Alert
    if (key === "low_stock" && Array.isArray(reportData)) {
      const lowStockItems = reportData.filter((r: any) => Number(r.current_stock || 0) <= Number(r.reorder_level || 0));
      return (
        <View style={[styles.previewCard, { backgroundColor: "#FFFFFF", borderColor: colors.cardBorder, padding: 20 }]}>
          <HeaderDoc title="LOW STOCK ALERTS & REORDER STATEMENT" periodText={`AS OF : ${endDate}`} />
          <View style={[styles.tableHeader, { backgroundColor: "#F1F5F9" }]}>
            <Text style={[styles.reportTh, { flex: 3 }]}>PRODUCT NAME</Text>
            <Text style={[styles.reportTh, { flex: 1.5, textAlign: "right" }]}>CURRENT STOCK</Text>
            <Text style={[styles.reportTh, { flex: 1.5, textAlign: "right" }]}>REORDER LEVEL</Text>
            <Text style={[styles.reportTh, { flex: 1.5, textAlign: "right" }]}>SHORTAGE QTY</Text>
          </View>
          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingRight: 12 }}>
            {lowStockItems.map((r: any, i: number) => {
              const shortage = Number(r.reorder_level || 0) - Number(r.current_stock || 0);
              return (
                <View key={r.id || i} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }]}>
                  <Text style={[styles.reportTd, { flex: 3, fontWeight: "600" }]}>{r.name}</Text>
                  <Text style={[styles.reportTd, { flex: 1.5, textAlign: "right", color: "#DC2626", fontWeight: "700" }]}>{fmtQty(r.current_stock)}</Text>
                  <Text style={[styles.reportTd, { flex: 1.5, textAlign: "right" }]}>{fmtQty(r.reorder_level)}</Text>
                  <Text style={[styles.reportTd, { flex: 1.5, textAlign: "right", color: "#DC2626", fontWeight: "700" }]}>{fmtQty(shortage)}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    // 12. Audit Trail
    if (key === "audit_trail" && Array.isArray(reportData)) {
      return (
        <View style={[styles.previewCard, { backgroundColor: "#FFFFFF", borderColor: colors.cardBorder, padding: 20 }]}>
          <HeaderDoc title="SYSTEM AUDIT LOG REGISTER" />
          <View style={[styles.tableHeader, { backgroundColor: "#F1F5F9" }]}>
            <Text style={[styles.reportTh, { flex: 1.8 }]}>TIMESTAMP</Text>
            <Text style={[styles.reportTh, { flex: 1.2 }]}>ACTION</Text>
            <Text style={[styles.reportTh, { flex: 1.5 }]}>ENTITY / TABLE</Text>
            <Text style={[styles.reportTh, { flex: 2 }]}>USER</Text>
          </View>
          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingRight: 12 }}>
            {reportData.map((r: any, i: number) => (
              <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }]}>
                <Text style={[styles.reportTd, { flex: 1.8 }]}>{r.timestamp || r.created_at || ""}</Text>
                <Text style={[styles.reportTd, { flex: 1.2, fontWeight: "700", color: r.action === "CREATE" ? "#16A34A" : r.action === "DELETE" ? "#DC2626" : "#2563EB" }]}>{r.action}</Text>
                <Text style={[styles.reportTd, { flex: 1.5 }]}>{r.table_name || r.entity_type || ""}</Text>
                <Text style={[styles.reportTd, { flex: 2 }]}>{r.user_email || r.changed_by || ""}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      );
    }

    // 13. GST Summary Overview
    if (key === "gst_summary" && reportData && typeof reportData === "object") {
      const d = reportData;
      return (
        <View style={[styles.previewCard, { backgroundColor: "#FFFFFF", borderColor: colors.cardBorder, padding: 20 }]}>
          <HeaderDoc title="GOODS AND SERVICES TAX SUMMARY OVERVIEW" />
          <KVRow label="TOTAL SALES VALUE" value={fmt(d.total_sales_value)} colors={colors} />
          <KVRow label="OUTPUT TAX LIABILITY" value={fmt(d.output_tax)} colors={colors} />
          <KVRow label="TOTAL PURCHASES VALUE" value={fmt(d.total_purchases_value)} colors={colors} />
          <KVRow label="INPUT TAX CREDIT (ITC CLAIMED)" value={fmt(d.itc_claimed)} colors={colors} />
          <View style={{ flexDirection: "row", backgroundColor: "#0F172A", paddingVertical: 10, paddingHorizontal: 12, marginTop: 14 }}>
            <Text style={{ flex: 1, fontSize: 13, fontWeight: "800", color: "#FFFFFF", fontFamily: "Segoe UI Variable Display" }}>NET GST PAYABLE / (REFUND) RS.:</Text>
            <Text style={{ fontSize: 14, fontWeight: "800", color: (d.net_tax_payable ?? 0) >= 0 ? "#38BDF8" : "#4ADE80", fontFamily: "Consolas" }}>{fmt(d.net_tax_payable)}</Text>
          </View>
        </View>
      );
    }

    // 14. GSTR-1 Summary & GSTR-2 Summary
    if ((key === "gstr1_summary" || key === "gstr2_summary") && reportData && typeof reportData === "object" && reportData.data) {
      const d = reportData;
      const categories = Object.keys(d.data || {});
      const months: string[] = d.months || [];
      return (
        <View style={[styles.previewCard, { backgroundColor: "#FFFFFF", borderColor: colors.cardBorder, padding: 20 }]}>
          <HeaderDoc title={key === "gstr1_summary" ? "GSTR-1 OUTWARD SUPPLIES SUMMARY" : "GSTR-2 INWARD SUPPLIES SUMMARY"} />
          {categories.map((catKey) => {
            const catObj = d.data[catKey] || {};
            const subTypes = Object.keys(catObj);
            return (
              <View key={catKey} style={{ marginBottom: 16 }}>
                <View style={{ backgroundColor: "#E2E8F0", paddingVertical: 6, paddingHorizontal: 8, marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: "#0F172A", fontFamily: "Segoe UI Variable Display" }}>CATEGORY: {catKey}</Text>
                </View>
                <View style={[styles.tableHeader, { backgroundColor: "#F1F5F9" }]}>
                  <Text style={[styles.reportTh, { flex: 2 }]}>TYPE</Text>
                  {months.map((m) => (
                    <Text key={m} style={[styles.reportTh, { flex: 1, textAlign: "right" }]}>{m}</Text>
                  ))}
                  <Text style={[styles.reportTh, { flex: 1.2, textAlign: "right" }]}>TOTAL RS.</Text>
                </View>
                {subTypes.map((subType, idx) => {
                  const monthVals = catObj[subType] || {};
                  return (
                    <View key={subType} style={[styles.tableRow, { backgroundColor: idx % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }]}>
                      <Text style={[styles.reportTd, { flex: 2, fontWeight: subType === "TOTAL" ? "bold" : "normal" }]}>
                        {subType}
                      </Text>
                      {months.map((m) => (
                        <Text key={m} style={[styles.reportTd, { flex: 1, textAlign: "right" }]}>
                          {fmt(monthVals[m])}
                        </Text>
                      ))}
                      <Text style={[styles.reportTd, { flex: 1.2, textAlign: "right", fontWeight: "bold", color: colors.accent }]}>
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

    // 15. GSTR-3B Return Summary
    if (key === "gstr3b" && reportData && typeof reportData === "object") {
      const d = reportData;
      const outward = d.outward_supplies || {};
      const inward = d.inward_supplies_itc || {};
      return (
        <View style={[styles.previewCard, { backgroundColor: "#FFFFFF", borderColor: colors.cardBorder, padding: 20 }]}>
          <HeaderDoc title="GSTR-3B MONTHLY RETURN SUMMARY" />

          <View style={{ backgroundColor: "#E2E8F0", paddingVertical: 6, paddingHorizontal: 8, marginBottom: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#0F172A", fontFamily: "Segoe UI Variable Display" }}>
              3.1 DETAILS OF OUTWARD SUPPLIES (OUTPUT TAX LIABILITY)
            </Text>
          </View>
          <KVRow label="TAXABLE VALUE" value={fmt(outward.taxable_value)} colors={colors} />
          <KVRow label="INTEGRATED TAX (IGST)" value={fmt(outward.igst)} colors={colors} />
          <KVRow label="CENTRAL TAX (CGST)" value={fmt(outward.cgst)} colors={colors} />
          <KVRow label="STATE/UT TAX (SGST)" value={fmt(outward.sgst)} colors={colors} />
          <KVRow label="TOTAL OUTPUT TAX" value={fmt(outward.total_tax)} colors={colors} />

          <View style={{ backgroundColor: "#E2E8F0", paddingVertical: 6, paddingHorizontal: 8, marginTop: 14, marginBottom: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#0F172A", fontFamily: "Segoe UI Variable Display" }}>
              4. ELIGIBLE INPUT TAX CREDIT (ITC)
            </Text>
          </View>
          <KVRow label="TAXABLE VALUE" value={fmt(inward.taxable_value)} colors={colors} />
          <KVRow label="INTEGRATED TAX (IGST)" value={fmt(inward.igst)} colors={colors} />
          <KVRow label="CENTRAL TAX (CGST)" value={fmt(inward.cgst)} colors={colors} />
          <KVRow label="STATE/UT TAX (SGST)" value={fmt(inward.sgst)} colors={colors} />
          <KVRow label="TOTAL ITC AVAILABLE" value={fmt(inward.itc_available)} colors={colors} />

          <View style={{ flexDirection: "row", backgroundColor: "#0F172A", paddingVertical: 10, paddingHorizontal: 12, marginTop: 16 }}>
            <Text style={{ flex: 1, fontSize: 13, fontWeight: "800", color: "#FFFFFF", fontFamily: "Segoe UI Variable Display" }}>NET TAX PAYABLE IN CASH RS.:</Text>
            <Text style={{ fontSize: 14, fontWeight: "800", color: (d.net_tax_payable ?? 0) >= 0 ? "#38BDF8" : "#4ADE80", fontFamily: "Consolas" }}>
              {fmt(d.net_tax_payable)}
            </Text>
          </View>
        </View>
      );
    }

    // GSTR-1 / GSTR-2 (Full Official GST Analysis Report Layout)
    if ((key === "gstr1" || key === "gstr2") && reportData && typeof reportData === "object") {
      const companyInfo = reportData.company || {};
      const period = reportData.period || { start: startDate, end: endDate };

      const b2b = reportData.b2b || [];
      const b2cl = reportData.b2cl || [];
      const b2cs = reportData.b2cs || [];
      const cdnr = reportData.cdnr || [];
      const cdnur = reportData.cdnur || [];
      const b2bur = reportData.b2bur || [];

      const calcSum = (arr: any[]) => {
        let t = 0, i = 0, c = 0, s = 0, cs = 0, g = 0, n = 0;
        arr.forEach((inv: any) => {
          const tx = Number(inv.taxable_value || inv.subtotal || 0);
          const ig = Number(inv.igst || 0);
          const cg = Number(inv.cgst || 0);
          const sg = Number(inv.sgst || 0);
          const css = Number(inv.cess || 0);
          const gst = ig + cg + sg;
          const net = Number(inv.value || inv.total || (tx + gst));

          t += tx; i += ig; c += cg; s += sg; cs += css; g += gst; n += net;
        });
        return { t, i, c, s, cs, g, n };
      };

      const b2bSum = calcSum(b2b);
      const b2clSum = calcSum(b2cl);
      const b2csSum = calcSum(b2cs);
      const cdnrSum = calcSum(cdnr);
      const cdnurSum = calcSum(cdnur);
      const b2burSum = calcSum(b2bur);

      const grandTaxable = b2bSum.t + b2clSum.t + b2csSum.t + cdnrSum.t + cdnurSum.t + b2burSum.t;
      const grandIgst = b2bSum.i + b2clSum.i + b2csSum.i + cdnrSum.i + cdnurSum.i + b2burSum.i;
      const grandCgst = b2bSum.c + b2clSum.c + b2csSum.c + cdnrSum.c + cdnurSum.c + b2burSum.c;
      const grandSgst = b2bSum.s + b2clSum.s + b2csSum.s + cdnrSum.s + cdnurSum.s + b2burSum.s;
      const grandCess = b2bSum.cs + b2clSum.cs + b2csSum.cs + cdnrSum.cs + cdnurSum.cs + b2burSum.cs;
      const grandGst = b2bSum.g + b2clSum.g + b2csSum.g + cdnrSum.g + cdnurSum.g + b2burSum.g;
      const grandNet = b2bSum.n + b2clSum.n + b2csSum.n + cdnrSum.n + cdnurSum.n + b2burSum.n;

      return (
        <View style={[styles.previewCard, { backgroundColor: "#FFFFFF", borderColor: colors.cardBorder, padding: 20 }]}>
          {/* Document Letterhead */}
          <View style={{ alignItems: "center", marginBottom: 16, borderBottomWidth: 2, borderBottomColor: "#0F172A", paddingBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A", letterSpacing: 0.5, fontFamily: "Segoe UI Variable Display" }}>
              {companyInfo.name || company?.name || "JK INFOTECH PVT LTD."}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#475569", marginTop: 2, fontFamily: "Segoe UI Variable Text" }}>
              GSTIN: {companyInfo.gst_number || company?.gst_number || "URP"}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accent, marginTop: 4, fontFamily: "Segoe UI Variable Display" }}>
              GOODS AND SERVICES TAX MONTHLY ANALYSIS REPORT FROM : {period.start} TO : {period.end}
            </Text>
          </View>

          {/* Full Width Scrollable 11-Column Table */}
          <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ flexDirection: "column", paddingBottom: 28, paddingRight: 16 }}>
            <View style={{ minWidth: 1050, paddingBottom: 28, marginBottom: 12 }}>
              {/* Table Column Headers */}
              <View style={{ flexDirection: "row", backgroundColor: "#F1F5F9", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#CBD5E1", paddingVertical: 8 }}>
                <Text style={[styles.reportTh, { width: 100 }]}>INVOICE-DATE</Text>
                <Text style={[styles.reportTh, { width: 110 }]}>INVOICE-NO.</Text>
                <Text style={[styles.reportTh, { width: 130 }]}>GSTIN-NUMBERS</Text>
                <Text style={[styles.reportTh, { width: 170 }]}>ACCOUNTS NAME</Text>
                <Text style={[styles.reportTh, { width: 110, textAlign: "right" }]}>TAXABLE RS.</Text>
                <Text style={[styles.reportTh, { width: 95, textAlign: "right" }]}>IGST RS.</Text>
                <Text style={[styles.reportTh, { width: 95, textAlign: "right" }]}>CGST RS.</Text>
                <Text style={[styles.reportTh, { width: 95, textAlign: "right" }]}>SGST RS.</Text>
                <Text style={[styles.reportTh, { width: 85, textAlign: "right" }]}>CESS RS.</Text>
                <Text style={[styles.reportTh, { width: 105, textAlign: "right" }]}>TOTALGST RS.</Text>
                <Text style={[styles.reportTh, { width: 115, textAlign: "right" }]}>NETBILL RS.</Text>
              </View>

              {/* B2B Section */}
              {b2b.length > 0 && (
                <>
                  <View style={{ backgroundColor: "#E2E8F0", paddingVertical: 6, paddingHorizontal: 8, marginTop: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: "#0F172A", fontFamily: "Segoe UI Variable Display" }}>
                      DAYBOOK : {key === "gstr1" ? "SALES OF BUSINESS TO BUSINESS-(B2B)" : "PURCHASES FROM REGISTERED SUPPLIERS-(B2B)"}
                    </Text>
                  </View>
                  {b2b.map((inv: any, idx: number) => {
                    const tx = Number(inv.taxable_value || inv.subtotal || 0);
                    const ig = Number(inv.igst || 0);
                    const cg = Number(inv.cgst || 0);
                    const sg = Number(inv.sgst || 0);
                    const cs = Number(inv.cess || 0);
                    const gst = ig + cg + sg;
                    const net = Number(inv.value || inv.total || (tx + gst));
                    return (
                      <View key={idx} style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: "#E2E8F0", paddingVertical: 6, backgroundColor: idx % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }}>
                        <Text style={[styles.reportTd, { width: 100 }]}>{inv.date || inv.bill_date || period.start}</Text>
                        <Text style={[styles.reportTd, { width: 110, fontWeight: "600" }]}>{inv.inv_no || inv.bill_no}</Text>
                        <Text style={[styles.reportTd, { width: 130 }]}>{inv.gstin || "URP"}</Text>
                        <Text style={[styles.reportTd, { width: 170 }]} numberOfLines={1}>{inv.receiver_name || inv.supplier_name}</Text>
                        <Text style={[styles.reportTd, { width: 110, textAlign: "right" }]}>{fmt(tx)}</Text>
                        <Text style={[styles.reportTd, { width: 95, textAlign: "right" }]}>{fmt(ig)}</Text>
                        <Text style={[styles.reportTd, { width: 95, textAlign: "right" }]}>{fmt(cg)}</Text>
                        <Text style={[styles.reportTd, { width: 95, textAlign: "right" }]}>{fmt(sg)}</Text>
                        <Text style={[styles.reportTd, { width: 85, textAlign: "right" }]}>{fmt(cs)}</Text>
                        <Text style={[styles.reportTd, { width: 105, textAlign: "right" }]}>{fmt(gst)}</Text>
                        <Text style={[styles.reportTd, { width: 115, textAlign: "right", fontWeight: "700" }]}>{fmt(net)}</Text>
                      </View>
                    );
                  })}
                  <View style={{ flexDirection: "row", backgroundColor: "#F1F5F9", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#CBD5E1", paddingVertical: 6 }}>
                    <Text style={{ width: 510, fontSize: 11, fontWeight: "800", color: "#0F172A", paddingLeft: 8, fontFamily: "Segoe UI Variable Display" }}>
                      TOTAL OF B2B SUPPLIES RS.:
                    </Text>
                    <Text style={[styles.reportTh, { width: 110, textAlign: "right" }]}>{fmt(b2bSum.t)}</Text>
                    <Text style={[styles.reportTh, { width: 95, textAlign: "right" }]}>{fmt(b2bSum.i)}</Text>
                    <Text style={[styles.reportTh, { width: 95, textAlign: "right" }]}>{fmt(b2bSum.c)}</Text>
                    <Text style={[styles.reportTh, { width: 95, textAlign: "right" }]}>{fmt(b2bSum.s)}</Text>
                    <Text style={[styles.reportTh, { width: 85, textAlign: "right" }]}>{fmt(b2bSum.cs)}</Text>
                    <Text style={[styles.reportTh, { width: 105, textAlign: "right" }]}>{fmt(b2bSum.g)}</Text>
                    <Text style={[styles.reportTh, { width: 115, textAlign: "right" }]}>{fmt(b2bSum.n)}</Text>
                  </View>
                </>
              )}

              {/* B2CS Section */}
              {b2cs.length > 0 && (
                <>
                  <View style={{ backgroundColor: "#E2E8F0", paddingVertical: 6, paddingHorizontal: 8, marginTop: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: "#0F172A", fontFamily: "Segoe UI Variable Display" }}>
                      DAYBOOK : SALES OF BUSINESS TO CONSUMER SMALL-(B2CS)
                    </Text>
                  </View>
                  {b2cs.map((inv: any, idx: number) => {
                    const tx = Number(inv.taxable_value || 0);
                    const ig = Number(inv.igst || 0);
                    const cg = Number(inv.cgst || 0);
                    const sg = Number(inv.sgst || 0);
                    const cs = Number(inv.cess || 0);
                    const gst = ig + cg + sg;
                    const net = tx + gst;
                    return (
                      <View key={idx} style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: "#E2E8F0", paddingVertical: 6, backgroundColor: idx % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }}>
                        <Text style={[styles.reportTd, { width: 100 }]}>{period.start}</Text>
                        <Text style={[styles.reportTd, { width: 110, fontWeight: "600" }]}>B2CS-{idx + 1}</Text>
                        <Text style={[styles.reportTd, { width: 130 }]}>URP</Text>
                        <Text style={[styles.reportTd, { width: 170 }]} numberOfLines={1}>Consumer Small - {inv.pos || "Other"}</Text>
                        <Text style={[styles.reportTd, { width: 110, textAlign: "right" }]}>{fmt(tx)}</Text>
                        <Text style={[styles.reportTd, { width: 95, textAlign: "right" }]}>{fmt(ig)}</Text>
                        <Text style={[styles.reportTd, { width: 95, textAlign: "right" }]}>{fmt(cg)}</Text>
                        <Text style={[styles.reportTd, { width: 95, textAlign: "right" }]}>{fmt(sg)}</Text>
                        <Text style={[styles.reportTd, { width: 85, textAlign: "right" }]}>{fmt(cs)}</Text>
                        <Text style={[styles.reportTd, { width: 105, textAlign: "right" }]}>{fmt(gst)}</Text>
                        <Text style={[styles.reportTd, { width: 115, textAlign: "right", fontWeight: "700" }]}>{fmt(net)}</Text>
                      </View>
                    );
                  })}
                  <View style={{ flexDirection: "row", backgroundColor: "#F1F5F9", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#CBD5E1", paddingVertical: 6 }}>
                    <Text style={{ width: 510, fontSize: 11, fontWeight: "800", color: "#0F172A", paddingLeft: 8, fontFamily: "Segoe UI Variable Display" }}>
                      TOTAL OF SALES OF BUSINESS TO CONSUMER SMALL-(B2CS) RS.:
                    </Text>
                    <Text style={[styles.reportTh, { width: 110, textAlign: "right" }]}>{fmt(b2csSum.t)}</Text>
                    <Text style={[styles.reportTh, { width: 95, textAlign: "right" }]}>{fmt(b2csSum.i)}</Text>
                    <Text style={[styles.reportTh, { width: 95, textAlign: "right" }]}>{fmt(b2csSum.c)}</Text>
                    <Text style={[styles.reportTh, { width: 95, textAlign: "right" }]}>{fmt(b2csSum.s)}</Text>
                    <Text style={[styles.reportTh, { width: 85, textAlign: "right" }]}>{fmt(b2csSum.cs)}</Text>
                    <Text style={[styles.reportTh, { width: 105, textAlign: "right" }]}>{fmt(b2csSum.g)}</Text>
                    <Text style={[styles.reportTh, { width: 115, textAlign: "right" }]}>{fmt(b2csSum.n)}</Text>
                  </View>
                </>
              )}

              {/* B2BUR Section */}
              {b2bur.length > 0 && (
                <>
                  <View style={{ backgroundColor: "#E2E8F0", paddingVertical: 6, paddingHorizontal: 8, marginTop: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: "#0F172A", fontFamily: "Segoe UI Variable Display" }}>
                      DAYBOOK : PURCHASES FROM UNREGISTERED SUPPLIERS-(B2BUR)
                    </Text>
                  </View>
                  {b2bur.map((inv: any, idx: number) => {
                    const tx = Number(inv.taxable_value || 0);
                    const ig = Number(inv.igst || 0);
                    const cg = Number(inv.cgst || 0);
                    const sg = Number(inv.sgst || 0);
                    const cs = Number(inv.cess || 0);
                    const gst = ig + cg + sg;
                    const net = Number(inv.value || (tx + gst));
                    return (
                      <View key={idx} style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: "#E2E8F0", paddingVertical: 6, backgroundColor: idx % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }}>
                        <Text style={[styles.reportTd, { width: 100 }]}>{inv.date || period.start}</Text>
                        <Text style={[styles.reportTd, { width: 110, fontWeight: "600" }]}>{inv.bill_no}</Text>
                        <Text style={[styles.reportTd, { width: 130 }]}>URP</Text>
                        <Text style={[styles.reportTd, { width: 170 }]} numberOfLines={1}>{inv.supplier_name}</Text>
                        <Text style={[styles.reportTd, { width: 110, textAlign: "right" }]}>{fmt(tx)}</Text>
                        <Text style={[styles.reportTd, { width: 95, textAlign: "right" }]}>{fmt(ig)}</Text>
                        <Text style={[styles.reportTd, { width: 95, textAlign: "right" }]}>{fmt(cg)}</Text>
                        <Text style={[styles.reportTd, { width: 95, textAlign: "right" }]}>{fmt(sg)}</Text>
                        <Text style={[styles.reportTd, { width: 85, textAlign: "right" }]}>{fmt(cs)}</Text>
                        <Text style={[styles.reportTd, { width: 105, textAlign: "right" }]}>{fmt(gst)}</Text>
                        <Text style={[styles.reportTd, { width: 115, textAlign: "right", fontWeight: "700" }]}>{fmt(net)}</Text>
                      </View>
                    );
                  })}
                  <View style={{ flexDirection: "row", backgroundColor: "#F1F5F9", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#CBD5E1", paddingVertical: 6 }}>
                    <Text style={{ width: 510, fontSize: 11, fontWeight: "800", color: "#0F172A", paddingLeft: 8, fontFamily: "Segoe UI Variable Display" }}>
                      TOTAL OF PURCHASES FROM UNREGISTERED SUPPLIERS-(B2BUR) RS.:
                    </Text>
                    <Text style={[styles.reportTh, { width: 110, textAlign: "right" }]}>{fmt(b2burSum.t)}</Text>
                    <Text style={[styles.reportTh, { width: 95, textAlign: "right" }]}>{fmt(b2burSum.i)}</Text>
                    <Text style={[styles.reportTh, { width: 95, textAlign: "right" }]}>{fmt(b2burSum.c)}</Text>
                    <Text style={[styles.reportTh, { width: 95, textAlign: "right" }]}>{fmt(b2burSum.s)}</Text>
                    <Text style={[styles.reportTh, { width: 85, textAlign: "right" }]}>{fmt(b2burSum.cs)}</Text>
                    <Text style={[styles.reportTh, { width: 105, textAlign: "right" }]}>{fmt(b2burSum.g)}</Text>
                    <Text style={[styles.reportTh, { width: 115, textAlign: "right" }]}>{fmt(b2burSum.n)}</Text>
                  </View>
                </>
              )}

              {/* DAYBOOKS SUMMARY SECTION */}
              <View style={{ backgroundColor: "#E2E8F0", paddingVertical: 6, paddingHorizontal: 8, marginTop: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: "#0F172A", fontFamily: "Segoe UI Variable Display" }}>
                  DAYBOOKS SUMMARY :-
                </Text>
              </View>

              {b2b.length > 0 && (
                <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: "#E2E8F0", paddingVertical: 5 }}>
                  <Text style={{ width: 510, fontSize: 11, fontWeight: "600", color: "#334155", paddingLeft: 8, fontFamily: "Segoe UI Variable Text" }}>
                    {key === "gstr1" ? "SALES OF BUSINESS TO BUSINESS-(B2B) RS.:" : "PURCHASES FROM REGISTERED SUPPLIERS-(B2B) RS.:"}
                  </Text>
                  <Text style={[styles.reportTd, { width: 110, textAlign: "right" }]}>{fmt(b2bSum.t)}</Text>
                  <Text style={[styles.reportTd, { width: 95, textAlign: "right" }]}>{fmt(b2bSum.i)}</Text>
                  <Text style={[styles.reportTd, { width: 95, textAlign: "right" }]}>{fmt(b2bSum.c)}</Text>
                  <Text style={[styles.reportTd, { width: 95, textAlign: "right" }]}>{fmt(b2bSum.s)}</Text>
                  <Text style={[styles.reportTd, { width: 85, textAlign: "right" }]}>{fmt(b2bSum.cs)}</Text>
                  <Text style={[styles.reportTd, { width: 105, textAlign: "right" }]}>{fmt(b2bSum.g)}</Text>
                  <Text style={[styles.reportTd, { width: 115, textAlign: "right", fontWeight: "700" }]}>{fmt(b2bSum.n)}</Text>
                </View>
              )}

              {b2cs.length > 0 && (
                <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: "#E2E8F0", paddingVertical: 5 }}>
                  <Text style={{ width: 510, fontSize: 11, fontWeight: "600", color: "#334155", paddingLeft: 8, fontFamily: "Segoe UI Variable Text" }}>
                    SALES OF BUSINESS TO CONSUMER SMALL-(B2CS) RS.:
                  </Text>
                  <Text style={[styles.reportTd, { width: 110, textAlign: "right" }]}>{fmt(b2csSum.t)}</Text>
                  <Text style={[styles.reportTd, { width: 95, textAlign: "right" }]}>{fmt(b2csSum.i)}</Text>
                  <Text style={[styles.reportTd, { width: 95, textAlign: "right" }]}>{fmt(b2csSum.c)}</Text>
                  <Text style={[styles.reportTd, { width: 95, textAlign: "right" }]}>{fmt(b2csSum.s)}</Text>
                  <Text style={[styles.reportTd, { width: 85, textAlign: "right" }]}>{fmt(b2csSum.cs)}</Text>
                  <Text style={[styles.reportTd, { width: 105, textAlign: "right" }]}>{fmt(b2csSum.g)}</Text>
                  <Text style={[styles.reportTd, { width: 115, textAlign: "right", fontWeight: "700" }]}>{fmt(b2csSum.n)}</Text>
                </View>
              )}

              {b2bur.length > 0 && (
                <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: "#E2E8F0", paddingVertical: 5 }}>
                  <Text style={{ width: 510, fontSize: 11, fontWeight: "600", color: "#334155", paddingLeft: 8, fontFamily: "Segoe UI Variable Text" }}>
                    PURCHASES FROM UNREGISTERED SUPPLIERS-(B2BUR) RS.:
                  </Text>
                  <Text style={[styles.reportTd, { width: 110, textAlign: "right" }]}>{fmt(b2burSum.t)}</Text>
                  <Text style={[styles.reportTd, { width: 95, textAlign: "right" }]}>{fmt(b2burSum.i)}</Text>
                  <Text style={[styles.reportTd, { width: 95, textAlign: "right" }]}>{fmt(b2burSum.c)}</Text>
                  <Text style={[styles.reportTd, { width: 95, textAlign: "right" }]}>{fmt(b2burSum.s)}</Text>
                  <Text style={[styles.reportTd, { width: 85, textAlign: "right" }]}>{fmt(b2burSum.cs)}</Text>
                  <Text style={[styles.reportTd, { width: 105, textAlign: "right" }]}>{fmt(b2burSum.g)}</Text>
                  <Text style={[styles.reportTd, { width: 115, textAlign: "right", fontWeight: "700" }]}>{fmt(b2burSum.n)}</Text>
                </View>
              )}

              {/* NET PAYABLE / TAX SUMMARY */}
              <View style={{ flexDirection: "row", backgroundColor: "#0F172A", paddingVertical: 8, marginTop: 4 }}>
                <Text style={{ width: 510, fontSize: 12, fontWeight: "800", color: "#FFFFFF", paddingLeft: 8, fontFamily: "Segoe UI Variable Display" }}>
                  NET PAYABLE GOODS AND SERVICES TAX RS.:
                </Text>
                <Text style={{ width: 110, fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "right", fontFamily: "Consolas" }}>{fmt(grandTaxable)}</Text>
                <Text style={{ width: 95, fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "right", fontFamily: "Consolas" }}>{fmt(grandIgst)}</Text>
                <Text style={{ width: 95, fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "right", fontFamily: "Consolas" }}>{fmt(grandCgst)}</Text>
                <Text style={{ width: 95, fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "right", fontFamily: "Consolas" }}>{fmt(grandSgst)}</Text>
                <Text style={{ width: 85, fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "right", fontFamily: "Consolas" }}>{fmt(grandCess)}</Text>
                <Text style={{ width: 105, fontSize: 12, fontWeight: "800", color: "#38BDF8", textAlign: "right", fontFamily: "Consolas" }}>{fmt(grandGst)}</Text>
                <Text style={{ width: 115, fontSize: 12, fontWeight: "800", color: "#38BDF8", textAlign: "right", fontFamily: "Consolas" }}>{fmt(grandNet)}</Text>
              </View>
            </View>
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
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={[styles.breadcrumb, { color: colors.accent }]}>ERP / REPORTS</Text>
            <Button
              title="❓ Help"
              onPress={() => setIsHelpModalOpen(true)}
              variant="secondary"
              size="small"
            />
          </View>
          <Text style={[styles.screenTitle, { color: colors.textPrimary, marginTop: 4 }]}>Reports Centre</Text>
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
            {selectedReport.hasDateRange && (() => {
              const isTodaySelected = startDate === today() && endDate === today();
              const isThisMonthSelected = startDate === monthStart() && endDate === monthEnd();
              const isLastMonthSelected = startDate === lastMonthStart() && endDate === lastMonthEnd();
              const isThisFySelected = startDate === fyStart() && endDate === today();

              return (
                <View style={styles.filterRow}>
                  <View style={styles.filterGroup}>
                    <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>From Date</Text>
                    <DatePicker
                      style={{ width: 160 }}
                      value={startDate}
                      onChange={(val) => {
                        setStartDate(val);
                        handleViewData({ startDate: val });
                      }}
                    />
                  </View>
                  <View style={styles.filterGroup}>
                    <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>To Date</Text>
                    <DatePicker
                      style={{ width: 160 }}
                      value={endDate}
                      onChange={(val) => {
                        setEndDate(val);
                        handleViewData({ endDate: val });
                      }}
                    />
                  </View>
                  <View style={styles.filterGroup}>
                    <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Quick Set</Text>
                    <View style={styles.presetRow}>
                      <Pressable
                        onPress={() => handleQuickSet(today(), today())}
                        style={({ pressed }) => [
                          styles.presetBtn,
                          {
                            backgroundColor: isTodaySelected ? colors.accent : colors.btnSecondaryBg,
                            transform: [{ scale: pressed ? 0.95 : 1 }],
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}>
                        <Text style={[styles.presetBtnText, { color: isTodaySelected ? "#FFFFFF" : colors.btnSecondaryText, fontWeight: isTodaySelected ? "700" : "600" }]}>
                          Today
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleQuickSet(monthStart(), monthEnd())}
                        style={({ pressed }) => [
                          styles.presetBtn,
                          {
                            backgroundColor: isThisMonthSelected ? colors.accent : colors.btnSecondaryBg,
                            transform: [{ scale: pressed ? 0.95 : 1 }],
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}>
                        <Text style={[styles.presetBtnText, { color: isThisMonthSelected ? "#FFFFFF" : colors.btnSecondaryText, fontWeight: isThisMonthSelected ? "700" : "600" }]}>
                          This Month
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleQuickSet(lastMonthStart(), lastMonthEnd())}
                        style={({ pressed }) => [
                          styles.presetBtn,
                          {
                            backgroundColor: isLastMonthSelected ? colors.accent : colors.btnSecondaryBg,
                            transform: [{ scale: pressed ? 0.95 : 1 }],
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}>
                        <Text style={[styles.presetBtnText, { color: isLastMonthSelected ? "#FFFFFF" : colors.btnSecondaryText, fontWeight: isLastMonthSelected ? "700" : "600" }]}>
                          Last Month
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleQuickSet(fyStart(), today())}
                        style={({ pressed }) => [
                          styles.presetBtn,
                          {
                            backgroundColor: isThisFySelected ? colors.accent : colors.btnSecondaryBg,
                            transform: [{ scale: pressed ? 0.95 : 1 }],
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}>
                        <Text style={[styles.presetBtnText, { color: isThisFySelected ? "#FFFFFF" : colors.btnSecondaryText, fontWeight: isThisFySelected ? "700" : "600" }]}>
                          This FY
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* As-Of Date */}
            {selectedReport.hasAsOf && (
              <View style={styles.filterRow}>
                <View style={styles.filterGroup}>
                  <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>As of Date</Text>
                  <DatePicker
                    style={{ width: 160 }}
                    value={asOf}
                    onChange={(val) => {
                      setAsOf(val);
                      handleViewData({ asOf: val });
                    }}
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
                    <Pressable key={acc.id} onPress={() => { setAccountId(acc.id); handleViewData({ accountId: acc.id }); }}
                      style={({ pressed }) => [
                        styles.selectorItem,
                        {
                          backgroundColor: accountId === acc.id ? colors.activeRowBg : "transparent",
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}>
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
                        style={({ pressed }) => [
                          styles.toggleBtn,
                          {
                            backgroundColor: partyType === pt ? colors.accent : colors.btnSecondaryBg,
                            transform: [{ scale: pressed ? 0.96 : 1 }],
                          },
                        ]}>
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
                      <Pressable key={p.id} onPress={() => { setPartyId(p.id); handleViewData({ partyId: p.id, partyType }); }}
                        style={({ pressed }) => [
                          styles.selectorItem,
                          {
                            backgroundColor: partyId === p.id ? colors.activeRowBg : "transparent",
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}>
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
                <Pressable
                  onPress={() => handleViewData()}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    {
                      backgroundColor: colors.accent,
                      transform: [{ scale: pressed ? 0.95 : 1 }],
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {isLoadingData && <ActivityIndicator size="small" color="#FFFFFF" style={{ width: 18, height: 18 }} />}
                    <Text style={styles.actionBtnText}>👁  View Data</Text>
                  </View>
                </Pressable>
              )}
              {selectedReport.pdfEndpoint && (
                <Pressable
                  onPress={handlePdf}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    {
                      backgroundColor: colors.pdfBtnBg,
                      transform: [{ scale: pressed ? 0.95 : 1 }],
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}>
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
          selectedReport && [
            "gstr1", "gstr2", "gstr3b", "gstr1_summary", "gstr2_summary",
            "daybook", "trial_balance", "cdn_register", "stock_valuation",
            "sales_by_customer", "sales_by_item", "account_ledger", "ledger",
            "party_ledger", "audit_trail", "item_movement", "outstanding",
            "outstanding_summary", "low_stock", "gst_summary"
          ].includes(selectedReport.key)
            ? "landscape"
            : "portrait"
        }
        getPdfUrl={(orientation, search, theme, copyType) => {
          if (!selectedReport || !selectedReport.pdfEndpoint) return "";
          let baseEndpoint = selectedReport.pdfEndpoint(currentParams);
          if (baseEndpoint.startsWith("/api/") && !baseEndpoint.startsWith("/api/v1/")) {
            baseEndpoint = baseEndpoint.replace("/api/", "/api/v1/");
          }
          const sep = baseEndpoint.includes("?") ? "&" : "?";
          return `${apiClient.defaults.baseURL}${baseEndpoint}${sep}orientation=${orientation}&search=${encodeURIComponent(search)}&_t=${Date.now()}`;
        }}
        getExcelUrl={selectedReport?.excelEndpoint ? () => {
          if (!selectedReport?.excelEndpoint) return "";
          return `${apiClient.defaults.baseURL}${selectedReport.excelEndpoint(currentParams)}`;
        } : undefined}
      />

      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        initialCategory="REPORTS_GUIDE"
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
  reportTh: { fontSize: 11, fontWeight: "700", color: "#475569", letterSpacing: 0.2 },
  reportTd: { fontSize: 11, color: "#0F172A" },
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
