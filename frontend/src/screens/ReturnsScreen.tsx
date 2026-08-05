// =============================================================
// JK INFOTECH ERP — Returns Screen (Credit & Debit Notes)
// File : src/screens/ReturnsScreen.tsx
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
  ActivityIndicator
} from "react-native";
import { useUIStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/client";
import { invalidateAllQueries } from "../utils/queryHelpers";
import { DataTable, ColumnDefinition } from "../components/ui/DataTable";
import { SearchToolbar } from "../components/ui/SearchToolbar";
import { FullScreenModal } from "../components/ui/FullScreenModal";
import { Dropdown } from "../components/ui/Dropdown";
import { Button } from "../components/ui/Button";
import { DatePicker } from "../components/ui/DatePicker";
import { Input } from "../components/ui/Input";
import { PdfPreviewModal } from "../components/ui/PdfPreviewModal";
import { PrinterIcon } from "../components/ui/Icons";

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

// ─── Types ────────────────────────────────────────────────────
interface Customer {
  id: string;
  name: string;
  gst_number?: string;
  phone?: string;
  mobile_no?: string;
  outstanding_balance?: number;
  is_active?: boolean;
}

interface Supplier {
  id: string;
  name: string;
  gst_number?: string;
  phone?: string;
  mobile_no?: string;
  outstanding_balance?: number;
  is_active?: boolean;
}

interface Product {
  id: string;
  name: string;
  sale_price: number;
  tax_rate: number;
  is_active?: boolean;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date?: string;
  customer_id?: string;
  total?: number;
  items?: any[];
}

interface PurchaseBill {
  id: string;
  bill_number: string;
  bill_date?: string;
  supplier_id?: string;
  total?: number;
  items?: any[];
}

interface ReturnItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  product_name?: string;
  total?: number;
}

interface ReturnNote {
  id: string;
  note_number: string;
  note_date: string;
  reason?: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  customer?: Customer; // for Credit Note
  supplier?: Supplier; // for Debit Note
  items: ReturnItem[];
}

function blankForm() {
  return {
    party_id: "",
    ref_id: "",
    note_number: "",
    note_date: toUIDate(new Date().toISOString().split("T")[0]),
    reason: "",
    return_mode: "GOODS_RETURN"
  };
}

function blankLine(): ReturnItem {
  return {
    product_id: "",
    quantity: 1,
    unit_price: 0,
    tax_rate: 18,
  };
}

