// =============================================================
// JK INFOTECH ERP — Sales / Invoices Screen (Fluent Master-Detail)
// File : src/screens/SalesScreen.tsx
// =============================================================

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Image,
  NativeModules,
  Clipboard,
  PanResponder,
  Modal as RNModal,
  Keyboard,
  DeviceEventEmitter
} from "react-native";
import { useUIStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/client";
import { DataTable, ColumnDefinition } from "../components/ui/DataTable";
import { SearchToolbar } from "../components/ui/SearchToolbar";
import { Modal } from "../components/ui/Modal";
import { FullScreenModal } from "../components/ui/FullScreenModal";
import { PdfPreviewModal } from "../components/ui/PdfPreviewModal";
import { Dropdown, DropdownRef } from "../components/ui/Dropdown";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { DatePicker } from "../components/ui/DatePicker";
import { storage } from "../utils/storage";
import { sequencesApi } from "../api/sequences";

const WindowsView = View as any;
const WindowsScrollView = ScrollView as any;

// ─── Helpers ──────────────────────────────────────────────────
function toUIDate(isoDateStr: string): string {
  if (!isoDateStr) return "—";
  const clean = isoDateStr.split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    if (parts[2].length === 4) return clean; // Already DD-MM-YYYY
    if (parts[0].length === 4) {
      return `${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}-${parts[0]}`;
    }
  }
  return isoDateStr;
}

function toISODate(uiDateStr: string): string {
  if (!uiDateStr) return "";
  const parts = uiDateStr.split("-");
  if (parts.length === 3) {
    if (parts[0].length === 4) return uiDateStr; // Already YYYY-MM-DD
    if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  }
  return uiDateStr;
}

function formatPaymentTimestamp(isoStr: string): string {
  if (!isoStr) return "—";
  const parts = isoStr.split("T");
  const datePart = toUIDate(parts[0]);
  if (parts.length === 2) {
    const timePart = parts[1].substring(0, 5); // HH:MM
    return `${datePart} ${timePart}`;
  }
  return datePart;
}



// ─── Types ────────────────────────────────────────────────────
interface Customer {
  id: string;
  name: string;
  gst_number?: string;
  phone?: string;
  city?: string;
  state?: string;
}

interface InvoiceItem {
  id?: string;
  product_id: string;
  quantity: number;
  quantity_2?: number | string;
  quantity_3?: number | string;
  unit_price: number | string;
  tax_rate: number | string;
  discount_pct: number | string;
  hsn_code?: string;
  tax_amount?: number;
  total?: number;
  p_challan_no?: string;
  note?: string;
  // enriched on client
  product_name?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  notes?: string;
  place_of_supply?: string;
  challan_no?: string;
  vehicle_no?: string;
  transporter_name?: string;
  eway_bill_no?: string;
  customer?: Customer;
  customer_id: string;
  items: InvoiceItem[];
}

interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  sale_price: number;
  tax_rate: number;
  hsn_code?: string;
  unit: string;
}

// ─── Status badge color helper ─────────────────────────────────
function statusColor(status: string) {
  switch (status?.toUpperCase()) {
    case "PAID": return { bg: "#DCFCE7", text: "#16A34A" };
    case "PARTIAL": return { bg: "#FEF9C3", text: "#A16207" };
    case "UNPAID": return { bg: "#FEE2E2", text: "#DC2626" };
    case "CANCELLED": return { bg: "#FEE2E2", text: "#9F1239" };
    default: return { bg: "#F1F5F9", text: "#64748B" };
  }
}

// ─── Blank new-invoice form ────────────────────────────────────
function blankForm() {
  return {
    customer_id: "",
    invoice_number: "",
    invoice_date: toUIDate(new Date().toISOString().split("T")[0]),
    due_date: "",
    due_days: "",
    notes: "",
    notes_2: "",
    gst_nature: "Same State",
    gst_type: "B2B",
    place_of_supply: "",
    challan_no: "",
    vehicle_no: "",
    transporter_name: "",
    transporter_id: "",
    distance_km_eway: "",
    eway_bill_no: "",
    eway_bill_date: "",
    round_off_amount: "",
    discount_percentage: "",
    rate_difference_amount: "",
    freight_forwarding_amount: "",
    other_additions: "",
    other_deductions: "",
    post_add_1: "",
    post_deduct_1: "",
    post_add_2: "",
    post_deduct_2: "",
    broker_name: "",
    brokerage_percentage: "",
    shipping_name: "",
    gst_transaction_type: "B2B",
    supply_type: "Goods",
    gst_inv_type: "Regular",
    gst_method: "GST On Supreme Amount",
    rounding_method: "NORMAL",
  };
}

function blankLine(): InvoiceItem {
  return {
    product_id: "",
    quantity: 0,
    quantity_2: "",
    quantity_3: "",
    unit_price: "",
    tax_rate: "",
    discount_pct: "",
    product_name: "",
    p_challan_no: "",
    note: "",
  };
}

interface Payment {
  id: string;
  payment_type: string;
  reference_type: string;
  reference_id?: string;
  party_type: string;
  party_id: string;
  payment_method: string;
  bank_account?: string;
  amount: number;
  payment_date: string;
  reference_number?: string;
  notes?: string;
  created_at: string;
}

interface BankAccount {
  id: string;
  name: string;
  account_code?: string;
  account_type: string;
  account_subtype?: string;
  opening_balance: number;
}

