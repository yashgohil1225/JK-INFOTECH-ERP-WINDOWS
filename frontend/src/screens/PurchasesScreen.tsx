// =============================================================
// JK INFOTECH ERP — Purchases Screen (Fluent Master-Detail)
// File : src/screens/PurchasesScreen.tsx
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
  Image,
  DeviceEventEmitter
} from "react-native";
import { useUIStore } from "../store/uiStore";
import { ModuleHelpModal, HelpCategory } from "../components/ui/ModuleHelpModal";
import { useAuthStore, getAccessToken } from "../store/authStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/client";
import { invalidateAllQueries } from "../utils/queryHelpers";
import { DataTable, ColumnDefinition } from "../components/ui/DataTable";
import { SearchToolbar } from "../components/ui/SearchToolbar";
import { FullScreenModal } from "../components/ui/FullScreenModal";
import { Modal } from "../components/ui/Modal";
import { PdfPreviewModal } from "../components/ui/PdfPreviewModal";
import { Dropdown } from "../components/ui/Dropdown";
import { Button } from "../components/ui/Button";
import { DatePicker } from "../components/ui/DatePicker";
import { Input } from "../components/ui/Input";
import { PrinterIcon } from "../components/ui/Icons";
import { sequencesApi } from "../api/sequences";
import { AddBankAccountModal } from "../components/ui/AddBankAccountModal";

// ─── Helpers ──────────────────────────────────────────────────
function toUIDate(isoDateStr: string): string {
  if (!isoDateStr) return "—";
  const clean = isoDateStr.split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    if (parts[2].length === 4) return clean;
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
    if (parts[0].length === 4) return uiDateStr;
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
    const timePart = parts[1].substring(0, 5);
    return `${datePart} ${timePart}`;
  }
  return datePart;
}

// ─── Types ────────────────────────────────────────────────────
interface Supplier {
  id: string;
  name: string;
  gst_number?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  address_line_1?: string;
}

interface PurchaseBillItem {
  id?: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  product_name?: string;
  note?: string;
  total?: number;
}

interface PurchaseBill {
  id: string;
  bill_number: string;
  bill_date: string;
  due_date?: string;
  status: string;
  subtotal?: number;
  tax_amount?: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  supplier_bill_no?: string;
  place_of_supply?: string;
  gst_type?: string;
  notes?: string;
  supplier?: Supplier;
  supplier_id: string;
  items: PurchaseBillItem[];
}

interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  purchase_price?: number;
  sale_price: number;
  tax_rate: number;
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

// ─── Status badge color helper ─────────────────────────────────
function statusColor(status: string) {
  switch (status?.toUpperCase()) {
    case "PAID": return { bg: "#DCFCE7", text: "#16A34A" };
    case "PARTIAL": return { bg: "#FEF9C3", text: "#A16207" };
    case "UNPAID": return { bg: "#FEE2E2", text: "#DC2626" };
    case "PENDING": return { bg: "#F1F5F9", text: "#64748B" };
    case "CANCELLED": return { bg: "#FEE2E2", text: "#9F1239" };
    default: return { bg: "#F1F5F9", text: "#64748B" };
  }
}

// ─── Blank form ────────────────────────────────────────────────
function blankForm() {
  return {
    supplier_id: "",
    bill_number: "",
    supplier_bill_no: "",
    bill_date: toUIDate(new Date().toISOString().split("T")[0]),
    due_date: "",
    place_of_supply: "",
    gst_type: "B2B",
    notes: "",
    round_off_amount: "0",
  };
}

function blankLine(): PurchaseBillItem {
  return {
    product_id: "",
    quantity: 0,
    unit_price: 0,
    tax_rate: 0,
    product_name: "",
    note: "",
  };
}