export default function ReturnsScreen() {
  const { isDarkMode, activeScreen } = useUIStore();
  const { company } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"SALES" | "PURCHASE">("SALES");
  const [selectedNote, setSelectedNote] = useState<ReturnNote | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [previewNote, setPreviewNote] = useState<ReturnNote | null>(null);

  // Form states
  const [form, setForm] = useState(blankForm());
  const [lines, setLines] = useState<ReturnItem[]>([blankLine()]);

  const partyRef = useRef<TextInput>(null);
  const refDocRef = useRef<TextInput>(null);
  const reasonRef = useRef<TextInput>(null);

  const productRefs = useRef<any>([]);
  const qtyRefs = useRef<any>([]);
  const priceRefs = useRef<any>([]);

  // Colors
  const C = isDarkMode
    ? {
        bg:            "#0F172A",
        card:          "#1E293B",
        border:        "#334155",
        textPrimary:   "#F8FAFC",
        textSecondary: "#94A3B8",
        accent:        "#38BDF8",
        inputBg:       "#1E293B",
        inputBorder:   "#334155",
        headerBg:      "#1E293B",
        rowHover:      "#1E3A5F",
        rowActive:     "#0C4A6E",
        divider:       "#334155",
        tableHead:     "#334155",
        btnPrimary:    "#0284C7",
        btnPrimaryHover: "#0EA5E9",
        btnDanger:     "#DC2626",
      }
    : {
        bg:            "#F8FAFC",
        card:          "#FFFFFF",
        border:        "#E2E8F0",
        textPrimary:   "#0F172A",
        textSecondary: "#64748B",
        accent:        "#0284C7",
        inputBg:       "#FFFFFF",
        inputBorder:   "#CBD5E1",
        headerBg:      "#F1F5F9",
        rowHover:      "#F1F5F9",
        rowActive:     "#E0F2FE",
        divider:       "#E2E8F0",
        tableHead:     "#F1F5F9",
        btnPrimary:    "#0284C7",
        btnPrimaryHover: "#0369A1",
        btnDanger:     "#DC2626",
      };

  // ── Query: Fetch Credit Notes (Sales Returns) ──
  const { data: creditNotes = [], isLoading: loadingCredit, refetch: refetchCredit } = useQuery<ReturnNote[]>({
    queryKey: ["credit_notes", company?.id],
    queryFn: async () => {
      const res = await apiClient.get("/api/sales/credit-notes");
      return res.data;
    },
    enabled: activeTab === "SALES",
    staleTime: 0
  });

  // ── Query: Fetch Debit Notes (Purchase Returns) ──
  const { data: debitNotes = [], isLoading: loadingDebit, refetch: refetchDebit } = useQuery<ReturnNote[]>({
    queryKey: ["debit_notes", company?.id],
    queryFn: async () => {
      const res = await apiClient.get("/api/purchase/debit-notes");
      return res.data;
    },
    enabled: activeTab === "PURCHASE",
    staleTime: 0
  });

  useEffect(() => {
    if (activeScreen === "RETURNS") {
      if (activeTab === "SALES") refetchCredit();
      else refetchDebit();
    }
  }, [activeScreen, activeTab]);

  // ── Query: Fetch dropdown entities ──
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers", company?.id],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/parties/customers");
      return res.data;
    },
    enabled: isCreating && activeTab === "SALES",
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers", company?.id],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/parties/suppliers");
      return res.data;
    },
    enabled: isCreating && activeTab === "PURCHASE",
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["invoices", company?.id],
    queryFn: async () => {
      const res = await apiClient.get("/api/sales/invoices");
      return res.data;
    },
    enabled: isCreating && activeTab === "SALES",
  });

  const { data: bills = [] } = useQuery<PurchaseBill[]>({
    queryKey: ["bills", company?.id],
    queryFn: async () => {
      const res = await apiClient.get("/api/purchase/bills");
      return res.data;
    },
    enabled: isCreating && activeTab === "PURCHASE",
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products", company?.id],
    queryFn: async () => {
      const res = await apiClient.get("/api/inventory/products");
      return res.data;
    },
    enabled: isCreating,
  });

  // Selected party details for info card & balance banner
  const selectedPartyInfo = useMemo(() => {
    if (!form.party_id) return null;
    return activeTab === "SALES"
      ? customers.find(c => c.id === form.party_id)
      : suppliers.find(s => s.id === form.party_id);
  }, [form.party_id, activeTab, customers, suppliers]);

  // Filtered invoices/bills for linked doc dropdown
  const filteredRefDocs = useMemo(() => {
    if (!form.party_id) return [];
    return activeTab === "SALES"
      ? invoices.filter((i: any) => i.customer_id === form.party_id)
      : bills.filter((b: any) => b.supplier_id === form.party_id);
  }, [form.party_id, activeTab, invoices, bills]);

  // Handle Linked Invoice / Bill selection
  const handleRefDocChange = (refId: string) => {
    setForm(f => ({ ...f, ref_id: refId || "" }));
    if (!refId) return;

    if (activeTab === "SALES") {
      const inv = invoices.find((i: any) => i.id === refId);
      if (inv) {
        if (inv.customer_id && !form.party_id) {
          setForm(f => ({ ...f, party_id: String(inv.customer_id) }));
        }
        if (inv.items && inv.items.length > 0) {
          setLines(inv.items.map((item: any) => ({
            product_id: item.product_id,
            quantity: Number(item.quantity || 1),
            unit_price: Number(item.unit_price || 0),
            tax_rate: Number(item.tax_rate || 18),
            product_name: item.product?.name || ""
          })));
        }
      }
    } else {
      const bill = bills.find((b: any) => b.id === refId);
      if (bill) {
        if (bill.supplier_id && !form.party_id) {
          setForm(f => ({ ...f, party_id: String(bill.supplier_id) }));
        }
        if (bill.items && bill.items.length > 0) {
          setLines(bill.items.map((item: any) => ({
            product_id: item.product_id,
            quantity: Number(item.quantity || 1),
            unit_price: Number(item.unit_price || 0),
            tax_rate: Number(item.tax_rate || 18),
            product_name: item.product?.name || ""
          })));
        }
      }
    }
  };

  // ── Mutation: Create Return ──
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const endpoint = activeTab === "SALES" 
        ? "/api/sales/credit-notes" 
        : "/api/purchase/debit-notes";
      const res = await apiClient.post(endpoint, payload);
      return res.data;
    },
    onSuccess: (newNote: ReturnNote) => {
      const qKey = [activeTab === "SALES" ? "credit_notes" : "debit_notes", company?.id];
      queryClient.setQueryData<ReturnNote[]>(qKey, (old = []) => {
        if (old.some(n => n.id === newNote.id)) return old;
        return [newNote, ...old];
      });
      invalidateAllQueries(queryClient);
      setIsCreating(false);
      setFormStep(1);
      setSelectedNote(null);
      setForm(blankForm());
      setLines([blankLine()]);
      Alert.alert("Success", `${activeTab === "SALES" ? "Credit Note" : "Debit Note"} created successfully.`);
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.detail || "Failed to create return note.");
    },
  });

  // ── Mutation: Delete Return ──
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const endpoint = activeTab === "SALES" 
        ? `/api/sales/credit-notes/${id}` 
        : `/api/purchase/debit-notes/${id}`;
      await apiClient.delete(endpoint);
    },
    onSuccess: () => {
      const qKey = [activeTab === "SALES" ? "credit_notes" : "debit_notes", company?.id];
      queryClient.setQueryData<ReturnNote[]>(qKey, (old = []) =>
        old.filter(n => n.id !== selectedNote?.id)
      );
      invalidateAllQueries(queryClient);
      setSelectedNote(null);
      Alert.alert("Success", `${activeTab === "SALES" ? "Credit Note" : "Debit Note"} deleted and invoice balance restored successfully.`);
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.detail || "Failed to delete return note.");
    },
  });

  // ── Computed totals ──
  const totals = useMemo(() => {
    let sub = 0, tax = 0;
    lines.forEach(l => {
      const qty = Number(l.quantity || 0);
      const price = Number(l.unit_price || 0);
      const rate = Number(l.tax_rate || 0);
      const base = qty * price;
      sub += base;
      tax += base * (rate / 100);
    });
    const cgst = tax / 2;
    const sgst = tax / 2;
    return { subtotal: sub, tax, cgst, sgst, total: sub + tax };
  }, [lines]);

  // ── Filtered list ──
  const activeNotes = activeTab === "SALES" ? creditNotes : debitNotes;
  const filteredNotes = useMemo(() => {
    return activeNotes.filter(n => {
      const noteNo = n.note_number || "";
      const partyName = activeTab === "SALES" 
        ? n.customer?.name || "" 
        : n.supplier?.name || "";
      return (
        !searchQuery ||
        noteNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        partyName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [activeNotes, searchQuery, activeTab]);

  // Table Columns Definition
  const columns: ColumnDefinition<ReturnNote>[] = useMemo(() => [
    {
      header: "NOTE NO.",
      accessorKey: "note_number",
      flex: 1.2,
      render: (row) => (
        <Text style={[styles.tdCell, { fontWeight: "700", color: C.accent }]}>
          {row.note_number}
        </Text>
      ),
    },
    {
      header: "DATE",
      accessorKey: "note_date",
      flex: 1,
      render: (row) => (
        <Text style={[styles.tdCell, { color: C.textSecondary }]}>
          {toUIDate(row.note_date)}
        </Text>
      ),
    },
    {
      header: activeTab === "SALES" ? "CUSTOMER" : "SUPPLIER",
      accessorKey: "party",
      flex: 2,
      render: (row) => {
        const name = activeTab === "SALES" ? row.customer?.name : row.supplier?.name;
        return (
          <Text style={[styles.tdCell, { fontWeight: "600", color: C.textPrimary }]}>
            {name || "—"}
          </Text>
        );
      },
    },
    {
      header: "REASON",
      accessorKey: "reason",
      flex: 1.5,
      render: (row) => (
        <Text style={[styles.tdCell, { color: C.textSecondary }]} numberOfLines={1}>
          {row.reason || "—"}
        </Text>
      ),
    },
    {
      header: "TOTAL AMOUNT",
      accessorKey: "total",
      flex: 1.2,
      align: "right",
      render: (row) => (
        <Text style={[styles.tdCell, { fontWeight: "700", color: C.textPrimary }]}>
          ₹{Number(row.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      header: "ACTIONS",
      accessorKey: "actions",
      flex: 0.9,
      align: "center",
      render: (row) => (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {/* Print Icon Button */}
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              setPreviewNote(row);
              setPdfModalOpen(true);
            }}
            style={({ hovered, pressed }: any) => [{
              paddingHorizontal: 8,
              paddingVertical: 6,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: C.border,
              backgroundColor: isDarkMode ? "#1E293B" : "#F1F5F9",
              justifyContent: "center",
              alignItems: "center"
            }, hovered && { backgroundColor: C.rowHover }, pressed && { transform: [{ scale: 0.96 }] }]}
          >
            <PrinterIcon size={18} />
          </Pressable>

          {/* Delete Icon Button */}
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              handleDelete(row.id);
            }}
            style={({ hovered, pressed }: any) => [{
              paddingHorizontal: 8,
              paddingVertical: 6,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: C.btnDanger,
              backgroundColor: isDarkMode ? "rgba(239,68,68,0.12)" : "#FEE2E2",
              justifyContent: "center",
              alignItems: "center"
            }, hovered && { backgroundColor: isDarkMode ? "rgba(239,68,68,0.25)" : "#FCA5A5" }, pressed && { transform: [{ scale: 0.96 }] }]}
          >
            <Text style={{ fontFamily: "Segoe MDL2 Assets", fontSize: 13, color: C.btnDanger, fontWeight: "bold" }}>{"\uE74D"}</Text>
          </Pressable>
        </View>
      )
    },
  ], [activeTab, C, isDarkMode]);

  function handleSave() {
    if (!form.party_id) {
      Alert.alert("Validation", `Please select a ${activeTab === "SALES" ? "customer" : "supplier"}.`);
      return;
    }
    if (lines.some(l => !l.product_id)) {
      Alert.alert("Validation", "Each line item must have a product selected.");
      return;
    }

    const payload = activeTab === "SALES"
      ? {
          customer_id: form.party_id,
          invoice_id: form.ref_id || null,
          note_date: toISODate(form.note_date) + "T12:00:00",
          reason: form.reason,
          return_mode: form.return_mode,
          items: lines.map(l => ({
            product_id: l.product_id,
            quantity: Number(l.quantity || 1),
            unit_price: Number(l.unit_price || 0),
            tax_rate: Number(l.tax_rate || 18),
          })),
        }
      : {
          supplier_id: form.party_id,
          bill_id: form.ref_id || null,
          note_date: toISODate(form.note_date) + "T12:00:00",
          reason: form.reason,
          return_mode: form.return_mode,
          items: lines.map(l => ({
            product_id: l.product_id,
            quantity: Number(l.quantity || 1),
            unit_price: Number(l.unit_price || 0),
            tax_rate: Number(l.tax_rate || 18),
          })),
        };

    createMutation.mutate(payload);
  }

  function handleDelete(id: string) {
    Alert.alert("Confirm Delete", "Are you sure you want to delete this return note?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(id) }
    ]);
  }

  function updateLine(idx: number, key: keyof ReturnItem, val: any) {
    setLines(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };
      return next;
    });
  }

  function addLine() {
    setLines(prev => [...prev, blankLine()]);
  }

  function removeLine(idx: number) {
    setLines(prev => prev.filter((_, i) => i !== idx));
  }

  const isLoading = activeTab === "SALES" ? loadingCredit : loadingDebit;

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      {/* LEFT LIST PANEL */}
      <View style={[styles.listPanel, selectedNote ? styles.listPanelSplit : null, { borderColor: C.border }]}>
        
        {/* Header section */}
        <View style={styles.header}>
          <Text style={[styles.breadcrumb, { color: C.textSecondary }]}>RETURNS / DEBIT & CREDIT NOTES</Text>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: C.textPrimary }]}>Returns Management</Text>
            <Pressable
              style={({ hovered }: any) => [
                styles.newBtn,
                { backgroundColor: C.btnPrimary },
                hovered && { backgroundColor: C.btnPrimaryHover }
              ]}
              onPress={() => {
                setFormStep(1);
                setForm(blankForm());
                setLines([blankLine()]);
                setIsCreating(true);
              }}
            >
              <Text style={styles.newBtnText}>
                + Create {activeTab === "SALES" ? "Credit Note" : "Debit Note"}
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.subtitle, { color: C.textSecondary }]}>
            Issue credit notes for customer sales returns or debit notes for vendor returns
          </Text>
        </View>

        {/* Sub-tabs: Sales Returns (Credit) vs Purchase Returns (Debit) */}
        <View style={[styles.tabHeader, { borderBottomColor: C.border }]}>
          <Pressable
            style={[styles.subtab, activeTab === "SALES" && { borderBottomWidth: 3, borderBottomColor: C.accent }]}
            onPress={() => { setActiveTab("SALES"); setSelectedNote(null); }}
          >
            <Text style={[styles.subtabText, { color: activeTab === "SALES" ? C.accent : C.textSecondary }]}>
              Credit Notes (Sales Returns)
            </Text>
          </Pressable>
          <Pressable
            style={[styles.subtab, activeTab === "PURCHASE" && { borderBottomWidth: 3, borderBottomColor: C.accent }]}
            onPress={() => { setActiveTab("PURCHASE"); setSelectedNote(null); }}
          >
            <Text style={[styles.subtabText, { color: activeTab === "PURCHASE" ? C.accent : C.textSecondary }]}>
              Debit Notes (Purchase Returns)
            </Text>
          </Pressable>
        </View>

        {/* Toolbar */}
        <SearchToolbar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={activeTab === "SALES" ? "Search Credit Notes..." : "Search Debit Notes..."}
        />

        {/* Data Table */}
        {isLoading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={[styles.loaderText, { color: C.textSecondary }]}>Loading return notes...</Text>
          </View>
        ) : filteredNotes.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>↩️</Text>
            <Text style={[styles.emptyText, { color: C.textSecondary }]}>
              No {activeTab === "SALES" ? "credit notes" : "debit notes"} found
            </Text>
          </View>
        ) : (
          <DataTable
            columns={columns}
            data={filteredNotes}
            selectedId={selectedNote?.id}
            onRowPress={(row) => setSelectedNote(row)}
          />
        )}
      </View>

      {/* RIGHT DETAIL PANEL */}
      {selectedNote && (
        <View style={[styles.detailPanel, { backgroundColor: C.card, borderColor: C.border }]}>
          {/* Header */}
          <View style={[styles.detailHeader, { borderBottomColor: C.divider, paddingHorizontal: 20, paddingVertical: 14 }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={[styles.detailTitle, { color: C.textPrimary, fontSize: 20, fontWeight: "700" }]}>
                  {selectedNote.note_number}
                </Text>
                <View style={{ backgroundColor: isDarkMode ? "#14532D" : "#DCFCE7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: isDarkMode ? "#22C55E" : "#16A34A" }}>
                    {selectedNote.status || "AUTHORIZED"}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: C.textSecondary, fontFamily: "Segoe UI Variable Text", marginTop: 2 }}>
                {activeTab === "SALES" ? "Sales Return Credit Note" : "Purchase Return Debit Note"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                onPress={() => {
                  setPreviewNote(selectedNote);
                  setPdfModalOpen(true);
                }}
                style={{
                  backgroundColor: isDarkMode ? "#1E293B" : "#F1F5F9",
                  borderColor: C.border,
                  borderWidth: 1,
                  borderRadius: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <PrinterIcon size={16} />
                <Text style={{ fontSize: 12.5, fontWeight: "700", color: C.textPrimary }}>Print / Preview Voucher</Text>
              </Pressable>
              <Pressable onPress={() => setSelectedNote(null)} style={styles.closeBtn}>
                <Text style={{ fontSize: 18, color: C.textSecondary, fontWeight: "700" }}>✕</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} style={{ flex: 1 }}>
            {/* Entity & Metadata Summary Card */}
            <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 16, backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC", gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: C.textSecondary, letterSpacing: 0.8 }}>
                    {activeTab === "SALES" ? "CUSTOMER ENTITY" : "SUPPLIER ENTITY"}
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: C.accent, fontFamily: "Segoe UI Variable Display", marginTop: 2 }}>
                    {activeTab === "SALES" ? selectedNote.customer?.name : selectedNote.supplier?.name}
                  </Text>
                  {((activeTab === "SALES" ? selectedNote.customer?.gst_number : selectedNote.supplier?.gst_number)) && (
                    <Text style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
                      GSTIN: {activeTab === "SALES" ? selectedNote.customer?.gst_number : selectedNote.supplier?.gst_number}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: C.textSecondary, letterSpacing: 0.8 }}>NOTE DATE</Text>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: C.textPrimary, marginTop: 2 }}>
                    {toUIDate(selectedNote.note_date)}
                  </Text>
                </View>
              </View>

              {/* Settlement Mode Pill */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 4 }}>
                <View style={{ backgroundColor: isDarkMode ? "rgba(56,189,248,0.12)" : "rgba(2,132,199,0.08)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: C.accent }}>
                    {(selectedNote as any).return_mode === "FINANCIAL_ADJUSTMENT" ? "💳 Financial Settlement (Ledger Only)" : "📦 Goods Return (Inventory + Ledger)"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Reason Banner */}
            {selectedNote.reason ? (
              <View style={{ borderWidth: 1, borderColor: isDarkMode ? "#1E3A5F" : "#BFDBFE", borderRadius: 8, padding: 12, backgroundColor: isDarkMode ? "#1A2536" : "#EFF6FF", flexDirection: "row", gap: 10, alignItems: "center" }}>
                <Text style={{ fontSize: 18 }}>💡</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: C.textSecondary, letterSpacing: 0.5 }}>REASON FOR RETURN / ADJUSTMENT</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: C.textPrimary, marginTop: 1 }}>{selectedNote.reason}</Text>
                </View>
              </View>
            ) : null}

            {/* Return Line Items Table */}
            <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, overflow: "hidden" }}>
              <View style={{ backgroundColor: C.tableHead, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: C.textSecondary, letterSpacing: 0.5 }}>RETURN LINE ITEMS ({(selectedNote.items || []).length})</Text>
              </View>

              {/* Table Sub-header */}
              <View style={{ flexDirection: "row", backgroundColor: isDarkMode ? "#1E293B" : "#F1F5F9", paddingHorizontal: 14, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.divider }}>
                <Text style={{ flex: 2, fontSize: 11, fontWeight: "700", color: C.textSecondary }}>ITEM NAME</Text>
                <Text style={{ flex: 0.8, fontSize: 11, fontWeight: "700", color: C.textSecondary, textAlign: "right" }}>QTY</Text>
                <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", color: C.textSecondary, textAlign: "right" }}>RATE (₹)</Text>
                <Text style={{ flex: 1.2, fontSize: 11, fontWeight: "700", color: C.textSecondary, textAlign: "right" }}>NET TOTAL (₹)</Text>
              </View>

              {(selectedNote.items || []).map((item, idx) => {
                const lineBase = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
                const lineTax = lineBase * ((Number(item.tax_rate) || 18) / 100);
                const lineTotal = Number(item.total || lineBase + lineTax);

                return (
                  <View key={idx} style={{ flexDirection: "row", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: idx === selectedNote.items.length - 1 ? 0 : 1, borderBottomColor: C.divider, alignItems: "center", backgroundColor: idx % 2 === 0 ? "transparent" : (isDarkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)") }}>
                    <View style={{ flex: 2 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: "600", color: C.textPrimary }} numberOfLines={1}>
                        {item.product_name || (item as any).product?.name || `Item #${item.product_id?.substring(0,6)}`}
                      </Text>
                      <Text style={{ fontSize: 11, color: C.textSecondary, marginTop: 1 }}>
                        GST Rate: {item.tax_rate || 18}%
                      </Text>
                    </View>
                    <Text style={{ flex: 0.8, fontSize: 13.5, fontWeight: "600", color: C.textPrimary, textAlign: "right" }}>
                      {item.quantity}
                    </Text>
                    <Text style={{ flex: 1, fontSize: 13.5, color: C.textPrimary, textAlign: "right" }}>
                      ₹{Number(item.unit_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </Text>
                    <Text style={{ flex: 1.2, fontSize: 14, fontWeight: "700", color: C.textPrimary, textAlign: "right" }}>
                      ₹{lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Financial Summary Card */}
            <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 16, backgroundColor: C.card, gap: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: C.textSecondary, letterSpacing: 0.8 }}>FINANCIAL BREAKDOWN</Text>
              
              <View style={styles.totalRow}>
                <Text style={{ fontSize: 13.5, color: C.textSecondary }}>Subtotal</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: C.textPrimary }}>
                  ₹{Number(selectedNote?.subtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              </View>

              <View style={styles.totalRow}>
                <Text style={{ fontSize: 13.5, color: C.textSecondary }}>CGST (50%)</Text>
                <Text style={{ fontSize: 14, color: C.textPrimary }}>
                  ₹{(Number(selectedNote?.tax_amount || 0) / 2).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              </View>

              <View style={styles.totalRow}>
                <Text style={{ fontSize: 13.5, color: C.textSecondary }}>SGST (50%)</Text>
                <Text style={{ fontSize: 14, color: C.textPrimary }}>
                  ₹{(Number(selectedNote?.tax_amount || 0) / 2).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              </View>

              <View style={{ height: 1, backgroundColor: C.divider, marginVertical: 4 }} />

              <View style={styles.totalRow}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: C.textPrimary }}>NET RETURN VALUE</Text>
                <Text style={{ fontSize: 20, fontWeight: "900", color: C.accent, fontFamily: "Segoe UI Variable Display" }}>
                  ₹{Number(selectedNote?.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            {/* Danger Delete Actions */}
            <Pressable
              onPress={() => handleDelete(selectedNote!.id)}
              style={({ hovered }: any) => [
                styles.deleteBtn,
                { borderColor: C.btnDanger, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 42 },
                hovered && { backgroundColor: isDarkMode ? "rgba(239,68,68,0.15)" : "#FEE2E2" }
              ]}
            >
              <Text style={{ fontFamily: "Segoe MDL2 Assets", color: C.btnDanger, fontSize: 14, fontWeight: "bold" }}>{"\uE74D"}</Text>
              <Text style={{ color: C.btnDanger, fontWeight: "700", fontSize: 14.5 }}>Delete Return Note</Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {/* ─── FULL SCREEN CREATION WORKSPACE ─── */}
      <FullScreenModal
        isOpen={isCreating}
        onClose={() => {
          setIsCreating(false);
          setFormStep(1);
          setForm(blankForm());
          setLines([blankLine()]);
        }}
        title={activeTab === "SALES" ? "Create Credit Note (Sales Return)" : "Create Debit Note (Purchase Return)"}
        subtitle="Manage inventory reversals, billing adjustments, and tax debit/credit options"
        breadcrumb={activeTab === "SALES" ? "returns / credit note" : "returns / debit note"}
        footerActions={
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flex: 1 }}>
            {/* Left side: Financial Totals Bar */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <View>
                <Text style={{ fontSize: 12, fontWeight: "700", color: C.textSecondary, letterSpacing: 0.5 }}>SUBTOTAL</Text>
                <Text style={{ fontSize: 16.5, fontWeight: "800", color: C.textPrimary, fontFamily: "Segoe UI Variable Display" }}>
                  ₹{totals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{ width: 1, height: 26, backgroundColor: C.border }} />
              <View>
                <Text style={{ fontSize: 12, fontWeight: "700", color: C.textSecondary, letterSpacing: 0.5 }}>CGST (+)</Text>
                <Text style={{ fontSize: 16.5, fontWeight: "800", color: C.textPrimary, fontFamily: "Segoe UI Variable Display" }}>
                  ₹{totals.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{ width: 1, height: 26, backgroundColor: C.border }} />
              <View>
                <Text style={{ fontSize: 12, fontWeight: "700", color: C.textSecondary, letterSpacing: 0.5 }}>SGST (+)</Text>
                <Text style={{ fontSize: 16.5, fontWeight: "800", color: C.textPrimary, fontFamily: "Segoe UI Variable Display" }}>
                  ₹{totals.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{ width: 1, height: 26, backgroundColor: C.border }} />
              <View>
                <Text style={{ fontSize: 12, fontWeight: "700", color: C.accent, letterSpacing: 0.5 }}>NET RETURN VALUE</Text>
                <Text style={{ fontSize: 19.5, fontWeight: "900", color: C.accent, fontFamily: "Segoe UI Variable Display" }}>
                  ₹{totals.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            {/* Right side: Step Navigation */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  <View style={{ width: 24, height: 4, borderRadius: 2, backgroundColor: C.accent }} />
                  <View style={{ width: 24, height: 4, borderRadius: 2, backgroundColor: formStep >= 2 ? C.accent : (isDarkMode ? "#334155" : "#E2E8F0") }} />
                </View>
                <Text style={{ fontSize: 13, fontWeight: "700", color: C.textSecondary }}>
                  STEP {formStep} OF 2
                </Text>
              </View>

              {formStep === 1 ? (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Button
                    title="Discard Return"
                    variant="secondary"
                    onPress={() => {
                      setIsCreating(false);
                      setFormStep(1);
                      setForm(blankForm());
                      setLines([blankLine()]);
                    }}
                    style={{ minWidth: 120 }}
                  />
                  <Button
                    title="Proceed to Return Items ›"
                    variant="primary"
                    onPress={() => {
                      if (!form.party_id) {
                        Alert.alert("Validation", `Please select a ${activeTab === "SALES" ? "customer" : "supplier"} before proceeding.`);
                        return;
                      }
                      setFormStep(2);
                    }}
                    style={{ minWidth: 180 }}
                  />
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Button
                    title="‹ Go Back"
                    variant="secondary"
                    onPress={() => setFormStep(1)}
                    style={{ minWidth: 110 }}
                  />
                  <Button
                    title={createMutation.isPending ? "Saving..." : `Create ${activeTab === "SALES" ? "Credit" : "Debit"} Note`}
                    variant="primary"
                    loading={createMutation.isPending}
                    loadingText="Saving Return..."
                    onPress={handleSave}
                    style={{ minWidth: 160 }}
                  />
                </View>
              )}
            </View>
          </View>
        }
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 280, gap: 20 }}>
          {formStep === 1 ? (
            /* STEP 1 LAYOUT */
            <View style={{ flexDirection: "row", gap: 20 }}>
              {/* Left Column */}
              <View style={{ flex: 1.4, gap: 14 }}>
                {/* Info row */}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="DOCUMENT NO."
                      value={activeTab === "SALES" ? "CN-2026-AUTO" : "DN-2026-AUTO"}
                      editable={false}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="REF NOTE NO."
                      value={form.note_number}
                      onChangeText={v => setForm(f => ({ ...f, note_number: v }))}
                      placeholder="e.g. RET-001"
                      editable={true}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <DatePicker
                      label="RETURN DATE *"
                      value={form.note_date}
                      onChange={v => setForm(f => ({ ...f, note_date: v }))}
                    />
                  </View>
                </View>

                {/* A/C Balance Banner */}
                {selectedPartyInfo && (
                  <View style={{ backgroundColor: isDarkMode ? "#1A2536" : "#EFF6FF", borderWidth: 1, borderColor: isDarkMode ? "#1E3A5F" : "#BFDBFE", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: C.textSecondary, letterSpacing: 0.5 }}>CURRENT A/C OUTSTANDING</Text>
                      <Text style={{ fontSize: 22, fontWeight: "900", fontFamily: "Segoe UI Variable Display", color: Number(selectedPartyInfo.outstanding_balance || 0) > 0 ? (activeTab === "SALES" ? C.accent : "#EF4444") : C.textPrimary }}>
                        ₹{Number(selectedPartyInfo.outstanding_balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: isDarkMode ? "rgba(56,189,248,0.1)" : "rgba(2,132,199,0.08)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: C.accent }}>
                        {activeTab === "SALES" ? "CUSTOMER LEDGER" : "VENDOR LEDGER"}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Party Selection */}
                <View style={{ zIndex: 100 }}>
                  <Text style={[styles.inputLabel, { color: C.textSecondary }]}>
                    {activeTab === "SALES" ? "CUSTOMER ENTITY *" : "SUPPLIER ENTITY *"}
                  </Text>
                  <Dropdown
                    inputRefProp={partyRef}
                    options={
                      activeTab === "SALES"
                        ? customers.filter(c => c.is_active !== false || c.id === form.party_id).map(c => ({ value: c.id, label: c.name, sublabel: c.gst_number || c.phone }))
                        : suppliers.filter(s => s.is_active !== false || s.id === form.party_id).map(s => ({ value: s.id, label: s.name, sublabel: s.gst_number || s.phone }))
                    }
                    value={form.party_id}
                    onChange={(val) => setForm(f => ({ ...f, party_id: val || "", ref_id: "" }))}
                    placeholder={activeTab === "SALES" ? "Search & select registered customer..." : "Search & select registered supplier..."}
                    autoFocus={true}
                  />
                </View>

                {/* Return Purpose & Settlement Type Selector */}
                <View>
                  <Text style={[styles.inputLabel, { color: C.textSecondary }]}>RETURN PURPOSE / SETTLEMENT TYPE</Text>
                  <View style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
                    <Pressable
                      onPress={() => setForm(f => ({ ...f, return_mode: "GOODS_RETURN" }))}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: form.return_mode === "GOODS_RETURN" ? C.accent : C.border,
                        backgroundColor: form.return_mode === "GOODS_RETURN" ? (isDarkMode ? "rgba(56,189,248,0.15)" : "#E0F2FE") : C.card,
                        alignItems: "center"
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "700", color: form.return_mode === "GOODS_RETURN" ? C.accent : C.textPrimary }}>
                        📦 Goods / Specific Item Return
                      </Text>
                      <Text style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>
                        Restores stock & reduces balance
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setForm(f => ({ ...f, return_mode: "FINANCIAL_ADJUSTMENT" }))}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: form.return_mode === "FINANCIAL_ADJUSTMENT" ? C.accent : C.border,
                        backgroundColor: form.return_mode === "FINANCIAL_ADJUSTMENT" ? (isDarkMode ? "rgba(56,189,248,0.15)" : "#E0F2FE") : C.card,
                        alignItems: "center"
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "700", color: form.return_mode === "FINANCIAL_ADJUSTMENT" ? C.accent : C.textPrimary }}>
                        💳 Financial / Payment Settlement
                      </Text>
                      <Text style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>
                        Adjusts ledger/invoice (No stock change)
                      </Text>
                    </Pressable>
                  </View>
                </View>
                <View style={{ zIndex: 90 }}>
                  <Text style={[styles.inputLabel, { color: C.textSecondary }]}>
                    {activeTab === "SALES" ? "LINKED SALES INVOICE (OPTIONAL)" : "LINKED PURCHASE BILL (OPTIONAL)"}
                  </Text>
                  <Dropdown
                    inputRefProp={refDocRef}
                    options={filteredRefDocs.map((d: any) => ({
                      value: d.id,
                      label: activeTab === "SALES" ? d.invoice_number : d.bill_number,
                      sublabel: `Date: ${toUIDate(d.invoice_date || d.bill_date || "")} | Total: ₹${Number(d.total || 0).toLocaleString("en-IN")}`
                    }))}
                    value={form.ref_id}
                    onChange={handleRefDocChange}
                    placeholder={activeTab === "SALES" ? "Select linked invoice to auto-load return items..." : "Select linked bill to auto-load return items..."}
                  />
                </View>

                {/* Reason for Return Input & Quick Pills */}
                <View>
                  <Text style={[styles.inputLabel, { color: C.textSecondary }]}>REASON FOR RETURN</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {["Defective Goods", "Rate Difference", "Stock Return", "Transit Damage", "Expired Stock"].map((pill, pIdx) => (
                      <Pressable
                        key={pIdx}
                        onPress={() => setForm(f => ({ ...f, reason: pill }))}
                        style={{
                          backgroundColor: form.reason === pill ? C.accent : (isDarkMode ? "#334155" : "#E2E8F0"),
                          borderRadius: 14,
                          paddingHorizontal: 10,
                          paddingVertical: 4
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "600", color: form.reason === pill ? "#FFFFFF" : C.textPrimary }}>
                          {pill}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    ref={reasonRef}
                    style={[styles.input, { color: C.textPrimary, backgroundColor: C.inputBg, borderColor: C.inputBorder, height: 38 }]}
                    value={form.reason}
                    onChangeText={t => setForm(f => ({ ...f, reason: t }))}
                    placeholder="e.g. Defective Goods, Rate Difference"
                    placeholderTextColor={C.textSecondary}
                  />
                </View>

                {/* Party Billing Details Card */}
                {selectedPartyInfo ? (
                  <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 16, backgroundColor: C.card }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: C.textSecondary, letterSpacing: 0.8, marginBottom: 6 }}>ENTITY DETAILS</Text>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: C.textPrimary }}>{selectedPartyInfo.name}</Text>
                    <View style={{ height: 1, backgroundColor: C.divider, marginVertical: 8 }} />
                    <Text style={{ fontSize: 13.5, color: C.textSecondary }}>GSTIN: {selectedPartyInfo.gst_number || "Unregistered"}</Text>
                    <Text style={{ fontSize: 13.5, color: C.textSecondary, marginTop: 2 }}>Phone: {selectedPartyInfo.phone || selectedPartyInfo.mobile_no || "—"}</Text>
                  </View>
                ) : (
                  <View style={{ borderWidth: 1, borderColor: C.border, borderStyle: "dashed", borderRadius: 8, padding: 20, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 14, color: C.textSecondary }}>Select a {activeTab === "SALES" ? "customer" : "supplier"} above to load details</Text>
                  </View>
                )}
              </View>

              {/* Right Column: GST Applied Strip */}
              <View style={{ flex: 1, gap: 14 }}>
                <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 8, backgroundColor: C.card, padding: 16, gap: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: C.accent, letterSpacing: 0.8 }}>GST APPLIED (STANDARD SPLITS)</Text>
                  <View style={{ flexDirection: "row" }}>
                    <View style={{ flex: 1, paddingRight: 12, borderRightWidth: 1, borderRightColor: C.border }}>
                      <Text style={{ fontSize: 13, color: C.textSecondary }}>TOTAL TAX</Text>
                      <Text style={{ fontSize: 26, fontWeight: "900", color: C.accent }}>18%</Text>
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 12, borderRightWidth: 1, borderRightColor: C.border }}>
                      <Text style={{ fontSize: 13, color: C.textSecondary }}>CGST</Text>
                      <Text style={{ fontSize: 24, fontWeight: "800", color: C.textPrimary }}>9%</Text>
                    </View>
                    <View style={{ flex: 1, paddingLeft: 12 }}>
                      <Text style={{ fontSize: 13, color: C.textSecondary }}>SGST</Text>
                      <Text style={{ fontSize: 24, fontWeight: "800", color: C.textPrimary }}>9%</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, color: C.textSecondary }}>Automatic 50/50 CGST & SGST splits for intra-state returns</Text>
                </View>
              </View>
            </View>
          ) : (
            /* STEP 2 LAYOUT */
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                <View style={{ width: 4, height: 28, backgroundColor: C.accent, marginRight: 10, borderRadius: 2 }} />
                <View>
                  <Text style={{ fontSize: 22, fontWeight: "700", color: C.textSecondary, letterSpacing: 1 }}>SECTION 02 — SPECIFY RETURN LINE ITEMS</Text>
                  <Text style={{ fontSize: 15, fontWeight: "500", color: C.textSecondary }}>
                    SELECT PRODUCTS, QUANTITIES, AND RATES TO CREDIT / DEBIT.
                  </Text>
                </View>
              </View>

              {/* Table Header */}
              <View style={[styles.lineHead, { backgroundColor: C.tableHead, borderColor: C.border, borderRadius: 6, marginBottom: 6 }]}>
                <Text style={[styles.lineThCell, { flex: 0.5, color: C.textSecondary, textAlign: "center" }]}>#</Text>
                <Text style={[styles.lineThCell, { flex: 3.5, color: C.textSecondary }]}>PRODUCT / ITEM NAME</Text>
                <Text style={[styles.lineThCell, { flex: 1, color: C.textSecondary, textAlign: "right" }]}>QTY</Text>
                <Text style={[styles.lineThCell, { flex: 1.2, color: C.textSecondary, textAlign: "right" }]}>RATE (₹)</Text>
                <Text style={[styles.lineThCell, { flex: 1, color: C.textSecondary, textAlign: "right" }]}>TAX (%)</Text>
                <Text style={[styles.lineThCell, { flex: 1.5, color: C.textSecondary, textAlign: "right" }]}>LINE TOTAL (₹)</Text>
                <View style={{ width: 36 }} />
              </View>

              {/* Line rows */}
              {lines.map((line, idx) => {
                const lineBase = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
                const lineTax = lineBase * ((Number(line.tax_rate) || 0) / 100);
                const lineTotal = lineBase + lineTax;

                return (
                  <View key={idx} style={[styles.lineInputRow, { borderColor: C.border, marginBottom: 6, zIndex: 1000 - idx, alignItems: "center", overflow: "visible", paddingHorizontal: 12, gap: 10 }]}>
                    <Text style={{ flex: 0.5, textAlign: "center", fontSize: 16, color: C.textSecondary, fontWeight: "700" }}>
                      {String(idx + 1).padStart(2, "0")}
                    </Text>

                    <View style={{ flex: 3.5, zIndex: 1000 - idx, overflow: "visible" }}>
                      <Dropdown
                        ref={el => { productRefs.current[idx] = el; }}
                        options={products.filter(p => p.is_active !== false || p.id === line.product_id).map(p => ({
                          value: p.id,
                          label: p.name,
                          sublabel: `Price: ₹${p.sale_price} | Tax: ${p.tax_rate}%`
                        }))}
                        value={line.product_id}
                        onChange={(val) => {
                          const prod = products.find(p => p.id === val);
                          updateLine(idx, "product_id", val || "");
                          if (prod) {
                            updateLine(idx, "unit_price", prod.sale_price);
                            updateLine(idx, "tax_rate", prod.tax_rate);
                          }
                        }}
                        placeholder="Search product..."
                        onSubmitEditing={() => qtyRefs.current[idx]?.focus()}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <TextInput
                        ref={el => { qtyRefs.current[idx] = el; }}
                        style={[styles.input, { color: C.textPrimary, backgroundColor: C.inputBg, borderColor: C.inputBorder, textAlign: "right" }]}
                        keyboardType="numeric"
                        value={String(line.quantity)}
                        onChangeText={t => updateLine(idx, "quantity", parseFloat(t) || 0)}
                        onSubmitEditing={() => priceRefs.current[idx]?.focus()}
                      />
                    </View>

                    <View style={{ flex: 1.2 }}>
                      <TextInput
                        ref={el => { priceRefs.current[idx] = el; }}
                        style={[styles.input, { color: C.textPrimary, backgroundColor: C.inputBg, borderColor: C.inputBorder, textAlign: "right" }]}
                        keyboardType="numeric"
                        value={String(line.unit_price)}
                        onChangeText={t => updateLine(idx, "unit_price", parseFloat(t) || 0)}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <TextInput
                        style={[styles.input, { color: C.textPrimary, backgroundColor: C.inputBg, borderColor: C.inputBorder, textAlign: "right" }]}
                        keyboardType="numeric"
                        value={String(line.tax_rate)}
                        onChangeText={t => updateLine(idx, "tax_rate", parseFloat(t) || 0)}
                      />
                    </View>

                    <View style={{ flex: 1.5, alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: C.textPrimary }}>
                        ₹{lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </View>

                    <View style={{ width: 36, alignItems: "center" }}>
                      {lines.length > 1 && (
                        <Pressable onPress={() => removeLine(idx)} style={({ hovered }: any) => [hovered && { opacity: 0.7 }]}>
                          <Text style={{ fontFamily: "Segoe MDL2 Assets", fontSize: 14, color: "#EF4444" }}>{"\uE74D"}</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}

              <Pressable onPress={addLine} style={[styles.addLineBtn, { borderColor: C.accent, marginTop: 10 }]}>
                <Text style={{ color: C.accent, fontWeight: "700" }}>+ Add Return Line Item</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </FullScreenModal>

      {/* ─── PDF PREVIEW MODAL ─── */}
      <PdfPreviewModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        title={activeTab === "SALES" ? `Credit Note Voucher - ${previewNote?.note_number}` : `Debit Note Voucher - ${previewNote?.note_number}`}
        getPdfUrl={() => {
          if (!previewNote) return "";
          const baseUrl = apiClient.defaults.baseURL || "http://127.0.0.1:8000";
          return activeTab === "SALES"
            ? `${baseUrl}/api/v1/sales/credit-notes/${previewNote.id}/pdf`
            : `${baseUrl}/api/v1/purchase/debit-notes/${previewNote.id}/pdf`;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
  },
  card: {
    borderWidth: 1,
    borderRadius: 8,
  },
  addLineBtn: {
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 6,
    borderStyle: "dashed",
    alignItems: "center",
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
  tabHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  subtab: {
    paddingVertical: 8,
    marginRight: 20,
  },
  subtabText: {
    fontSize: 15,
    fontWeight: "700",
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
  tableHead: {
    flexDirection: "row",
    height: 32,
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  thCell: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    fontFamily: "Segoe UI Variable Display",
  },
  tableRow: {
    flexDirection: "row",
    height: 48,
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    position: "relative",
  },
  activeBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  tdCell: {
    fontSize: 15.5,
    fontFamily: "Segoe UI Variable Text",
  },
  loaderWrap: {
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  loaderText: {
    fontSize: 14,
  },
  emptyWrap: {
    padding: 48,
    alignItems: "center",
    gap: 8,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyText: {
    fontSize: 16.5,
    fontWeight: "600",
  },
  detailPanel: {
    flex: 0.55,
    borderLeftWidth: 1,
  },
  detailScroll: {
    paddingBottom: 40,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Display",
  },
  closeBtn: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    height: 34,
    paddingHorizontal: 8,
    fontSize: 14.5,
  },
  lineHead: {
    flexDirection: "row",
    height: 38,
    alignItems: "center",
    borderBottomWidth: 1,
    paddingHorizontal: 12,
  },
  lineThCell: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    fontFamily: "Segoe UI Variable Display",
  },
  lineInputRow: {
    flexDirection: "row",
    minHeight: 48,
    alignItems: "center",
    borderBottomWidth: 1,
    paddingHorizontal: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailContainer: {
    gap: 16,
  },
  detailMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    paddingBottom: 10,
  },
  detailMetaLabel: {
    fontSize: 13,
  },
  detailMetaVal: {
    fontSize: 16.5,
    fontWeight: "600",
    marginTop: 2,
  },
  detailSectionTitle: {
    fontSize: 16.5,
    fontWeight: "700",
    marginBottom: 10,
  },
  detailTableHead: {
    flexDirection: "row",
    height: 34,
    alignItems: "center",
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  detailTableRow: {
    flexDirection: "row",
    height: 40,
    alignItems: "center",
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  detailTotals: {
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 8,
    marginTop: 16,
  },
  deleteBtn: {
    marginTop: 24,
    height: 40,
    borderWidth: 1,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  }
});
