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
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return isoDateStr;
}

function toISODate(uiDateStr: string): string {
  if (!uiDateStr) return "";
  const parts = uiDateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return uiDateStr;
}

// ─── Types ────────────────────────────────────────────────────
interface Supplier {
  id: string;
  name: string;
  gst_number?: string;
  phone?: string;
  city?: string;
  state?: string;
}

interface PurchaseBillItem {
  id?: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  product_name?: string;
  total?: number;
}

interface PurchaseBill {
  id: string;
  bill_number: string;
  bill_date: string;
  due_date?: string;
  status: string;
  total: number;
  amount_paid: number;
  balance_due: number;
  supplier_bill_no?: string;
  place_of_supply?: string;
  gst_type?: string;
  supplier?: Supplier;
  supplier_id: string;
  items: PurchaseBillItem[];
}

interface Product {
  id: string;
  name: string;
  sku?: string;
  purchase_price?: number;
  sale_price: number;
  tax_rate: number;
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
    round_off_amount: "0",
  };
}

function blankLine(): PurchaseBillItem {
  return {
    product_id: "",
    quantity: 1,
    unit_price: 0,
    tax_rate: 18,
    product_name: "",
  };
}

export default function PurchasesScreen() {
  const { isDarkMode } = useUIStore();
  const queryClient = useQueryClient();

  const [selectedBill, setSelectedBill] = useState<PurchaseBill | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Form states
  const [form, setForm] = useState(blankForm());
  const [lines, setLines] = useState<PurchaseBillItem[]>([blankLine()]);

  const supplierRef = useRef<TextInput>(null);
  const billNumberRef = useRef<TextInput>(null);
  const supplierRefNoRef = useRef<TextInput>(null);
  const billDateRef = useRef<TextInput>(null);
  const dueDateRef = useRef<TextInput>(null);

  const productRefs = useRef<any>([]);
  const qtyRefs = useRef<any>([]);
  const priceRefs = useRef<any>([]);

  useEffect(() => {
    if (isCreating && form.supplier_id) {
      setTimeout(() => {
        billNumberRef.current?.focus();
      }, 50);
    }
  }, [form.supplier_id, isCreating]);

  // Colors
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
      btnPrimary: "#0284C7",
      btnPrimaryHover: "#0369A1",
      btnDanger: "#DC2626",
    };

  // ── Query: Fetch bills ──
  const { data: bills = [], isLoading } = useQuery<PurchaseBill[]>({
    queryKey: ["purchase_bills"],
    queryFn: async () => {
      const res = await apiClient.get("/api/purchase/bills");
      return res.data;
    },
  });

  // ── Query: Fetch suppliers ──
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const res = await apiClient.get("/api/suppliers");
      return res.data;
    },
  });

  // ── Query: Fetch products ──
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await apiClient.get("/api/inventory/products");
      return res.data;
    },
  });

  // ── Mutation: Create bill ──
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/api/purchase/bills", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_bills"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_kpis"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_sales_trend"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_liquidity"] });
      setIsCreating(false);
      setSelectedBill(null);
      setForm(blankForm());
      setLines([blankLine()]);
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.detail || "Failed to create Purchase Bill.");
    },
  });

  // ── Mutation: Delete bill ──
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/purchase/bills/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_bills"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_kpis"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_sales_trend"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_liquidity"] });
      setSelectedBill(null);
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.detail || "Failed to delete.");
    },
  });

  // ── Computed totals ──
  const totals = useMemo(() => {
    let sub = 0, tax = 0;
    lines.forEach(l => {
      const lineBase = l.quantity * l.unit_price;
      sub += lineBase;
      tax += lineBase * (l.tax_rate / 100);
    });
    const roundOff = parseFloat(form.round_off_amount || "0") || 0;
    return { subtotal: sub, tax, total: sub + tax + roundOff };
  }, [lines, form.round_off_amount]);

  // ── Filtered bill list ──
  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      const matchSearch =
        !searchQuery ||
        bill.bill_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bill.supplier?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus =
        statusFilter === "ALL" || bill.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [bills, searchQuery, statusFilter]);

  // ── Handlers ──
  function handleSave() {
    if (!form.supplier_id) {
      Alert.alert("Validation", "Please select a supplier.");
      return;
    }
    if (!form.bill_number) {
      Alert.alert("Validation", "Please enter a bill number.");
      return;
    }
    if (lines.some(l => !l.product_id)) {
      Alert.alert("Validation", "Each line item must have a product selected.");
      return;
    }

    const payload = {
      ...form,
      bill_date: toISODate(form.bill_date),
      due_date: form.due_date ? toISODate(form.due_date) : null,
      total: totals.total,
      round_off_amount: parseFloat(form.round_off_amount || "0"),
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
    Alert.alert("Confirm Delete", "Are you sure you want to delete this purchase bill?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(id) }
    ]);
  }

  function updateLine(idx: number, key: keyof PurchaseBillItem, val: any) {
    setLines(prev => {
      const next = [...prev];
      (next[idx] as any)[key] = val;
      if (key === "product_id") {
        const prod = products.find(p => p.id === val);
        if (prod) {
          next[idx].unit_price = prod.purchase_price || prod.sale_price;
          next[idx].tax_rate = prod.tax_rate;
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
          <Text style={[styles.breadcrumb, { color: C.accent }]}>PURCHASES / BILLS</Text>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: C.textPrimary }]}>Purchase Bills</Text>
            <Pressable
              onPress={() => { setIsCreating(true); setSelectedBill(null); }}
              style={({ hovered, pressed }: any) => [
                styles.newBtn,
                { backgroundColor: hovered ? C.btnPrimaryHover : C.btnPrimary },
                pressed && { transform: [{ scale: 0.98 }] }
              ]}
            >
              <Text style={styles.newBtnText}>+ New Bill</Text>
            </Pressable>
          </View>
          <Text style={[styles.subtitle, { color: C.textSecondary }]}>
            Track supplier bills, record payments, manage due dates, and update incoming stock.
          </Text>
        </View>

        {/* Search */}
        <SearchToolbar
          placeholder="Search bill no. or vendor..."
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
              header: "VENDOR",
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
                <Text style={[styles.tdCell, { color: C.textSecondary, fontSize: 13 }]}>
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
                const badge = statusColor(row.status);
                return (
                  <View style={{ alignItems: "center" }}>
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                        {row.status}
                      </Text>
                    </View>
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
          loaderMessage="Loading purchase bills..."
        />
      </View>

      {/* RIGHT PANEL — Detail Card View */}
      {selectedBill && !isCreating && (
        <View style={[styles.detailPanel, { backgroundColor: C.card, borderLeftColor: C.border }]}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.detailScroll}>

            <View style={[styles.detailHeader, { borderBottomColor: C.border }]}>
              <Text style={[styles.detailTitle, { color: C.textPrimary }]}>
                Bill {selectedBill?.bill_number}
              </Text>
              <Pressable
                onPress={() => setSelectedBill(null)}
                style={styles.closeBtn}
              >
                <Text style={{ color: C.textSecondary, fontSize: 18.5 }}>×</Text>
              </Pressable>
            </View>

            {/* DETAIL CARD VIEW */}
            <View style={styles.detailContainer}>

              <View style={[styles.detailMetaRow, { borderBottomColor: C.border }]}>
                <View>
                  <Text style={[styles.detailMetaLabel, { color: C.textSecondary }]}>Vendor / Supplier</Text>
                  <Text style={[styles.detailMetaVal, { color: C.textPrimary }]}>{selectedBill?.supplier?.name}</Text>
                </View>
                <View>
                  <Text style={[styles.detailMetaLabel, { color: C.textSecondary }]}>Status</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(selectedBill?.status || "").bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusColor(selectedBill?.status || "").text }]}>{selectedBill?.status}</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.detailMetaRow, { borderBottomColor: C.border }]}>
                <View>
                  <Text style={[styles.detailMetaLabel, { color: C.textSecondary }]}>Bill Date</Text>
                  <Text style={[styles.detailMetaVal, { color: C.textPrimary }]}>{toUIDate(selectedBill?.bill_date || "")}</Text>
                </View>
                <View>
                  <Text style={[styles.detailMetaLabel, { color: C.textSecondary }]}>Due Date</Text>
                  <Text style={[styles.detailMetaVal, { color: C.textPrimary }]}>{selectedBill?.due_date ? toUIDate(selectedBill?.due_date) : "—"}</Text>
                </View>
              </View>

              <View style={[styles.detailMetaRow, { borderBottomColor: C.border }]}>
                <View>
                  <Text style={[styles.detailMetaLabel, { color: C.textSecondary }]}>Place of Supply</Text>
                  <Text style={[styles.detailMetaVal, { color: C.textPrimary }]}>{selectedBill?.place_of_supply || "—"}</Text>
                </View>
                <View>
                  <Text style={[styles.detailMetaLabel, { color: C.textSecondary }]}>GST Type</Text>
                  <Text style={[styles.detailMetaVal, { color: C.textPrimary }]}>{selectedBill?.gst_type || "B2B"}</Text>
                </View>
              </View>

              {/* Items detail list */}
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.detailSectionTitle, { color: C.textPrimary }]}>Items Purchased</Text>
                <View style={[styles.detailTableHead, { backgroundColor: C.tableHead, borderBottomColor: C.border }]}>
                  <Text style={{ flex: 2.5, color: C.textSecondary, fontWeight: "600" }}>PRODUCT</Text>
                  <Text style={{ flex: 1, color: C.textSecondary, fontWeight: "600", textAlign: "center" }}>QTY</Text>
                  <Text style={{ flex: 1.2, color: C.textSecondary, fontWeight: "600", textAlign: "right" }}>UNIT PRICE</Text>
                  <Text style={{ flex: 1.2, color: C.textSecondary, fontWeight: "600", textAlign: "right" }}>TOTAL</Text>
                </View>

                {selectedBill?.items?.map((item, idx) => (
                  <View key={idx} style={[styles.detailTableRow, { borderBottomColor: C.divider }]}>
                    <Text style={{ flex: 2.5, color: C.textPrimary }} numberOfLines={1}>{item.product_name || "Purchased Product"}</Text>
                    <Text style={{ flex: 1, color: C.textPrimary, textAlign: "center" }}>{item.quantity}</Text>
                    <Text style={{ flex: 1.2, color: C.textPrimary, textAlign: "right" }}>₹{Number(item.unit_price).toFixed(2)}</Text>
                    <Text style={{ flex: 1.2, color: C.textPrimary, textAlign: "right", fontWeight: "600" }}>₹{Number(item.total || 0).toFixed(2)}</Text>
                  </View>
                ))}
              </View>

              {/* Balance breakdown */}
              <View style={[styles.detailTotals, { borderTopColor: C.border }]}>
                <View style={styles.totalRow}><Text style={{ color: C.textSecondary }}>Grand Total</Text><Text style={{ color: C.textPrimary }}>₹{Number(selectedBill?.total || 0).toFixed(2)}</Text></View>
                <View style={styles.totalRow}><Text style={{ color: C.textSecondary }}>Amount Paid</Text><Text style={{ color: C.textPrimary }}>₹{Number(selectedBill?.amount_paid || 0).toFixed(2)}</Text></View>
                <View style={styles.totalRow}><Text style={{ color: C.textPrimary, fontWeight: "700" }}>Balance Due</Text><Text style={{ color: C.accent, fontWeight: "700", fontSize: 18.5 }}>₹{Number(selectedBill?.balance_due || 0).toFixed(2)}</Text></View>
              </View>

              {/* Delete button */}
              <Pressable
                onPress={() => handleDelete(selectedBill!.id)}
                style={[styles.deleteBtn, { borderColor: C.btnDanger }]}
              >
                <Text style={{ color: C.btnDanger, fontWeight: "700" }}>Delete Bill Record</Text>
              </Pressable>

            </View>
          </ScrollView>
        </View>
      )}

      {/* FULL SCREEN PURCHASE CREATION WORKSPACE */}
      <FullScreenModal
        isOpen={isCreating}
        onClose={() => { setIsCreating(false); setForm(blankForm()); setLines([blankLine()]); }}
        title="Record Purchase Bill"
        subtitle="Log vendor invoice records, purchase costs, and tax entries"
        breadcrumb="purchases / bills"
        footerActions={
          <>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => { setIsCreating(false); setForm(blankForm()); setLines([blankLine()]); }}
              style={{ minWidth: 100 }}
            />
            <Button
              title={createMutation.isPending ? "Saving..." : "Save Purchase Bill"}
              variant="primary"
              disabled={createMutation.isPending}
              onPress={handleSave}
              style={{ minWidth: 140 }}
            />
          </>
        }
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 20 }}>
          {/* Section 1: Supplier & Bill details */}
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, padding: 20, gap: 16, zIndex: 100 }]}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: C.textPrimary }}>Bill Metadata</Text>

            <View style={{ flexDirection: "row", gap: 16, zIndex: 110 }}>
              <View style={{ flex: 1, zIndex: 120 }}>
                <Text style={[styles.inputLabel, { color: C.textSecondary, marginBottom: 6 }]}>SUPPLIER (VENDOR) *</Text>
                <Dropdown
                  inputRefProp={supplierRef}
                  options={suppliers.map(s => ({ value: s.id, label: s.name, sublabel: s.gst_number || s.phone }))}
                  value={form.supplier_id}
                  onChange={(val) => setForm(f => ({ ...f, supplier_id: val || "" }))}
                  placeholder="Select vendor..."
                  autoFocus={true}
                />
              </View>
              <View style={{ flex: 0.5 }}>
                <Text style={[styles.inputLabel, { color: C.textSecondary, marginBottom: 6 }]}>BILL NUMBER *</Text>
                <TextInput
                  ref={billNumberRef}
                  style={[styles.input, { color: C.textPrimary, backgroundColor: C.inputBg, borderColor: C.inputBorder }]}
                  value={form.bill_number}
                  onChangeText={t => setForm(f => ({ ...f, bill_number: t }))}
                  placeholder="e.g. BILL-9923"
                  placeholderTextColor={C.textSecondary}
                  onSubmitEditing={() => supplierRefNoRef.current?.focus()}
                />
              </View>
              <View style={{ flex: 0.5 }}>
                <Text style={[styles.inputLabel, { color: C.textSecondary, marginBottom: 6 }]}>SUPPLIER REF NO.</Text>
                <TextInput
                  ref={supplierRefNoRef}
                  style={[styles.input, { color: C.textPrimary, backgroundColor: C.inputBg, borderColor: C.inputBorder }]}
                  value={form.supplier_bill_no}
                  onChangeText={t => setForm(f => ({ ...f, supplier_bill_no: t }))}
                  placeholder="Supplier ref no."
                  placeholderTextColor={C.textSecondary}
                  onSubmitEditing={() => billDateRef.current?.focus()}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 16 }}>
              <View style={{ flex: 1 }}>
                <DatePicker
                  label="BILL DATE *"
                  value={form.bill_date}
                  onChange={t => setForm(f => ({ ...f, bill_date: t }))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <DatePicker
                  label="DUE DATE"
                  value={form.due_date}
                  onChange={t => setForm(f => ({ ...f, due_date: t }))}
                />
              </View>
            </View>
          </View>

          {/* Section 2: Line Items */}
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, padding: 20, zIndex: 90 }]}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: C.textPrimary, marginBottom: 16 }}>Line Items</Text>

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
              <Text style={{ fontSize: 15, fontWeight: "700", color: C.textPrimary }}>Purchase Financial Summary</Text>
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
  pillText: {
    fontSize: 12.5,
    fontWeight: "600",
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
    textTransform: "uppercase",
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
  addLineBtn: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 4,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  removeLineBtn: {
    alignSelf: "flex-end",
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
