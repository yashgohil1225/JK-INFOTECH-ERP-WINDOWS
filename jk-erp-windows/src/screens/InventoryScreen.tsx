// =============================================================
// JK INFOTECH ERP — Inventory / Products Screen (Fluent Master-Detail + FullScreen Modal)
// File : src/screens/InventoryScreen.tsx
// =============================================================

import React, { useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TextInput
} from "react-native";
import { useUIStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/client";
import { DataTable, ColumnDefinition } from "../components/ui/DataTable";
import { SearchToolbar } from "../components/ui/SearchToolbar";
import { FullScreenModal } from "../components/ui/FullScreenModal";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { authApi } from "../api/auth";
import { Toggle } from "../components/ui/Toggle";

// ─── EAN-13 Barcode Generation Helpers ───
function calculateEan13Checksum(digits12: string): string {
  const total = digits12.split("").reduce((sum, digit, i) => sum + parseInt(digit) * (i % 2 === 1 ? 3 : 1), 0);
  const mod = total % 10;
  return String(mod === 0 ? 0 : 10 - mod);
}

function generateRandomEan13(): string {
  const randDigits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("");
  const digits12 = `290${randDigits}`;
  return digits12 + calculateEan13Checksum(digits12);
}

// ─── Interfaces ───────────────────────────────────────────────
interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  description?: string;
  unit: string;
  base_unit: string;
  item_type: string;
  secondary_unit?: string;
  conversion_factor: number;
  purchase_price: number;
  sale_price: number;
  mrp: number;
  tax_preference: string;
  tax_rate: number;
  intra_state_tax_rate: number;
  inter_state_tax_rate: number;
  hsn_code?: string;
  sac_code?: string;
  reorder_level: number;
  has_batch_tracking: boolean;
  is_active: boolean;
  current_stock: number;
  category_id?: string;
}

// ─── Options ──────────────────────────────────────────────────
const UNIT_OPTIONS = ["PCS", "KG", "LTR", "MTR", "BOX", "DOZ", "SET", "NOS", "PKT", "BAG", "TON", "GM", "ML"];
const TAX_RATES = ["0", "0.1", "0.25", "1", "1.5", "3", "5", "7.5", "12", "18", "28"];
const ITEM_TYPES = [{ value: "goods", label: "Goods (Physical Product)" }, { value: "service", label: "Service" }];
const TAX_PREFS = [{ value: "taxable", label: "Taxable" }, { value: "exempt", label: "Exempt" }, { value: "non_gst", label: "Non-GST" }];

// ─── Blank form ────────────────────────────────────────────────
function blankForm(): any {
  return {
    name: "", sku: "", barcode: "", description: "",
    unit: "PCS", base_unit: "PCS", item_type: "goods",
    secondary_unit: "", conversion_factor: "1",
    purchase_price: "", sale_price: "", mrp: "",
    tax_preference: "taxable", tax_rate: "",
    intra_state_tax_rate: "", inter_state_tax_rate: "",
    hsn_code: "", sac_code: "",
    reorder_level: "", has_batch_tracking: false, is_active: true,
    opening_stock: ""
  };
}

// ─── Sub-components ────────────────────────────────────────────
function SecHeader({ label, accent }: { label: string; accent: string }) {
  return (
    <Text style={{ fontSize: 12, fontWeight: "800", letterSpacing: 1.2, fontFamily: "Segoe UI Variable Text", color: accent, marginBottom: 6, marginTop: 4 }}>
      {label}
    </Text>
  );
}

function DetailRow({ label, value, C }: { label: string; value?: string | number | boolean | null; C: any }) {
  const display = (value === null || value === undefined || value === "") ? "—" : String(value);
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.8, color: C.textSecondary, fontFamily: "Segoe UI Variable Text", marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 14.5, color: C.textPrimary, fontFamily: "Segoe UI Variable Text" }}>{display}</Text>
    </View>
  );
}



