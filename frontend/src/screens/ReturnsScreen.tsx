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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/client";
import { DataTable, ColumnDefinition } from "../components/ui/DataTable";
import { SearchToolbar } from "../components/ui/SearchToolbar";
import { FullScreenModal } from "../components/ui/FullScreenModal";
import { Dropdown } from "../components/ui/Dropdown";
import { Button } from "../components/ui/Button";
import { DatePicker } from "../components/ui/DatePicker";

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
}

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sale_price: number;
  tax_rate: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
}

interface PurchaseBill {
  id: string;
  bill_number: string;
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

export default function ReturnsScreen() {
  const { isDarkMode } = useUIStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"SALES" | "PURCHASE">("SALES");
  const [selectedNote, setSelectedNote] = useState<ReturnNote | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form states
  const [form, setForm] = useState({
    party_id: "",
    ref_id: "",
    note_date: toUIDate(new Date().toISOString().split("T")[0]),
    reason: "",
  });
  const [lines, setLines] = useState<ReturnItem[]>([{
    product_id: "",
    quantity: 1,
    unit_price: 0,
    tax_rate: 18,
  }]);

  const partyRef = useRef<TextInput>(null);
  const refDocRef = useRef<TextInput>(null);
  const noteDateRef = useRef<TextInput>(null);
  const reasonRef = useRef<TextInput>(null);

  const productRefs = useRef<any>([]);
  const qtyRefs = useRef<any>([]);
  const priceRefs = useRef<any>([]);

  useEffect(() => {
    if (isCreating && form.party_id) {
      setTimeout(() => {
        refDocRef.current?.focus();
      }, 50);
    }
  }, [form.party_id, isCreating]);

  useEffect(() => {
    if (isCreating && form.ref_id) {
      setTimeout(() => {
        noteDateRef.current?.focus();
      }, 50);
    }
  }, [form.ref_id, isCreating]);

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
  const { data: creditNotes = [], isLoading: loadingCredit } = useQuery<ReturnNote[]>({
    queryKey: ["credit_notes"],
    queryFn: async () => {
      const res = await apiClient.get("/api/sales/credit-notes");
      return res.data;
    },
    enabled: activeTab === "SALES",
  });

  // ── Query: Fetch Debit Notes (Purchase Returns) ──
  const { data: debitNotes = [], isLoading: loadingDebit } = useQuery<ReturnNote[]>({
    queryKey: ["debit_notes"],
    queryFn: async () => {
      const res = await apiClient.get("/api/purchase/debit-notes");
      return res.data;
    },
    enabled: activeTab === "PURCHASE",
  });

  // ── Query: Fetch dropdown entities ──
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await apiClient.get("/api/customers");
      return res.data;
    },
    enabled: isCreating && activeTab === "SALES",
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const res = await apiClient.get("/api/suppliers");
      return res.data;
    },
    enabled: isCreating && activeTab === "PURCHASE",
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["invoices"],
    queryFn: async () => {
      const res = await apiClient.get("/api/sales/invoices");
      return res.data;
    },
    enabled: isCreating && activeTab === "SALES",
  });

  const { data: bills = [] } = useQuery<PurchaseBill[]>({
    queryKey: ["bills"],
    queryFn: async () => {
      const res = await apiClient.get("/api/purchase/bills");
      return res.data;
    },
    enabled: isCreating && activeTab === "PURCHASE",
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await apiClient.get("/api/inventory/products");
      return res.data;
    },
    enabled: isCreating,
  });

  // ── Mutation: Create Return ──
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const endpoint = activeTab === "SALES" 
        ? "/api/sales/credit-notes" 
        : "/api/purchase/debit-notes";
      const res = await apiClient.post(endpoint, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activeTab === "SALES" ? "credit_notes" : "debit_notes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_kpis"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_sales_trend"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_liquidity"] });
      setIsCreating(false);
      setSelectedNote(null);
      setForm({ party_id: "", ref_id: "", note_date: toUIDate(new Date().toISOString().split("T")[0]), reason: "" });
      setLines([{ product_id: "", quantity: 1, unit_price: 0, tax_rate: 18 }]);
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
      queryClient.invalidateQueries({ queryKey: [activeTab === "SALES" ? "credit_notes" : "debit_notes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_kpis"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_sales_trend"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_liquidity"] });
      setSelectedNote(null);
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.detail || "Failed to delete return note.");
    },
  });

  // ── Computed totals ──
  const totals = useMemo(() => {
    let sub = 0, tax = 0;
    lines.forEach(l => {
      const base = l.quantity * l.unit_price;
      sub += base;
      tax += base * (l.tax_rate / 100);
    });
    return { subtotal: sub, tax, total: sub + tax };
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

  // ── Handlers ──
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
          items: lines.map(l => ({
            product_id: l.product_id,
            quantity: l.quantity,
            unit_price: l.unit_price,
            tax_rate: l.tax_rate,
          })),
        }
      : {
          supplier_id: form.party_id,
          bill_id: form.ref_id || null,
          note_date: toISODate(form.note_date) + "T12:00:00",
          reason: form.reason,
          items: lines.map(l => ({
            product_id: l.product_id,
            quantity: l.quantity,
            unit_price: l.unit_price,
            tax_rate: l.tax_rate,
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
      (next[idx] as any)[key] = val;
      if (key === "product_id") {
        const prod = products.find(p => p.id === val);
        if (prod) {
          next[idx].unit_price = prod.sale_price;
          next[idx].tax_rate = prod.tax_rate;
          next[idx].product_name = prod.name;
        }
      }
      return next;
    });
  }

  function addLine() {
    setLines(prev => [...prev, { product_id: "", quantity: 1, unit_price: 0, tax_rate: 18 }]);
  }

  function removeLine(idx: number) {
    setLines(prev => prev.filter((_, i) => i !== idx));
  }

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      
      {/* LEFT PANEL: Returns List */}
      <View
        style={[
          styles.listPanel,
          (selectedNote && !isCreating) && styles.listPanelSplit,
          (selectedNote && !isCreating) && { borderRightColor: C.border },
        ]}
      >
        
        {/* Toggle subtabs */}
        <View style={[styles.tabHeader, { borderBottomColor: C.border }]}>
          <Pressable
            onPress={() => { setActiveTab("SALES"); setSelectedNote(null); setIsCreating(false); }}
            style={[styles.subtab, activeTab === "SALES" && { borderBottomWidth: 2, borderBottomColor: C.accent }]}
          >
            <Text style={[styles.subtabText, { color: activeTab === "SALES" ? C.accent : C.textSecondary }]}>Sales Returns</Text>
          </Pressable>
          <Pressable
            onPress={() => { setActiveTab("PURCHASE"); setSelectedNote(null); setIsCreating(false); }}
            style={[styles.subtab, activeTab === "PURCHASE" && { borderBottomWidth: 2, borderBottomColor: C.accent }]}
          >
            <Text style={[styles.subtabText, { color: activeTab === "PURCHASE" ? C.accent : C.textSecondary }]}>Purchase Returns</Text>
          </Pressable>
        </View>

        {/* Header Block */}
        <View style={styles.header}>
          <Text style={[styles.breadcrumb, { color: C.accent }]}>RETURNS / NOTES</Text>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: C.textPrimary }]}>
              {activeTab === "SALES" ? "Credit Notes" : "Debit Notes"}
            </Text>
            <Pressable
              onPress={() => { setIsCreating(true); setSelectedNote(null); }}
              style={({ hovered, pressed }: any) => [
                styles.newBtn,
                { backgroundColor: hovered ? C.btnPrimaryHover : C.btnPrimary },
                pressed && { transform: [{ scale: 0.98 }] }
              ]}
            >
              <Text style={styles.newBtnText}>+ Create Return</Text>
            </Pressable>
          </View>
          <Text style={[styles.subtitle, { color: C.textSecondary }]}>
            Manage customer credit notes and supplier debit notes, track returned items, and reconcile balances.
          </Text>
        </View>

        {/* Search */}
        <SearchToolbar
          placeholder="Search return number or party..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {/* Table List View */}
        <DataTable
          data={filteredNotes}
          columns={[
            {
              header: "NOTE #",
              accessorKey: "note_number",
              flex: 1.4,
              render: (row) => (
                <Text style={[styles.tdCell, { color: C.textPrimary, fontWeight: "600" }]} numberOfLines={1}>
                  {row.note_number}
                </Text>
              )
            },
            {
              header: "PARTY",
              accessorKey: "party_name",
              flex: 1.8,
              render: (row) => {
                const partyName = activeTab === "SALES" ? row.customer?.name : row.supplier?.name;
                return (
                  <Text style={[styles.tdCell, { color: C.textPrimary }]} numberOfLines={1}>
                    {partyName || "—"}
                  </Text>
                );
              }
            },
            {
              header: "DATE",
              accessorKey: "note_date",
              flex: 0.9,
              render: (row) => (
                <Text style={[styles.tdCell, { color: C.textSecondary, fontSize: 13 }]}>
                  {toUIDate(row.note_date)}
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
                const badgeBg = row.status === "PAID" || row.status === "APPROVED" ? (isDarkMode ? "#14532D" : "#DCFCE7") : (isDarkMode ? "#713F12" : "#FEF9C3");
                const badgeText = row.status === "PAID" || row.status === "APPROVED" ? (isDarkMode ? "#4ADE80" : "#16A34A") : (isDarkMode ? "#FDE047" : "#A16207");
                return (
                  <View style={{ alignItems: "center" }}>
                    <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                      <Text style={[styles.statusBadgeText, { color: badgeText }]}>
                        {row.status || "CONFIRMED"}
                      </Text>
                    </View>
                  </View>
                );
              }
            }
          ]}
          isLoading={activeTab === "SALES" ? loadingCredit : loadingDebit}
          onRowPress={(item) => {
            setSelectedNote(item);
            setIsCreating(false);
          }}
          selectedId={selectedNote?.id}
          emptyMessage="No return records found"
          loaderMessage="Loading returns..."
        />
      </View>

      {/* RIGHT PANEL: Details/Forms */}
      {selectedNote && !isCreating && (
        <View style={[styles.detailPanel, { backgroundColor: C.card, borderLeftColor: C.border }]}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.detailScroll}>
            
            <View style={[styles.detailHeader, { borderBottomColor: C.border }]}>
              <Text style={[styles.detailTitle, { color: C.textPrimary }]}>
                Return Note {selectedNote?.note_number}
              </Text>
              <Pressable
                onPress={() => setSelectedNote(null)}
                style={styles.closeBtn}
              >
                <Text style={{ color: C.textSecondary, fontSize: 18.5 }}>×</Text>
              </Pressable>
            </View>

            {/* DETAIL CARD VIEW */}
            <View style={styles.detailContainer}>
              
              <View style={[styles.detailMetaRow, { borderBottomColor: C.border }]}>
                <View>
                  <Text style={[styles.detailMetaLabel, { color: C.textSecondary }]}>
                    {activeTab === "SALES" ? "Customer" : "Supplier"}
                  </Text>
                  <Text style={[styles.detailMetaVal, { color: C.textPrimary }]}>
                    {activeTab === "SALES" ? selectedNote?.customer?.name : selectedNote?.supplier?.name}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.detailMetaLabel, { color: C.textSecondary }]}>Note Date</Text>
                  <Text style={[styles.detailMetaVal, { color: C.textPrimary }]}>{toUIDate(selectedNote?.note_date || "")}</Text>
                </View>
              </View>

              <View style={[styles.detailMetaRow, { borderBottomColor: C.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailMetaLabel, { color: C.textSecondary }]}>Reason for Return</Text>
                  <Text style={[styles.detailMetaVal, { color: C.textPrimary }]}>{selectedNote?.reason || "—"}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.detailMetaLabel, { color: C.textSecondary }]}>Status</Text>
                  <Text style={[styles.detailMetaVal, { color: C.accent }]}>{selectedNote?.status}</Text>
                </View>
              </View>

              {/* Items details table */}
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.detailSectionTitle, { color: C.textPrimary }]}>Returned Items</Text>
                <View style={[styles.detailTableHead, { backgroundColor: C.tableHead, borderBottomColor: C.border }]}>
                  <Text style={{ flex: 2.5, color: C.textSecondary, fontWeight: "600" }}>PRODUCT</Text>
                  <Text style={{ flex: 1, color: C.textSecondary, fontWeight: "600", textAlign: "center" }}>QTY</Text>
                  <Text style={{ flex: 1.2, color: C.textSecondary, fontWeight: "600", textAlign: "right" }}>UNIT PRICE</Text>
                  <Text style={{ flex: 1.2, color: C.textSecondary, fontWeight: "600", textAlign: "right" }}>TOTAL</Text>
                </View>

                {selectedNote?.items?.map((item, idx) => (
                  <View key={idx} style={[styles.detailTableRow, { borderBottomColor: C.divider }]}>
                    <Text style={{ flex: 2.5, color: C.textPrimary }} numberOfLines={1}>{item.product_name || "Returned Product"}</Text>
                    <Text style={{ flex: 1, color: C.textPrimary, textAlign: "center" }}>{item.quantity}</Text>
                    <Text style={{ flex: 1.2, color: C.textPrimary, textAlign: "right" }}>₹{Number(item.unit_price).toFixed(2)}</Text>
                    <Text style={{ flex: 1.2, color: C.textPrimary, textAlign: "right", fontWeight: "600" }}>₹{Number(item.total || 0).toFixed(2)}</Text>
                  </View>
                ))}
              </View>

              {/* Grand Totals */}
              <View style={[styles.detailTotals, { borderTopColor: C.border }]}>
                <View style={styles.totalRow}><Text style={{ color: C.textSecondary }}>Subtotal</Text><Text style={{ color: C.textPrimary }}>₹{Number(selectedNote?.subtotal || 0).toFixed(2)}</Text></View>
                <View style={styles.totalRow}><Text style={{ color: C.textSecondary }}>Tax (GST)</Text><Text style={{ color: C.textPrimary }}>₹{Number(selectedNote?.tax_amount || 0).toFixed(2)}</Text></View>
                <View style={styles.totalRow}><Text style={{ color: C.textPrimary, fontWeight: "700" }}>Total Note Value</Text><Text style={{ color: C.textPrimary, fontWeight: "700", fontSize: 18.5 }}>₹{Number(selectedNote?.total || 0).toFixed(2)}</Text></View>
              </View>

              {/* Danger Delete Actions */}
              <Pressable
                onPress={() => handleDelete(selectedNote!.id)}
                style={[styles.deleteBtn, { borderColor: C.btnDanger }]}
              >
                <Text style={{ color: C.btnDanger, fontWeight: "700" }}>Delete Return Note</Text>
              </Pressable>

            </View>
          </ScrollView>
        </View>
      )}

      {/* FULL SCREEN RETURNS CREATION WORKSPACE */}
      <FullScreenModal
        isOpen={isCreating}
        onClose={() => { setIsCreating(false); setForm({ party_id: "", ref_id: "", note_date: toUIDate(new Date().toISOString().split("T")[0]), reason: "" }); setLines([{ product_id: "", quantity: 1, unit_price: 0, tax_rate: 18 }]); }}
        title={activeTab === "SALES" ? "Create Credit Note (Sales Return)" : "Create Debit Note (Purchase Return)"}
        subtitle="Manage inventory reversals, billing adjustments, and tax debit options"
        breadcrumb={activeTab === "SALES" ? "returns / credit note" : "returns / debit note"}
        footerActions={
          <>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => { setIsCreating(false); setForm({ party_id: "", ref_id: "", note_date: toUIDate(new Date().toISOString().split("T")[0]), reason: "" }); setLines([{ product_id: "", quantity: 1, unit_price: 0, tax_rate: 18 }]); }}
              style={{ minWidth: 100 }}
            />
            <Button
              title={createMutation.isPending ? "Saving..." : `Create ${activeTab === "SALES" ? "Credit" : "Debit"} Note`}
              variant="primary"
              disabled={createMutation.isPending}
              onPress={handleSave}
              style={{ minWidth: 140 }}
            />
          </>
        }
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 20 }}>
          {/* Section 1: Party Details */}
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, padding: 20, gap: 16, zIndex: 100 }]}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: C.textPrimary }}>Return metadata</Text>
            
            <View style={{ flexDirection: "row", gap: 16, zIndex: 110 }}>
              <View style={{ flex: 1, zIndex: 120 }}>
                <Text style={[styles.inputLabel, { color: C.textSecondary, marginBottom: 6 }]}>
                  {activeTab === "SALES" ? "CUSTOMER *" : "SUPPLIER (VENDOR) *"}
                </Text>
                <Dropdown
                  inputRefProp={partyRef}
                  options={
                    activeTab === "SALES"
                      ? customers.map(c => ({ value: c.id, label: c.name, sublabel: c.gst_number || c.phone }))
                      : suppliers.map(s => ({ value: s.id, label: s.name, sublabel: s.gst_number || s.phone }))
                  }
                  value={form.party_id}
                  onChange={(val) => setForm(f => ({ ...f, party_id: val || "" }))}
                  placeholder={activeTab === "SALES" ? "Select Customer..." : "Select Supplier..."}
                  autoFocus={true}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: C.textSecondary, marginBottom: 6 }]}>
                  {activeTab === "SALES" ? "LINKED INVOICE" : "LINKED BILL"}
                </Text>
                <Dropdown
                  inputRefProp={refDocRef}
                  options={
                    activeTab === "SALES"
                      ? invoices.map(i => ({ value: i.id, label: i.invoice_number }))
                      : bills.map(b => ({ value: b.id, label: b.bill_number }))
                  }
                  value={form.ref_id}
                  onChange={(val) => setForm(f => ({ ...f, ref_id: val || "" }))}
                  placeholder="Select Linked Document..."
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 16 }}>
              <View style={{ flex: 1 }}>
                <DatePicker
                  label="RETURN DATE *"
                  value={form.note_date}
                  onChange={t => setForm(f => ({ ...f, note_date: t }))}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: C.textSecondary, marginBottom: 6 }]}>REASON FOR RETURN</Text>
                <TextInput
                  ref={reasonRef}
                  style={[styles.input, { color: C.textPrimary, backgroundColor: C.inputBg, borderColor: C.inputBorder }]}
                  value={form.reason}
                  onChangeText={t => setForm(f => ({ ...f, reason: t }))}
                  placeholder="e.g. Defective Goods, Rate Difference"
                  placeholderTextColor={C.textSecondary}
                />
              </View>
            </View>
          </View>

          {/* Section 2: Items list */}
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, padding: 20, zIndex: 90 }]}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: C.textPrimary, marginBottom: 16 }}>Items to Return</Text>

            {lines.map((line, idx) => (
              <View key={idx} style={{ flexDirection: "row", gap: 12, alignItems: "flex-end", borderBottomWidth: 1, borderBottomColor: C.divider, paddingBottom: 16, marginBottom: 16, zIndex: 100 - idx }}>
                <View style={{ width: 28, justifyContent: "flex-end", paddingBottom: 10 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: C.textSecondary, textAlign: "center" }}>
                    {String(idx + 1).padStart(2, "0")}
                  </Text>
                </View>
                <View style={{ flex: 2, zIndex: 110 - idx }}>
                  <Text style={[styles.inputLabel, { color: C.textSecondary, marginBottom: 6 }]}>Select Product *</Text>
                  <Dropdown
                    ref={el => { productRefs.current[idx] = el; }}
                    options={products.map(p => ({ value: p.id, label: p.name, sublabel: `Price: ₹${p.sale_price} | Tax: ${p.tax_rate}%` }))}
                    value={line.product_id}
                    onChange={(val) => {
                      const prod = products.find(p => p.id === val);
                      updateLine(idx, "product_id", val || "");
                      if (prod) {
                        updateLine(idx, "unit_price", prod.sale_price);
                        updateLine(idx, "tax_rate", prod.tax_rate);
                      }
                    }}
                    placeholder="Select product..."
                    onSubmitEditing={() => {
                      qtyRefs.current[idx]?.focus();
                    }}
                  />
                </View>

                <View style={{ flex: 0.6 }}>
                  <Text style={[styles.inputLabel, { color: C.textSecondary, marginBottom: 6 }]}>Qty</Text>
                  <TextInput
                    ref={el => { qtyRefs.current[idx] = el; }}
                    style={[styles.input, { color: C.textPrimary, backgroundColor: C.inputBg, borderColor: C.inputBorder }]}
                    keyboardType="numeric"
                    value={String(line.quantity)}
                    onChangeText={t => updateLine(idx, "quantity", parseFloat(t) || 0)}
                    onSubmitEditing={() => priceRefs.current[idx]?.focus()}
                  />
                </View>

                <View style={{ flex: 0.8 }}>
                  <Text style={[styles.inputLabel, { color: C.textSecondary, marginBottom: 6 }]}>Unit Cost</Text>
                  <TextInput
                    ref={el => { priceRefs.current[idx] = el; }}
                    style={[styles.input, { color: C.textPrimary, backgroundColor: C.inputBg, borderColor: C.inputBorder }]}
                    keyboardType="numeric"
                    value={String(line.unit_price)}
                    onChangeText={t => updateLine(idx, "unit_price", parseFloat(t) || 0)}
                    onSubmitEditing={() => {
                      if (idx === lines.length - 1) {
                        addLine();
                        setTimeout(() => {
                          productRefs.current[idx + 1]?.focus();
                        }, 80);
                      } else {
                        productRefs.current[idx + 1]?.focus();
                      }
                    }}
                  />
                </View>

                <View style={{ flex: 0.8, justifyContent: "center", height: 38 }}>
                  <Text style={[styles.inputLabel, { color: C.textSecondary, marginBottom: 2 }]}>Total</Text>
                  <Text style={{ fontSize: 14.5, fontWeight: "600", color: C.textPrimary }}>
                    ₹{(line.quantity * line.unit_price * (1 + line.tax_rate / 100)).toFixed(2)}
                  </Text>
                </View>

                {lines.length > 1 && (
                  <Pressable
                    onPress={() => removeLine(idx)}
                    style={{ height: 38, justifyContent: "center", paddingHorizontal: 8 }}
                  >
                    <Text style={{ color: C.btnDanger, fontSize: 13, fontWeight: "600" }}>Remove</Text>
                  </Pressable>
                )}
              </View>
            ))}

            <Pressable onPress={addLine} style={[styles.addLineBtn, { borderColor: C.accent, marginTop: 8 }]}>
              <Text style={{ color: C.accent, fontWeight: "600" }}>+ Add Item Line</Text>
            </Pressable>
          </View>

          {/* Section 3: Summary details */}
          <View style={{ flexDirection: "row", gap: 20 }}>
            <View style={{ flex: 1.5 }} />

            <View style={[styles.card, { flex: 1, backgroundColor: C.card, borderColor: C.border, padding: 20, gap: 10 }]}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: C.textPrimary }}>Return Financial Summary</Text>
              <View style={styles.totalRow}><Text style={{ color: C.textSecondary }}>Subtotal</Text><Text style={{ color: C.textPrimary }}>₹{totals.subtotal.toFixed(2)}</Text></View>
              <View style={styles.totalRow}><Text style={{ color: C.textSecondary }}>Tax (GST)</Text><Text style={{ color: C.textPrimary }}>₹{totals.tax.toFixed(2)}</Text></View>
              <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: C.divider, paddingTop: 10 }]}><Text style={{ color: C.textPrimary, fontWeight: "700" }}>Grand Total</Text><Text style={{ color: C.accent, fontWeight: "900", fontSize: 20 }}>₹{totals.total.toFixed(2)}</Text></View>
            </View>
          </View>
        </ScrollView>
      </FullScreenModal>

    </View>
  );
}

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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
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
    flex: 1.3,
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
    marginBottom: 20,
  },
  detailTitle: {
    fontSize: 21,
    fontWeight: "800",
    fontFamily: "Segoe UI Variable Display",
  },
  closeBtn: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  formContainer: {
    gap: 16,
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
    height: 32,
    paddingHorizontal: 8,
    fontSize: 15,
  },
  row: {
    flexDirection: "row",
  },
  dropdownItem: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
  },
  sectionTitle: {
    fontSize: 17.5,
    fontWeight: "700",
    marginBottom: 8,
  },
  lineRow: {
    borderBottomWidth: 1,
    paddingVertical: 12,
    gap: 10,
  },
  totalsSummary: {
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionRow: {
    marginTop: 12,
    alignItems: "flex-end",
  },
  actionBtn: {
    height: 38,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
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
