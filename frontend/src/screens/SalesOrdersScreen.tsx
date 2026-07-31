// =============================================================
// JK INFOTECH ERP — Sales Orders Screen (Fluent Master-Detail)
// File : src/screens/SalesOrdersScreen.tsx
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
import { sequencesApi } from "../api/sequences";
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
  gst_number?: string;
  phone?: string;
  city?: string;
  state?: string;
}

interface SalesOrderItem {
  id?: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_pct: number;
  product_name?: string;
  total?: number;
}

interface SalesOrder {
  id: string;
  so_number: string;
  order_date: string;
  delivery_date?: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes?: string;
  customer?: Customer;
  customer_id: string;
  items: SalesOrderItem[];
}

interface Product {
  id: string;
  name: string;
  sku?: string;
  sale_price: number;
  tax_rate: number;
  hsn_code?: string;
}

// ─── Status badge color helper ─────────────────────────────────
function statusColor(status: string) {
  switch (status?.toUpperCase()) {
    case "DELIVERED": return { bg: "#DCFCE7", text: "#16A34A" };
    case "DISPATCHED":return { bg: "#E0F2FE", text: "#0369A1" };
    case "CONFIRMED": return { bg: "#FEF9C3", text: "#A16207" };
    case "DRAFT":     return { bg: "#F1F5F9", text: "#64748B" };
    case "CANCELLED": return { bg: "#FEE2E2", text: "#9F1239" };
    default:          return { bg: "#F1F5F9", text: "#64748B" };
  }
}

// ─── Blank form ────────────────────────────────────────────────
function blankForm() {
  return {
    customer_id: "",
    so_number: "",
    order_date: toUIDate(new Date().toISOString().split("T")[0]),
    delivery_date: "",
    notes: "",
    gst_type: "B2B",
  };
}

function blankLine(): SalesOrderItem {
  return {
    product_id: "",
    quantity: 1,
    unit_price: 0,
    tax_rate: 18,
    discount_pct: 0,
    product_name: "",
  };
}