function InlineSelect({ label, value, options, onChange, C }: {
  label: string; value: string; options: string[] | { value: string; label: string }[];
  onChange: (v: string) => void; C: any;
}) {
  const [open, setOpen] = useState(false);
  const normalized = options.map((o: any) => typeof o === "string" ? { value: o, label: o } : o);
  const selected = normalized.find(o => o.value === value);
  return (
    <View style={{ gap: 4, zIndex: open ? 999 : 1 }}>
      <Text style={{ fontSize: 12.5, fontWeight: "700", letterSpacing: 0.5, color: C.textSecondary, fontFamily: "Segoe UI Variable Text" }}>{label}</Text>
      <Pressable onPress={() => setOpen(o => !o)} style={{ height: 40, borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderColor: C.border, backgroundColor: C.surface }}>
        <Text style={{ fontSize: 15, color: C.textPrimary, fontFamily: "Segoe UI Variable Text", flex: 1 }} numberOfLines={1}>{selected?.label || "Select..."}</Text>
        <Text style={{ color: C.textSecondary, fontSize: 12 }}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open && (
        <View style={{ position: "absolute", top: 68, left: 0, right: 0, zIndex: 9999, borderWidth: 1, borderColor: C.border, borderRadius: 6, backgroundColor: C.surface, maxHeight: 200, overflow: "hidden" }}>
          <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
            {normalized.map(o => (
              <Pressable key={o.value} onPress={() => { onChange(o.value); setOpen(false); }}
                style={({ hovered }: any) => ({
                  paddingHorizontal: 12, paddingVertical: 10,
                  backgroundColor: o.value === value ? (C.isDarkMode ? "#0C4A6E" : "#EFF6FF") : hovered ? (C.isDarkMode ? "#334155" : "#F1F5F9") : "transparent"
                })}>
                <Text style={{ fontSize: 14.5, color: C.textPrimary, fontFamily: "Segoe UI Variable Text" }}>{o.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────
export default function InventoryScreen() {
  const { isDarkMode, setIsFullScreenOpen } = useUIStore();
  const { company, setCompany } = useAuthStore();
  const queryClient = useQueryClient();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<any>(blankForm());
  const [formTab, setFormTab] = useState<1 | 2 | 3 | 4>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const [duplicateWarningOpen, setDuplicateWarningOpen] = useState(false);
  const [duplicatePayload, setDuplicatePayload] = useState<any>(null);
  const nameRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);
  const skuRef = useRef<TextInput>(null);
  const barcodeRef = useRef<TextInput>(null);

  const C = isDarkMode
    ? { bg: "#0F172A", surface: "#1E293B", border: "#334155", textPrimary: "#F8FAFC", textSecondary: "#94A3B8", accent: "#38BDF8", divider: "#334155", statusActive: "#22C55E", statusInactive: "#EF4444", isDarkMode: true }
    : { bg: "#F8FAFC", surface: "#FFFFFF", border: "#E2E8F0", textPrimary: "#0F172A", textSecondary: "#64748B", accent: "#0284C7", divider: "#E2E8F0", statusActive: "#16A34A", statusInactive: "#DC2626", isDarkMode: false };

  // ── Queries ──
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => { const res = await apiClient.get("/api/inventory/products"); return res.data; }
  });

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { opening_stock, ...prodData } = payload;
      const res = await apiClient.post("/api/inventory/products", prodData);
      const created = res.data;
      if (opening_stock && Number(opening_stock) !== 0) {
        await apiClient.post(`/api/inventory/products/${created.id}/adjust`, {
          entry_type: "OPENING", quantity: Number(opening_stock), notes: "Initial Opening Stock"
        });
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsFormOpen(false); setFormData(blankForm()); setFormTab(1); setIsFullScreenOpen(false);
    },
    onError: (err: any) => { Alert.alert("Error", err.response?.data?.detail || "Failed to create product."); }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiClient.put(`/api/inventory/products/${id}`, data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSelectedProduct(data); setIsFormOpen(false); setIsFullScreenOpen(false);
    },
    onError: (err: any) => { Alert.alert("Error", err.response?.data?.detail || "Update failed."); }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`/api/inventory/products/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); setSelectedProduct(null); },
    onError: (err: any) => { Alert.alert("Cannot Delete", err.response?.data?.detail || "Product has linked transactions."); }
  });

  // ── Helpers ──
  const set = (key: string, val: any) => setFormData((f: any) => ({ ...f, [key]: val }));

  const openAdd = () => {
    setIsEditMode(false); setFormData(blankForm()); setFormTab(1);
    setIsFormOpen(true); setIsFullScreenOpen(true);
  };

  const openEdit = (p: Product) => {
    setIsEditMode(true);
    setFormData({
      name: p.name, sku: p.sku || "", barcode: p.barcode || "", description: p.description || "",
      unit: p.unit, base_unit: p.base_unit, item_type: p.item_type,
      secondary_unit: p.secondary_unit || "", conversion_factor: String(p.conversion_factor),
      purchase_price: String(p.purchase_price), sale_price: String(p.sale_price), mrp: String(p.mrp),
      tax_preference: p.tax_preference, tax_rate: String(p.tax_rate),
      intra_state_tax_rate: String(p.intra_state_tax_rate), inter_state_tax_rate: String(p.inter_state_tax_rate),
      hsn_code: p.hsn_code || "", sac_code: p.sac_code || "",
      reorder_level: String(p.reorder_level), has_batch_tracking: p.has_batch_tracking,
      is_active: p.is_active, opening_stock: "0"
    });
    setFormTab(1); setIsFormOpen(true); setIsFullScreenOpen(true);
  };

  const closeForm = () => { setIsFormOpen(false); setFormTab(1); setIsFullScreenOpen(false); };

  const handleSave = () => {
    if (!formData.name.trim()) { Alert.alert("Validation", "Product name is required."); return; }

    const isGst = company?.is_gst_applicable ?? true;
    const resolvedGstRate = isGst ? (parseFloat(company?.default_gst_rate || company?.default_tax_rate || "18") || 0) : 0;
    const resolvedItemType = (company?.hsn_sac_type || "Goods").toLowerCase() === "service" ? "service" : "goods";
    const resolvedHsn = resolvedItemType === "goods" ? (company?.default_hsn_sac_code || "") : "";
    const resolvedSac = resolvedItemType === "service" ? (company?.default_hsn_sac_code || "") : "";

    const payload: any = {
      ...formData,
      item_type: resolvedItemType,
      hsn_code: resolvedHsn,
      sac_code: resolvedSac,
      tax_rate: resolvedGstRate,
      intra_state_tax_rate: resolvedGstRate / 2,
      inter_state_tax_rate: resolvedGstRate,
      purchase_price: parseFloat(formData.purchase_price) || 0,
      sale_price: parseFloat(formData.sale_price) || 0,
      mrp: parseFloat(formData.mrp) || 0,
      reorder_level: parseFloat(formData.reorder_level) || 0,
      conversion_factor: parseFloat(formData.conversion_factor) || 1,
    };

    const duplicateExists = products.some(p =>
      p.name.trim().toLowerCase() === formData.name.trim().toLowerCase() &&
      (isEditMode && selectedProduct ? p.id !== selectedProduct.id : true)
    );

    if (duplicateExists && !duplicatePayload) {
      setDuplicatePayload(payload);
      setDuplicateWarningOpen(true);
      return;
    }

    const finalPayload = duplicatePayload || payload;
    if (isEditMode && selectedProduct) updateMutation.mutate({ id: selectedProduct.id, data: finalPayload });
    else createMutation.mutate(finalPayload);

    setDuplicateWarningOpen(false);
    setDuplicatePayload(null);
  };

  // ── Bulk Generate Barcodes ──
  const handleBulkGenerateBarcodes = async () => {
    const missing = products.filter(p => !p.barcode).map(p => p.id);
    if (missing.length === 0) {
      Alert.alert("Registry Complete", "All products already have barcodes generated.");
      return;
    }
    Alert.alert(
      "Bulk Generate Barcodes",
      `Would you like to generate EAN-13 barcodes for ${missing.length} products?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Generate",
          onPress: async () => {
            try {
              const res = await apiClient.post("/api/v1/barcode/bulk-generate", { product_ids: missing });
              Alert.alert("Success", `Generated EAN-13 barcodes for ${res.data?.count} products.`);
              queryClient.invalidateQueries({ queryKey: ["products"] });
            } catch (err: any) {
              Alert.alert("Error", err.response?.data?.detail || "Bulk generation failed.");
            }
          }
        }
      ]
    );
  };

  // ── Filter ──
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchStatus = statusFilter === "ALL" || (statusFilter === "ACTIVE" && p.is_active) || (statusFilter === "INACTIVE" && !p.is_active);
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)) || (p.hsn_code && p.hsn_code.includes(q)) || (p.barcode && p.barcode.includes(q));
      return matchStatus && matchSearch;
    });
  }, [products, searchQuery, statusFilter]);

  // ── Tax preview calc ──
  const taxRate = parseFloat(formData.tax_rate || "0");
  const salePrice = parseFloat(formData.sale_price || "0");
  const margin = salePrice > 0 && parseFloat(formData.purchase_price || "0") > 0
    ? (((salePrice - parseFloat(formData.purchase_price)) / salePrice) * 100).toFixed(1)
    : "—";

  // ── Table columns ──
  const columns: ColumnDefinition<Product>[] = [
    { header: "#", accessorKey: "id", width: 48, render: (_: Product, idx: number) => <Text style={{ fontSize: 13.5, color: C.textSecondary, fontFamily: "Segoe UI Variable Text" }}>{(idx ?? 0) + 1}</Text> },
    {
      header: "PRODUCT NAME", accessorKey: "name", flex: 2.5,
      render: (row: Product) => (
        <View>
          <Text style={{ fontSize: 14.5, fontWeight: "700", color: C.textPrimary, fontFamily: "Segoe UI Variable Text" }} numberOfLines={1}>{row.name}</Text>
          <Text style={{ fontSize: 12, color: C.textSecondary, fontFamily: "Segoe UI Variable Text" }}>{row.sku || "No SKU"} · {row.unit}</Text>
        </View>
      )
    },
    {
      header: "HSN", accessorKey: "hsn_code", flex: 1,
      render: (row: Product) => <Text style={{ fontSize: 13.5, color: row.hsn_code ? C.textPrimary : C.textSecondary }}>{row.hsn_code || "—"}</Text>
    },
    {
      header: "SALE PRICE", accessorKey: "sale_price", flex: 1.2, align: "right" as any,
      render: (row: Product) => (
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 14.5, fontWeight: "700", color: C.textPrimary, fontFamily: "Segoe UI Variable Text" }}>₹{Number(row.sale_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</Text>
          <Text style={{ fontSize: 11, color: C.textSecondary }}>{row.tax_rate}% GST</Text>
        </View>
      )
    },
    {
      header: "STOCK", accessorKey: "current_stock", flex: 0.9, align: "center" as any,
      render: (row: Product) => {
        const stock = Number(row.current_stock || 0);
        const low = stock <= Number(row.reorder_level || 0) && stock >= 0;
        return (
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 15, fontWeight: "800", fontFamily: "Segoe UI Variable Display", color: stock <= 0 ? "#EF4444" : low ? "#F59E0B" : C.textPrimary }}>{stock}</Text>
            <Text style={{ fontSize: 11, color: C.textSecondary }}>{row.unit}</Text>
          </View>
        );
      }
    },
    {
      header: "STATUS", accessorKey: "is_active", width: 90, align: "center" as any,
      render: (row: Product) => (
        <View style={{ backgroundColor: row.is_active ? (isDarkMode ? "#14532D" : "#DCFCE7") : (isDarkMode ? "#450A0A" : "#FEE2E2"), borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "center" }}>
          <Text style={{ fontSize: 11.5, fontWeight: "800", fontFamily: "Segoe UI Variable Text", color: row.is_active ? C.statusActive : C.statusInactive }}>
            {row.is_active ? "ACTIVE" : "INACTIVE"}
          </Text>
        </View>
      )
    }
  ];

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: C.bg }}>

      {/* ─── MASTER LIST ─── */}
      <View style={[styles.masterSection, selectedProduct && { flex: 0.6, borderRightWidth: 1, borderRightColor: C.divider }]}>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1.2, color: C.accent, fontFamily: "Segoe UI Variable Text" }}>INVENTORY / PRODUCTS</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 28, fontWeight: "700", color: C.textPrimary, fontFamily: "Segoe UI Variable Display" }}>Products Registry</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {company?.settings?.enable_barcodes && (
                <Pressable
                  onPress={handleBulkGenerateBarcodes}
                  style={({ hovered }: any) => [
                    { height: 36, paddingHorizontal: 16, borderRadius: 6, borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center", backgroundColor: hovered ? (isDarkMode ? "#334155" : "#F1F5F9") : "transparent" }
                  ]}
                >
                  <Text style={{ fontSize: 13, fontWeight: "800", color: C.textPrimary }}>Bulk Generate Barcodes</Text>
                </Pressable>
              )}
              <Button title="+ Add Product" onPress={openAdd} variant="primary" size="medium" />
            </View>
          </View>
          <Text style={{ fontSize: 15, color: C.textSecondary, fontFamily: "Segoe UI Variable Text" }}>
            Manage products, pricing, tax rates, stock levels & HSN codes.
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <SearchToolbar placeholder="Search by name, SKU or HSN code..." value={searchQuery} onChangeText={setSearchQuery} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, height: 32 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["ALL", "ACTIVE", "INACTIVE"] as const).map(f => (
                <Pressable key={f} onPress={() => setStatusFilter(f)} style={{ paddingHorizontal: 14, height: 28, borderRadius: 14, justifyContent: "center", backgroundColor: statusFilter === f ? C.accent : (isDarkMode ? "#1E293B" : "#F1F5F9"), borderWidth: 1, borderColor: statusFilter === f ? C.accent : C.border }}>
                  <Text style={{ fontSize: 12.5, fontWeight: "700", fontFamily: "Segoe UI Variable Text", color: statusFilter === f ? "#FFFFFF" : C.textSecondary }}>{f}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        <DataTable
          data={filteredProducts}
          columns={columns}
          isLoading={isLoading}
          onRowPress={(item) => setSelectedProduct(item)}
          selectedId={selectedProduct?.id}
          emptyMessage="No products found."
          loaderMessage="Loading inventory..."
        />
      </View>

      {/* ─── DETAIL PANEL ─── */}
      {selectedProduct && (
        <View style={{ flex: 0.4, backgroundColor: C.surface }}>
          <ScrollView contentContainerStyle={{ padding: 22 }} showsVerticalScrollIndicator={true}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 22, fontWeight: "700", color: C.textPrimary, fontFamily: "Segoe UI Variable Display" }} numberOfLines={2}>{selectedProduct.name}</Text>
                <Text style={{ fontSize: 14, color: C.textSecondary, marginTop: 2 }}>{selectedProduct.sku || "No SKU"} · {selectedProduct.unit}</Text>
                <View style={{ marginTop: 6, alignSelf: "flex-start", backgroundColor: selectedProduct.is_active ? (isDarkMode ? "#14532D" : "#DCFCE7") : (isDarkMode ? "#450A0A" : "#FEE2E2"), borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11.5, fontWeight: "800", color: selectedProduct.is_active ? C.statusActive : C.statusInactive }}>{selectedProduct.is_active ? "ACTIVE" : "INACTIVE"}</Text>
                </View>
              </View>
              <Pressable onPress={() => setSelectedProduct(null)} style={({ hovered }: any) => ({ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: hovered ? "#E81123" : (isDarkMode ? "rgba(239,68,68,0.15)" : "#FEE2E2") })}>
                <Text style={{ fontSize: 16, fontWeight: "bold", color: isDarkMode ? "#EF4444" : "#DC2626" }}>×</Text>
              </Pressable>
            </View>

            <View style={{ height: 1, backgroundColor: C.divider, marginBottom: 14 }} />

            {/* Stock Hero */}
            <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 16, marginBottom: 14, backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC" }}>
              <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.8, color: C.textSecondary, marginBottom: 8 }}>CURRENT STOCK</Text>
              <View style={{ flexDirection: "row", gap: 0 }}>
                <View style={{ flex: 1, paddingRight: 16, borderRightWidth: 1, borderRightColor: C.border }}>
                  <Text style={{ fontSize: 11, color: C.textSecondary }}>IN STOCK</Text>
                  <Text style={{ fontSize: 30, fontWeight: "900", fontFamily: "Segoe UI Variable Display", color: Number(selectedProduct.current_stock) <= 0 ? "#EF4444" : C.accent }}>
                    {Number(selectedProduct.current_stock || 0)}
                  </Text>
                  <Text style={{ fontSize: 13, color: C.textSecondary }}>{selectedProduct.unit}</Text>
                </View>
                <View style={{ flex: 1, paddingHorizontal: 16, borderRightWidth: 1, borderRightColor: C.border }}>
                  <Text style={{ fontSize: 11, color: C.textSecondary }}>REORDER AT</Text>
                  <Text style={{ fontSize: 26, fontWeight: "800", fontFamily: "Segoe UI Variable Display", color: C.textPrimary }}>{Number(selectedProduct.reorder_level || 0)}</Text>
                </View>
                <View style={{ flex: 1, paddingLeft: 16 }}>
                  <Text style={{ fontSize: 11, color: C.textSecondary }}>TAX RATE</Text>
                  <Text style={{ fontSize: 26, fontWeight: "800", fontFamily: "Segoe UI Variable Display", color: C.textPrimary }}>{selectedProduct.tax_rate}%</Text>
                </View>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
              <Button title="✎ Edit" onPress={() => openEdit(selectedProduct)} variant="primary" size="medium" style={{ flex: 1 }} />
              <Button title="Delete" onPress={() => Alert.alert("Delete Confirmation", `Delete "${selectedProduct.name}"?`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(selectedProduct.id) }])} variant="secondary" size="medium" style={{ flex: 1 }} />
            </View>

            {/* Pricing */}
            <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, marginBottom: 12, backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC" }}>
              <SecHeader label="PRICING" accent={C.accent} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}><DetailRow label="PURCHASE PRICE" value={`₹${Number(selectedProduct.purchase_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} C={C} /></View>
                <View style={{ flex: 1 }}><DetailRow label="SALE PRICE" value={`₹${Number(selectedProduct.sale_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} C={C} /></View>
                <View style={{ flex: 1 }}><DetailRow label="MRP" value={`₹${Number(selectedProduct.mrp).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} C={C} /></View>
              </View>
            </View>

            {/* Tax */}
            <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, marginBottom: 12, backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC" }}>
              <SecHeader label="TAX DETAILS" accent={C.accent} />
              <DetailRow label="HSN CODE" value={selectedProduct.hsn_code} C={C} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}><DetailRow label="GST RATE" value={`${selectedProduct.tax_rate}%`} C={C} /></View>
                <View style={{ flex: 1 }}><DetailRow label="TAX PREFERENCE" value={selectedProduct.tax_preference} C={C} /></View>
              </View>
            </View>

            {/* Product Info */}
            <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC" }}>
              <SecHeader label="PRODUCT INFO" accent={C.accent} />
              {(!company?.settings?.enable_barcodes || !selectedProduct.barcode) && (
                <DetailRow label="BARCODE" value={selectedProduct.barcode} C={C} />
              )}
              {company?.settings?.enable_barcodes && selectedProduct.barcode && (
                <View style={{ alignItems: "center", marginVertical: 14, padding: 12, borderWidth: 1, borderColor: C.border, borderRadius: 8, backgroundColor: "#FFFFFF" }}>
                  <View style={{ flexDirection: "row", height: 40, alignItems: "stretch", marginBottom: 6 }}>
                    {selectedProduct.barcode.split("").map((char, index) => {
                      const num = parseInt(char) || 0;
                      return (
                        <View key={index} style={{ flexDirection: "row" }}>
                          <View style={{ width: (num % 3) + 1, backgroundColor: "#000000", marginRight: (num % 2) + 1 }} />
                          <View style={{ width: 1, backgroundColor: "#FFFFFF" }} />
                          <View style={{ width: ((num + 2) % 3) + 1, backgroundColor: "#000000" }} />
                          <View style={{ width: 2, backgroundColor: "#FFFFFF" }} />
                        </View>
                      );
                    })}
                  </View>
                  <Text style={{ fontFamily: "Consolas", fontSize: 13, color: "#000000", letterSpacing: 3, fontWeight: "700" }}>
                    {selectedProduct.barcode}
                  </Text>
                </View>
              )}
              <DetailRow label="ITEM TYPE" value={selectedProduct.item_type} C={C} />
              <DetailRow label="BATCH TRACKING" value={selectedProduct.has_batch_tracking ? "Enabled" : "Disabled"} C={C} />
              {selectedProduct.description && <DetailRow label="DESCRIPTION" value={selectedProduct.description} C={C} />}
            </View>
          </ScrollView>
        </View>
      )}

      {/* ─── ADD / EDIT FULLSCREEN MODAL ─── */}
      <FullScreenModal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={isEditMode ? "Edit Product" : "Add New Product"}
        subtitle={isEditMode ? "Update product profile, pricing & tax configuration" : "Register a new product in your inventory"}
        breadcrumb="inventory / products"
        scrollEnabled={true}
        footerActions={
          <View style={{ flexDirection: "row", gap: 10, flex: 1, justifyContent: "space-between", alignItems: "center" }}>
            {/* Step indicator */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ flexDirection: "row", gap: 5 }}>
                {[1, 2, 3, 4].map(n => (
                  <View key={n} style={{ width: 28, height: 4, borderRadius: 2, backgroundColor: formTab >= n ? C.accent : (isDarkMode ? "#3D3D3D" : "#E5E7EB") }} />
                ))}
              </View>
              <Text style={{ fontSize: 13.5, fontWeight: "700", fontFamily: "Segoe UI Variable Text", color: C.textSecondary, letterSpacing: 0.5 }}>
                STEP {formTab} OF 4{[" — BASIC INFO", " — PRICING", " — TAX & GST", " — SETTINGS"][formTab - 1]}
              </Text>
            </View>
            {/* Buttons */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {formTab > 1 && <Button title="‹ Back" onPress={() => setFormTab(t => Math.max(1, t - 1) as any)} variant="secondary" size="large" style={{ minWidth: 100 }} />}
              <Button title="Discard Product" onPress={closeForm} variant="secondary" size="large" style={{ minWidth: 140 }} />
              {formTab < 4
                ? <Button title="Next ›" onPress={() => setFormTab(t => Math.min(4, t + 1) as any)} variant="primary" size="large" style={{ minWidth: 120 }} />
                : <Button title={isEditMode ? "Update Product" : "Save Product"} onPress={handleSave} variant="primary" size="large" loading={createMutation.isPending || updateMutation.isPending} style={{ minWidth: 160 }} />
              }
            </View>
          </View>
        }
      >
        <View style={{ paddingBottom: 10 }}>

          {/* ── TAB 1: Basic Info ── */}
          {formTab === 1 && (
            <View style={{ flexDirection: "row", gap: 24 }}>
              <View style={{ flex: 1.4, gap: 14 }}>
                <View style={{ backgroundColor: isDarkMode ? "#1A2536" : "#EFF6FF", borderWidth: 1, borderColor: isDarkMode ? "#1E3A5F" : "#BFDBFE", borderRadius: 8, padding: 14 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: C.textSecondary, letterSpacing: 0.8, marginBottom: 4 }}>PRODUCT TYPE</Text>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: C.accent, fontFamily: "Segoe UI Variable Display" }}>
                    {formData.item_type === "goods" ? "📦 Physical Goods" : "🛠 Service Item"}
                  </Text>
                </View>

                <Input
                   ref={nameRef}
                   label="PRODUCT NAME *"
                   value={formData.name}
                   onChangeText={v => set("name", v)}
                   placeholder="Enter product name..."
                   onSubmitEditing={() => descriptionRef.current?.focus()}
                 />
                 <Input
                   ref={descriptionRef}
                   label="DESCRIPTION"
                   value={formData.description}
                   onChangeText={v => set("description", v)}
                   placeholder="Short product description..."
                   onSubmitEditing={() => skuRef.current?.focus()}
                 />

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                     <Input
                       ref={skuRef}
                       label="SKU / ITEM CODE"
                       value={formData.sku}
                       onChangeText={v => set("sku", v)}
                       placeholder="AUTO-001"
                       onSubmitEditing={() => {
                         if (company?.settings?.enable_barcodes) {
                           barcodeRef.current?.focus();
                         } else {
                           setFormTab(2);
                         }
                       }}
                     />
                   </View>
                  {company?.settings?.enable_barcodes ? (
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15.5, fontWeight: "700", color: C.textSecondary, marginBottom: 8 }}>BARCODE</Text>
                      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                        <TextInput
                          ref={barcodeRef}
                          value={formData.barcode}
                          onChangeText={v => set("barcode", v)}
                          placeholder="EAN-13 code"
                          placeholderTextColor={C.textSecondary}
                          onSubmitEditing={() => setFormTab(2)}
                          style={{
                            flex: 1,
                            height: 48,
                            borderWidth: 2,
                            borderRadius: 6,
                            paddingHorizontal: 10,
                            fontSize: 18,
                            fontFamily: "Segoe UI Variable Text",
                            backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF",
                            borderColor: isDarkMode ? "#334155" : "#CBD5E1",
                            color: isDarkMode ? "#F8FAFC" : "#0F172A",
                          }}
                        />
                        <Pressable
                          onPress={async () => {
                            if (isEditMode && selectedProduct) {
                              try {
                                const response = await apiClient.post(`/api/v1/barcode/generate/${selectedProduct.id}`);
                                if (response.data?.barcode) {
                                  set("barcode", response.data.barcode);
                                }
                              } catch (err: any) {
                                Alert.alert("Error", err.response?.data?.detail || "Failed to generate barcode.");
                              }
                            } else {
                              const code = generateRandomEan13();
                              set("barcode", code);
                            }
                          }}
                          style={({ hovered }: any) => [
                            { height: 48, paddingHorizontal: 14, borderRadius: 6, backgroundColor: C.accent, justifyContent: "center", alignItems: "center" },
                            hovered && { opacity: 0.9 }
                          ]}
                        >
                          <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>GENERATE</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={{ flex: 1 }}><Input label="BARCODE" value={formData.barcode} onChangeText={v => set("barcode", v)} placeholder="8901234567890" /></View>
                  )}
                </View>

                <View style={{ flexDirection: "row", gap: 12, zIndex: 100 }}>
                  <View style={{ flex: 1 }}><InlineSelect label="PRIMARY UNIT" value={formData.unit} options={UNIT_OPTIONS} onChange={v => set("unit", v)} C={C} /></View>
                  <View style={{ flex: 1 }}><InlineSelect label="BASE UNIT" value={formData.base_unit} options={UNIT_OPTIONS} onChange={v => set("base_unit", v)} C={C} /></View>
                  <View style={{ flex: 1 }}><InlineSelect label="SECONDARY UNIT" value={formData.secondary_unit || ""} options={["", ...UNIT_OPTIONS]} onChange={v => set("secondary_unit", v)} C={C} /></View>
                </View>

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}><Input label="CONVERSION FACTOR" value={formData.conversion_factor} onChangeText={v => set("conversion_factor", v)} placeholder="1" keyboardType="numeric" /></View>
                  <View style={{ flex: 1 }}><Input label="OPENING STOCK" value={formData.opening_stock} onChangeText={v => set("opening_stock", v)} placeholder="0" keyboardType="numeric" editable={!isEditMode} /></View>
                </View>
              </View>

              {/* Right panel — live preview */}
              <View style={{ flex: 1, gap: 14 }}>
                <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 8, backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF", padding: 16, gap: 14 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: C.accent, letterSpacing: 0.8, marginBottom: 2 }}>PRODUCT PREVIEW</Text>
                  <View style={{ borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 12 }}>
                    <Text style={{ fontSize: 13, color: C.textSecondary, marginBottom: 3 }}>PRODUCT NAME</Text>
                    <Text style={{ fontSize: 22, fontWeight: "900", fontFamily: "Segoe UI Variable Display", color: formData.name ? C.textPrimary : C.textSecondary }} numberOfLines={2}>
                      {formData.name || "Enter name above..."}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 0 }}>
                    <View style={{ flex: 1, paddingRight: 12, borderRightWidth: 1, borderRightColor: C.border }}>
                      <Text style={{ fontSize: 12, color: C.textSecondary, marginBottom: 3 }}>SKU</Text>
                      <Text style={{ fontSize: 15, fontWeight: "800", fontFamily: "Segoe UI Variable Display", color: C.textPrimary }} numberOfLines={1}>{formData.sku || "—"}</Text>
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 12, borderRightWidth: 1, borderRightColor: C.border }}>
                      <Text style={{ fontSize: 12, color: C.textSecondary, marginBottom: 3 }}>UNIT</Text>
                      <Text style={{ fontSize: 15, fontWeight: "800", fontFamily: "Segoe UI Variable Display", color: C.textPrimary }}>{formData.unit}</Text>
                    </View>
                    <View style={{ flex: 1, paddingLeft: 12 }}>
                      <Text style={{ fontSize: 12, color: C.textSecondary, marginBottom: 3 }}>OPENING</Text>
                      <Text style={{ fontSize: 15, fontWeight: "800", fontFamily: "Segoe UI Variable Display", color: C.textPrimary }}>{formData.opening_stock || "0"}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, color: C.textSecondary }}>
                    {formData.item_type === "goods" ? "Physical goods item" : "Service item"} · {formData.is_active ? "Active" : "Inactive"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 12, zIndex: 90 }}>
                  <View style={{ flex: 1 }}><InlineSelect label="ITEM TYPE" value={formData.item_type} options={ITEM_TYPES} onChange={v => set("item_type", v)} C={C} /></View>
                </View>
                <Toggle value={formData.is_active} onChange={v => set("is_active", v)} label="Product Active Status" />
              </View>
            </View>
          )}

          {/* ── TAB 2: Pricing ── */}
          {formTab === 2 && (
            <View style={{ flexDirection: "row", gap: 24 }}>
              <View style={{ flex: 1.4, gap: 14 }}>
                <View style={{ backgroundColor: isDarkMode ? "#1A2536" : "#EFF6FF", borderWidth: 1, borderColor: isDarkMode ? "#1E3A5F" : "#BFDBFE", borderRadius: 8, padding: 14 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: C.textSecondary, letterSpacing: 0.8, marginBottom: 4 }}>PRICING NOTE</Text>
                  <Text style={{ fontSize: 13, color: C.textSecondary, fontFamily: "Segoe UI Variable Text" }}>Prices are exclusive of GST. Tax is calculated and added on top during invoicing.</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}><Input label="PURCHASE PRICE (₹)" value={formData.purchase_price} onChangeText={v => set("purchase_price", v)} placeholder="0.00" keyboardType="numeric" /></View>
                  <View style={{ flex: 1 }}><Input label="SALE PRICE (₹)" value={formData.sale_price} onChangeText={v => set("sale_price", v)} placeholder="0.00" keyboardType="numeric" /></View>
                  <View style={{ flex: 1 }}><Input label="MRP (₹)" value={formData.mrp} onChangeText={v => set("mrp", v)} placeholder="0.00" keyboardType="numeric" /></View>
                </View>
                <Input label="REORDER LEVEL (QTY)" value={formData.reorder_level} onChangeText={v => set("reorder_level", v)} placeholder="Minimum stock before reorder alert" keyboardType="numeric" />
              </View>

              {/* Pricing preview */}
              <View style={{ flex: 1 }}>
                <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 8, backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF", padding: 16, gap: 14 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: C.accent, letterSpacing: 0.8, marginBottom: 2 }}>PRICING PREVIEW</Text>
                  <View style={{ flexDirection: "row", gap: 0 }}>
                    <View style={{ flex: 1, paddingRight: 16, borderRightWidth: 1, borderRightColor: C.border }}>
                      <Text style={{ fontSize: 13, color: C.textSecondary, marginBottom: 3 }}>SALE PRICE</Text>
                      <Text style={{ fontSize: 30, fontWeight: "900", fontFamily: "Segoe UI Variable Display", color: C.accent }}>
                        ₹{parseFloat(formData.sale_price || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 16, borderRightWidth: 1, borderRightColor: C.border }}>
                      <Text style={{ fontSize: 13, color: C.textSecondary, marginBottom: 3 }}>MRP</Text>
                      <Text style={{ fontSize: 26, fontWeight: "800", fontFamily: "Segoe UI Variable Display", color: C.textPrimary }}>
                        ₹{parseFloat(formData.mrp || "0").toLocaleString("en-IN")}
                      </Text>
                    </View>
                    <View style={{ flex: 1, paddingLeft: 16 }}>
                      <Text style={{ fontSize: 13, color: C.textSecondary, marginBottom: 3 }}>MARGIN</Text>
                      <Text style={{ fontSize: 26, fontWeight: "800", fontFamily: "Segoe UI Variable Display", color: margin !== "—" && parseFloat(margin) > 0 ? "#22C55E" : C.textPrimary }}>
                        {margin}%
                      </Text>
                    </View>
                  </View>
                  <View style={{ height: 1, backgroundColor: C.border }} />
                  {[
                    { label: "Purchase Price", value: `₹${parseFloat(formData.purchase_price || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}` },
                    { label: "Reorder Level", value: `${formData.reorder_level || 0} ${formData.unit}` },
                  ].map((row, i) => (
                    <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 13, color: C.textSecondary }}>{row.label}</Text>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: C.textPrimary }}>{row.value}</Text>
                    </View>
                  ))}
                  <Text style={{ fontSize: 13, color: C.textSecondary }}>Prices exclusive of GST · Tax added at invoicing</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── TAB 3: Tax & GST ── */}
          {formTab === 3 && (
            <View style={{ flexDirection: "row", gap: 24 }}>
              <View style={{ flex: 1.4, gap: 14 }}>
                <View style={{ backgroundColor: isDarkMode ? "#1A2536" : "#EFF6FF", borderWidth: 1, borderColor: isDarkMode ? "#1E3A5F" : "#BFDBFE", borderRadius: 8, padding: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: C.accent, letterSpacing: 0.8, marginBottom: 8 }}>GLOBAL TAX CONFIGURATION (READ-ONLY)</Text>
                  <Text style={{ fontSize: 13.5, color: C.textSecondary, fontFamily: "Segoe UI Variable Text", lineHeight: 18, marginBottom: 14 }}>
                    Tax preferences and default rates are set up in system configuration and are automatically applied to this product.
                  </Text>
                  
                  <View style={{ gap: 12 }}>
                    <DetailRow label="GST REGISTERED" value={company?.is_gst_applicable ? "Yes" : "No"} C={C} />
                    {company?.is_gst_applicable && (
                      <>
                        <DetailRow label="DEFAULT GST RATE" value={`${company?.default_gst_rate || company?.default_tax_rate || "18"}%`} C={C} />
                        <DetailRow label="TYPE OF SUPPLY" value={company?.hsn_sac_type || "Goods"} C={C} />
                        <DetailRow 
                          label={company?.hsn_sac_type?.toLowerCase() === "service" ? "SAC CODE" : "HSN CODE"} 
                          value={company?.default_hsn_sac_code || "—"} 
                          C={C} 
                        />
                      </>
                    )}
                  </View>
                </View>
              </View>

              {/* GST Preview Panel */}
              <View style={{ flex: 1 }}>
                <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 8, backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF", padding: 16, gap: 14 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: C.accent, letterSpacing: 0.8, marginBottom: 2 }}>GST CONFIGURATION PREVIEW</Text>
                  <View style={{ flexDirection: "row", gap: 0 }}>
                    <View style={{ flex: 1, paddingRight: 16, borderRightWidth: 1, borderRightColor: C.border }}>
                      <Text style={{ fontSize: 13, color: C.textSecondary, marginBottom: 3 }}>TOTAL GST RATE</Text>
                      <Text style={{ fontSize: 30, fontWeight: "900", fontFamily: "Segoe UI Variable Display", color: C.accent }}>
                        {company?.is_gst_applicable ? `${company?.default_gst_rate || company?.default_tax_rate || "18"}%` : "0%"}
                      </Text>
                    </View>
                    {company?.is_gst_applicable && (
                      <>
                        <View style={{ flex: 1, paddingHorizontal: 16, borderRightWidth: 1, borderRightColor: C.border }}>
                          <Text style={{ fontSize: 13, color: C.textSecondary, marginBottom: 3 }}>CGST</Text>
                          <Text style={{ fontSize: 26, fontWeight: "800", fontFamily: "Segoe UI Variable Display", color: C.textPrimary }}>
                            {(parseFloat(company?.default_gst_rate || company?.default_tax_rate || "18") / 2).toFixed(1)}%
                          </Text>
                        </View>
                        <View style={{ flex: 1, paddingLeft: 16 }}>
                          <Text style={{ fontSize: 13, color: C.textSecondary, marginBottom: 3 }}>SGST</Text>
                          <Text style={{ fontSize: 26, fontWeight: "800", fontFamily: "Segoe UI Variable Display", color: C.textPrimary }}>
                            {(parseFloat(company?.default_gst_rate || company?.default_tax_rate || "18") / 2).toFixed(1)}%
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                  <View style={{ height: 1, backgroundColor: C.border }} />
                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 13, color: C.textSecondary }}>{company?.hsn_sac_type?.toLowerCase() === "service" ? "SAC CODE" : "HSN CODE"}</Text>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: C.textPrimary }}>{company?.default_hsn_sac_code || "—"}</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 13, color: C.textSecondary }}>PREFERENCE</Text>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: C.textPrimary }}>{company?.is_gst_applicable ? "Taxable" : "Exempt"}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, color: C.textSecondary }}>Auto-applied on invoices · Change rate per line item</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── TAB 4: Settings ── */}
          {formTab === 4 && (
            <View style={{ flexDirection: "row", gap: 24 }}>
              <View style={{ flex: 1.4, gap: 14 }}>
                <View style={{ backgroundColor: isDarkMode ? "#1A2536" : "#EFF6FF", borderWidth: 1, borderColor: isDarkMode ? "#1E3A5F" : "#BFDBFE", borderRadius: 8, padding: 14 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: C.textSecondary, letterSpacing: 0.8, marginBottom: 4 }}>PRODUCT SETTINGS</Text>
                  <Text style={{ fontSize: 13, color: C.textSecondary, fontFamily: "Segoe UI Variable Text" }}>Configure batch tracking, active status, and item type classification.</Text>
                </View>
                <View style={{ gap: 14, marginTop: 4 }}>
                  <Toggle value={formData.is_active} onChange={v => set("is_active", v)} label="Product Active (visible in invoices)" />
                  <Toggle value={formData.has_batch_tracking} onChange={v => set("has_batch_tracking", v)} label="Batch / Lot Tracking" />
                </View>
              </View>

              {/* Record summary */}
              <View style={{ flex: 1 }}>
                <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 16, backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF" }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.8, color: C.accent, marginBottom: 12 }}>RECORD SUMMARY</Text>
                  {[
                    { label: "Name", value: formData.name || "—" },
                    { label: "SKU", value: formData.sku || "—" },
                    { label: "HSN Code", value: formData.hsn_code || "—" },
                    { label: "Sale Price", value: `₹${parseFloat(formData.sale_price || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}` },
                    { label: "GST Rate", value: `${formData.tax_rate}%` },
                    { label: "Unit", value: formData.unit },
                    { label: "Item Type", value: formData.item_type },
                    { label: "Status", value: formData.is_active ? "Active" : "Inactive" },
                  ].map((row, i, arr) => (
                    <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: C.border, paddingBottom: 8, marginBottom: 8 }}>
                      <Text style={{ fontSize: 12.5, color: C.textSecondary, fontFamily: "Segoe UI Variable Text" }}>{row.label}</Text>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: C.textPrimary, fontFamily: "Segoe UI Variable Text", maxWidth: 160, textAlign: "right" }} numberOfLines={1}>{row.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>
      </FullScreenModal>

      {/* ─── BARCODE OPT-IN DIALOG ─── */}
      <Modal
        isOpen={company?.settings?.enable_barcodes === undefined}
        onClose={async () => {
          const currentSettings = company?.settings || {};
          try {
            const updated = await authApi.updateCompanyProfile({
              settings: { ...currentSettings, enable_barcodes: false }
            });
            setCompany(updated);
          } catch (e) {}
        }}
        title="Enable Barcode Features?"
        width={480}
        footerActions={
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={async () => {
                const currentSettings = company?.settings || {};
                try {
                  const updated = await authApi.updateCompanyProfile({
                    settings: { ...currentSettings, enable_barcodes: false }
                  });
                  setCompany(updated);
                } catch (e) {}
              }}
              style={{ height: 32, borderWidth: 1, borderColor: C.border, borderRadius: 4, paddingHorizontal: 16, justifyContent: "center" }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: C.textPrimary }}>No, Skip</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                const currentSettings = company?.settings || {};
                try {
                  const updated = await authApi.updateCompanyProfile({
                    settings: { ...currentSettings, enable_barcodes: true }
                  });
                  setCompany(updated);
                } catch (e) {}
              }}
              style={{ height: 32, borderRadius: 4, backgroundColor: C.accent, paddingHorizontal: 16, justifyContent: "center" }}
            >
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#FFFFFF" }}>Yes, Enable</Text>
            </Pressable>
          </View>
        }
      >
        <Text style={{ fontSize: 14.5, color: C.textPrimary, fontFamily: "Segoe UI Variable Text", lineHeight: 22 }}>
          Would you like to enable barcode support for this company? This will let you generate unique EAN-13 barcodes for your products and perform quick lookups during inventory and invoicing transactions. You can always change this choice later in Settings.
        </Text>
      </Modal>
      {/* DUPLICATE PRODUCT WARNING MODAL */}
      {duplicateWarningOpen && (
        <Modal
          isOpen={duplicateWarningOpen}
          onClose={() => {
            setDuplicateWarningOpen(false);
            setDuplicatePayload(null);
          }}
          title="Duplicate Product Name Warning"
          width={480}
        >
          <View style={{ padding: 16, gap: 16 }}>
            <Text style={{ fontSize: 15, color: C.textPrimary, lineHeight: 22 }}>
              A product with the name <Text style={{ fontWeight: "700" }}>"{formData.name}"</Text> already exists in your inventory registry.
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
                  handleSave();
                }}
              />
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  setDuplicateWarningOpen(false);
                  setDuplicatePayload(null);
                }}
              />
            </View>
          </View>
        </Modal>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  masterSection: {
    flex: 1,
    padding: 24,
    gap: 20,
  },
});