// ─── Main Screen ───────────────────────────────────────────────
export default function SalesScreen() {
  const { isDarkMode, isCreatingInvoice, setIsCreatingInvoice, setGlobalLoading, setIsPrintPreviewOpen } = useUIStore();
  const { company } = useAuthStore();
  const defaultTaxRate = company?.default_gst_rate || company?.default_tax_rate || 18;
  const queryClient = useQueryClient();

  const [selectedInv, setSelectedInv] = useState<Invoice | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  // form state
  const [form, setForm] = useState(blankForm());
  const [lines, setLines] = useState<InvoiceItem[]>([blankLine()]);
  const [formStep, setFormStep] = useState(1);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState("Generating...");

  useEffect(() => {
    if (isCreatingInvoice && !editingInvoiceId) {
      sequencesApi.previewSequence("Sales Invoice")
        .then(res => {
          setNextInvoiceNumber(res.next_number);
          setForm(f => ({ ...f, invoice_number: res.next_number }));
        })
        .catch(() => {
          setNextInvoiceNumber("INV-AUTO");
          setForm(f => ({ ...f, invoice_number: "INV-AUTO" }));
        });
    }
  }, [isCreatingInvoice]);

  // Listen to global keyboard shortcuts
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("globalKeyDown", (e) => {
      if (!e) return;
      const { key, ctrlKey } = e;
      
      // Ctrl + S triggers handleSave if the invoice form is open!
      if (isCreatingInvoice && ctrlKey && (key === "s" || key === "S")) {
        handleSave();
      }
    });
    return () => sub.remove();
  }, [isCreatingInvoice, form, lines, totals]);

  // quick add product states
  const [isQuickAddProductModalOpen, setIsQuickAddProductModalOpen] = useState(false);
  const [quickAddProductName, setQuickAddProductName] = useState("");
  const [quickAddProductRate, setQuickAddProductRate] = useState("");
  const [quickAddLineIndex, setQuickAddLineIndex] = useState<number | null>(null);
  const [disabledLineIndex, setDisabledLineIndex] = useState<number | null>(null);
  const quickAddRateRef = useRef<TextInput>(null);
  const invoiceBillNoRef = useRef<TextInput>(null);
  const invoiceDateRef = useRef<TextInput>(null);
  const invoiceCustomerRef = useRef<DropdownRef>(null);
  const productRefs = useRef<any>([]);
  const qtyRefs = useRef<any>([]);
  const rateRefs = useRef<any>([]);
  const challanRefs = useRef<any>([]);
  const noteRefs = useRef<any>([]);
  const dupConfirmBtnRef = useRef<any>(null);
  const dupHiddenInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (formStep === 2) {
      setTimeout(() => {
        productRefs.current[0]?.open();
      }, 200);
    }
  }, [formStep]);

  useEffect(() => {
    if (isCreatingInvoice && formStep === 1) {
      setTimeout(() => {
        invoiceCustomerRef.current?.open();
      }, 300);
    }
  }, [isCreatingInvoice]);

  useEffect(() => {
    if (isQuickAddProductModalOpen) {
      setTimeout(() => {
        quickAddRateRef.current?.focus();
      }, 200);
    }
  }, [isQuickAddProductModalOpen]);

  useEffect(() => {
    if (isCreatingInvoice && form.customer_id) {
      setTimeout(() => {
        invoiceBillNoRef.current?.focus();
      }, 50);
    }
  }, [form.customer_id, isCreatingInvoice]);



  // native preview state
  const [previewInv, setPreviewInv] = useState<Invoice | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [rateEditModal, setRateEditModal] = useState<{
    isOpen: boolean;
    lineIndex: number;
    productId: string;
    productName: string;
    oldPrice: number;
    newPrice: number;
  } | null>(null);

  const [duplicateWarningModal, setDuplicateWarningModal] = useState<{
    isOpen: boolean;
    lineIndex: number;
    productId: string;
    productName: string;
    invoiceNumbers: string[];
  } | null>(null);

  // Dismiss keyboard/focus from background fields and focus warning overlay hidden input
  useEffect(() => {
    if (duplicateWarningModal?.isOpen) {
      Keyboard.dismiss();
      setTimeout(() => {
        dupHiddenInputRef.current?.focus();
      }, 250);
    }
  }, [duplicateWarningModal]);

  const [quickAddDuplicateWarningOpen, setQuickAddDuplicateWarningOpen] = useState(false);
  const [quickAddDuplicatePayload, setQuickAddDuplicatePayload] = useState<any>(null);

  const handleConfirmDuplicate = () => {
    if (!duplicateWarningModal) return;
    const { lineIndex, productId } = duplicateWarningModal;
    const prod = products.find(p => p.id === productId);
    if (prod) {
      updateLine(lineIndex, "product_id", productId);
      updateLine(lineIndex, "unit_price", prod.sale_price);
      setTimeout(() => {
        qtyRefs.current[lineIndex]?.focus();
      }, 150);
    }
    setDuplicateWarningModal(null);
  };

  const handleCancelDuplicate = () => {
    if (!duplicateWarningModal) return;
    const { lineIndex } = duplicateWarningModal;
    updateLine(lineIndex, "product_id", "");
    setDuplicateWarningModal(null);
  };

  const updateProductPriceMutation = useMutation({
    mutationFn: async (payload: { id: string, sale_price: number }) => {
      const detail = await apiClient.get(`/api/inventory/products/${payload.id}`);
      const updated = { ...detail.data, sale_price: payload.sale_price };
      return apiClient.put(`/api/inventory/products/${payload.id}`, updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    }
  });

  const duplicateProductMutation = useMutation({
    mutationFn: async (payload: { id: string, sale_price: number }) => {
      const detail = await apiClient.get(`/api/inventory/products/${payload.id}`);
      const newSku = `${detail.data.sku || "PROD"}-${Math.floor(1000 + Math.random() * 9000)}`;
      const newProduct = {
        ...detail.data,
        id: undefined,
        sku: newSku,
        name: `${detail.data.name} - ₹${payload.sale_price}`,
        sale_price: payload.sale_price,
        opening_stock: 0
      };
      return apiClient.post(`/api/inventory/products`, newProduct);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (rateEditModal && res.data?.id) {
        updateLine(rateEditModal.lineIndex, "product_id", res.data.id);
      }
    }
  });

  // ── Colors ──
  const C = isDarkMode
    ? {
      bg: "#0F172A",
      card: "#1E293B",
      border: "#334155",
      textPrimary: "#F8FAFC",
      textSecondary: "#94A3B8",
      accent: "#38BDF8",
      inputBg: "#1E293B",
      inputBorder: "#334155",
      headerBg: "#1E293B",
      rowHover: "#1E3A5F",
      rowActive: "#0C4A6E",
      divider: "#334155",
      tableHead: "#334155",
      badgePaid: { bg: "#14532D", text: "#86EFAC" },
      badgePartial: { bg: "#422006", text: "#FDE68A" },
      badgeUnpaid: { bg: "#450A0A", text: "#FCA5A5" },
      btnPrimary: "#0284C7",
      btnPrimaryHover: "#0EA5E9",
      btnDanger: "#DC2626",
    }
    : {
      bg: "#F8FAFC",
      card: "#FFFFFF",
      border: "#E2E8F0",
      textPrimary: "#0F172A",
      textSecondary: "#64748B",
      accent: "#0284C7",
      inputBg: "#FFFFFF",
      inputBorder: "#CBD5E1",
      headerBg: "#F1F5F9",
      rowHover: "#F1F5F9",
      rowActive: "#E0F2FE",
      divider: "#E2E8F0",
      tableHead: "#F1F5F9",
      badgePaid: { bg: "#DCFCE7", text: "#16A34A" },
      badgePartial: { bg: "#FEF9C3", text: "#A16207" },
      badgeUnpaid: { bg: "#FEE2E2", text: "#DC2626" },
      btnPrimary: "#0284C7",
      btnPrimaryHover: "#0369A1",
      btnDanger: "#DC2626",
    };

  // ── Fetch invoices ──
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["invoices"],
    queryFn: async () => {
      const res = await apiClient.get("/api/sales/invoices");
      return res.data;
    },
  });

  // ── Fetch customers ──
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await apiClient.get("/api/sales/customers");
      return res.data;
    },
  });

  // ── Fetch products ──
  const productsQuery = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await apiClient.get("/api/inventory/products");
      return res.data;
    },
  });
  const products = productsQuery.data || [];

  // ── Create invoice mutation ──
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/api/sales/invoices", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_kpis"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_sales_trend"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_liquidity"] });
      setIsCreatingInvoice(false);
      setSelectedInv(null);
      setEditingInvoiceId(null);
      setForm(blankForm());
      setLines([blankLine()]);
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.detail
        ? (typeof err.response.data.detail === "string"
          ? err.response.data.detail
          : JSON.stringify(err.response.data.detail, null, 2))
        : "Failed to create invoice.";
      Alert.alert("Error", errMsg);
      console.error("Save invoice error:", err?.response?.data || err);
    },
  });

  // ── Update invoice mutation ──
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await apiClient.put(`/api/sales/invoices/${id}`, payload);
      return res.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_kpis"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_sales_trend"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_liquidity"] });
      setIsCreatingInvoice(false);
      setEditingInvoiceId(null);
      setSelectedInv(data);
      setForm(blankForm());
      setLines([blankLine()]);
      setFormStep(1);
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.detail
        ? (typeof err.response.data.detail === "string"
          ? err.response.data.detail
          : JSON.stringify(err.response.data.detail, null, 2))
        : "Failed to update invoice.";
      Alert.alert("Error", errMsg);
      console.error("Update invoice error:", err?.response?.data || err);
    },
  });

  // ── Trigger edit mode ──
  const triggerEditInvoice = (inv: Invoice) => {
    setEditingInvoiceId(inv.id);
    setForm({
      customer_id: inv.customer_id,
      invoice_number: inv.invoice_number,
      invoice_date: toUIDate(inv.invoice_date),
      due_date: inv.due_date ? toUIDate(inv.due_date) : "",
      due_days: "",
      notes: inv.notes || "",
      notes_2: "",
      gst_nature: (inv as any).gst_nature || "Same State",
      gst_type: (inv as any).gst_type || "B2B",
      place_of_supply: inv.place_of_supply || "",
      challan_no: inv.challan_no || "",
      vehicle_no: inv.vehicle_no || "",
      transporter_name: inv.transporter_name || "",
      transporter_id: (inv as any).transporter_id || "",
      distance_km_eway: (inv as any).distance_km_eway ? String((inv as any).distance_km_eway) : "",
      eway_bill_no: inv.eway_bill_no || "",
      eway_bill_date: (inv as any).eway_bill_date ? toUIDate((inv as any).eway_bill_date) : "",
      round_off_amount: (inv as any).round_off_amount ? String((inv as any).round_off_amount) : "",
      discount_percentage: (inv as any).discount_percentage ? String((inv as any).discount_percentage) : "",
      rate_difference_amount: (inv as any).rate_difference_amount ? String((inv as any).rate_difference_amount) : "",
      freight_forwarding_amount: (inv as any).freight_forwarding_amount ? String((inv as any).freight_forwarding_amount) : "",
      other_additions: "",
      other_deductions: "",
      post_add_1: "",
      post_deduct_1: "",
      post_add_2: "",
      post_deduct_2: "",
      broker_name: (inv as any).broker_name || "",
      brokerage_percentage: (inv as any).brokerage_percentage ? String((inv as any).brokerage_percentage) : "",
      shipping_name: (inv as any).shipping_name || "",
      gst_transaction_type: (inv as any).gst_transaction_type || "B2B",
      supply_type: (inv as any).supply_type || "Goods",
      gst_inv_type: (inv as any).gst_inv_type || "Regular",
      gst_method: (inv as any).gst_method || "GST On Supreme Amount",
      rounding_method: (inv as any).rounding_method || "NORMAL",
    });
    setLines(
      inv.items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        quantity_2: item.quantity_2 ? String(item.quantity_2) : "",
        quantity_3: item.quantity_3 ? String(item.quantity_3) : "",
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        discount_pct: item.discount_pct || "",
        hsn_code: item.hsn_code || "",
        p_challan_no: item.p_challan_no || "",
        note: item.note || "",
        product_name: item.product_name || (item as any).product?.name || "",
      }))
    );
    setNextInvoiceNumber(inv.invoice_number);
    setFormStep(1);
    setSelectedInv(null);
    setIsCreatingInvoice(true);
  };

  // ── Delete invoice mutation ──
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/sales/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_kpis"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_sales_trend"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_liquidity"] });
      setSelectedInv(null);
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.detail || "Failed to delete.");
    },
  });

  const triggerPreview = async (inv: Invoice) => {
    setPreviewInv(inv);
    setIsPreviewOpen(true);
  };

  // ── Payment Receipt states ──
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    tds_amount: "0",
    apply_remaining_as_tds: true,
    payment_date: toUIDate(new Date().toISOString().split("T")[0]),
    payment_method: "BANK_TRANSFER",
    bank_account: "",
    reference_number: "",
    notes: ""
  });

  // Fetch linked payments for history
  const { data: invoicePayments = [], refetch: refetchPayments } = useQuery<Payment[]>({
    queryKey: ["invoicePayments", selectedInv?.id],
    queryFn: async () => {
      if (!selectedInv) return [];
      const res = await apiClient.get(`/api/banking/payments?reference_type=invoice&reference_id=${selectedInv.id}`);
      return res.data;
    },
    enabled: !!selectedInv,
  });

  // Fetch liquid accounts for target selection
  const { data: bankAccounts = [] } = useQuery<BankAccount[]>({
    queryKey: ["bankingAccounts"],
    queryFn: async () => {
      const res = await apiClient.get("/api/banking/accounts");
      return res.data;
    },
  });

  // Create payment mutation
  const receivePaymentMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/api/banking/payments", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoicePayments", paymentInvoice?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_kpis"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_sales_trend"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_liquidity"] });
      setIsPaymentModalOpen(false);
      Alert.alert("Success", "Payment receipt registered successfully.");
      if (paymentInvoice) {
        const out = Number(paymentInvoice.balance_due);
        const amt = parseFloat(paymentForm.amount) || 0;
        const tds = paymentForm.apply_remaining_as_tds ? Math.max(0, out - amt) : 0;
        const totalCredited = amt + tds;
        const newPaid = Number(paymentInvoice.amount_paid) + totalCredited;
        const newDue = Math.max(0, Number(paymentInvoice.total) - newPaid);
        const updated = {
          ...paymentInvoice,
          amount_paid: newPaid,
          balance_due: newDue,
          status: newDue <= 0 ? "PAID" : "PARTIAL"
        };
        setPaymentInvoice(updated);
        if (selectedInv?.id === paymentInvoice.id) {
          setSelectedInv(updated);
        }
      }
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.detail || "Failed to save payment.");
    }
  });

  // Delete payment mutation
  const deletePaymentMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/banking/payments/${id}`);
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoicePayments", selectedInv?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_kpis"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_sales_trend"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_liquidity"] });
      Alert.alert("Success", "Payment receipt deleted successfully.");

      if (selectedInv) {
        const deletedPayment = invoicePayments.find(p => p.id === deletedId);
        if (deletedPayment) {
          const amt = Number(deletedPayment.amount) + Number((deletedPayment as any).tds_amount || 0);
          const newPaid = Math.max(0, Number(selectedInv.amount_paid) - amt);
          const newDue = Number(selectedInv.total) - newPaid;
          setSelectedInv({
            ...selectedInv,
            amount_paid: newPaid,
            balance_due: newDue,
            status: newDue <= 0 ? "PAID" : newPaid > 0 ? "PARTIAL" : "UNPAID"
          });
        }
      }
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.detail || "Failed to delete payment.");
    }
  });

  // ── Computed totals ──
  const totals = useMemo(() => {
    let sub = 0;
    lines.forEach(l => {
      sub += (l.quantity || 0) * (Number(l.unit_price) || 0);
    });

    const rateDiff = parseFloat(form.rate_difference_amount || "0") || 0;
    const discPct = parseFloat(form.discount_percentage || "0") || 0;
    const otherAdd = parseFloat(form.other_additions || "0") || 0;
    const otherDed = parseFloat(form.other_deductions || "0") || 0;
    const freight = parseFloat(form.freight_forwarding_amount || "0") || 0;

    const discAmt = sub * (discPct / 100);
    const taxableVal = sub - discAmt - rateDiff + otherAdd - otherDed + freight;

    // Tax rate from settings
    const taxVal = taxableVal > 0 ? taxableVal * (defaultTaxRate / 100) : 0;
    const netTotalBeforeRounding = taxableVal + taxVal;

    let netTotalRounded = netTotalBeforeRounding;
    let autoRoundOff = 0;

    if (form.rounding_method === "NORMAL") {
      netTotalRounded = Math.round(netTotalBeforeRounding);
      autoRoundOff = netTotalRounded - netTotalBeforeRounding;
    } else {
      autoRoundOff = parseFloat(form.round_off_amount || "0") || 0;
      netTotalRounded = netTotalBeforeRounding + autoRoundOff;
    }

    return {
      subtotal: sub,
      discount_amount: discAmt,
      taxable_value: taxableVal,
      tax: taxVal,
      cgst: taxVal / 2,
      sgst: taxVal / 2,
      auto_round_off: autoRoundOff,
      total: netTotalRounded
    };
  }, [lines, form.rate_difference_amount, form.discount_percentage, form.other_additions, form.other_deductions, form.freight_forwarding_amount, form.rounding_method, form.round_off_amount, defaultTaxRate]);

  // ── Filtered invoice list ──
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchSearch =
        !searchQuery ||
        inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus =
        statusFilter === "ALL" || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [invoices, searchQuery, statusFilter]);

  // ── Save invoice ──
  function handleSave() {
    if (!form.customer_id) {
      Alert.alert("Validation", "Please select a customer.");
      return;
    }
    if (lines.some(l => !l.product_id)) {
      Alert.alert("Validation", "Each line item must have a product selected.");
      return;
    }

    const payload = {
      ...form,
      invoice_date: toISODate(form.invoice_date),
      due_date: form.due_date ? toISODate(form.due_date) : null,
      eway_bill_date: form.eway_bill_date ? toISODate(form.eway_bill_date) : null,
      invoice_number: form.invoice_number || "INV-AUTO",
      subtotal: totals.subtotal,
      tax_amount: totals.tax,
      total: totals.total,
      round_off_amount: parseFloat(form.round_off_amount || "0"),
      due_days: parseInt(form.due_days || "0") || 0,
      discount_percentage: parseFloat(form.discount_percentage || "0") || 0,
      rate_difference_amount: parseFloat(form.rate_difference_amount || "0") || 0,
      freight_forwarding_amount: parseFloat(form.freight_forwarding_amount || "0") || 0,
      brokerage_percentage: parseFloat(form.brokerage_percentage || "0") || 0,
      distance_km_eway: parseFloat(form.distance_km_eway || "0") || null,
      items: lines.map(l => ({
        product_id: l.product_id,
        quantity: l.quantity,
        quantity_2: l.quantity_2 ? parseFloat(l.quantity_2 as any) : 0,
        quantity_3: l.quantity_3 ? parseFloat(l.quantity_3 as any) : 0,
        unit_price: l.unit_price,
        tax_rate: defaultTaxRate,
        discount_pct: 0,
        hsn_code: l.hsn_code || "",
        p_challan_no: l.p_challan_no || "",
        note: l.note || "",
      })),
    };

    if (editingInvoiceId) {
      updateMutation.mutate({ id: editingInvoiceId, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  // ── Line helpers ──
  function updateLine(idx: number, key: keyof InvoiceItem, val: any) {
    setLines(prev => {
      const next = [...prev];
      (next[idx] as any)[key] = val;
      // auto-fill from product
      if (key === "product_id") {
        const prod = products.find(p => p.id === val);
        if (prod) {
          next[idx].unit_price = prod.sale_price;
          next[idx].tax_rate = prod.tax_rate;
          next[idx].hsn_code = prod.hsn_code;
          next[idx].product_name = prod.name;
        }
      }
      return next;
    });

    if (key === "product_id" && val) {
      setTimeout(() => {
        noteRefs.current[idx]?.focus();
      }, 100);
    }
  }

  function addLine() {
    setLines(prev => [...prev, blankLine()]);
  }

  function removeLine(idx: number) {
    setLines(prev => prev.filter((_, i) => i !== idx));
  }

  const handleQuickAddSave = async () => {
    if (!quickAddProductName.trim()) {
      Alert.alert("Validation", "Product name cannot be empty.");
      return;
    }
    const rateVal = parseFloat(quickAddProductRate) || 0;
    if (rateVal <= 0) {
      Alert.alert("Validation", "Please enter a valid rate (sale price) greater than 0.");
      return;
    }

    const isGst = company?.is_gst_applicable ?? true;
    const resolvedGstRate = isGst ? (parseFloat(company?.default_gst_rate || company?.default_tax_rate || "18") || 0) : 0;
    const resolvedItemType = (company?.hsn_sac_type || "Goods").toLowerCase() === "service" ? "service" : "goods";
    const resolvedHsn = resolvedItemType === "goods" ? (company?.default_hsn_sac_code || "") : "";
    const resolvedSac = resolvedItemType === "service" ? (company?.default_hsn_sac_code || "") : "";

    const payload = {
      name: quickAddProductName.trim(),
      sku: quickAddProductName.trim(),
      barcode: "",
      description: "",
      unit: "PCS",
      base_unit: "PCS",
      item_type: resolvedItemType,
      secondary_unit: null,
      conversion_factor: 1.0,
      purchase_price: 0.0,
      sale_price: rateVal,
      mrp: rateVal,
      tax_preference: isGst ? "taxable" : "exempt",
      tax_rate: resolvedGstRate,
      intra_state_tax_rate: resolvedGstRate / 2,
      inter_state_tax_rate: resolvedGstRate,
      hsn_code: resolvedHsn,
      sac_code: resolvedSac,
      reorder_level: 0.0,
      has_batch_tracking: false,
      is_active: true,
      category_id: null,
    };

    const duplicateExists = products.some(p =>
      p.name.trim().toLowerCase() === quickAddProductName.trim().toLowerCase()
    );

    const performSave = async (savePayload: any) => {
      try {
        setGlobalLoading("Saving Product...", "Registering new product");
        const res = await apiClient.post("/api/inventory/products", savePayload);
        const newProd = res.data;

        queryClient.invalidateQueries({ queryKey: ["products"] });

        setIsQuickAddProductModalOpen(false);
        setQuickAddDuplicateWarningOpen(false);
        setQuickAddDuplicatePayload(null);

        if (quickAddLineIndex !== null) {
          const activeIdx = quickAddLineIndex;
          setLines(prev => {
            const next = [...prev];
            next[activeIdx].product_id = newProd.id;
            next[activeIdx].unit_price = newProd.sale_price;
            next[activeIdx].tax_rate = newProd.tax_rate;
            next[activeIdx].hsn_code = newProd.hsn_code;
            next[activeIdx].product_name = newProd.name;
            return next;
          });

          setTimeout(() => {
            qtyRefs.current[activeIdx]?.focus();
          }, 120);
        }
      } catch (err: any) {
        Alert.alert("Error", err.response?.data?.detail || "Failed to save product.");
      } finally {
        setGlobalLoading(null, "");
      }
    };

    if (duplicateExists && !quickAddDuplicatePayload) {
      setQuickAddDuplicatePayload(payload);
      setQuickAddDuplicateWarningOpen(true);
      return;
    }

    performSave(quickAddDuplicatePayload || payload);
  };

  // ─── Status badge row ──────────────────────────────────────────
  const STATUS_FILTERS = ["ALL", "UNPAID", "PARTIAL", "PAID"];

  // ── Main render ───────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>

      {/* LEFT PANEL — Invoice list */}
      <View
        style={[
          styles.listPanel,
          (selectedInv && !isCreatingInvoice) && styles.listPanelSplit,
          (selectedInv && !isCreatingInvoice) && { borderRightColor: C.border },
          { backgroundColor: C.bg }
        ]}
      >

        {/* Header Block */}
        <View style={styles.header}>
          <Text style={[styles.breadcrumb, { color: C.accent }]}>SALES / INVOICES</Text>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: C.textPrimary }]}>Sales Invoices</Text>
            <Pressable
              onPress={() => {
                setForm(blankForm());
                setLines([blankLine()]);
                setFormStep(1);
                setIsCreatingInvoice(true);
                setSelectedInv(null);
              }}
              style={({ hovered, pressed }: any) => [
                styles.newBtn,
                { backgroundColor: hovered ? C.btnPrimaryHover : C.btnPrimary },
                pressed && { transform: [{ scale: 0.98 }] }
              ]}
            >
              <Text style={styles.newBtnText}>+ New Invoice</Text>
            </Pressable>
          </View>
          <Text style={[styles.subtitle, { color: C.textSecondary }]}>
            Create and track customer invoices, manage payments, and view invoice status.
          </Text>
        </View>

        {/* Search */}
        <SearchToolbar
          placeholder="Search invoice no. or customer..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {/* Status filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
          {STATUS_FILTERS.map(s => (
            <Pressable
              key={s}
              onPress={() => setStatusFilter(s)}
              style={[
                styles.pill,
                { borderColor: statusFilter === s ? C.accent : C.border },
                statusFilter === s && { backgroundColor: isDarkMode ? "#0C4A6E" : "#E0F2FE" }
              ]}
            >
              <Text style={[styles.pillText, { color: statusFilter === s ? C.accent : C.textSecondary }]}>
                {s}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Table List View */}
        <DataTable
          data={filteredInvoices}
          columns={[
            {
              header: "INVOICE #",
              accessorKey: "invoice_number",
              flex: 1.4,
              render: (row) => (
                <Text style={[styles.tdCell, { color: C.textPrimary, fontWeight: "600" }]} numberOfLines={1}>
                  {row.invoice_number}
                </Text>
              )
            },
            {
              header: "CUSTOMER",
              accessorKey: "customer.name",
              flex: 1.8,
              render: (row) => (
                <Text style={[styles.tdCell, { color: C.textPrimary }]} numberOfLines={1}>
                  {row.customer?.name || "—"}
                </Text>
              )
            },
            {
              header: "DATE",
              accessorKey: "invoice_date",
              flex: 0.9,
              render: (row) => (
                <Text style={[styles.tdCell, { color: C.textSecondary, fontSize: 11 }]}>
                  {toUIDate(row.invoice_date)}
                </Text>
              )
            },
            {
              header: "TOTAL",
              accessorKey: "total",
              flex: 0.9,
              align: "right",
              render: (row) => (
                <Text style={[styles.tdCell, { color: C.textPrimary, fontWeight: "600", textAlign: "right" }]}>
                  ₹{Number(row.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              )
            },
            {
              header: "STATUS",
              accessorKey: "status",
              flex: 0.8,
              align: "center",
              render: (row) => {
                const badge = isDarkMode
                  ? (row.status === "PAID" ? C.badgePaid : row.status === "PARTIAL" ? C.badgePartial : C.badgeUnpaid)
                  : statusColor(row.status);
                return (
                  <View style={{ alignItems: "center" }}>
                    <View style={[styles.statusBadge, { backgroundColor: (badge as any).bg }]}>
                      <Text style={[styles.statusBadgeText, { color: (badge as any).text }]}>
                        {row.status}
                      </Text>
                    </View>
                  </View>
                );
              }
            },
            {
              header: "ACTION",
              accessorKey: "id",
              flex: 1.1,
              align: "center",
              render: (row) => {
                const canReceive = row.status !== "CANCELLED" && Number(row.balance_due) > 0;
                return (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Pressable
                      onPress={() => triggerPreview(row)}
                      style={({ hovered, pressed }: any) => [
                        {
                          paddingHorizontal: 8,
                          paddingVertical: 6,
                          borderRadius: 4,
                          borderWidth: 1,
                          borderColor: C.border,
                          justifyContent: "center",
                          alignItems: "center"
                        },
                        hovered && { backgroundColor: C.rowHover },
                        pressed && { transform: [{ scale: 0.96 }] }
                      ]}
                    >
                      <Image
                        source={require("../components/print_icon_for_print_preview.png")}
                        style={{ width: 18, height: 18 }}
                        resizeMode="contain"
                      />
                    </Pressable>
                    {canReceive && (
                      <Pressable
                        onPress={() => {
                          setPaymentForm({
                            amount: String(row.balance_due),
                            tds_amount: "0",
                            apply_remaining_as_tds: true,
                            payment_date: toUIDate(new Date().toISOString().split("T")[0]),
                            payment_method: "BANK_TRANSFER",
                            bank_account: bankAccounts[0]?.name || "",
                            reference_number: "",
                            notes: `Payment for invoice ${row.invoice_number}`
                          });
                          setPaymentInvoice(row);
                          setIsPaymentModalOpen(true);
                        }}
                        style={({ hovered, pressed }: any) => [
                          styles.tableReceiveBtn,
                          { backgroundColor: hovered ? C.btnPrimaryHover : C.btnPrimary },
                          pressed && { transform: [{ scale: 0.96 }] }
                        ]}
                      >
                        <Text style={styles.tableReceiveBtnText}>Receive Payment</Text>
                      </Pressable>
                    )}
                  </View>
                );
              }
            }
          ]}
          isLoading={isLoading}
          onRowPress={(item) => {
            setSelectedInv(item);
            setIsCreatingInvoice(false);
          }}
          selectedId={selectedInv?.id}
          emptyMessage="No invoices found"
          loaderMessage="Loading invoices…"
        />
      </View>

      {/* RIGHT PANEL — Detail View */}
      {selectedInv && !isCreatingInvoice && (
        <View style={[styles.detailPanel, { backgroundColor: C.card, borderLeftColor: C.border }]}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.detailScroll}>

            {/* Detail Header */}
            <View style={[styles.detailHeader, { borderBottomColor: C.border }]}>
              <Text style={[styles.detailTitle, { color: C.textPrimary }]}>
                {isCreatingInvoice ? "New Invoice" : selectedInv?.invoice_number}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {!isCreatingInvoice && selectedInv && (
                  <Pressable
                    onPress={() => triggerPreview(selectedInv)}
                    style={({ hovered }: any) => [
                      styles.iconBtn,
                      { borderColor: C.border },
                      hovered && { backgroundColor: C.rowHover }
                    ]}
                  >
                    <Image
                      source={require("../components/print_icon_for_print_preview.png")}
                      style={{ width: 18, height: 18 }}
                      resizeMode="contain"
                    />
                  </Pressable>
                )}
                {!isCreatingInvoice && selectedInv && selectedInv.status !== "CANCELLED" && (
                  <Pressable
                    onPress={() => triggerEditInvoice(selectedInv)}
                    style={({ hovered }: any) => [
                      styles.iconBtn,
                      { borderColor: C.accent },
                      hovered && { backgroundColor: "#E0F2FE" }
                    ]}
                  >
                    <Text style={[styles.iconBtnText, { fontFamily: "Segoe MDL2 Assets", color: C.accent }]}>{"\uE70F"}</Text>
                  </Pressable>
                )}
                {!isCreatingInvoice && selectedInv && (
                  <Pressable
                    onPress={() => {
                      const hasPayments = Number(selectedInv.amount_paid) > 0;
                      const formattedAmount = Number(selectedInv.amount_paid).toLocaleString("en-IN", { minimumFractionDigits: 2 });
                      const alertTitle = hasPayments ? "⚠️ Delete Paid Invoice?" : "Delete Invoice";
                      const alertMsg = hasPayments
                        ? `Warning: Payments of ₹${formattedAmount} have been received against invoice ${selectedInv.invoice_number}.\n\nDeleting this invoice will also permanently delete all associated payment records and adjust your cash/bank balances.\n\nAre you sure you want to proceed?`
                        : `Are you sure you want to delete invoice ${selectedInv.invoice_number}?`;

                      Alert.alert(
                        alertTitle,
                        alertMsg,
                        [
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => deleteMutation.mutate(selectedInv.id)
                          },
                          { text: "Cancel", style: "cancel" }
                        ]
                      );
                    }}
                    style={({ hovered }: any) => [
                      styles.iconBtn,
                      { borderColor: "#EF4444" },
                      hovered && { backgroundColor: "#FEE2E2" }
                    ]}
                  >
                    <Text style={[styles.iconBtnText, { fontFamily: "Segoe MDL2 Assets", color: "#EF4444" }]}>{"\uE74D"}</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => setSelectedInv(null)}
                  style={({ hovered }: any) => [
                    styles.iconBtn,
                    { borderColor: C.border },
                    hovered && { backgroundColor: C.rowHover }
                  ]}
                >
                  <Text style={[styles.iconBtnText, { fontFamily: "Segoe MDL2 Assets", color: C.textSecondary }]}>{"\uE8BB"}</Text>
                </Pressable>
              </View>
            </View>

            {/* View mode Content */}
            {!isCreatingInvoice && selectedInv && (
              <View style={styles.viewContent}>
                {/* Summary cards */}
                <View style={styles.summaryRow}>
                  <SummaryCard label="Subtotal" value={`₹${Number(selectedInv.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color={C.textPrimary} bg={C.bg} border={C.border} />
                  <SummaryCard label="GST" value={`₹${Number(selectedInv.tax_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color={C.textSecondary} bg={C.bg} border={C.border} />
                  <SummaryCard label="Total" value={`₹${Number(selectedInv.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color={C.accent} bg={C.bg} border={C.border} accent />
                  <SummaryCard label="Balance Due" value={`₹${Number(selectedInv.balance_due).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color={Number(selectedInv.balance_due) > 0 ? "#DC2626" : "#16A34A"} bg={C.bg} border={C.border} />
                </View>

                {/* Invoice meta */}
                <View style={[styles.metaCard, { backgroundColor: C.bg, borderColor: C.border }]}>
                  <DetailRow label="Customer" value={selectedInv.customer?.name || "—"} color={C.textPrimary} labelColor={C.textSecondary} />
                  <DetailRow label="Invoice Date" value={toUIDate(selectedInv.invoice_date)} color={C.textPrimary} labelColor={C.textSecondary} />
                  <DetailRow label="Due Date" value={selectedInv.due_date ? toUIDate(selectedInv.due_date) : "—"} color={C.textPrimary} labelColor={C.textSecondary} />
                  <DetailRow label="CGST" value={`₹${Number(selectedInv.cgst_amount).toFixed(2)}`} color={C.textPrimary} labelColor={C.textSecondary} />
                  <DetailRow label="SGST" value={`₹${Number(selectedInv.sgst_amount).toFixed(2)}`} color={C.textPrimary} labelColor={C.textSecondary} />
                  {Number(selectedInv.igst_amount) > 0 && (
                    <DetailRow label="IGST" value={`₹${Number(selectedInv.igst_amount).toFixed(2)}`} color={C.textPrimary} labelColor={C.textSecondary} />
                  )}
                  {selectedInv.place_of_supply ? (
                    <DetailRow label="Place of Supply" value={selectedInv.place_of_supply} color={C.textPrimary} labelColor={C.textSecondary} />
                  ) : null}
                  {selectedInv.challan_no ? (
                    <DetailRow label="Challan No" value={selectedInv.challan_no} color={C.textPrimary} labelColor={C.textSecondary} />
                  ) : null}
                  {selectedInv.vehicle_no ? (
                    <DetailRow label="Vehicle No" value={selectedInv.vehicle_no} color={C.textPrimary} labelColor={C.textSecondary} />
                  ) : null}
                  {selectedInv.transporter_name ? (
                    <DetailRow label="Transporter" value={selectedInv.transporter_name} color={C.textPrimary} labelColor={C.textSecondary} />
                  ) : null}
                  {selectedInv.eway_bill_no ? (
                    <DetailRow label="E-Way Bill" value={selectedInv.eway_bill_no} color={C.textPrimary} labelColor={C.textSecondary} />
                  ) : null}
                  {selectedInv.notes ? (
                    <DetailRow label="Notes" value={selectedInv.notes} color={C.textPrimary} labelColor={C.textSecondary} />
                  ) : null}
                </View>

                {/* Line items */}
                <Text style={[styles.sectionLabel, { color: C.textSecondary }]}>LINE ITEMS</Text>
                <View style={[styles.lineTable, { borderColor: C.border }]}>
                  <View style={[styles.lineHead, { backgroundColor: C.tableHead, borderBottomColor: C.border }]}>
                    <Text style={[styles.lineThCell, { flex: 2.2, color: C.textSecondary }]}>PRODUCT</Text>
                    <Text style={[styles.lineThCell, { flex: 0.8, color: C.textSecondary, textAlign: "right" }]}>QTY</Text>
                    <Text style={[styles.lineThCell, { flex: 1.2, color: C.textSecondary, textAlign: "right" }]}>RATE</Text>
                    <Text style={[styles.lineThCell, { flex: 0.8, color: C.textSecondary, textAlign: "right" }]}>GST%</Text>
                    <Text style={[styles.lineThCell, { flex: 1, color: C.textSecondary, textAlign: "right" }]}>AMOUNT</Text>
                  </View>
                  {selectedInv.items?.map((item: any) => (
                    <View key={item.id} style={[styles.lineRow, { borderBottomColor: C.divider }]}>
                      <Text style={[styles.lineTdCell, { flex: 2.2, color: C.textPrimary }]} numberOfLines={1}>
                        {item.product?.name || "Unknown"}
                      </Text>
                      <Text style={[styles.lineTdCell, { flex: 0.8, color: C.textSecondary, textAlign: "right" }]}>{item.quantity}</Text>
                      <Text style={[styles.lineTdCell, { flex: 1.2, color: C.textPrimary, textAlign: "right" }]}>
                        ₹{Number(item.unit_price).toLocaleString("en-IN")}
                      </Text>
                      <Text style={[styles.lineTdCell, { flex: 0.8, color: C.textSecondary, textAlign: "right" }]}>{item.tax_rate}%</Text>
                      <Text style={[styles.lineTdCell, { flex: 1, color: C.textPrimary, fontWeight: "600", textAlign: "right" }]}>
                        ₹{Number(item.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Payment History Section */}
                <Text style={[styles.sectionLabel, { color: C.textSecondary, marginTop: 16 }]}>PAYMENT HISTORY</Text>
                {invoicePayments.length === 0 ? (
                  <View style={[styles.emptyHistory, { borderColor: C.border, backgroundColor: C.bg }]}>
                    <Text style={[styles.emptyHistoryText, { color: C.textSecondary }]}>No payments received for this invoice yet.</Text>
                  </View>
                ) : (
                  <View style={[styles.lineTable, { borderColor: C.border }]}>
                    <View style={[styles.lineHead, { backgroundColor: C.tableHead, borderBottomColor: C.border }]}>
                      <Text style={[styles.lineThCell, { flex: 1.2, color: C.textSecondary }]}>DATE</Text>
                      <Text style={[styles.lineThCell, { flex: 1.4, color: C.textSecondary }]}>METHOD</Text>
                      <Text style={[styles.lineThCell, { flex: 2.0, color: C.textSecondary }]}>ACCOUNT/REF</Text>
                      <Text style={[styles.lineThCell, { flex: 1.2, color: C.textSecondary, textAlign: "right" }]}>AMOUNT</Text>
                      <Text style={[styles.lineThCell, { flex: 0.4, color: C.textSecondary, textAlign: "center" }]} />
                    </View>
                    {invoicePayments.map((p) => (
                      <View key={p.id} style={[styles.lineRow, { borderBottomColor: C.divider, height: "auto", paddingVertical: 8 }]}>
                        {/* Timestamp */}
                        <View style={{ flex: 1.2 }}>
                          <Text style={[styles.lineTdCell, { color: C.textPrimary, fontSize: 10.5 }]}>
                            {formatPaymentTimestamp(p.payment_date)}
                          </Text>
                        </View>

                        {/* Method with IN indicator */}
                        <View style={{ flex: 1.4, flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <View style={{ backgroundColor: "#DCFCE7", paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3 }}>
                            <Text style={{ color: "#16A34A", fontSize: 9, fontWeight: "700" }}>IN</Text>
                          </View>
                          <Text style={[styles.lineTdCell, { color: C.textPrimary, fontSize: 11 }]}>
                            {p.payment_method}
                          </Text>
                        </View>

                        {/* Reference / Cheque details */}
                        <View style={{ flex: 2.0 }}>
                          <Text style={[styles.lineTdCell, { color: C.textSecondary, fontSize: 11 }]} numberOfLines={2}>
                            {p.payment_method === "CASH" ? "Cash In Hand" : (p.bank_account || "—")}
                            {"\n"}
                            <Text style={{ fontSize: 10, color: C.textPrimary, fontWeight: "600" }}>
                              {p.payment_method === "CHEQUE"
                                ? `Cheque No: ${p.reference_number || "—"}`
                                : `Ref: ${p.reference_number || "—"}`}
                            </Text>
                            {p.notes ? `\nNote: ${p.notes}` : ""}
                          </Text>
                        </View>

                        {/* Amount & TDS */}
                        <View style={{ flex: 1.2, alignItems: "flex-end", justifyContent: "center" }}>
                          <Text style={[styles.lineTdCell, { color: "#10B981", fontWeight: "700", textAlign: "right" }]}>
                            + ₹{Number(p.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </Text>
                          {Number((p as any).tds_amount) > 0 && (
                            <Text style={{ fontSize: 9.5, color: "#EF4444", fontWeight: "700", marginTop: 1, textAlign: "right" }}>
                              + ₹{Number((p as any).tds_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })} TDS
                            </Text>
                          )}
                        </View>

                        {/* Delete action */}
                        <View style={{ flex: 0.4, alignItems: "center", justifyContent: "center" }}>
                          <Pressable
                            onPress={() =>
                              Alert.alert("Delete Payment", `Revert and delete this payment of ₹${Number(p.amount).toFixed(2)} ${Number((p as any).tds_amount) > 0 ? `(with TDS: ₹${Number((p as any).tds_amount).toFixed(2)})` : ""}?`, [
                                { text: "Cancel" },
                                { text: "Delete", style: "destructive", onPress: () => deletePaymentMutation.mutate(p.id) }
                              ])
                            }
                            style={({ hovered }: any) => [
                              { width: 24, height: 24, borderRadius: 4, alignItems: "center", justifyContent: "center" },
                              hovered && { backgroundColor: "rgba(239, 68, 68, 0.08)" }
                            ]}
                          >
                            <Text style={{ fontFamily: "Segoe MDL2 Assets", color: "#EF4444", fontSize: 11 }}>{"\uE74D"}</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      )}



      {/* FULLSCREEN CREATE INVOICE WORKSPACE */}
      <FullScreenModal
        isOpen={isCreatingInvoice}
        onClose={() => { setIsCreatingInvoice(false); setEditingInvoiceId(null); setForm(blankForm()); setLines([blankLine()]); setFormStep(1); }}
        title={editingInvoiceId ? "Modify Sales Invoice" : "Generate Sales Invoice"}
        subtitle={editingInvoiceId ? "Edit invoice details, items, and recalculate totals" : "Revenue & Receivables Control Center"}
        breadcrumb={editingInvoiceId ? "sales / invoices / modify" : "sales / invoices"}
        footerActions={
          <View style={{ flexDirection: "row", gap: 10, flex: 1, justifyContent: "space-between", alignItems: "center" }}>
            {/* Left side: Detailed calculations */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View>
                <Text style={{ fontSize: 12, fontWeight: "700", fontFamily: "Segoe UI Variable Text", color: C.textSecondary, letterSpacing: 0.5 }}>TAXABLE BASE</Text>
                <Text style={{ fontSize: 16.5, fontWeight: "800", fontFamily: "Segoe UI Variable Display", color: C.textPrimary }}>
                  ₹{totals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{ width: 1, height: 26, backgroundColor: C.border }} />
              <View>
                <Text style={{ fontSize: 12, fontWeight: "700", fontFamily: "Segoe UI Variable Text", color: C.textSecondary, letterSpacing: 0.5 }}>CGST (+)</Text>
                <Text style={{ fontSize: 16.5, fontWeight: "800", fontFamily: "Segoe UI Variable Display", color: C.textPrimary }}>
                  ₹{totals.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{ width: 1, height: 26, backgroundColor: C.border }} />
              <View>
                <Text style={{ fontSize: 12, fontWeight: "700", fontFamily: "Segoe UI Variable Text", color: C.textSecondary, letterSpacing: 0.5 }}>SGST (+)</Text>
                <Text style={{ fontSize: 16.5, fontWeight: "800", fontFamily: "Segoe UI Variable Display", color: C.textPrimary }}>
                  ₹{totals.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{ width: 1, height: 26, backgroundColor: C.border }} />
              <View>
                <Text style={{ fontSize: 12, fontWeight: "700", fontFamily: "Segoe UI Variable Text", color: C.accent, letterSpacing: 0.5 }}>NET AMOUNT</Text>
                <Text style={{ fontSize: 19.5, fontWeight: "900", fontFamily: "Segoe UI Variable Display", color: C.accent }}>
                  ₹{totals.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            {/* Right side: Navigation actions */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {/* Step indicator */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginRight: 20 }}>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  <View style={{ width: 24, height: 4, borderRadius: 2, backgroundColor: C.accent }} />
                  <View style={{ width: 24, height: 4, borderRadius: 2, backgroundColor: formStep >= 2 ? C.accent : (isDarkMode ? "#3D3D3D" : "#E5E7EB") }} />
                </View>
                <Text style={{ fontSize: 13.5, fontWeight: "700", fontFamily: "Segoe UI Variable Text", color: C.textSecondary, letterSpacing: 0.5 }}>
                  STEP {formStep} OF 2
                </Text>
              </View>

              {formStep === 1 ? (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Button
                    title={editingInvoiceId ? "Cancel Edit" : "Discard Invoice"}
                    onPress={() => { setIsCreatingInvoice(false); setEditingInvoiceId(null); setForm(blankForm()); setLines([blankLine()]); setFormStep(1); }}
                    variant="secondary"
                    size="large"
                    style={{ minWidth: 140 }}
                  />

                  <Button
                    title="Proceed to Add Items ›"
                    onPress={() => {
                      if (!form.customer_id) {
                        Alert.alert("Validation", "Please select a customer before proceeding.");
                        return;
                      }
                      setFormStep(2);
                    }}
                    variant="primary"
                    size="large"
                    style={{ minWidth: 200 }}
                  />
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Button
                    title="‹ Go Back"
                    onPress={() => setFormStep(1)}
                    variant="secondary"
                    size="large"
                    style={{ minWidth: 120 }}
                  />

                  <Button
                    title={editingInvoiceId ? "Update Invoice" : "Save Invoice"}
                    onPress={handleSave}
                    variant="primary"
                    size="large"
                    loading={editingInvoiceId ? updateMutation.isPending : createMutation.isPending}
                    style={{ minWidth: 145 }}
                  />
                </View>
              )}
            </View>
          </View>
        }
      >
        <View style={{ paddingBottom: 10 }}>


          {formStep === 1 ? (
            <View>

              {/* TWO-COLUMN LAYOUT: Left = Form Fields | Right = Context Panel */}
              <View style={{ flexDirection: "row", gap: 20, flex: 1 }}>

                {/* ── LEFT COLUMN: Input Fields ── */}
                <View style={{ flex: 1.4, gap: 14 }}>

                  {/* Info row: DOCUMENT NO / A-C BALANCE / BILL NO / BILL DATE */}
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="DOCUMENT NO."
                        value={editingInvoiceId ? form.invoice_number : "Auto-Sequence"}
                        editable={false}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        ref={invoiceBillNoRef}
                        label="BILL NO."
                        value={form.invoice_number}
                        onChangeText={v => setForm(f => ({ ...f, invoice_number: v }))}
                        editable={true}
                        onSubmitEditing={() => invoiceDateRef.current?.focus()}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <DatePicker
                        label="BILL DATE *"
                        value={form.invoice_date}
                        onChange={v => setForm(f => ({ ...f, invoice_date: v }))}
                      />
                    </View>
                  </View>

                  {/* A/C Balance banner */}
                  <View style={{ backgroundColor: isDarkMode ? "#1A2536" : "#EFF6FF", borderWidth: 1, borderColor: isDarkMode ? "#1E3A5F" : "#BFDBFE", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: C.textSecondary, letterSpacing: 0.5 }}>CURRENT A/C BALANCE</Text>
                      <Text style={{ fontSize: 24, fontWeight: "900", fontFamily: "Segoe UI Variable Display", color: C.accent }}>₹0.00 CR</Text>
                    </View>
                    <View style={{ backgroundColor: isDarkMode ? "rgba(56,189,248,0.1)" : "rgba(2,132,199,0.08)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: "700", color: C.accent }}>CREDIT STANDING</Text>
                    </View>
                  </View>

                  {/* Customer select */}
                  <View style={{ zIndex: 100 }}>
                    <Text style={[styles.inputLabel, { color: C.textSecondary }]}>ACCOUNT NAME / CUSTOMER ENTITY *</Text>
                    <Dropdown
                      ref={invoiceCustomerRef}
                      options={customers.map(c => ({ value: c.id, label: c.name, sublabel: c.gst_number || c.phone }))}
                      value={form.customer_id}
                      onChange={(val) => {
                        setForm(f => ({ ...f, customer_id: val || "" }));
                      }}
                      placeholder="Search and select registered customer..."
                      autoFocus={true}
                      onSubmitEditing={() => {
                        // form.customer_id may be stale here — read from the Dropdown's own value instead
                        setForm(f => {
                          if (f.customer_id) setFormStep(2);
                          return f;
                        });
                      }}
                    />
                  </View>

                  {/* Billing Address Card */}
                  {form.customer_id ? (
                    (() => {
                      const sel = customers.find(c => c.id === form.customer_id);
                      if (!sel) return null;
                      return (
                        <View style={{ borderWidth: 4, borderColor: C.border, borderRadius: 10, padding: 16, backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF" }}>
                          <Text style={{ fontSize: 12, fontWeight: "700", fontFamily: "Segoe UI Variable Text", color: C.textSecondary, letterSpacing: 0.8, marginBottom: 8 }}>BILLING ADDRESS</Text>
                          <Text style={{ fontSize: 20, fontFamily: "Segoe UI Variable Display", color: C.textPrimary, fontWeight: "700" }}>{sel.name}</Text>
                          <View style={{ height: 1, backgroundColor: C.border, marginVertical: 8 }} />
                          <View style={{ gap: 3 }}>
                            <Text style={{ fontSize: 14, fontFamily: "Segoe UI Variable Text", color: C.textSecondary }}>
                              <Text style={{ fontWeight: "600", color: C.textPrimary }}>GSTIN: </Text>{sel.gst_number || "N/A"}
                            </Text>
                            <Text style={{ fontSize: 14, fontFamily: "Segoe UI Variable Text", color: C.textSecondary }}>
                              <Text style={{ fontWeight: "600", color: C.textPrimary }}>Phone: </Text>{sel.phone || "N/A"}
                            </Text>
                            <Text style={{ fontSize: 14, fontFamily: "Segoe UI Variable Text", color: C.textSecondary }}>
                              <Text style={{ fontWeight: "600", color: C.textPrimary }}>Location: </Text>{[sel.city, sel.state].filter(Boolean).join(", ") || "No address on record."}
                            </Text>
                          </View>
                        </View>
                      );
                    })()
                  ) : (
                    <View style={{ borderWidth: 1, borderColor: C.border, borderStyle: "dashed", borderRadius: 8, padding: 24, backgroundColor: isDarkMode ? "#1E293B" : "#F8FAFC", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Text style={{ fontFamily: "Segoe MDL2 Assets", fontSize: 26, color: C.textSecondary }}>{"\uE77B"}</Text>
                      <Text style={{ fontSize: 16, fontFamily: "Segoe UI Variable Text", color: C.textSecondary, textAlign: "center" }}>Select a customer above to load billing details</Text>
                    </View>
                  )}
                </View>

                {/* ── RIGHT COLUMN: GST Info Strip ── */}
                <View style={{ flex: 1, gap: 14 }}>
                  {/* GST flat strip — no card, just inline rows */}
                  <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 8, backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF", padding: 16, gap: 12 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: C.accent, letterSpacing: 0.8, marginBottom: 2 }}>GST APPLIED (FROM BUSINESS SETTINGS)</Text>
                    <View style={{ flexDirection: "row", gap: 0 }}>
                      {/* Total GST */}
                      <View style={{ flex: 1, paddingRight: 16, borderRightWidth: 1, borderRightColor: C.border }}>
                        <Text style={{ fontSize: 14, color: C.textSecondary, marginBottom: 3 }}>TOTAL GST RATE</Text>
                        <Text style={{ fontSize: 30, fontWeight: "900", fontFamily: "Segoe UI Variable Display", color: C.accent }}>{defaultTaxRate}%</Text>
                      </View>
                      {/* CGST */}
                      <View style={{ flex: 1, paddingHorizontal: 16, borderRightWidth: 1, borderRightColor: C.border }}>
                        <Text style={{ fontSize: 14, color: C.textSecondary, marginBottom: 3 }}>CGST</Text>
                        <Text style={{ fontSize: 26, fontWeight: "800", fontFamily: "Segoe UI Variable Display", color: C.textPrimary }}>{(defaultTaxRate / 2).toFixed(1)}%</Text>
                      </View>
                      {/* SGST */}
                      <View style={{ flex: 1, paddingLeft: 16 }}>
                        <Text style={{ fontSize: 14, color: C.textSecondary, marginBottom: 3 }}>SGST</Text>
                        <Text style={{ fontSize: 26, fontWeight: "800", fontFamily: "Segoe UI Variable Display", color: C.textPrimary }}>{(defaultTaxRate / 2).toFixed(1)}%</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 14, color: C.textSecondary }}>Auto-applied · Change in Settings → Advanced Config</Text>
                  </View>
                </View>
              </View>
            </View>

          ) : (
            <View>
              {/* Header Step description */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                <View style={{ width: 4, height: 28, backgroundColor: C.accent, marginRight: 10, borderRadius: 2 }} />
                <View>
                  <Text style={{ fontSize: 23, fontWeight: "700", fontFamily: "Segoe UI Variable Text", color: C.textSecondary, letterSpacing: 1 }}>SECTION 02 — ADD ITEMS TO INVOICE</Text>
                  <Text style={{ fontSize: 17, fontWeight: "500", fontFamily: "Segoe UI Variable Text", color: C.textSecondary }}>
                    SPECIFY PRODUCT QUANTITIES, RATES, AND DETAILS FOR EACH ITEM. (Loaded: {products.length} items{productsQuery.error ? `, Error: ${(productsQuery.error as any).message}` : ""})
                  </Text>
                </View>
              </View>

              {/* Line table header */}
              <View style={[styles.lineHead, { backgroundColor: C.tableHead, borderColor: C.border, borderWidth: 1, borderRadius: 6, marginBottom: 6, paddingHorizontal: 20, gap: 20 }]}>
                <Text style={[styles.lineThCell, { flex: 0.5, color: C.textSecondary, textAlign: "center" }]}>#</Text>
                <Text style={[styles.lineThCell, { flex: 3.5, color: C.textSecondary }]}>ITEM NAME / DETAILS</Text>
                <Text style={[styles.lineThCell, { flex: 0.8, color: C.textSecondary, textAlign: "right" }]}>QTY</Text>
                <Text style={[styles.lineThCell, { flex: 1.5, color: C.textSecondary, textAlign: "right" }]}>P.CHALLAN NO.</Text>
                <Text style={[styles.lineThCell, { flex: 1.2, color: C.textSecondary, textAlign: "right" }]}>RATE (₹)</Text>
                <Text style={[styles.lineThCell, { flex: 2, color: C.textSecondary, textAlign: "right" }]}>ITEM NOTE</Text>
                <View style={{ width: 32 }} />
              </View>

              {lines.map((line, idx) => (
                <View key={idx} style={[styles.lineInputRow, { borderColor: C.border, marginBottom: 6, zIndex: lines.length - idx, alignItems: "center", overflow: "visible", paddingHorizontal: 12, gap: 12 }]}>
                  {/* Serial */}
                  <Text style={{ flex: 0.5, textAlign: "center", fontSize: 17, color: C.textSecondary, fontWeight: "700" }}>
                    {String(idx + 1).padStart(2, "0")}
                  </Text>

                  {/* Product */}
                  <View style={{ flex: 3.5, zIndex: 100, overflow: "visible" }}>
                    <Dropdown
                      ref={(el: DropdownRef | null) => { productRefs.current[idx] = el; }}
                      options={products.map(p => ({
                        value: p.id,
                        label: p.name,
                        sublabel: company?.settings?.enable_barcodes && p.barcode ? `${p.sku || ""} [Barcode: ${p.barcode}]` : p.sku
                      }))}
                      value={line.product_id}
                      onChange={(val) => {
                        if (!val) {
                          updateLine(idx, "product_id", "");
                          return;
                        }
                        const prod = products.find(p => p.id === val);
                        if (!prod) return;

                        // Check if this product was already invoiced to this customer
                        const matchedInvs = invoices.filter(inv =>
                          inv.customer_id === form.customer_id &&
                          inv.items?.some((item: any) => item.product_id === val)
                        ).map(inv => inv.invoice_number);

                        if (matchedInvs.length > 0) {
                          Keyboard.dismiss();
                          setTimeout(() => {
                            Alert.alert(
                              "⚠️ Already Invoiced",
                              `"${prod.name}" was already billed to this customer in:\n\n${matchedInvs.map(n => `• Invoice #${n}`).join("\n")}\n\nDo you still want to add it?`,
                              [
                                {
                                  text: "Cancel",
                                  style: "cancel",
                                  onPress: () => updateLine(idx, "product_id", "")
                                },
                                {
                                  text: "Add Anyway",
                                  style: "default",
                                  onPress: () => {
                                    updateLine(idx, "product_id", val);
                                    updateLine(idx, "unit_price", prod.sale_price);
                                    setTimeout(() => {
                                      qtyRefs.current[idx]?.focus();
                                    }, 150);
                                  }
                                }
                              ]
                            );
                          }, 150);
                        } else {
                          updateLine(idx, "product_id", val);
                          updateLine(idx, "unit_price", prod.sale_price);
                          setTimeout(() => {
                            qtyRefs.current[idx]?.focus();
                          }, 150);
                        }
                      }}
                      placeholder="Select Product..."
                      onAddNew={(searchQuery) => {
                        setQuickAddLineIndex(idx);
                        setQuickAddProductName(searchQuery);
                        setQuickAddProductRate("");
                        setIsQuickAddProductModalOpen(true);
                      }}
                      addNewLabel="Quick Add Product"
                      onSubmitEditing={() => {
                        qtyRefs.current[idx]?.focus();
                      }}
                    />
                  </View>

                  {/* Qty */}
                  <Input
                    ref={el => { qtyRefs.current[idx] = el; }}
                    value={line.quantity ? String(line.quantity) : ""}
                    onChangeText={v => updateLine(idx, "quantity", parseFloat(v) || 0)}
                    keyboardType="numeric"
                    placeholder="0"
                    style={{ fontSize: 17, textAlign: "right" }}
                    containerStyle={{ flex: 0.8 }}
                    onSubmitEditing={() => challanRefs.current[idx]?.focus()}
                  />

                  {/* P. Challan */}
                  <Input
                    ref={el => { challanRefs.current[idx] = el; }}
                    value={line.p_challan_no || ""}
                    onChangeText={v => updateLine(idx, "p_challan_no", v)}
                    placeholder="Challan..."
                    style={{ fontSize: 17, textAlign: "right" }}
                    containerStyle={{ flex: 1.5 }}
                    onSubmitEditing={() => noteRefs.current[idx]?.focus()}
                  />

                  {/* Rate */}
                  <Input
                    ref={el => { rateRefs.current[idx] = el; }}
                    value={String(line.unit_price || "")}
                    onChangeText={v => updateLine(idx, "unit_price", parseFloat(v) || 0)}
                    keyboardType="numeric"
                    placeholder="0.00"
                    style={{ fontSize: 17, textAlign: "right" }}
                    containerStyle={{ flex: 1.2 }}
                    tabIndex={-1}
                    onSubmitEditing={() => noteRefs.current[idx]?.focus()}
                    onBlur={() => {
                      const prod = products.find(p => p.id === line.product_id);
                      if (prod && Number(line.unit_price) !== Number(prod.sale_price)) {
                        Alert.alert(
                          "Rate Changed Warning",
                          `The selling rate for product "${prod.name}" has been modified from ₹${Number(prod.sale_price).toFixed(2)} to ₹${Number(line.unit_price).toFixed(2)}. How would you like to apply this rate change?`,
                          [
                            {
                              text: "Update Registry Rate", onPress: () => {
                                updateProductPriceMutation.mutate({ id: prod.id, sale_price: Number(line.unit_price) });
                              }
                            },
                            {
                              text: "Create New Product Profile", onPress: () => {
                                duplicateProductMutation.mutate({ id: prod.id, sale_price: Number(line.unit_price) });
                              }
                            },
                            { text: "Apply to Invoice Only", style: "cancel" }
                          ]
                        );
                      }
                    }}
                  />

                  {/* Item Note */}
                  <Input
                    ref={el => { noteRefs.current[idx] = el; }}
                    value={line.note || ""}
                    onChangeText={v => updateLine(idx, "note", v)}
                    placeholder="Add note..."
                    style={{ fontSize: 17, textAlign: "right" }}
                    containerStyle={{ flex: 2 }}
                    onSubmitEditing={() => {
                      if (idx === lines.length - 1) {
                        addLine();
                        setTimeout(() => {
                          productRefs.current[idx + 1]?.open();
                        }, 80);
                      } else {
                        productRefs.current[idx + 1]?.open();
                      }
                    }}
                  />

                  {/* Delete line */}
                  <Pressable onPress={() => removeLine(idx)} style={{ width: 50, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: "Segoe MDL2 Assets", color: "#EF4444", fontSize: 13 }}>{"\uE74D"}</Text>
                  </Pressable>
                </View>
              ))}

              {/* Add line */}
              <View style={{ alignItems: "center", marginTop: 8 }}>
                <Pressable
                  onPress={addLine}
                  style={[styles.addLineBtn, { borderColor: C.accent, paddingHorizontal: 24, height: 34 }]}
                >
                  <Text style={[styles.addLineBtnText, { color: C.accent }]}>+ ADD ITEM</Text>
                </Pressable>
              </View>

              {/* Two Panel Columns: Optional Details & Summary */}
              <View style={{ flexDirection: "row", gap: 24, marginTop: 24 }}>
                {/* Left Card: Optional Details */}
                <View style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 16, backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF" }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", fontFamily: "Segoe UI Variable Text", color: C.accent, letterSpacing: 0.5 }}>LOGISTICS & ADDITIONAL DETAILS (OPTIONAL)</Text>
                    <Pressable
                      onPress={() => setShowOptionalFields(!showOptionalFields)}
                      style={({ hovered }: any) => [
                        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: C.accent },
                        hovered && { backgroundColor: isDarkMode ? "rgba(56, 189, 248, 0.12)" : "rgba(2, 132, 199, 0.08)" }
                      ]}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "700", color: C.accent }}>
                        {showOptionalFields ? "HIDE" : "SHOW"}
                      </Text>
                    </Pressable>
                  </View>

                  {showOptionalFields && (
                    <View style={{ gap: 12 }}>
                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Input
                            label="BROKER NAME"
                            value={form.broker_name}
                            onChangeText={v => setForm(f => ({ ...f, broker_name: v }))}
                            placeholder="Search brokers..."
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Input
                            label="SHIPPING NAME"
                            value={form.shipping_name}
                            onChangeText={v => setForm(f => ({ ...f, shipping_name: v }))}
                            placeholder="Consignee identification..."
                          />
                        </View>
                      </View>

                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Input
                            label="REMARKS / NOTES 1"
                            value={form.notes}
                            onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                            placeholder="Operational notes..."
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Input
                            label="REMARKS / NOTES 2"
                            value={form.notes_2}
                            onChangeText={v => setForm(f => ({ ...f, notes_2: v }))}
                            placeholder="Additional details..."
                          />
                        </View>
                      </View>

                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Input
                            label="POST ADD 1"
                            value={form.post_add_1}
                            onChangeText={v => setForm(f => ({ ...f, post_add_1: v }))}
                            placeholder="Post additions..."
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Input
                            label="POST DEDUCT 1"
                            value={form.post_deduct_1}
                            onChangeText={v => setForm(f => ({ ...f, post_deduct_1: v }))}
                            placeholder="Post deductions..."
                          />
                        </View>
                      </View>

                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Input
                            label="POST ADD 2"
                            value={form.post_add_2}
                            onChangeText={v => setForm(f => ({ ...f, post_add_2: v }))}
                            placeholder="Post additions..."
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Input
                            label="POST DEDUCT 2"
                            value={form.post_deduct_2}
                            onChangeText={v => setForm(f => ({ ...f, post_deduct_2: v }))}
                            placeholder="Post deductions..."
                          />
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>
      </FullScreenModal>


      {/* RECEIVE PAYMENT MODAL */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => { setIsPaymentModalOpen(false); setPaymentInvoice(null); }}
        title="Receive Invoice Payment"
        width={650}
        footerActions={
          <View style={{ flexDirection: "row", gap: 10, flex: 1 }}>
            <Button
              title="Cancel"
              onPress={() => { setIsPaymentModalOpen(false); setPaymentInvoice(null); }}
              variant="secondary"
              style={{ minWidth: 110 }}
            />
            <Button
              title="Record Receipt"
              onPress={() => {
                const amt = parseFloat(paymentForm.amount) || 0;
                const out = Number(paymentInvoice?.balance_due || 0);
                const tds = paymentForm.apply_remaining_as_tds ? Math.max(0, out - amt) : 0;
                if (amt < 0) {
                  Alert.alert("Validation", "Amount cannot be negative.");
                  return;
                }
                const totalDeducted = amt + tds;
                if (totalDeducted <= 0) {
                  Alert.alert("Validation", "Please enter a valid positive amount.");
                  return;
                }
                if (totalDeducted > out) {
                  Alert.alert("Validation", `Total transaction (₹${totalDeducted.toFixed(2)}) cannot exceed the remaining balance due (₹${out.toFixed(2)}).`);
                  return;
                }
                if (paymentForm.payment_method !== "CASH" && !paymentForm.bank_account) {
                  Alert.alert("Validation", "Please select a bank account.");
                  return;
                }

                const payload = {
                  amount: amt,
                  tds_amount: tds,
                  payment_date: toISODate(paymentForm.payment_date) + "T" + new Date().toTimeString().split(" ")[0],
                  payment_method: paymentForm.payment_method,
                  bank_account: paymentForm.payment_method === "CASH" ? "Cash In Hand" : paymentForm.bank_account,
                  reference_number: paymentForm.reference_number || null,
                  notes: paymentForm.notes || null,
                  reference_type: "invoice",
                  reference_id: paymentInvoice?.id
                };

                receivePaymentMutation.mutate(payload);
              }}
              variant="primary"
              loading={receivePaymentMutation.isPending}
              style={{ minWidth: 150 }}
            />
          </View>
        }
      >
        <View style={{ gap: 16, paddingBottom: 10 }}>

          {/* Visual Breakdown Card */}
          {(() => {
            const out = Number(paymentInvoice?.balance_due || 0);
            const rec = parseFloat(paymentForm.amount) || 0;
            const tds = paymentForm.apply_remaining_as_tds ? Math.max(0, out - rec) : 0;
            const netExpected = Math.max(0, out - tds);
            const remaining = Math.max(0, out - tds - rec);
            return (
              <View style={[styles.modalMathCard, { backgroundColor: isDarkMode ? "#1E293B" : "#F1F5F9", borderColor: C.border }]}>
                <View style={styles.modalMathRow}>
                  <Text style={[styles.modalMathLabel, { color: C.textSecondary }]}>Total Outstanding:</Text>
                  <Text style={[styles.modalMathValue, { color: C.textPrimary, fontWeight: "700" }]}>
                    ₹{out.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.modalMathRow}>
                  <Text style={[styles.modalMathLabel, { color: C.textSecondary }]}>TDS Deducted (-):</Text>
                  <Text style={[styles.modalMathValue, { color: "#EF4444", fontWeight: "700" }]}>
                    ₹{tds.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={[styles.modalMathRow, { borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 6, marginBottom: 6 }]}>
                  <Text style={[styles.modalMathLabel, { color: C.textSecondary }]}>Net Expected Received:</Text>
                  <Text style={[styles.modalMathValue, { color: C.accent, fontWeight: "700" }]}>
                    ₹{netExpected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.modalMathRow}>
                  <Text style={[styles.modalMathLabel, { color: C.textSecondary }]}>Net Amount Received:</Text>
                  <Text style={[styles.modalMathValue, { color: "#10B981", fontWeight: "700" }]}>
                    ₹{rec.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={[styles.modalMathRow, { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6, marginTop: 6 }]}>
                  <Text style={[styles.modalMathLabel, { color: C.textPrimary, fontWeight: "700" }]}>Remaining Balance:</Text>
                  <Text style={[styles.modalMathValue, { color: remaining <= 0 ? "#10B981" : "#F59E0B", fontWeight: "800" }]}>
                    ₹{remaining.toLocaleString("en-IN", { minimumFractionDigits: 2 })} {remaining <= 0 ? "(Settled)" : "(Pending)"}
                  </Text>
                </View>
              </View>
            );
          })()}

          {/* Amount Input */}
          <View style={styles.formGroup}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.inputLabel, { color: C.textSecondary }]}>AMOUNT RECEIVED (NET) *</Text>
              <Pressable
                onPress={() => {
                  const balance = paymentInvoice?.balance_due || 0;
                  setPaymentForm(f => ({ ...f, amount: String(balance) }));
                }}
                style={({ hovered, pressed }: any) => [
                  hovered && { opacity: 0.7 },
                  pressed && { transform: [{ scale: 0.95 }] }
                ]}
              >
                <Text style={{ fontSize: 10.5, fontWeight: "700", color: C.accent, fontFamily: "Segoe UI Variable Text", textDecorationLine: "underline" }}>PAY EXPECTED</Text>
              </Pressable>
            </View>
            <TextInput
              style={[styles.textInputUWP, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.textPrimary }]}
              value={paymentForm.amount}
              onChangeText={v => setPaymentForm(f => ({ ...f, amount: v }))}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={C.textSecondary}
            />
          </View>

          {/* Auto TDS Toggle Checkbox */}
          {(() => {
            const out = Number(paymentInvoice?.balance_due || 0);
            const rec = parseFloat(paymentForm.amount) || 0;
            const remaining = Math.max(0, out - rec);
            if (remaining > 0) {
              return (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>
                  <Pressable
                    onPress={() => setPaymentForm(f => ({ ...f, apply_remaining_as_tds: !f.apply_remaining_as_tds }))}
                    style={({ hovered }: any) => [
                      {
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        borderWidth: 1.5,
                        borderColor: paymentForm.apply_remaining_as_tds ? C.accent : C.border,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: paymentForm.apply_remaining_as_tds ? C.accent : "transparent"
                      },
                      hovered && { opacity: 0.8 }
                    ]}
                  >
                    {paymentForm.apply_remaining_as_tds && (
                      <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "900", fontFamily: "Segoe MDL2 Assets" }}>{"\uE73E"}</Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => setPaymentForm(f => ({ ...f, apply_remaining_as_tds: !f.apply_remaining_as_tds }))}
                    style={({ hovered }: any) => [
                      hovered && { opacity: 0.8 }
                    ]}
                  >
                    <Text style={{ fontSize: 13, color: C.textPrimary, fontFamily: "Segoe UI Variable Text" }}>
                      Settle invoice (Apply remaining balance of ₹{remaining.toFixed(2)} as TDS deduction)
                    </Text>
                  </Pressable>
                </View>
              );
            }
            return null;
          })()}

          {/* Date Input */}
          <View style={styles.formGroup}>
            <DatePicker
              label="RECEIPT DATE *"
              value={paymentForm.payment_date}
              onChange={v => setPaymentForm(f => ({ ...f, payment_date: v }))}
            />
          </View>

          {/* Payment Method Pills */}
          <View style={styles.formGroup}>
            <Text style={[styles.inputLabel, { color: C.textSecondary }]}>PAYMENT METHOD</Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {["BANK_TRANSFER", "UPI", "CASH", "CHEQUE", "CARD"].map((m) => (
                <Pressable
                  key={m}
                  onPress={() => {
                    setPaymentForm(f => ({
                      ...f,
                      payment_method: m,
                      bank_account: m === "CASH" ? "Cash In Hand" : (f.bank_account === "Cash In Hand" ? "" : f.bank_account)
                    }));
                  }}
                  style={({ hovered }: any) => [
                    styles.methodPill,
                    { borderColor: paymentForm.payment_method === m ? C.accent : C.border },
                    paymentForm.payment_method === m && { backgroundColor: isDarkMode ? "#0C4A6E" : "#E0F2FE" },
                    hovered && { opacity: 0.8 }
                  ]}
                >
                  <Text style={[styles.methodPillText, { color: paymentForm.payment_method === m ? C.accent : C.textSecondary }]}>
                    {m.replace("_", " ")}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Bank Account Selection Dropdown */}
          {paymentForm.payment_method !== "CASH" && (
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: C.textSecondary }]}>BANK ACCOUNT *</Text>
              {bankAccounts.length === 0 ? (
                <Text style={{ fontSize: 11, color: "#DC2626", fontFamily: "Segoe UI Variable Text" }}>No active bank accounts found. Create one in Banking first.</Text>
              ) : (
                <View style={[styles.picker, { backgroundColor: C.inputBg, borderColor: C.inputBorder }]}>
                  <ScrollView style={{ maxHeight: 110 }} nestedScrollEnabled={true}>
                    {bankAccounts.map((acc) => (
                      <Pressable
                        key={acc.id}
                        onPress={() => setPaymentForm(f => ({ ...f, bank_account: acc.name }))}
                        style={({ hovered }: any) => [
                          styles.pickerOption,
                          { borderBottomColor: C.divider },
                          hovered && { backgroundColor: C.rowHover },
                          paymentForm.bank_account === acc.name && { backgroundColor: C.rowActive }
                        ]}
                      >
                        <Text style={[styles.pickerOptionText, { color: C.textPrimary, fontWeight: paymentForm.bank_account === acc.name ? "600" : "400" }]}>
                          {acc.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* Reference Number */}
          <View style={styles.formGroup}>
            <Text style={[styles.inputLabel, { color: C.textSecondary }]}>REFERENCE NUMBER (UTR / CHEQUE / TXN ID)</Text>
            <TextInput
              style={[styles.textInputUWP, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.textPrimary }]}
              value={paymentForm.reference_number}
              onChangeText={v => setPaymentForm(f => ({ ...f, reference_number: v }))}
              placeholder="e.g. UTR1293848"
              placeholderTextColor={C.textSecondary}
            />
          </View>

          {/* Notes */}
          <View style={styles.formGroup}>
            <Text style={[styles.inputLabel, { color: C.textSecondary }]}>NOTES / REMARKS</Text>
            <TextInput
              style={[styles.textInputUWP, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.textPrimary }]}
              value={paymentForm.notes}
              onChangeText={v => setPaymentForm(f => ({ ...f, notes: v }))}
              placeholder="Remarks..."
              placeholderTextColor={C.textSecondary}
            />
          </View>
        </View>
      </Modal>

      <PdfPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewInv(null);
        }}
        title={`Tax Invoice — ${previewInv?.invoice_number || ""}`}
        subtitle="Review, configure layout options, and print the document"
        breadcrumb="SALES / INVOICES / PREVIEW"
        reportKey={`invoice_${previewInv?.id}`}
        getPdfUrl={(orientation, search, theme, copyType) =>
          `${apiClient.defaults.baseURL}/api/v1/sales/invoices/public/${previewInv?.id}/pdf?theme=${theme}&copy_type=${copyType}&orientation=${orientation}&search=${encodeURIComponent(search)}`
        }
        showThemeSelector={true}
        showCopySelector={true}
      />

      {/* QUICK ADD PRODUCT DIALOG */}
      <FullScreenModal
        isOpen={isQuickAddProductModalOpen}
        onClose={() => {
          setIsQuickAddProductModalOpen(false);
          if (quickAddLineIndex !== null) {
            const activeIdx = quickAddLineIndex;
            setTimeout(() => {
              noteRefs.current[activeIdx]?.focus();
            }, 120);
            setTimeout(() => {
              setDisabledLineIndex(null);
            }, 600);
          }
        }}
        title="Quick Add Product"
        subtitle="Register a new product in your inventory database"
        breadcrumb="sales / invoices"
        footerActions={
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
            <Button
              title="Cancel"
              onPress={() => {
                setIsQuickAddProductModalOpen(false);
                if (quickAddLineIndex !== null) {
                  const activeIdx = quickAddLineIndex;
                  setTimeout(() => {
                    noteRefs.current[activeIdx]?.focus();
                  }, 120);
                  setTimeout(() => {
                    setDisabledLineIndex(null);
                  }, 600);
                }
              }}
              variant="secondary"
              size="large"
            />
            <Button
              title="Save Product"
              onPress={handleQuickAddSave}
              variant="primary"
              size="large"
            />
          </View>
        }
      >
        <View style={{
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: 8,
          backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF",
          padding: 24,
          gap: 20,
          maxWidth: 600,
          width: "100%",
          alignSelf: "center",
          marginTop: 24
        }}>
          <Text style={{ fontSize: 13, fontWeight: "700", fontFamily: "Segoe UI Variable Text", color: C.accent, letterSpacing: 0.8 }}>
            BASIC PRODUCT DETAIL
          </Text>

          <Input
            label="PRODUCT NAME"
            value={quickAddProductName}
            onChangeText={setQuickAddProductName}
            placeholder="e.g. sk-1212"
            onSubmitEditing={() => quickAddRateRef.current?.focus()}
          />

          <Input
            ref={quickAddRateRef}
            label="RATE (SALE PRICE) *"
            value={quickAddProductRate}
            onChangeText={setQuickAddProductRate}
            placeholder="0.00"
            keyboardType="numeric"
            onSubmitEditing={handleQuickAddSave}
          />
        </View>
      </FullScreenModal>


      {/* QUICK ADD DUPLICATE PRODUCT WARNING MODAL */}
      {quickAddDuplicateWarningOpen && (
        <Modal
          isOpen={quickAddDuplicateWarningOpen}
          onClose={() => {
            setQuickAddDuplicateWarningOpen(false);
            setQuickAddDuplicatePayload(null);
          }}
          title="Duplicate Product Name Warning"
          width={480}
        >
          <View style={{ padding: 16, gap: 16 }}>
            <Text style={{ fontSize: 15, color: C.textPrimary, lineHeight: 22 }}>
              A product with the name <Text style={{ fontWeight: "700" }}>"{quickAddProductName}"</Text> already exists in your inventory registry.
            </Text>
            <Text style={{ fontSize: 13.5, color: C.textSecondary }}>
              Are you sure you want to register a duplicate product with this name?
            </Text>

            <View style={{ flexDirection: "row", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
              <Button
                title="Save Product Anyway"
                variant="primary"
                autoFocus={true}
                onPress={() => {
                  handleQuickAddSave();
                }}
              />
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  setQuickAddDuplicateWarningOpen(false);
                  setQuickAddDuplicatePayload(null);
                }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ─── Small helper components ───────────────────────────────────
function SummaryCard({ label, value, color, bg, border, accent }: any) {
  return (
    <View style={[summaryCardStyle.card, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[summaryCardStyle.label, { color: "#64748B" }]}>{label}</Text>
      <Text style={[summaryCardStyle.value, { color }]}>{value}</Text>
    </View>
  );
}
const summaryCardStyle = StyleSheet.create({
  card: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, gap: 2 },
  label: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, fontFamily: "Segoe UI Variable Text" },
  value: { fontSize: 16.5, fontWeight: "700", fontFamily: "Segoe UI Variable Display" },
});

function DetailRow({ label, value, color, labelColor }: any) {
  return (
    <View style={detailRowStyle.row}>
      <Text style={[detailRowStyle.label, { color: labelColor }]}>{label}</Text>
      <Text style={[detailRowStyle.value, { color }]}>{value}</Text>
    </View>
  );
}
const detailRowStyle = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  label: { fontSize: 14.5, fontFamily: "Segoe UI Variable Text", flex: 1 },
  value: { fontSize: 14.5, fontWeight: "600", fontFamily: "Segoe UI Variable Text", flex: 1, textAlign: "right" },
});

// ─── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },

  // Left panel
  listPanel: {
    flex: 1,
    padding: 24,
    gap: 20,
  },
  listPanelSplit: {
    flex: 0.65,
    borderRightWidth: 1,
  },
  header: {
    gap: 4,
  },
  breadcrumb: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    fontFamily: "Segoe UI Variable Text",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Display",
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Segoe UI Variable Text",
  },
  newBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    elevation: 2,
  },
  newBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  pillRow: {
    flexGrow: 0,
    height: 32,
  },
  pill: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  pillText: { fontSize: 13, fontWeight: "600", fontFamily: "Segoe UI Variable Text" },
  tableHead: {
    flexDirection: "row",
    height: 36,
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  thCell: { fontSize: 12.5, fontWeight: "700", fontFamily: "Segoe UI Variable Text", letterSpacing: 0.3 },
  tableRow: {
    flexDirection: "row",
    height: 48,
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    position: "relative",
  },
  activeBar: { position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },
  tdCell: { fontSize: 14.5, fontFamily: "Segoe UI Variable Text" },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  statusBadgeText: { fontSize: 12, fontWeight: "700", fontFamily: "Segoe UI Variable Text" },
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10, paddingTop: 48 },
  loaderText: { fontSize: 15, fontFamily: "Segoe UI Variable Text" },
  emptyWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8, paddingTop: 64 },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontSize: 17, fontWeight: "700", fontFamily: "Segoe UI Variable Display" },
  emptyHint: { fontSize: 14, fontFamily: "Segoe UI Variable Text", textAlign: "center", maxWidth: 260 },

  // Right panel
  detailPanel: { flex: 0.55, borderLeftWidth: 1 },
  detailScroll: { paddingBottom: 40 },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  detailTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Segoe UI Variable Display" },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  iconBtnText: { fontSize: 15 },
  viewContent: { padding: 16, gap: 12 },
  summaryRow: { flexDirection: "row", gap: 8 },
  metaCard: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
    fontFamily: "Segoe UI Variable Text",
    marginBottom: 4,
  },
  lineTable: { borderWidth: 1, borderRadius: 8, overflow: "hidden" },
  lineHead: {
    flexDirection: "row",
    height: 42,
    alignItems: "center",
    paddingHorizontal: 10,
    borderBottomWidth: 1,
  },
  lineThCell: { fontSize: 15.5, fontWeight: "700", fontFamily: "Segoe UI Variable Text", letterSpacing: 0.3 },
  lineRow: {
    flexDirection: "row",
    height: 48,
    alignItems: "center",
    paddingHorizontal: 10,
    borderBottomWidth: 1,
  },
  lineTdCell: { fontSize: 17.5, fontFamily: "Segoe UI Variable Text" },

  // Create form
  createContent: { padding: 14, gap: 10 },
  formGroup: { gap: 8 },
  inputLabel: {
    fontSize: 15.5,
    fontWeight: "700",
    letterSpacing: 0.5,
    fontFamily: "Segoe UI Variable Text",
  },
  textInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 18,
    fontFamily: "Segoe UI Variable Text",
    textAlignVertical: "center",
  },
  picker: { borderWidth: 1, borderRadius: 6, overflow: "hidden" },
  pickerOption: {
    padding: 10,
    borderBottomWidth: 1,
  },
  pickerOptionText: { fontSize: 18, fontFamily: "Segoe UI Variable Text" },
  pickerOptionSub: { fontSize: 15, fontFamily: "Segoe UI Variable Text", marginTop: 1 },
  selectedCustomerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
  },
  selectedCustomerName: { fontSize: 18, fontWeight: "600", fontFamily: "Segoe UI Variable Text" },
  clearBtn: { fontSize: 17 },
  togglePill: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  togglePillText: { fontSize: 16.5, fontWeight: "600", fontFamily: "Segoe UI Variable Text" },

  // Line item inputs
  lineInputRow: {
    flexDirection: "row",
    gap: 4,
    borderBottomWidth: 1,
    padding: 5,
    marginBottom: 4,
    alignItems: "center",
  },
  lineInput: {
    height: 42,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    fontSize: 17,
    fontFamily: "Segoe UI Variable Text",
    textAlignVertical: "center",
  },
  miniPicker: {
    borderWidth: 1,
    borderRadius: 4,
    minHeight: 38,
    overflow: "hidden",
  },
  miniPickerSelected: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 6,
    height: 38,
  },
  miniPickerText: { fontSize: 16.5, fontFamily: "Segoe UI Variable Text", flex: 1 },
  miniPickerOption: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
  },
  miniPickerOptionText: { fontSize: 17, fontFamily: "Segoe UI Variable Text" },
  miniPickerOptionSub: { fontSize: 14, fontFamily: "Segoe UI Variable Text" },

  addLineBtn: {
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  addLineBtnText: { fontSize: 17.5, fontWeight: "600", fontFamily: "Segoe UI Variable Text" },

  // Totals
  totalCard: { borderWidth: 1, borderRadius: 8, padding: 10, gap: 6 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalFinalRow: { borderTopWidth: 1, paddingTop: 8, marginTop: 2 },
  totalLabel: { fontSize: 17, fontFamily: "Segoe UI Variable Text" },
  totalValue: { fontSize: 17, fontFamily: "Segoe UI Variable Text", fontWeight: "600" },
  totalFinalLabel: { fontSize: 18, fontWeight: "700", fontFamily: "Segoe UI Variable Display" },
  totalFinalValue: { fontSize: 20, fontWeight: "700", fontFamily: "Segoe UI Variable Display" },

  // Actions
  actionRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  actionBtn: {
    flex: 1,
    height: 46,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  actionBtnText: { fontSize: 18, fontFamily: "Segoe UI Variable Text" },
  textInputUWP: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 18,
    fontFamily: "Segoe UI Variable Text",
  },
  modalCancelBtn: {
    height: 42,
    minWidth: 110,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCancelBtnText: {
    fontSize: 17.5,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  modalSubmitBtn: {
    height: 42,
    minWidth: 110,
    paddingHorizontal: 16,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  modalSubmitBtnText: {
    color: "#FFFFFF",
    fontSize: 17.5,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
  },
  modalInfoBox: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
  },
  methodPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  methodPillText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  primaryActionBtn: {
    height: 36,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 4,
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
  },
  emptyHistory: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderStyle: "dashed",
  },
  emptyHistoryText: {
    fontSize: 14,
    fontFamily: "Segoe UI Variable Text",
  },
  tableReceiveBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  tableReceiveBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
  },
  modalMathCard: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    gap: 8,
  },
  modalMathRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalMathLabel: {
    fontSize: 13.5,
    fontFamily: "Segoe UI Variable Text",
  },
  modalMathValue: {
    fontSize: 14,
    fontFamily: "Segoe UI Variable Text",
  },
  summaryItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  summaryTextInput: {
    width: 100,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    fontFamily: "Segoe UI Variable Text",
    textAlign: "right",
  },
});