export default function PurchasesScreen() {
  const { isDarkMode, setActiveScreen, setGlobalLoading } = useUIStore();
  const { company } = useAuthStore();
  const defaultTaxRate = company?.default_gst_rate || company?.default_tax_rate || 18;
  const queryClient = useQueryClient();

  const [selectedBill, setSelectedBill] = useState<PurchaseBill | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [helpModalCategory, setHelpModalCategory] = useState<HelpCategory>("PURCHASES_GUIDE");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [formStep, setFormStep] = useState(1);
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  // PDF Preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBill, setPreviewBill] = useState<PurchaseBill | null>(null);

  // Payment Receipt Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_date: toUIDate(new Date().toISOString().split("T")[0]),
    payment_method: "BANK_TRANSFER",
    bank_account: "",
    reference_number: "",
    notes: ""
  });

  // Quick Add Supplier Modal State
  const [isQuickAddSupplierOpen, setIsQuickAddSupplierOpen] = useState(false);
  const [quickSupplierForm, setQuickSupplierForm] = useState({
    name: "",
    gst_number: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    address_line_1: ""
  });

  // Quick Add Product States
  const [isQuickAddProductModalOpen, setIsQuickAddProductModalOpen] = useState(false);
  const [quickAddProductName, setQuickAddProductName] = useState("");
  const [quickAddProductSku, setQuickAddProductSku] = useState("");
  const [quickAddProductPurchasePrice, setQuickAddProductPurchasePrice] = useState("");
  const [quickAddProductSalePrice, setQuickAddProductSalePrice] = useState("");
  const [quickAddLineIndex, setQuickAddLineIndex] = useState<number | null>(null);
  const [quickAddDuplicateWarningOpen, setQuickAddDuplicateWarningOpen] = useState(false);
  const [quickAddDuplicatePayload, setQuickAddDuplicatePayload] = useState<any>(null);
  const quickAddSkuRef = useRef<TextInput>(null);
  const quickAddRateRef = useRef<TextInput>(null);
  const quickAddSaleRateRef = useRef<TextInput>(null);

  // Form states
  const [form, setForm] = useState(blankForm());
  const [lines, setLines] = useState<PurchaseBillItem[]>([blankLine()]);

  const supplierRef = useRef<any>(null);
  const billNumberRef = useRef<any>(null);
  const supplierRefNoRef = useRef<any>(null);

  const productRefs = useRef<any>([]);
  const qtyRefs = useRef<any>([]);
  const priceRefs = useRef<any>([]);
  const taxRefs = useRef<any>([]);
  const noteRefs = useRef<any>([]);

  // Quick Supplier Form Refs
  const quickSupplierNameRef = useRef<TextInput>(null);
  const quickSupplierGstinRef = useRef<TextInput>(null);
  const quickSupplierPhoneRef = useRef<TextInput>(null);
  const quickSupplierCityRef = useRef<TextInput>(null);
  const quickSupplierStateRef = useRef<TextInput>(null);
  const quickSupplierAddressRef = useRef<TextInput>(null);

  // Auto-focus supplier dropdown on Step 1 load
  useEffect(() => {
    if (isCreating && formStep === 1) {
      setTimeout(() => {
        supplierRef.current?.open();
      }, 200);
    }
  }, [isCreating, formStep]);

  // Auto-focus first product dropdown on Step 2 load
  useEffect(() => {
    if (formStep === 2) {
      setTimeout(() => {
        productRefs.current[0]?.open();
      }, 200);
    }
  }, [formStep]);

  // Auto-focus GSTIN field when Quick Add Vendor Modal opens (since Vendor Name is pre-typed)
  useEffect(() => {
    if (isQuickAddSupplierOpen) {
      const timer = setTimeout(() => {
        quickSupplierGstinRef.current?.focus();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isQuickAddSupplierOpen]);

  // Auto-focus unit cost input when Quick Add Product Modal opens
  useEffect(() => {
    if (isQuickAddProductModalOpen) {
      const timer = setTimeout(() => {
        quickAddRateRef.current?.focus();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isQuickAddProductModalOpen]);

  // Auto-fetch preview sequence number for new bill
  useEffect(() => {
    if (isCreating && !editingBillId) {
      sequencesApi.previewSequence("Purchase Bill")
        .then((res) => {
          if (res?.next_number) {
            setForm(f => ({ ...f, bill_number: res.next_number }));
          }
        })
        .catch((err) => console.warn("Failed to fetch Purchase Bill sequence:", err));
    }
  }, [isCreating]);

  // Listen to global keyboard shortcuts
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("globalKeyDown", (e) => {
      if (!e) return;
      const { key, ctrlKey, altKey } = e;
      if (isCreating && ctrlKey && (key === "s" || key === "S")) {
        handleSave();
      }
      if (altKey && (key === "p" || key === "P")) {
        setIsCreating(true);
      }
    });
    return () => sub.remove();
  }, [isCreating, form, lines]);

  // Theme Colors
  const C = isDarkMode
    ? {
      bg: "#0F172A",
      card: "#1E293B",
      border: "#334155",
      textPrimary: "#F8FAFC",
      textSecondary: "#94A3B8",
      accent: "#38BDF8",
      accentLight: "rgba(56, 189, 248, 0.12)",
      inputBg: "#0F172A",
      inputBorder: "#334155",
      headerBg: "#1E293B",
      rowHover: "#1E3A5F",
      rowActive: "#0C4A6E",
      divider: "#334155",
      tableHead: "#334155",
      btnPrimary: "#0284C7",
      btnPrimaryHover: "#0EA5E9",
      btnDanger: "#DC2626",
      badgePaid: { bg: "#064E3B", text: "#34D399" },
      badgePartial: { bg: "#78350F", text: "#FBBF24" },
      badgeUnpaid: { bg: "#7F1D1D", text: "#FCA5A5" },
    }
    : {
      bg: "#F8FAFC",
      card: "#FFFFFF",
      border: "#E2E8F0",
      textPrimary: "#0F172A",
      textSecondary: "#64748B",
      accent: "#0284C7",
      accentLight: "rgba(2, 132, 199, 0.08)",
      inputBg: "#FFFFFF",
      inputBorder: "#CBD5E1",
      headerBg: "#F1F5F9",
      rowHover: "#F1F5F9",
      rowActive: "#E0F2FE",
      divider: "#E2E8F0",
      tableHead: "#F1F5F9",
      btnPrimary: "#0284C7",
      btnPrimaryHover: "#0369A1",
      btnDanger: "#DC2626",
      badgePaid: { bg: "#DCFCE7", text: "#16A34A" },
      badgePartial: { bg: "#FEF9C3", text: "#A16207" },
      badgeUnpaid: { bg: "#FEE2E2", text: "#DC2626" },
    };

  // ── Query: Fetch bills ──
  const { data: bills = [], isLoading } = useQuery<PurchaseBill[]>({
    queryKey: ["purchase_bills", company?.id],
    queryFn: async () => {
      const res = await apiClient.get("/api/purchase/bills");
      return res.data;
    },
  });

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("openSearchResult", ({ targetScreen, targetId, title }) => {
      if (targetScreen === "PURCHASES" || targetScreen === "PURCHASE_BILL") {
        if (title) setSearchQuery(title);
        if (targetId && bills && bills.length > 0) {
          const match = bills.find(b => b.id === targetId || b.bill_number === title);
          if (match) setSelectedBill(match);
        }
      }
    });
    return () => sub.remove();
  }, [bills]);

  // ── Query: Fetch suppliers ──
  const { data: suppliers = [], refetch: refetchSuppliers } = useQuery<Supplier[]>({
    queryKey: ["suppliers", company?.id],
    queryFn: async () => {
      const res = await apiClient.get("/api/suppliers");
      return res.data;
    },
  });

  // ── Query: Fetch products ──
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products", company?.id],
    queryFn: async () => {
      const res = await apiClient.get("/api/inventory/products");
      return res.data;
    },
  });

  // ── Query: Fetch payment history for selected bill ──
  const { data: billPayments = [], refetch: refetchPayments } = useQuery<Payment[]>({
    queryKey: ["billPayments", selectedBill?.id],
    queryFn: async () => {
      if (!selectedBill) return [];
      const res = await apiClient.get(`/api/banking/payments?reference_type=purchase_bill&reference_id=${selectedBill.id}`);
      return res.data;
    },
    enabled: !!selectedBill,
  });

  // ── Query: Fetch liquid accounts ──
  const { data: bankAccounts = [] } = useQuery<BankAccount[]>({
    queryKey: ["bankingAccounts", company?.id],
    queryFn: async () => {
      const res = await apiClient.get("/api/banking/accounts");
      return res.data;
    },
  });

  const [isAddBankModalOpen, setIsAddBankModalOpen] = useState(false);

  const filteredBankAccounts = useMemo(() => {
    return bankAccounts.filter(acc => {
      const typeUpper = acc.account_type?.toUpperCase();
      const subtypeUpper = acc.account_subtype?.toUpperCase();
      return typeUpper !== "CASH" && subtypeUpper !== "CASH" && acc.name !== "Cash In Hand";
    });
  }, [bankAccounts]);

  // ── Mutation: Create bill ──
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/api/purchase/bills", payload);
      return res.data;
    },
    onSuccess: (newBill: PurchaseBill) => {
      queryClient.setQueryData<PurchaseBill[]>(["purchase_bills", company?.id], (old = []) => {
        if (old.some(b => b.id === newBill.id)) return old;
        return [newBill, ...old];
      });
      invalidateAllQueries(queryClient);
      setIsCreating(false);
      setEditingBillId(null);
      setSelectedBill(null);
      setForm(blankForm());
      setLines([blankLine()]);
      setFormStep(1);
      Alert.alert("Success", "Purchase Bill recorded successfully.");
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.detail || "Failed to record Purchase Bill.");
    },
  });

  // ── Mutation: Update bill ──
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await apiClient.put(`/api/purchase/bills/${id}`, payload);
      return res.data;
    },
    onSuccess: (updatedBill: PurchaseBill) => {
      queryClient.setQueryData<PurchaseBill[]>(["purchase_bills", company?.id], (old = []) =>
        old.map(b => (b.id === updatedBill.id ? updatedBill : b))
      );
      invalidateAllQueries(queryClient);
      setIsCreating(false);
      setEditingBillId(null);
      setSelectedBill(updatedBill);
      setForm(blankForm());
      setLines([blankLine()]);
      setFormStep(1);
      Alert.alert("Success", "Purchase Bill updated successfully.");
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.detail || "Failed to update Purchase Bill.");
    },
  });

  // ── Mutation: Delete bill ──
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/purchase/bills/${id}`);
    },
    onSuccess: () => {
      invalidateAllQueries(queryClient);
      setSelectedBill(null);
      Alert.alert("Success", "Purchase Bill record deleted.");
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.detail || "Failed to delete Purchase Bill.");
    },
  });

  // ── Delete payment mutation ──
  const deletePaymentMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/banking/payments/${id}`);
    },
    onSuccess: (_, deletedId) => {
      invalidateAllQueries(queryClient);
      Alert.alert("Success", "Payment record deleted successfully.");

      if (selectedBill) {
        const deletedPayment = billPayments.find(p => p.id === deletedId);
        if (deletedPayment) {
          const amt = Number(deletedPayment.amount);
          const newPaid = Math.max(0, Number(selectedBill.amount_paid) - amt);
          const newDue = Number(selectedBill.total) - newPaid;
          setSelectedBill({
            ...selectedBill,
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

  // ── Mutation: Record Supplier Payment ──
  const recordPaymentMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/api/banking/payments", payload);
      return res.data;
    },
    onSuccess: (newPayment: any) => {
      // ─── Optimistic instant cache update ────────────────────────────────
      // 1. Push new payment into payments cache immediately
      queryClient.setQueryData<any[]>(["payments", company?.id], (old = []) => {
        if (old.some((p: any) => p.id === newPayment?.id)) return old;
        return [newPayment, ...old];
      });
      // 2. Push into bill-specific payments list
      queryClient.setQueryData<any[]>(["billPayments", selectedBill?.id], (old = []) => {
        if (old.some((p: any) => p.id === newPayment?.id)) return old;
        return [newPayment, ...old];
      });
      // 3. Force-refetch banking accounts immediately (balance update)
      queryClient.invalidateQueries({ queryKey: ["bankingAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["allAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_bills"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_kpis"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_liquidity"] });
      // ────────────────────────────────────────────────────────────────────

      setIsPaymentModalOpen(false);
      setPaymentForm({
        amount: "",
        payment_date: toUIDate(new Date().toISOString().split("T")[0]),
        payment_method: "BANK_TRANSFER",
        bank_account: "",
        reference_number: "",
        notes: ""
      });
      Alert.alert("Success", "Supplier payment recorded successfully.");
    },
    onError: (err: any) => {
      Alert.alert("Payment Error", err?.response?.data?.detail || "Failed to record payment.");
    }
  });

  // Quick Add Supplier Save Handler
  const handleQuickAddSupplierSubmit = () => {
    if (!quickSupplierForm.name.trim()) {
      Alert.alert("Validation", "Vendor name is required.");
      return;
    }
    quickAddSupplierMutation.mutate(quickSupplierForm);
  };

  // Quick Add Supplier Mutation
  const quickAddSupplierMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/api/suppliers", payload);
      return res.data;
    },
    onSuccess: (newSupp) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setForm(f => ({ ...f, supplier_id: newSupp.id }));
      setIsQuickAddSupplierOpen(false);
      setQuickSupplierForm({
        name: "",
        gst_number: "",
        phone: "",
        email: "",
        city: "",
        state: "",
        address_line_1: ""
      });
      setTimeout(() => {
        setFormStep(2);
      }, 200);
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.detail || "Failed to create vendor.");
    }
  });

  // Quick Add Product Save Handler
  const handleQuickAddSave = async () => {
    if (!quickAddProductName.trim()) {
      Alert.alert("Validation", "Product name is required.");
      return;
    }

    const purchaseRateVal = parseFloat(quickAddProductPurchasePrice) || 0;
    const saleRateVal = parseFloat(quickAddProductSalePrice) || purchaseRateVal;
    const isGst = company?.is_gst_applicable ?? true;
    const resolvedGstRate = isGst ? (parseFloat(company?.default_gst_rate || company?.default_tax_rate || "18") || 0) : 0;
    const resolvedItemType = (company?.hsn_sac_type || "Goods").toLowerCase() === "service" ? "service" : "goods";
    const resolvedHsn = resolvedItemType === "goods" ? (company?.default_hsn_sac_code || "") : "";
    const resolvedSac = resolvedItemType === "service" ? (company?.default_hsn_sac_code || "") : "";

    const payload: any = {
      name: quickAddProductName.trim(),
      sku: quickAddProductSku.trim() || `PROD-${Math.floor(1000 + Math.random() * 9000)}`,
      unit: "PCS",
      base_unit: "PCS",
      item_type: resolvedItemType,
      secondary_unit: null,
      conversion_factor: 1.0,
      purchase_price: purchaseRateVal,
      sale_price: saleRateVal,
      mrp: saleRateVal,
      tax_preference: isGst ? "taxable" : "exempt",
      tax_rate: resolvedGstRate,
      intra_state_tax_rate: resolvedGstRate / 2,
      inter_state_tax_rate: resolvedGstRate,
      hsn_code: resolvedHsn,
      sac_code: resolvedSac,
      reorder_level: 0.0,
      has_batch_tracking: false,
      is_active: true,
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
            next[activeIdx].unit_price = newProd.purchase_price || purchaseRateVal;
            next[activeIdx].tax_rate = newProd.tax_rate || resolvedGstRate;
            next[activeIdx].product_name = newProd.name;
            return next;
          });

          setTimeout(() => {
            noteRefs.current[activeIdx]?.focus();
          }, 150);
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

  // ── Computed totals ──
  const totals = useMemo(() => {
    let sub = 0;
    lines.forEach(l => {
      sub += (l.quantity || 0) * (Number(l.unit_price) || 0);
    });

    const taxVal = sub > 0 ? sub * (defaultTaxRate / 100) : 0;
    const roundOff = parseFloat(form.round_off_amount || "0") || 0;
    const netTotal = sub + taxVal + roundOff;

    return {
      subtotal: sub,
      tax: taxVal,
      cgst: taxVal / 2,
      sgst: taxVal / 2,
      total: Math.round(netTotal)
    };
  }, [lines, form.round_off_amount, defaultTaxRate]);

  // ── Multi-field Effective Search ──
  const filteredBills = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return bills.filter(bill => {
      const matchSearch =
        !q ||
        bill.bill_number?.toLowerCase().includes(q) ||
        bill.supplier?.name?.toLowerCase().includes(q) ||
        bill.supplier?.phone?.toLowerCase().includes(q) ||
        bill.supplier?.gst_number?.toLowerCase().includes(q) ||
        bill.supplier?.city?.toLowerCase().includes(q) ||
        bill.supplier_bill_no?.toLowerCase().includes(q) ||
        bill.total?.toString().includes(q) ||
        bill.status?.toLowerCase().includes(q);
      const matchStatus =
        statusFilter === "ALL" || bill.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [bills, searchQuery, statusFilter]);

  // ── Handlers ──
  function triggerEditBill(bill: PurchaseBill) {
    setEditingBillId(bill.id);
    setForm({
      supplier_id: bill.supplier_id,
      bill_number: bill.bill_number,
      supplier_bill_no: bill.supplier_bill_no || "",
      bill_date: toUIDate(bill.bill_date),
      due_date: bill.due_date ? toUIDate(bill.due_date) : "",
      place_of_supply: bill.place_of_supply || "",
      gst_type: bill.gst_type || "B2B",
      notes: bill.notes || "",
      round_off_amount: "0",
    });
    setLines(
      bill.items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate || defaultTaxRate,
        product_name: item.product_name || "",
      }))
    );
    setFormStep(1);
    setSelectedBill(null);
    setIsCreating(true);
  }

  function handleSave() {
    if (!form.supplier_id) {
      Alert.alert("Validation", "Please select a vendor / supplier.");
      return;
    }
    if (lines.length === 0 || lines.some(l => !l.product_id)) {
      Alert.alert("Validation", "Each line item must have a product selected.");
      return;
    }

    const payload = {
      ...form,
      bill_date: toISODate(form.bill_date),
      due_date: form.due_date ? toISODate(form.due_date) : null,
      bill_number: form.bill_number || "BILL-AUTO",
      subtotal: totals.subtotal,
      tax_amount: totals.tax,
      total: totals.total,
      round_off_amount: parseFloat(form.round_off_amount || "0"),
      items: lines.map(l => ({
        product_id: l.product_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        tax_rate: defaultTaxRate,
      })),
    };

    if (editingBillId) {
      updateMutation.mutate({ id: editingBillId, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleDelete(id: string) {
    const hasPayments = Number(selectedBill?.amount_paid || 0) > 0;
    const formattedAmount = Number(selectedBill?.amount_paid || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
    const alertTitle = hasPayments ? "⚠️ Delete Paid Purchase Bill?" : "Delete Purchase Bill";
    const alertMsg = hasPayments
      ? `Warning: Payments of ₹${formattedAmount} have been made against Bill ${selectedBill?.bill_number}.\n\nDeleting this bill will also permanently delete all associated payment records and adjust your cash/bank balances.\n\nAre you sure you want to proceed?`
      : `Are you sure you want to delete purchase bill ${selectedBill?.bill_number}?`;

    Alert.alert(
      alertTitle,
      alertMsg,
      [
        { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(id) },
        { text: "Cancel", style: "cancel" }
      ]
    );
  }

  function updateLine(idx: number, key: keyof PurchaseBillItem, val: any) {
    setLines(prev => {
      const next = [...prev];
      (next[idx] as any)[key] = val;
      if (key === "product_id") {
        const prod = products.find(p => p.id === val);
        if (prod) {
          next[idx].unit_price = prod.purchase_price || prod.sale_price;
          next[idx].tax_rate = prod.tax_rate || defaultTaxRate;
          next[idx].product_name = prod.name;
        }
      }
      return next;
    });
  }

  function addLine() {
    setLines(prev => [...prev, blankLine()]);
  }

  function removeLine(idx: number) {
    setLines(prev => prev.filter((_, i) => i !== idx));
  }

  function handleRecordPaymentSubmit() {
    if (!selectedBill) return;
    const amtNum = parseFloat(paymentForm.amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      Alert.alert("Validation Error", "Please enter a valid payment amount.");
      return;
    }

    const payload = {
      payment_type: "OUT",
      reference_type: "purchase_bill",
      reference_id: selectedBill.id,
      party_type: "supplier",
      party_id: selectedBill.supplier_id,
      payment_method: paymentForm.payment_method,
      bank_account: paymentForm.payment_method === "CASH" ? "Cash In Hand" : paymentForm.bank_account,
      amount: amtNum,
      payment_date: toISODate(paymentForm.payment_date) + "T" + new Date().toTimeString().split(" ")[0],
      reference_number: paymentForm.reference_number.trim() || null,
      notes: paymentForm.notes.trim() || null
    };

    recordPaymentMutation.mutate(payload);
  }

  function triggerPreview(bill: PurchaseBill) {
    setPreviewBill(bill);
    setIsPreviewOpen(true);
  }

  const STATUS_FILTERS = ["ALL", "PENDING", "UNPAID", "PARTIAL", "PAID"];

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>

      {/* LEFT PANEL — Bills list */}
      <View
        style={[
          styles.listPanel,
          (selectedBill && !isCreating) && styles.listPanelSplit,
          (selectedBill && !isCreating) && { borderRightColor: C.border },
        ]}
      >

        {/* Header Block */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable onPress={() => setActiveScreen("DASHBOARD")} style={({ hovered }: any) => [hovered && { opacity: 0.8 }]}>
              <Text style={[styles.breadcrumb, { color: C.accent }]}>DASHBOARD</Text>
            </Pressable>
            <Text style={[styles.breadcrumb, { color: C.textSecondary }]}> / PURCHASES / BILLS</Text>
          </View>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: C.textPrimary }]}>Purchase Bills</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>

              <Pressable
                onPress={() => {
                  setForm(blankForm());
                  setLines([blankLine()]);
                  setFormStep(1);
                  setEditingBillId(null);
                  setIsCreating(true);
                  setSelectedBill(null);
                }}
                style={({ hovered, pressed }: any) => [
                  styles.newBtn,
                  { backgroundColor: hovered ? C.btnPrimaryHover : C.btnPrimary },
                  pressed && { transform: [{ scale: 0.98 }] }
                ]}
              >
                <Text style={styles.newBtnText}>+ New Bill</Text>
              </Pressable>
            </View>
          </View>
          <Text style={[styles.subtitle, { color: C.textSecondary }]}>
            Track supplier invoices, record vendor payments, manage due dates, and update inventory stock.
          </Text>
        </View>

        {/* Search */}
        <SearchToolbar
          placeholder="Search bill no., vendor, or ref no..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {/* Status filters */}
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
          data={filteredBills}
          columns={[
            {
              header: "BILL #",
              accessorKey: "bill_number",
              flex: 1.4,
              render: (row) => (
                <Text style={[styles.tdCell, { color: C.textPrimary, fontWeight: "600" }]} numberOfLines={1}>
                  {row.bill_number}
                </Text>
              )
            },
            {
              header: "VENDOR / SUPPLIER",
              accessorKey: "supplier.name",
              flex: 1.8,
              render: (row) => (
                <Text style={[styles.tdCell, { color: C.textPrimary }]} numberOfLines={1}>
                  {row.supplier?.name || "—"}
                </Text>
              )
            },
            {
              header: "DATE",
              accessorKey: "bill_date",
              flex: 0.9,
              render: (row) => (
                <Text style={[styles.tdCell, { color: C.textSecondary, fontSize: 11 }]}>
                  {toUIDate(row.bill_date)}
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
                const canPay = row.status !== "CANCELLED" && Number(row.balance_due) > 0;
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
                    {canPay && (
                      <Pressable
                        onPress={() => {
                          setPaymentForm({
                            amount: String(row.balance_due),
                            payment_date: toUIDate(new Date().toISOString().split("T")[0]),
                            payment_method: "BANK_TRANSFER",
                            bank_account: bankAccounts[0]?.name || "",
                            reference_number: "",
                            notes: `Payment for Bill #${row.bill_number}`
                          });
                          setSelectedBill(row);
                          setIsPaymentModalOpen(true);
                        }}
                        style={({ hovered, pressed }: any) => [
                          styles.tableReceiveBtn,
                          { backgroundColor: hovered ? C.btnPrimaryHover : C.btnPrimary },
                          pressed && { transform: [{ scale: 0.96 }] }
                        ]}
                      >
                        <Text style={styles.tableReceiveBtnText}>Pay Vendor</Text>
                      </Pressable>
                    )}
                  </View>
                );
              }
            }
          ]}
          isLoading={isLoading}
          onRowPress={(item) => {
            setSelectedBill(item);
            setIsCreating(false);
          }}
          selectedId={selectedBill?.id}
          emptyMessage="No purchase bills found"
          loaderMessage="Loading purchase bills…"
        />
      </View>

      {/* RIGHT PANEL — Detail Sidebar View */}
      {selectedBill && !isCreating && (
        <View style={[styles.detailPanel, { backgroundColor: C.card, borderLeftColor: C.border }]}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.detailScroll}>

            {/* Detail Header */}
            <View style={[styles.detailHeader, { borderBottomColor: C.border }]}>
              <Text style={[styles.detailTitle, { color: C.textPrimary }]}>
                {selectedBill.bill_number}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => triggerPreview(selectedBill)}
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

                {selectedBill.status !== "CANCELLED" && (
                  <Pressable
                    onPress={() => triggerEditBill(selectedBill)}
                    style={({ hovered }: any) => [
                      styles.iconBtn,
                      { borderColor: C.accent },
                      hovered && { backgroundColor: "#E0F2FE" }
                    ]}
                  >
                    <Text style={[styles.iconBtnText, { fontFamily: "Segoe MDL2 Assets", color: C.accent }]}>{"\uE70F"}</Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => handleDelete(selectedBill.id)}
                  style={({ hovered }: any) => [
                    styles.iconBtn,
                    { borderColor: "#EF4444" },
                    hovered && { backgroundColor: "#FEE2E2" }
                  ]}
                >
                  <Text style={[styles.iconBtnText, { fontFamily: "Segoe MDL2 Assets", color: "#EF4444" }]}>{"\uE74D"}</Text>
                </Pressable>

                <Pressable
                  onPress={() => setSelectedBill(null)}
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

            {/* View Content */}
            <View style={styles.viewContent}>
              {/* Summary cards */}
              <View style={styles.summaryRow}>
                <SummaryCard label="Subtotal" value={`₹${Number(selectedBill.subtotal || selectedBill.total * 0.85).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color={C.textPrimary} bg={C.bg} border={C.border} />
                <SummaryCard label="GST" value={`₹${Number(selectedBill.tax_amount || selectedBill.total * 0.15).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color={C.textSecondary} bg={C.bg} border={C.border} />
                <SummaryCard label="Total" value={`₹${Number(selectedBill.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color={C.accent} bg={C.bg} border={C.border} accent />
                <SummaryCard label="Balance Due" value={`₹${Number(selectedBill.balance_due).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color={Number(selectedBill.balance_due) > 0 ? "#DC2626" : "#16A34A"} bg={C.bg} border={C.border} />
              </View>

              {/* Bill Meta Card */}
              <View style={[styles.metaCard, { backgroundColor: C.bg, borderColor: C.border }]}>
                <DetailRow label="Vendor / Supplier" value={selectedBill.supplier?.name || "—"} color={C.textPrimary} labelColor={C.textSecondary} />
                <DetailRow label="Bill Date" value={toUIDate(selectedBill.bill_date)} color={C.textPrimary} labelColor={C.textSecondary} />
                <DetailRow label="Due Date" value={selectedBill.due_date ? toUIDate(selectedBill.due_date) : "—"} color={C.textPrimary} labelColor={C.textSecondary} />
                {selectedBill.supplier_bill_no ? (
                  <DetailRow label="Supplier Ref No" value={selectedBill.supplier_bill_no} color={C.textPrimary} labelColor={C.textSecondary} />
                ) : null}
                {selectedBill.place_of_supply ? (
                  <DetailRow label="Place of Supply" value={selectedBill.place_of_supply} color={C.textPrimary} labelColor={C.textSecondary} />
                ) : null}
                <DetailRow label="GST Type" value={selectedBill.gst_type || "B2B"} color={C.textPrimary} labelColor={C.textSecondary} />
                {selectedBill.notes ? (
                  <DetailRow label="Notes" value={selectedBill.notes} color={C.textPrimary} labelColor={C.textSecondary} />
                ) : null}
              </View>

              {/* Line items */}
              <Text style={[styles.sectionLabel, { color: C.textSecondary }]}>LINE ITEMS</Text>
              <View style={[styles.lineTable, { borderColor: C.border }]}>
                <View style={[styles.lineHead, { backgroundColor: C.tableHead, borderBottomColor: C.border }]}>
                  <Text style={[styles.lineThCell, { flex: 2.2, color: C.textSecondary }]}>PRODUCT</Text>
                  <Text style={[styles.lineThCell, { flex: 0.8, color: C.textSecondary, textAlign: "right" }]}>QTY</Text>
                  <Text style={[styles.lineThCell, { flex: 1.2, color: C.textSecondary, textAlign: "right" }]}>UNIT COST</Text>
                  <Text style={[styles.lineThCell, { flex: 0.8, color: C.textSecondary, textAlign: "right" }]}>GST%</Text>
                  <Text style={[styles.lineThCell, { flex: 1, color: C.textSecondary, textAlign: "right" }]}>AMOUNT</Text>
                </View>
                {selectedBill.items?.map((item: any) => (
                  <View key={item.id || item.product_id} style={[styles.lineRow, { borderBottomColor: C.divider }]}>
                    <Text style={[styles.lineTdCell, { flex: 2.2, color: C.textPrimary }]} numberOfLines={1}>
                      {item.product_name || item.product?.name || "Purchased Product"}
                    </Text>
                    <Text style={[styles.lineTdCell, { flex: 0.8, color: C.textSecondary, textAlign: "right" }]}>{item.quantity}</Text>
                    <Text style={[styles.lineTdCell, { flex: 1.2, color: C.textPrimary, textAlign: "right" }]}>
                      ₹{Number(item.unit_price).toLocaleString("en-IN")}
                    </Text>
                    <Text style={[styles.lineTdCell, { flex: 0.8, color: C.textSecondary, textAlign: "right" }]}>{item.tax_rate}%</Text>
                    <Text style={[styles.lineTdCell, { flex: 1, color: C.textPrimary, fontWeight: "600", textAlign: "right" }]}>
                      ₹{Number(item.total || (item.quantity * item.unit_price * (1 + (item.tax_rate || 0) / 100))).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Payment History Section */}
              <Text style={[styles.sectionLabel, { color: C.textSecondary, marginTop: 16 }]}>PAYMENT HISTORY</Text>
              {billPayments.length === 0 ? (
                <View style={[styles.emptyHistory, { borderColor: C.border, backgroundColor: C.bg }]}>
                  <Text style={[styles.emptyHistoryText, { color: C.textSecondary }]}>No payments recorded for this purchase bill yet.</Text>
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
                  {billPayments.map((p) => (
                    <View key={p.id} style={[styles.lineRow, { borderBottomColor: C.divider, height: "auto", paddingVertical: 8 }]}>
                      {/* Timestamp */}
                      <View style={{ flex: 1.2 }}>
                        <Text style={[styles.lineTdCell, { color: C.textPrimary, fontSize: 10.5 }]}>
                          {formatPaymentTimestamp(p.payment_date)}
                        </Text>
                      </View>

                      {/* Method with OUT indicator */}
                      <View style={{ flex: 1.4, flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <View style={{ backgroundColor: "#FEE2E2", paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3 }}>
                          <Text style={{ color: "#DC2626", fontSize: 9, fontWeight: "700" }}>OUT</Text>
                        </View>
                        <Text style={[styles.lineTdCell, { color: C.textPrimary, fontSize: 11 }]}>
                          {p.payment_method}
                        </Text>
                      </View>

                      {/* Reference / Bank details */}
                      <View style={{ flex: 2.0 }}>
                        <Text style={[styles.lineTdCell, { color: C.textSecondary, fontSize: 11 }]} numberOfLines={2}>
                          {p.payment_method === "CASH" ? "Cash In Hand" : (p.bank_account || "—")}
                          {"\n"}
                          <Text style={{ fontSize: 10, color: C.textPrimary, fontWeight: "600" }}>
                            Ref: {p.reference_number || "—"}
                          </Text>
                          {p.notes ? `\nNote: ${p.notes}` : ""}
                        </Text>
                      </View>

                      {/* Amount paid */}
                      <View style={{ flex: 1.2, alignItems: "flex-end", justifyContent: "center" }}>
                        <Text style={[styles.lineTdCell, { color: "#DC2626", fontWeight: "700", textAlign: "right" }]}>
                          - ₹{Number(p.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </Text>
                      </View>

                      {/* Delete action */}
                      <View style={{ flex: 0.4, alignItems: "center", justifyContent: "center" }}>
                        <Pressable
                          onPress={() =>
                            Alert.alert("Delete Payment", `Revert and delete this supplier payment of ₹${Number(p.amount).toFixed(2)}?`, [
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
          </ScrollView>
        </View>
      )}

      {/* FULLSCREEN CREATE PURCHASE BILL WORKSPACE */}
      <FullScreenModal
        isOpen={isCreating}
        onClose={() => { setIsCreating(false); setEditingBillId(null); setForm(blankForm()); setLines([blankLine()]); setFormStep(1); }}
        title={editingBillId ? "Modify Purchase Bill" : "Generate Purchase Bill"}
        subtitle={editingBillId ? "Edit bill details, line items, and recalculate purchase totals" : "Procurement & Payables Control Center"}
        breadcrumb={editingBillId ? "purchases / bills / modify" : "purchases / bills"}
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
                    title={editingBillId ? "Cancel Edit" : "Discard Bill"}
                    onPress={() => { setIsCreating(false); setEditingBillId(null); setForm(blankForm()); setLines([blankLine()]); setFormStep(1); }}
                    variant="secondary"
                    size="large"
                    style={{ minWidth: 140 }}
                  />

                  <Button
                    title="Proceed to Add Items ›"
                    onPress={() => {
                      if (!form.supplier_id) {
                        Alert.alert("Validation", "Please select a vendor / supplier before proceeding.");
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
                    title={editingBillId ? "Update Bill" : "Save Purchase Bill"}
                    onPress={handleSave}
                    variant="primary"
                    size="large"
                    loading={editingBillId ? updateMutation.isPending : createMutation.isPending}
                    style={{ minWidth: 165 }}
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

                  {/* Info row: DOCUMENT NO / BILL NO / BILL DATE */}
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="DOCUMENT NO."
                        value={editingBillId ? form.bill_number : "Auto-Sequence"}
                        editable={false}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        ref={billNumberRef}
                        label="BILL NUMBER *"
                        value={form.bill_number}
                        onChangeText={v => setForm(f => ({ ...f, bill_number: v }))}
                        editable={true}
                        placeholder="e.g. BILL-9923"
                        onSubmitEditing={() => supplierRefNoRef.current?.focus()}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <DatePicker
                        label="BILL DATE *"
                        value={form.bill_date}
                        onChange={v => setForm(f => ({ ...f, bill_date: v }))}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        ref={supplierRefNoRef}
                        label="SUPPLIER REF NO."
                        value={form.supplier_bill_no}
                        onChangeText={v => setForm(f => ({ ...f, supplier_bill_no: v }))}
                        placeholder="Vendor invoice ref no."
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <DatePicker
                        label="DUE DATE"
                        value={form.due_date}
                        onChange={v => setForm(f => ({ ...f, due_date: v }))}
                      />
                    </View>
                  </View>

                  {/* Vendor Selection */}
                  <View style={{ zIndex: 100 }}>
                    <Text style={[styles.inputLabel, { color: C.textSecondary }]}>SUPPLIER / VENDOR ENTITY *</Text>
                    <Dropdown
                      ref={supplierRef}
                      options={suppliers.map(s => ({ value: s.id, label: s.name, sublabel: s.gst_number ? `GSTIN: ${s.gst_number}` : (s.phone ? `Phone: ${s.phone}` : undefined) }))}
                      value={form.supplier_id}
                      onChange={(val) => setForm(f => ({ ...f, supplier_id: val || "" }))}
                      placeholder="Search and select registered vendor..."
                      autoFocus={true}
                      onAddNew={(searchQuery) => {
                        setQuickSupplierForm({
                          name: searchQuery || "",
                          gst_number: "",
                          phone: "",
                          email: "",
                          city: "",
                          state: "",
                          address_line_1: ""
                        });
                        setIsQuickAddSupplierOpen(true);
                      }}
                      addNewLabel="+ Quick Add New Vendor"
                      onSubmitEditing={() => {
                        setForm(f => {
                          if (f.supplier_id) setFormStep(2);
                          return f;
                        });
                      }}
                    />
                  </View>

                  {/* Vendor Details Card */}
                  {form.supplier_id ? (
                    (() => {
                      const sel = suppliers.find(s => s.id === form.supplier_id);
                      if (!sel) return null;
                      return (
                        <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 16, backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF" }}>
                          <Text style={{ fontSize: 12, fontWeight: "700", fontFamily: "Segoe UI Variable Text", color: C.textSecondary, letterSpacing: 0.8, marginBottom: 8 }}>VENDOR DETAILS</Text>
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
                      <Text style={{ fontSize: 16, fontFamily: "Segoe UI Variable Text", color: C.textSecondary, textAlign: "center" }}>Select a vendor above to load supplier details</Text>
                    </View>
                  )}
                </View>

                {/* ── RIGHT COLUMN: GST Info & Metadata Strip ── */}
                <View style={{ flex: 1, gap: 14 }}>
                  <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 8, backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF", padding: 16, gap: 12 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: C.accent, letterSpacing: 0.8, marginBottom: 2 }}>GST APPLIED (FROM BUSINESS SETTINGS)</Text>
                    <View style={{ flexDirection: "row", gap: 0 }}>
                      <View style={{ flex: 1, paddingRight: 16, borderRightWidth: 1, borderRightColor: C.border }}>
                        <Text style={{ fontSize: 14, color: C.textSecondary, marginBottom: 3 }}>TOTAL GST RATE</Text>
                        <Text style={{ fontSize: 30, fontWeight: "900", fontFamily: "Segoe UI Variable Display", color: C.accent }}>{defaultTaxRate}%</Text>
                      </View>
                      <View style={{ flex: 1, paddingHorizontal: 16, borderRightWidth: 1, borderRightColor: C.border }}>
                        <Text style={{ fontSize: 14, color: C.textSecondary, marginBottom: 3 }}>CGST</Text>
                        <Text style={{ fontSize: 26, fontWeight: "800", fontFamily: "Segoe UI Variable Display", color: C.textPrimary }}>{(defaultTaxRate / 2).toFixed(1)}%</Text>
                      </View>
                      <View style={{ flex: 1, paddingLeft: 16 }}>
                        <Text style={{ fontSize: 14, color: C.textSecondary, marginBottom: 3 }}>SGST</Text>
                        <Text style={{ fontSize: 26, fontWeight: "800", fontFamily: "Segoe UI Variable Display", color: C.textPrimary }}>{(defaultTaxRate / 2).toFixed(1)}%</Text>
                      </View>
                    </View>
                  </View>

                  <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 8, backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF", padding: 16, gap: 12 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: C.textSecondary, letterSpacing: 0.8 }}>SUPPLY & TAX NATURE</Text>

                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputLabel, { color: C.textSecondary, marginBottom: 6 }]}>GST TYPE</Text>
                        <Dropdown
                          options={[
                            { value: "B2B", label: "B2B (Registered Supplier)" },
                            { value: "B2C", label: "B2C (Unregistered)" },
                            { value: "SEZ", label: "SEZ Developer / Unit" },
                          ]}
                          value={form.gst_type}
                          onChange={(val) => setForm(f => ({ ...f, gst_type: val || "B2B" }))}
                          placeholder="Select GST Type"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="PLACE OF SUPPLY"
                          value={form.place_of_supply}
                          onChangeText={t => setForm(f => ({ ...f, place_of_supply: t }))}
                          placeholder="e.g. Gujarat (24)"
                        />
                      </View>
                    </View>

                    <Input
                      label="NARRATION / NOTES"
                      value={form.notes}
                      onChangeText={t => setForm(f => ({ ...f, notes: t }))}
                      placeholder="Optional purchase bill notes..."
                    />
                  </View>
                </View>

              </View>
            </View>
          ) : (
            /* STEP 2: LINE ITEMS WORKSPACE */
            <View>
              {/* Header Step description */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                <View style={{ width: 4, height: 28, backgroundColor: C.accent, marginRight: 10, borderRadius: 2 }} />
                <View>
                  <Text style={{ fontSize: 23, fontWeight: "700", fontFamily: "Segoe UI Variable Text", color: C.textSecondary, letterSpacing: 1 }}>SECTION 02 — ADD ITEMS TO PURCHASE BILL</Text>
                  <Text style={{ fontSize: 17, fontWeight: "500", fontFamily: "Segoe UI Variable Text", color: C.textSecondary }}>
                    SPECIFY PRODUCT QUANTITIES, RATES, AND DETAILS FOR EACH ITEM. (Loaded: {products.length} items)
                  </Text>
                </View>
              </View>

              {/* Line table header */}
              <View style={[styles.lineHead, { backgroundColor: C.tableHead, borderColor: C.border, borderWidth: 1, borderRadius: 6, marginBottom: 6, paddingHorizontal: 16, gap: 10 }]}>
                <Text style={[styles.lineThCell, { flex: 0.4, color: C.textSecondary, textAlign: "center" }]}>#</Text>
                <Text style={[styles.lineThCell, { flex: 3, color: C.textSecondary }]}>ITEM NAME / DETAILS</Text>
                <Text style={[styles.lineThCell, { flex: 1.6, color: C.textSecondary }]}>ITEM NOTE / BATCH</Text>
                <Text style={[styles.lineThCell, { flex: 0.8, color: C.textSecondary, textAlign: "right" }]}>QTY</Text>
                <Text style={[styles.lineThCell, { flex: 1.1, color: C.textSecondary, textAlign: "right" }]}>UNIT COST (₹)</Text>
                <Text style={[styles.lineThCell, { flex: 0.8, color: C.textSecondary, textAlign: "right" }]}>TAX %</Text>
                <Text style={[styles.lineThCell, { flex: 1, color: C.textSecondary, textAlign: "right" }]}>TOTAL</Text>
                <View style={{ width: 32 }} />
              </View>

              {lines.map((line, idx) => (
                <View key={idx} style={[styles.lineInputRow, { borderBottomColor: C.divider, marginBottom: 6, zIndex: (lines.length - idx) * 10, position: "relative", alignItems: "center", paddingHorizontal: 12, gap: 12 }]}>
                  {/* Serial */}
                  <Text style={{ flex: 0.5, textAlign: "center", fontSize: 17, color: C.textSecondary, fontWeight: "700" }}>
                    {String(idx + 1).padStart(2, "0")}
                  </Text>

                  {/* Product */}
                  <View style={{ flex: 3, zIndex: 100, overflow: "visible" }}>
                    <Dropdown
                      ref={el => { productRefs.current[idx] = el; }}
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
                        updateLine(idx, "product_id", val);
                        updateLine(idx, "unit_price", prod.purchase_price || prod.sale_price);
                        updateLine(idx, "tax_rate", prod.tax_rate ?? 0);
                        setTimeout(() => {
                          noteRefs.current[idx]?.focus();
                        }, 150);
                      }}
                      placeholder="Select Product..."
                      onAddNew={(searchQuery) => {
                        setQuickAddLineIndex(idx);
                        setQuickAddProductName(searchQuery || "");
                        setQuickAddProductSku("");
                        setQuickAddProductPurchasePrice("");
                        setQuickAddProductSalePrice("");
                        setIsQuickAddProductModalOpen(true);
                      }}
                      addNewLabel="+ Quick Add Product"
                      onSubmitEditing={() => noteRefs.current[idx]?.focus()}
                    />
                  </View>

                  {/* Item Note */}
                  <Input
                    ref={el => { noteRefs.current[idx] = el; }}
                    value={line.note || ""}
                    onChangeText={v => updateLine(idx, "note", v)}
                    placeholder="Note / batch..."
                    style={{ fontSize: 15 }}
                    containerStyle={{ flex: 1.6 }}
                    onSubmitEditing={() => qtyRefs.current[idx]?.focus()}
                  />

                  {/* Qty */}
                  <Input
                    ref={el => { qtyRefs.current[idx] = el; }}
                    value={line.quantity ? String(line.quantity) : ""}
                    onChangeText={v => updateLine(idx, "quantity", parseFloat(v) || 0)}
                    keyboardType="numeric"
                    placeholder="0"
                    style={{ fontSize: 17, textAlign: "right" }}
                    containerStyle={{ flex: 0.8 }}
                    onSubmitEditing={() => taxRefs.current[idx]?.focus()}
                  />

                  {/* Unit Cost */}
                  <Input
                    ref={el => { priceRefs.current[idx] = el; }}
                    value={String(line.unit_price || "")}
                    onChangeText={v => updateLine(idx, "unit_price", parseFloat(v) || 0)}
                    keyboardType="numeric"
                    placeholder="0.00"
                    style={{ fontSize: 17, textAlign: "right" }}
                    containerStyle={{ flex: 1.1 }}
                    onSubmitEditing={() => taxRefs.current[idx]?.focus()}
                  />

                  {/* Tax % */}
                  <Input
                    ref={el => { taxRefs.current[idx] = el; }}
                    value={line.tax_rate ? String(line.tax_rate) : ""}
                    onChangeText={v => updateLine(idx, "tax_rate", parseFloat(v) || 0)}
                    keyboardType="numeric"
                    placeholder="0"
                    style={{ fontSize: 17, textAlign: "right" }}
                    containerStyle={{ flex: 0.8 }}
                    onSubmitEditing={() => {
                      if (idx === lines.length - 1) {
                        addLine();
                        setTimeout(() => {
                          const ref = productRefs.current[idx + 1];
                          if (ref) {
                            if (typeof ref.open === "function") ref.open();
                            else if (typeof ref.focus === "function") ref.focus();
                          }
                        }, 150);
                      } else {
                        const ref = productRefs.current[idx + 1];
                        if (ref) {
                          if (typeof ref.open === "function") ref.open();
                          else if (typeof ref.focus === "function") ref.focus();
                        }
                      }
                    }}
                  />

                  {/* Total */}
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 17, fontWeight: "700", color: C.textPrimary }}>
                      ₹{(line.quantity * line.unit_price * (1 + line.tax_rate / 100)).toFixed(2)}
                    </Text>
                  </View>

                  {/* Delete line */}
                  <Pressable onPress={() => removeLine(idx)} style={{ width: 32, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: "Segoe MDL2 Assets", color: "#EF4444", fontSize: 13 }}>{"\uE74D"}</Text>
                  </Pressable>
                </View>
              ))}

              {/* Add line button */}
              <View style={{ alignItems: "center", marginTop: 8 }}>
                <Pressable
                  onPress={addLine}
                  style={[styles.addLineBtn, { borderColor: C.accent, paddingHorizontal: 24, height: 36 }]}
                >
                  <Text style={[styles.addLineBtnText, { color: C.accent }]}>+ ADD ITEM</Text>
                </Pressable>
              </View>

              {/* Collapsible Purchase Logistics & Notes Card (Optional) */}
              <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 16, backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF", marginTop: 24 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", fontFamily: "Segoe UI Variable Text", color: C.accent, letterSpacing: 0.5 }}>PURCHASE LOGISTICS & NOTES (OPTIONAL)</Text>
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
                  <View style={{ gap: 12, marginTop: 14 }}>
                    <Input
                      label="PURCHASE NARRATION / REMARKS"
                      value={form.notes}
                      onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                      placeholder="Optional purchase bill notes..."
                    />
                  </View>
                )}
              </View>
            </View>
          )}

        </View>
      </FullScreenModal>

      {/* SUPPLIER PAYMENT RECORDING MODAL */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Supplier Payment"
        width={500}
      >
        <View style={{ gap: 16, paddingVertical: 10 }}>
          <Input
            label="PAYMENT AMOUNT (₹) *"
            value={paymentForm.amount}
            onChangeText={t => setPaymentForm(p => ({ ...p, amount: t }))}
            keyboardType="numeric"
            placeholder="0.00"
          />

          <DatePicker
            label="PAYMENT DATE *"
            value={paymentForm.payment_date}
            onChange={t => setPaymentForm(p => ({ ...p, payment_date: t }))}
          />

          <View>
            <Text style={[styles.inputLabel, { color: C.textSecondary, marginBottom: 6 }]}>PAYMENT METHOD *</Text>
            <Dropdown
              options={[
                { value: "BANK_TRANSFER", label: "Bank Transfer / NEFT / RTGS" },
                { value: "UPI", label: "UPI / QR Code" },
                { value: "CASH", label: "Cash" },
                { value: "CHEQUE", label: "Cheque" },
              ]}
              value={paymentForm.payment_method}
              onChange={(val) => {
                const method = val || "BANK_TRANSFER";
                const isCash = method === "CASH";
                let targetBank = paymentForm.bank_account;
                if (isCash) {
                  targetBank = "Cash In Hand";
                } else {
                  if (!targetBank || targetBank === "Cash In Hand" || !filteredBankAccounts.some(b => b.name === targetBank)) {
                    targetBank = filteredBankAccounts[0]?.name || "";
                  }
                }
                setPaymentForm(p => ({ ...p, payment_method: method, bank_account: targetBank }));
              }}
            />
          </View>

          {paymentForm.payment_method !== "CASH" && (
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text style={[styles.inputLabel, { color: C.textSecondary }]}>PAID FROM BANK ACCOUNT *</Text>
                <Pressable
                  onPress={() => setIsAddBankModalOpen(true)}
                  style={({ hovered }: any) => [hovered && { opacity: 0.7 }]}
                >
                  <Text style={{ fontSize: 13, fontWeight: "800", color: C.accent, textDecorationLine: "underline" }}>
                    + Add Bank Account
                  </Text>
                </Pressable>
              </View>
              {filteredBankAccounts.length === 0 ? (
                <View style={{ gap: 6, marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, color: "#DC2626" }}>No active bank accounts found.</Text>
                  <Pressable onPress={() => setIsAddBankModalOpen(true)}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: C.accent, textDecorationLine: "underline" }}>+ Click here to add a bank account</Text>
                  </Pressable>
                </View>
              ) : (
                <Dropdown
                  options={filteredBankAccounts.map(b => ({ value: b.name, label: b.name, sublabel: b.account_code || b.account_type }))}
                  value={paymentForm.bank_account}
                  onChange={(val) => setPaymentForm(p => ({ ...p, bank_account: val || "" }))}
                  placeholder="Select bank account..."
                  onAddNew={() => setIsAddBankModalOpen(true)}
                  addNewLabel="Add New Bank Account"
                />
              )}
            </View>
          )}

          <Input
            label="TRANSACTION / CHEQUE REF NO."
            value={paymentForm.reference_number}
            onChangeText={t => setPaymentForm(p => ({ ...p, reference_number: t }))}
            placeholder="e.g. UTR192837465"
          />

          <Input
            label="NOTES / NARRATION"
            value={paymentForm.notes}
            onChangeText={t => setPaymentForm(p => ({ ...p, notes: t }))}
            placeholder="Optional payment notes..."
          />

          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setIsPaymentModalOpen(false)}
            />
            <Button
              title="Record Payment"
              variant="primary"
              loading={recordPaymentMutation.isPending}
              loadingText="Recording Payment..."
              onPress={handleRecordPaymentSubmit}
            />
          </View>
        </View>
      </Modal>

      {/* QUICK ADD BANK ACCOUNT MODAL */}
      <AddBankAccountModal
        isOpen={isAddBankModalOpen}
        onClose={() => setIsAddBankModalOpen(false)}
        onAccountCreated={(newAcc) => {
          setPaymentForm(p => ({ ...p, bank_account: newAcc.name }));
        }}
      />

      {/* QUICK ADD VENDOR / SUPPLIER DIALOG */}
      <FullScreenModal
        isOpen={isQuickAddSupplierOpen}
        onClose={() => setIsQuickAddSupplierOpen(false)}
        title="Quick Add Vendor / Supplier"
        subtitle="Register a new supplier / vendor in your contact database"
        breadcrumb="purchases / bills"
        footerActions={
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
            <Button
              title="Cancel"
              onPress={() => setIsQuickAddSupplierOpen(false)}
              variant="secondary"
              size="large"
            />
            <Button
              title="Save Vendor"
              onPress={() => {
                if (!quickSupplierForm.name.trim()) {
                  Alert.alert("Validation", "Vendor name is required.");
                  return;
                }
                quickAddSupplierMutation.mutate(quickSupplierForm);
              }}
              variant="primary"
              size="large"
              loading={quickAddSupplierMutation.isPending}
              loadingText="Saving Vendor..."
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
            BASIC VENDOR DETAIL
          </Text>

          <Input
            ref={quickSupplierNameRef}
            label="VENDOR / FIRM NAME *"
            value={quickSupplierForm.name}
            onChangeText={t => setQuickSupplierForm(s => ({ ...s, name: t }))}
            placeholder="e.g. ABC Suppliers & Co."
            onSubmitEditing={() => quickSupplierGstinRef.current?.focus()}
          />

          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Input
                ref={quickSupplierGstinRef}
                label="GSTIN"
                value={quickSupplierForm.gst_number}
                onChangeText={t => setQuickSupplierForm(s => ({ ...s, gst_number: t }))}
                placeholder="24AAAAA0000A1Z5"
                onSubmitEditing={() => quickSupplierPhoneRef.current?.focus()}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                ref={quickSupplierPhoneRef}
                label="PHONE"
                value={quickSupplierForm.phone}
                onChangeText={t => setQuickSupplierForm(s => ({ ...s, phone: t }))}
                placeholder="+91 9876543210"
                onSubmitEditing={() => quickSupplierCityRef.current?.focus()}
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Input
                ref={quickSupplierCityRef}
                label="CITY"
                value={quickSupplierForm.city}
                onChangeText={t => setQuickSupplierForm(s => ({ ...s, city: t }))}
                placeholder="e.g. Ahmedabad"
                onSubmitEditing={() => quickSupplierStateRef.current?.focus()}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                ref={quickSupplierStateRef}
                label="STATE"
                value={quickSupplierForm.state}
                onChangeText={t => setQuickSupplierForm(s => ({ ...s, state: t }))}
                placeholder="e.g. Gujarat"
                onSubmitEditing={() => quickSupplierAddressRef.current?.focus()}
              />
            </View>
          </View>

          <Input
            ref={quickSupplierAddressRef}
            label="ADDRESS LINE 1"
            value={quickSupplierForm.address_line_1}
            onChangeText={t => setQuickSupplierForm(s => ({ ...s, address_line_1: t }))}
            placeholder="e.g. 101 Industrial Estate, SG Highway"
            onSubmitEditing={handleQuickAddSupplierSubmit}
          />
        </View>
      </FullScreenModal>

      {/* REUSABLE PDF & EXCEL PREVIEW MODAL */}
      <PdfPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={`Purchase Bill ${previewBill?.bill_number || ""}`}
        documentTitle={`Purchase_Bill_${previewBill?.bill_number || ""}`}
        subtitle={`Vendor: ${previewBill?.supplier?.name || "Supplier"}`}
        breadcrumb="purchases / bill preview"
        reportKey="purchase_bill"
        getPdfUrl={(orientation, search, theme, copyType) => {
          if (!previewBill) return "";
          const activeTheme = (theme === "classic" || theme === "theme2") ? "theme2" : "theme1";
          const token = getAccessToken() || "";
          return `${apiClient.defaults.baseURL}/api/v1/purchase/bills/${previewBill.id}/pdf?orientation=${orientation}&search=${encodeURIComponent(search)}&theme=${activeTheme}&copy=${copyType}&token=${encodeURIComponent(token)}`;
        }}
        getExcelUrl={() => {
          if (!previewBill) return "";
          const token = getAccessToken() || "";
          return `${apiClient.defaults.baseURL}/api/v1/purchase/bills/${previewBill.id}/excel?token=${encodeURIComponent(token)}`;
        }}
        showThemeSelector={false}
        showCopySelector={true}
      />

      {/* QUICK ADD PRODUCT DIALOG */}
      <FullScreenModal
        isOpen={isQuickAddProductModalOpen}
        onClose={() => {
          setIsQuickAddProductModalOpen(false);
          setQuickAddDuplicateWarningOpen(false);
        }}
        title="Quick Add Product"
        subtitle="Register a new product in your inventory database"
        breadcrumb="purchases / bills"
        footerActions={
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
            <Button
              title="Cancel"
              onPress={() => setIsQuickAddProductModalOpen(false)}
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
            label="PRODUCT NAME *"
            value={quickAddProductName}
            onChangeText={setQuickAddProductName}
            placeholder="e.g. Electric Motor 5HP"
            onSubmitEditing={() => quickAddSkuRef.current?.focus()}
          />

          <Input
            ref={quickAddSkuRef}
            label="ITEM CODE / SKU (OPTIONAL)"
            value={quickAddProductSku}
            onChangeText={setQuickAddProductSku}
            placeholder="e.g. ELEC-101 (Auto-generated if left blank)"
            onSubmitEditing={() => quickAddRateRef.current?.focus()}
          />

          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Input
                ref={quickAddRateRef}
                label="PURCHASE PRICE (UNIT COST) *"
                value={quickAddProductPurchasePrice}
                onChangeText={setQuickAddProductPurchasePrice}
                placeholder="0.00"
                keyboardType="numeric"
                onSubmitEditing={() => quickAddSaleRateRef.current?.focus()}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Input
                ref={quickAddSaleRateRef}
                label="SALE PRICE (SELLING RATE) *"
                value={quickAddProductSalePrice}
                onChangeText={setQuickAddProductSalePrice}
                placeholder="0.00"
                keyboardType="numeric"
                onSubmitEditing={handleQuickAddSave}
              />
            </View>
          </View>
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
      <ModuleHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        initialCategory={helpModalCategory}
      />
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
  root: {
    flex: 1,
    flexDirection: "row",
  },
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
    flexWrap: "wrap",
    gap: 10,
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
  pillText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  tdCell: {
    fontSize: 15,
    fontFamily: "Segoe UI Variable Text",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailPanel: {
    flex: 0.55,
    borderLeftWidth: 1,
  },
  detailScroll: {
    padding: 24,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 16,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: "800",
    fontFamily: "Segoe UI Variable Display",
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnText: {
    fontSize: 14,
  },
  viewContent: {
    gap: 16,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  metaCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    fontFamily: "Segoe UI Variable Text",
  },
  lineTable: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  lineHead: {
    flexDirection: "row",
    height: 44,
    alignItems: "center",
    borderBottomWidth: 1,
    paddingHorizontal: 12,
  },
  lineThCell: {
    fontSize: 15.5,
    fontWeight: "800",
    letterSpacing: 0.6,
    fontFamily: "Segoe UI Variable Text",
  },
  lineRow: {
    flexDirection: "row",
    height: 42,
    alignItems: "center",
    borderBottomWidth: 1,
    paddingHorizontal: 12,
  },
  lineTdCell: {
    fontSize: 13.5,
    fontFamily: "Segoe UI Variable Text",
  },
  emptyHistory: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderStyle: "dashed",
  },
  emptyHistoryText: {
    fontSize: 13.5,
    fontFamily: "Segoe UI Variable Text",
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    fontFamily: "Segoe UI Variable Text",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addLineBtn: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 6,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  lineInputRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  addLineBtnText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
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
});