export default function SalesOrdersScreen() {
  const { isDarkMode } = useUIStore();
  const { company } = useAuthStore();
  const queryClient = useQueryClient();

  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Form states
  const [form, setForm] = useState(blankForm());
  const [lines, setLines] = useState<SalesOrderItem[]>([blankLine()]);

  const [nextOrderNumber, setNextOrderNumber] = useState("Generating...");

  const customerRef = useRef<TextInput>(null);
  const orderNoRef = useRef<TextInput>(null);
  const orderDateRef = useRef<TextInput>(null);
  const deliveryDateRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);

  const qtyRefs = useRef<any>([]);
  const priceRefs = useRef<any>([]);
  const discountRefs = useRef<any>([]);
  const productRefs = useRef<any>([]);

  useEffect(() => {
    if (isCreating) {
      sequencesApi.previewSequence("Sales Order")
        .then(res => {
          setNextOrderNumber(res.next_number);
          setForm(f => ({ ...f, so_number: res.next_number }));
        })
        .catch(() => {
          setNextOrderNumber("SO-AUTO");
          setForm(f => ({ ...f, so_number: "SO-AUTO" }));
        });
    }
  }, [isCreating]);

  useEffect(() => {
    if (isCreating && form.customer_id) {
      setTimeout(() => {
        orderNoRef.current?.focus();
      }, 50);
    }
  }, [form.customer_id, isCreating]);

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

  // ── Query: Fetch orders ──
  const { data: orders = [], isLoading } = useQuery<SalesOrder[]>({
    queryKey: ["sales_orders", company?.id],
    queryFn: async () => {
      const res = await apiClient.get("/api/sales/orders");
      return res.data;
    },
  });

  // ── Query: Fetch customers ──
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers", company?.id],
    queryFn: async () => {
      const res = await apiClient.get("/api/customers");
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

  // ── Mutation: Create order ──
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/api/sales/orders", payload);
      return res.data;
    },
    onSuccess: (newOrder: SalesOrder) => {
      queryClient.setQueryData<SalesOrder[]>(["sales_orders", company?.id], (old = []) => {
        if (old.some(o => o.id === newOrder.id)) return old;
        return [newOrder, ...old];
      });
      invalidateAllQueries(queryClient);
      setIsCreating(false);
      setSelectedOrder(null);
      setForm(blankForm());
      setLines([blankLine()]);
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.detail || "Failed to create Sales Order.");
    },
  });

  // ── Computed Totals ──
  const totals = useMemo(() => {
    let sub = 0, tax = 0;
    lines.forEach(l => {
      const base = l.quantity * l.unit_price;
      const disc = base * (l.discount_pct / 100);
      const taxable = base - disc;
      sub += taxable;
      tax += taxable * (l.tax_rate / 100);
    });
    return { subtotal: sub, tax, total: sub + tax };
  }, [lines]);

  // ── Filtered list ──
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchSearch =
        !searchQuery ||
        o.so_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus =
        statusFilter === "ALL" || o.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  // ── Handlers ──
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
      order_date: toISODate(form.order_date),
      delivery_date: form.delivery_date ? toISODate(form.delivery_date) : null,
      so_number: form.so_number || "SO-AUTO",
      subtotal: totals.subtotal,
      tax_amount: totals.tax,
      total: totals.total,
      items: lines.map(l => ({
        product_id: l.product_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        tax_rate: l.tax_rate,
        discount_pct: l.discount_pct,
      })),
    };
    createMutation.mutate(payload);
  }

  function updateLine(idx: number, key: keyof SalesOrderItem, val: any) {
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
    setLines(prev => [...prev, blankLine()]);
  }

  function removeLine(idx: number) {
    setLines(prev => prev.filter((_, i) => i !== idx));
  }

  const STATUS_FILTERS = ["ALL", "DRAFT", "CONFIRMED", "DISPATCHED", "DELIVERED", "CANCELLED"];

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      
      {/* LEFT PANEL: Orders List */}
      <View
        style={[
          styles.listPanel,
          (selectedOrder && !isCreating) && styles.listPanelSplit,
          (selectedOrder && !isCreating) && { borderRightColor: C.border },
        ]}
      >
        
        {/* Header Block */}
        <View style={styles.header}>
          <Text style={[styles.breadcrumb, { color: C.accent }]}>SALES / ORDERS</Text>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: C.textPrimary }]}>Sales Orders</Text>
            <Pressable
              onPress={() => { setIsCreating(true); setSelectedOrder(null); }}
              style={({ hovered, pressed }: any) => [
                styles.newBtn,
                { backgroundColor: hovered ? C.btnPrimaryHover : C.btnPrimary },
                pressed && { transform: [{ scale: 0.98 }] }
              ]}
            >
              <Text style={styles.newBtnText}>+ New Order</Text>
            </Pressable>
          </View>
          <Text style={[styles.subtitle, { color: C.textSecondary }]}>
            Create, confirm and dispatch client orders, monitor shipping status, and update drafts.
          </Text>
        </View>

        {/* Search */}
        <SearchToolbar
          placeholder="Search order no. or customer..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {/* Status Filters */}
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
          data={filteredOrders}
          columns={[
            {
              header: "ORDER #",
              accessorKey: "so_number",
              flex: 1.4,
              render: (row) => (
                <Text style={[styles.tdCell, { color: C.textPrimary, fontWeight: "600" }]} numberOfLines={1}>
                  {row.so_number}
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
              accessorKey: "order_date",
              flex: 0.9,
              render: (row) => (
                <Text style={[styles.tdCell, { color: C.textSecondary, fontSize: 13 }]}>
                  {toUIDate(row.order_date)}
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
            setSelectedOrder(item);
            setIsCreating(false);
          }}
          selectedId={selectedOrder?.id}
          emptyMessage="No sales orders found"
          loaderMessage="Loading sales orders..."
        />
      </View>

      {/* RIGHT PANEL: Detail Card View */}
      {selectedOrder && !isCreating && (
        <View style={[styles.detailPanel, { backgroundColor: C.card, borderLeftColor: C.border }]}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.detailScroll}>
            
            {/* Detail Header */}
            <View style={[styles.detailHeader, { borderBottomColor: C.border }]}>
              <Text style={[styles.detailTitle, { color: C.textPrimary }]}>
                Order {selectedOrder?.so_number}
              </Text>
              <Pressable
                onPress={() => setSelectedOrder(null)}
                style={styles.closeBtn}
              >
                <Text style={{ color: C.textSecondary, fontSize: 18.5 }}>×</Text>
              </Pressable>
            </View>

            {/* DETAIL CARD VIEW */}
            <View style={styles.detailContainer}>
              
              <View style={[styles.detailMetaRow, { borderBottomColor: C.border }]}>
                <View>
                  <Text style={[styles.detailMetaLabel, { color: C.textSecondary }]}>Customer</Text>
                  <Text style={[styles.detailMetaVal, { color: C.textPrimary }]}>{selectedOrder?.customer?.name}</Text>
                </View>
                <View>
                  <Text style={[styles.detailMetaLabel, { color: C.textSecondary }]}>Status</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(selectedOrder?.status || "").bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusColor(selectedOrder?.status || "").text }]}>{selectedOrder?.status}</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.detailMetaRow, { borderBottomColor: C.border }]}>
                <View>
                  <Text style={[styles.detailMetaLabel, { color: C.textSecondary }]}>Order Date</Text>
                  <Text style={[styles.detailMetaVal, { color: C.textPrimary }]}>{toUIDate(selectedOrder?.order_date || "")}</Text>
                </View>
                <View>
                  <Text style={[styles.detailMetaLabel, { color: C.textSecondary }]}>Delivery Date</Text>
                  <Text style={[styles.detailMetaVal, { color: C.textPrimary }]}>{selectedOrder?.delivery_date ? toUIDate(selectedOrder?.delivery_date) : "—"}</Text>
                </View>
              </View>

              {/* Items Table */}
              <View style={{ marginTop: 24 }}>
                <Text style={[styles.detailSectionTitle, { color: C.textPrimary }]}>Order Items</Text>
                <View style={[styles.detailTableHead, { backgroundColor: C.tableHead, borderBottomColor: C.border }]}>
                  <Text style={{ flex: 2, color: C.textSecondary, fontWeight: "600" }}>PRODUCT</Text>
                  <Text style={{ flex: 1, color: C.textSecondary, fontWeight: "600", textAlign: "center" }}>QTY</Text>
                  <Text style={{ flex: 1, color: C.textSecondary, fontWeight: "600", textAlign: "right" }}>PRICE</Text>
                  <Text style={{ flex: 1, color: C.textSecondary, fontWeight: "600", textAlign: "right" }}>TAX %</Text>
                  <Text style={{ flex: 1, color: C.textSecondary, fontWeight: "600", textAlign: "right" }}>TOTAL</Text>
                </View>

                {selectedOrder?.items?.map((line, idx) => (
                  <View key={idx} style={[styles.detailTableRow, { borderBottomColor: C.divider }]}>
                    <Text style={{ flex: 2, color: C.textPrimary }} numberOfLines={1}>{line.product_name || "Unknown Product"}</Text>
                    <Text style={{ flex: 1, color: C.textPrimary, textAlign: "center" }}>{line.quantity}</Text>
                    <Text style={{ flex: 1, color: C.textPrimary, textAlign: "right" }}>₹{Number(line.unit_price).toFixed(2)}</Text>
                    <Text style={{ flex: 1, color: C.textPrimary, textAlign: "right" }}>{line.tax_rate}%</Text>
                    <Text style={{ flex: 1, color: C.textPrimary, textAlign: "right", fontWeight: "600" }}>₹{Number(line.total || 0).toFixed(2)}</Text>
                  </View>
                ))}
              </View>

              {/* Financial Totals */}
              <View style={[styles.detailTotals, { borderTopColor: C.border }]}>
                <View style={styles.totalRow}><Text style={{ color: C.textSecondary }}>Subtotal</Text><Text style={{ color: C.textPrimary }}>₹{Number(selectedOrder?.subtotal || 0).toFixed(2)}</Text></View>
                <View style={styles.totalRow}><Text style={{ color: C.textSecondary }}>GST</Text><Text style={{ color: C.textPrimary }}>₹{Number(selectedOrder?.tax_amount || 0).toFixed(2)}</Text></View>
                <View style={styles.totalRow}><Text style={{ color: C.textPrimary, fontWeight: "700" }}>Total Amount</Text><Text style={{ color: C.textPrimary, fontWeight: "700", fontSize: 18.5 }}>₹{Number(selectedOrder?.total || 0).toFixed(2)}</Text></View>
              </View>

              {/* Notes */}
              {selectedOrder?.notes ? (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ color: C.textSecondary, fontSize: 13, fontWeight: "600" }}>NOTES</Text>
                  <Text style={{ color: C.textPrimary, fontSize: 15, marginTop: 4 }}>{selectedOrder.notes}</Text>
                </View>
              ) : null}

            </View>
          </ScrollView>
        </View>
      )}

      {/* FULL SCREEN CREATION WORKSPACE */}
      <FullScreenModal
        isOpen={isCreating}
        onClose={() => { setIsCreating(false); setForm(blankForm()); setLines([blankLine()]); }}
        title="Create Sales Order"
        subtitle="Manage client commitments and order allocation sequences"
        breadcrumb="sales / orders"
        footerActions={
          <>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => { setIsCreating(false); setForm(blankForm()); setLines([blankLine()]); }}
              style={{ minWidth: 100 }}
            />
            <Button
              title={createMutation.isPending ? "Saving..." : "Save Sales Order"}
              variant="primary"
              disabled={createMutation.isPending}
              onPress={handleSave}
              style={{ minWidth: 140 }}
            />
          </>
        }
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 20 }}>
          {/* Section 1: Customer & Order Details */}
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, padding: 20, gap: 16, zIndex: 100 }]}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: C.textPrimary }}>Order Metadata</Text>
            
            <View style={{ flexDirection: "row", gap: 16, zIndex: 110 }}>
              <View style={{ flex: 1, zIndex: 120 }}>
                <Text style={[styles.inputLabel, { color: C.textSecondary, marginBottom: 6 }]}>CUSTOMER *</Text>
                <Dropdown
                  inputRefProp={customerRef}
                  options={customers.map(c => ({ value: c.id, label: c.name, sublabel: c.gst_number || c.phone }))}
                  value={form.customer_id}
                  onChange={(val) => setForm(f => ({ ...f, customer_id: val || "" }))}
                  placeholder="Select customer..."
                  autoFocus={true}
                />
              </View>
              <View style={{ flex: 0.5 }}>
                <Text style={[styles.inputLabel, { color: C.textSecondary, marginBottom: 6 }]}>ORDER NO.</Text>
                <TextInput
                  ref={orderNoRef}
                  style={[styles.input, { color: C.textPrimary, backgroundColor: C.inputBg, borderColor: C.inputBorder }]}
                  value={form.so_number}
                  onChangeText={t => setForm(f => ({ ...f, so_number: t }))}
                  editable={true}
                  onSubmitEditing={() => orderDateRef.current?.focus()}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 16 }}>
              <View style={{ flex: 1 }}>
                <DatePicker
                  label="ORDER DATE *"
                  value={form.order_date}
                  onChange={t => setForm(f => ({ ...f, order_date: t }))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <DatePicker
                  label="DELIVERY DATE"
                  value={form.delivery_date}
                  onChange={t => setForm(f => ({ ...f, delivery_date: t }))}
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
                    inputRefProp={(el: any) => { productRefs.current[idx] = el; }}
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
                  <Text style={[styles.inputLabel, { color: C.textSecondary, marginBottom: 6 }]}>Unit Price</Text>
                  <TextInput
                    ref={el => { priceRefs.current[idx] = el; }}
                    style={[styles.input, { color: C.textPrimary, backgroundColor: C.inputBg, borderColor: C.inputBorder }]}
                    keyboardType="numeric"
                    value={String(line.unit_price)}
                    onChangeText={t => updateLine(idx, "unit_price", parseFloat(t) || 0)}
                    onSubmitEditing={() => discountRefs.current[idx]?.focus()}
                  />
                </View>

                <View style={{ flex: 0.6 }}>
                  <Text style={[styles.inputLabel, { color: C.textSecondary, marginBottom: 6 }]}>Discount %</Text>
                  <TextInput
                    ref={el => { discountRefs.current[idx] = el; }}
                    style={[styles.input, { color: C.textPrimary, backgroundColor: C.inputBg, borderColor: C.inputBorder }]}
                    keyboardType="numeric"
                    value={String(line.discount_pct)}
                    onChangeText={t => updateLine(idx, "discount_pct", parseFloat(t) || 0)}
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
                    ₹{((line.quantity * line.unit_price * (1 - line.discount_pct / 100)) * (1 + line.tax_rate / 100)).toFixed(2)}
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

          {/* Section 3: Notes & Financial Details */}
          <View style={{ flexDirection: "row", gap: 20 }}>
            <View style={[styles.card, { flex: 1.5, backgroundColor: C.card, borderColor: C.border, padding: 20 }]}>
              <Text style={[styles.inputLabel, { color: C.textSecondary, marginBottom: 6 }]}>ORDER NOTES</Text>
              <TextInput
                ref={notesRef}
                style={[styles.input, { height: 100, textAlignVertical: "top", color: C.textPrimary, backgroundColor: C.inputBg, borderColor: C.inputBorder }]}
                multiline
                value={form.notes}
                onChangeText={t => setForm(f => ({ ...f, notes: t }))}
                placeholder="Internal order remarks or instructions..."
                placeholderTextColor={C.textSecondary}
              />
            </View>

            <View style={[styles.card, { flex: 1, backgroundColor: C.card, borderColor: C.border, padding: 20, gap: 10 }]}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: C.textPrimary }}>Financial Summary</Text>
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
  card: {
    borderWidth: 1,
    borderRadius: 8,
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
  }
});
