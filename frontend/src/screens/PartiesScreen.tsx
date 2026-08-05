// =============================================================
// JK INFOTECH ERP — Customers & Vendors Registry (Fluent Master-Detail)
// File : src/screens/PartiesScreen.tsx
// =============================================================

import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  DeviceEventEmitter
} from "react-native";
import { useUIStore } from "../store/uiStore";
import { ModuleHelpModal, HelpCategory } from "../components/ui/ModuleHelpModal";
import { useAuthStore } from "../store/authStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/client";
import { invalidateAllQueries } from "../utils/queryHelpers";
import { DataTable, ColumnDefinition } from "../components/ui/DataTable";
import { SearchToolbar } from "../components/ui/SearchToolbar";
import { FullScreenModal } from "../components/ui/FullScreenModal";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

// ─── Interfaces ───────────────────────────────────────────────
interface Party {
  id: string;
  name: string;
  gst_number?: string;
  pan_number?: string;
  phone?: string;
  mobile_no?: string;
  secondary_phone?: string;
  email?: string;
  address?: string;
  street2?: string;
  address_3?: string;
  city?: string;
  state?: string;
  state_code?: string;
  pincode?: string;
  country: string;
  station?: string;
  opening_balance: number;
  outstanding_balance?: number;
  opening_balance_type: string;
  is_active: boolean;
  default_tax_rate?: number;
  gst_treatment: string;
  gst_filling_method?: string;
  payment_terms: string;
  msme_no?: string;
  type_of_trader?: string;
  type_of_supply: string;
  discount_pct: number;
  tds_rate: number;
  bill_by_bill: boolean;
  check_credit_days: boolean;
  bank_name?: string;
  bank_branch?: string;
  ifsc_code?: string;
  bank_account_no?: string;
  credit_limit?: number;
  credit_days?: number;
}

// ─── Dropdown options ──────────────────────────────────────────
const GST_TREATMENTS = [
  "Registered Business", "Unregistered Business", "Consumer",
  "Overseas", "Special Economic Zone", "Deemed Export"
];
const PAYMENT_TERMS_OPTS = ["Immediate", "7 Days", "15 Days", "30 Days", "45 Days", "60 Days", "90 Days"];
const SUPPLY_TYPES = ["Goods", "Services"];
const TRADER_TYPES = ["Regular", "Manufacturer", "Retailer", "Wholesaler", "Distributor"];
const OB_TYPES = [
  { value: "dr", label: "Debit (Dr) — Receivable" },
  { value: "cr", label: "Credit (Cr) — Payable" }
];

// ─── Blank form ────────────────────────────────────────────────
function blankForm(isCustomer: boolean): any {
  return {
    name: "", phone: "", mobile_no: "", secondary_phone: "", email: "",
    address: "", street2: "", address_3: "", city: "", state: "",
    state_code: "", pincode: "", country: "India", station: "",
    gst_number: "", gst_treatment: "Registered Business", pan_number: "",
    default_tax_rate: "", type_of_supply: "Goods", type_of_trader: "Regular",
    msme_no: "", gst_filling_method: "",
    opening_balance: "", opening_balance_type: "dr", payment_terms: "Immediate",
    discount_pct: "", tds_rate: "", bill_by_bill: true, check_credit_days: false,
    is_active: true, credit_limit: isCustomer ? "" : undefined, credit_days: "",
    bank_name: "", bank_branch: "", ifsc_code: "", bank_account_no: ""
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

function Toggle({ value, onChange, label, C }: { value: boolean; onChange: (v: boolean) => void; label: string; C: any }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{
        width: 44, height: 24, borderRadius: 12, borderWidth: 1,
        borderColor: value ? "#22C55E" : C.border,
        backgroundColor: value ? "#22C55E" : (C.isDarkMode ? "#1E293B" : "#E2E8F0"),
        padding: 2, justifyContent: "center", alignItems: value ? "flex-end" : "flex-start"
      }}>
        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#FFFFFF" }} />
      </View>
      <Text style={{ fontSize: 14, color: C.textPrimary, fontFamily: "Segoe UI Variable Text" }}>
        {label} <Text style={{ color: value ? "#22C55E" : C.textSecondary, fontWeight: "700" }}>{value ? "ON" : "OFF"}</Text>
      </Text>
    </Pressable>
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
      <Pressable
        onPress={() => setOpen(o => !o)}
        style={{ height: 40, borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderColor: C.border, backgroundColor: C.surface }}
      >
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
export default function PartiesScreen() {
  const { activeScreen, isDarkMode, setIsFullScreenOpen, setActiveScreen } = useUIStore();
  const { company } = useAuthStore();
  const queryClient = useQueryClient();

  const isCustomer = activeScreen === "CUSTOMERS";
  const apiEndpoint = isCustomer ? "/api/customers" : "/api/suppliers";
  const entityLabel = isCustomer ? "Customer" : "Vendor";
  const entityLabelPlural = isCustomer ? "Customers" : "Vendors";

  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<any>(blankForm(isCustomer));
  const [formTab, setFormTab] = useState<1 | 2 | 3 | 4>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [helpModalCategory, setHelpModalCategory] = useState<HelpCategory>("PARTIES_GUIDE");

  const C = isDarkMode
    ? { bg: "#0F172A", surface: "#1E293B", border: "#334155", textPrimary: "#F8FAFC", textSecondary: "#94A3B8", accent: "#38BDF8", divider: "#334155", statusActive: "#22C55E", statusInactive: "#EF4444", isDarkMode: true }
    : { bg: "#F8FAFC", surface: "#FFFFFF", border: "#E2E8F0", textPrimary: "#0F172A", textSecondary: "#64748B", accent: "#0284C7", divider: "#E2E8F0", statusActive: "#16A34A", statusInactive: "#DC2626", isDarkMode: false };

  const { data: parties = [], isLoading, refetch } = useQuery<Party[]>({
    queryKey: [isCustomer ? "customers" : "suppliers", company?.id],
    queryFn: async () => { const res = await apiClient.get(apiEndpoint); return res.data; },
    staleTime: 0
  });

  React.useEffect(() => {
    if (activeScreen === "PARTIES" || activeScreen === "CUSTOMERS" || activeScreen === "VENDORS") {
      refetch();
    }
  }, [activeScreen]);

  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener("openSearchResult", ({ targetScreen, targetId, title }) => {
      if (targetScreen === "PARTIES" || targetScreen === "CUSTOMERS" || targetScreen === "VENDORS") {
        if (title) setSearchQuery(title);
        if (parties && parties.length > 0) {
          const match = parties.find(p => p.id === targetId || p.name.toLowerCase() === (title || "").toLowerCase());
          if (match) setSelectedParty(match);
        }
      }
    });
    return () => sub.remove();
  }, [parties]);

  const createMutation = useMutation({
    mutationFn: async (payload: any) => { const res = await apiClient.post(apiEndpoint, payload); return res.data; },
    onSuccess: (newParty: Party) => {
      const qKey = [isCustomer ? "customers" : "suppliers", company?.id];
      queryClient.setQueryData<Party[]>(qKey, (old = []) => {
        if (old.some(p => p.id === newParty.id)) return old;
        return [newParty, ...old];
      });
      invalidateAllQueries(queryClient);
      setIsFormOpen(false);
      setFormData(blankForm(isCustomer));
      setFormTab(1);
      setIsFullScreenOpen(false);
    },
    onError: (err: any) => { Alert.alert("Error", err.response?.data?.detail || `Failed to create ${entityLabel}.`); }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { const res = await apiClient.put(`${apiEndpoint}/${id}`, data); return res.data; },
    onSuccess: (updatedParty: Party) => {
      const qKey = [isCustomer ? "customers" : "suppliers", company?.id];
      queryClient.setQueryData<Party[]>(qKey, (old = []) =>
        old.map(p => (p.id === updatedParty.id ? updatedParty : p))
      );
      invalidateAllQueries(queryClient);
      setSelectedParty(updatedParty);
      setIsFormOpen(false);
      setIsFullScreenOpen(false);
    },
    onError: (err: any) => { Alert.alert("Error", err.response?.data?.detail || "Update failed."); }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`${apiEndpoint}/${id}`); },
    onSuccess: () => {
      invalidateAllQueries(queryClient);
      setSelectedParty(null);
      Alert.alert("Success", `${entityLabel} deleted successfully.`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || `This ${entityLabel.toLowerCase()} has existing invoices or payment history. Deletion is blocked to protect your tax & accounting records.\n\nPlease mark them as INACTIVE instead.`;
      Alert.alert(`Cannot Delete ${entityLabel}`, msg);
    }
  });

  const set = (key: string, val: any) => setFormData((f: any) => ({ ...f, [key]: val }));

  const openAdd = () => {
    setIsEditMode(false);
    setFormData(blankForm(isCustomer));
    setFormTab(1);
    setIsFormOpen(true);
    setIsFullScreenOpen(true);
  };

  const openEdit = (party: Party) => {
    setIsEditMode(true);
    setFormData({
      name: party.name, phone: party.phone || "", mobile_no: party.mobile_no || "",
      secondary_phone: party.secondary_phone || "", email: party.email || "",
      address: party.address || "", street2: party.street2 || "", address_3: party.address_3 || "",
      city: party.city || "", state: party.state || "", state_code: party.state_code || "",
      pincode: party.pincode || "", country: party.country || "India", station: party.station || "",
      gst_number: party.gst_number || "", gst_treatment: party.gst_treatment || "Registered Business",
      pan_number: party.pan_number || "", default_tax_rate: String(party.default_tax_rate || "18"),
      type_of_supply: party.type_of_supply || "Goods", type_of_trader: party.type_of_trader || "Regular",
      msme_no: party.msme_no || "", gst_filling_method: party.gst_filling_method || "",
      opening_balance: String(party.opening_balance || "0"), opening_balance_type: party.opening_balance_type || "dr",
      payment_terms: party.payment_terms || "Immediate", discount_pct: String(party.discount_pct || "0"),
      tds_rate: String(party.tds_rate || "0"), bill_by_bill: party.bill_by_bill ?? true,
      check_credit_days: party.check_credit_days ?? false, is_active: party.is_active ?? true,
      credit_limit: isCustomer ? String(party.credit_limit || "0") : undefined, credit_days: String(party.credit_days || "0"),
      bank_name: party.bank_name || "", bank_branch: party.bank_branch || "",
      ifsc_code: party.ifsc_code || "", bank_account_no: party.bank_account_no || ""
    });
    setFormTab(1);
    setIsFormOpen(true);
    setIsFullScreenOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) { Alert.alert("Validation", "Name is required."); return; }

    const isGst = company?.is_gst_applicable ?? true;
    const resolvedGstRate = isGst ? (parseFloat(company?.default_gst_rate || company?.default_tax_rate || "18") || 0) : 0;
    const resolvedSupplyType = company?.hsn_sac_type || "Goods";

    const payload: any = {
      ...formData,
      default_tax_rate: resolvedGstRate,
      type_of_supply: resolvedSupplyType,
      opening_balance: parseFloat(formData.opening_balance) || 0,
      discount_pct: parseFloat(formData.discount_pct) || 0,
      tds_rate: parseFloat(formData.tds_rate) || 0,
      credit_days: parseInt(formData.credit_days) || 0
    };
    if (isCustomer) payload.credit_limit = parseFloat(formData.credit_limit) || 0;
    if (isEditMode && selectedParty) updateMutation.mutate({ id: selectedParty.id, data: payload });
    else createMutation.mutate(payload);
  };

  // ── Multi-field Effective Search ──
  const filteredParties = useMemo(() => {
    return parties.filter(p => {
      const isActive = p.is_active !== false;
      const matchStatus = statusFilter === "ALL" || (statusFilter === "ACTIVE" && isActive) || (statusFilter === "INACTIVE" && !isActive);
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.phone && p.phone.toLowerCase().includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.gst_number && p.gst_number.toLowerCase().includes(q)) ||
        (p.city && p.city.toLowerCase().includes(q)) ||
        (p.state && p.state.toLowerCase().includes(q)) ||
        ((p as any).outstanding_balance && (p as any).outstanding_balance.toString().includes(q)) ||
        ((p as any).balance && (p as any).balance.toString().includes(q));
      return matchStatus && matchSearch;
    });
  }, [parties, searchQuery, statusFilter]);

  const columns: ColumnDefinition<Party>[] = [
    { header: "#", accessorKey: "id", width: 48, render: (_: any, idx?: number) => <Text style={{ fontSize: 13.5, color: C.textSecondary, fontFamily: "Segoe UI Variable Text" }}>{(idx ?? 0) + 1}</Text> },
    {
      header: "NAME", accessorKey: "name", flex: 2.2,
      render: (row: Party) => (
        <View>
          <Text style={{ fontSize: 14.5, fontWeight: "700", color: C.textPrimary, fontFamily: "Segoe UI Variable Text" }} numberOfLines={1}>{row.name}</Text>
          {row.city ? <Text style={{ fontSize: 12, color: C.textSecondary, fontFamily: "Segoe UI Variable Text" }} numberOfLines={1}>{row.city}{row.state ? `, ${row.state}` : ""}</Text> : null}
        </View>
      )
    },
    {
      header: "GSTIN", accessorKey: "gst_number", flex: 1.8,
      render: (row: Party) => <Text style={{ fontSize: 13.5, color: row.gst_number ? C.textPrimary : C.textSecondary, fontFamily: "Segoe UI Variable Text" }} numberOfLines={1}>{row.gst_number || row.gst_treatment || "Unregistered"}</Text>
    },
    {
      header: "PHONE", accessorKey: "phone", flex: 1.3,
      render: (row: Party) => <Text style={{ fontSize: 13.5, color: C.textPrimary, fontFamily: "Segoe UI Variable Text" }}>{row.phone || row.mobile_no || "—"}</Text>
    },
    {
      header: isCustomer ? "OUTSTANDING / CREDIT" : "OUTSTANDING / TERMS", accessorKey: "outstanding_balance", flex: 1.5, align: "right" as any,
      render: (row: Party) => {
        const out = Number(row.outstanding_balance ?? row.opening_balance ?? 0);
        const credLim = Number(row.credit_limit || 0);
        const credDays = Number(row.credit_days || 0);

        let subtext = "";
        if (isCustomer) {
          if (credLim > 0 || credDays > 0) {
            const limStr = credLim > 0 ? `₹${credLim.toLocaleString("en-IN")}` : "No Limit";
            const daysStr = credDays > 0 ? `${credDays}d` : "";
            subtext = `Lim: ${limStr}${daysStr ? ` | ${daysStr}` : ""}`;
          } else {
            subtext = "No Credit Limit";
          }
        } else {
          subtext = `Terms: ${row.payment_terms || "Immediate"}`;
        }

        return (
          <View style={{ alignItems: "flex-end", justifyContent: "center" }}>
            <Text style={{ fontSize: 13.5, fontWeight: "700", color: out > 0 ? (isCustomer ? C.accent : "#EF4444") : C.textPrimary, fontFamily: "Segoe UI Variable Text" }}>
              ₹{out.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={{ fontSize: 11, color: C.textSecondary, fontFamily: "Segoe UI Variable Text", marginTop: 2 }}>
              {subtext}
            </Text>
          </View>
        );
      }
    },
    {
      header: "STATUS", accessorKey: "is_active", width: 90, align: "center" as any,
      render: (row: Party) => {
        const isActive = row.is_active !== false;
        return (
          <View style={{ backgroundColor: isActive ? (isDarkMode ? "#14532D" : "#DCFCE7") : (isDarkMode ? "#450A0A" : "#FEE2E2"), borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "center" }}>
            <Text style={{ fontSize: 11.5, fontWeight: "800", fontFamily: "Segoe UI Variable Text", color: isActive ? C.statusActive : C.statusInactive }}>
              {isActive ? "ACTIVE" : "INACTIVE"}
            </Text>
          </View>
        );
      }
    }
  ];

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: C.bg }}>

      {/* ─── LEFT: MASTER LIST ─── */}
      <View style={[styles.masterSection, selectedParty && { flex: 0.6, borderRightWidth: 1, borderRightColor: C.divider }]}>
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable onPress={() => setActiveScreen("DASHBOARD")} style={({ hovered }: any) => [hovered && { opacity: 0.8 }]}>
              <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1.2, color: C.accent, fontFamily: "Segoe UI Variable Text" }}>
                DASHBOARD
              </Text>
            </Pressable>
            <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1.2, color: C.textSecondary, fontFamily: "Segoe UI Variable Text" }}>
              {" / "}PARTIES / {entityLabelPlural.toUpperCase()}
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 28, fontWeight: "700", color: C.textPrimary, fontFamily: "Segoe UI Variable Display" }}>
              {entityLabelPlural} Registry
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>

              <Button title={`+ Add ${entityLabel}`} onPress={openAdd} variant="primary" size="medium" />
            </View>
          </View>
          <Text style={{ fontSize: 15, color: C.textSecondary, fontFamily: "Segoe UI Variable Text" }}>
            Manage {entityLabelPlural.toLowerCase()}, payment terms, outstanding balances & contact details.
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <SearchToolbar placeholder={`Search by name, GSTIN, phone or city...`} value={searchQuery} onChangeText={setSearchQuery} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, height: 32 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["ALL", "ACTIVE", "INACTIVE"] as const).map(f => (
                <Pressable key={f} onPress={() => setStatusFilter(f)} style={{
                  paddingHorizontal: 14, height: 28, borderRadius: 14, justifyContent: "center",
                  backgroundColor: statusFilter === f ? C.accent : (isDarkMode ? "#1E293B" : "#F1F5F9"),
                  borderWidth: 1, borderColor: statusFilter === f ? C.accent : C.border
                }}>
                  <Text style={{ fontSize: 12.5, fontWeight: "700", fontFamily: "Segoe UI Variable Text", color: statusFilter === f ? "#FFFFFF" : C.textSecondary }}>{f}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        <DataTable
          data={filteredParties}
          columns={columns}
          isLoading={isLoading}
          onRowPress={(item) => setSelectedParty(item)}
          selectedId={selectedParty?.id}
          emptyMessage={`No ${entityLabelPlural.toLowerCase()} found.`}
          loaderMessage="Loading directory..."
        />
      </View>

      {/* ─── RIGHT: DETAIL PANEL ─── */}
      {selectedParty && (
        <View style={{ flex: 0.4, backgroundColor: C.card, borderLeftWidth: 1, borderLeftColor: C.border }}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={true}>
            
            {/* Header: Title, Active Switch & Close */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontSize: 24, fontWeight: "800", color: C.textPrimary, fontFamily: "Segoe UI Variable Display" }} numberOfLines={2}>
                  {selectedParty.name}
                </Text>
                
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
                  {/* Entity Type Badge */}
                  <View style={{ backgroundColor: isDarkMode ? "rgba(56,189,248,0.15)" : "#E0F2FE", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 }}>
                    <Text style={{ fontSize: 11.5, fontWeight: "800", color: C.accent }}>
                      {isCustomer ? "CUSTOMER REGISTRY" : "VENDOR REGISTRY"}
                    </Text>
                  </View>

                  {/* Active / Inactive Switch Pill */}
                  <Pressable
                    onPress={() => {
                      const newStatus = !selectedParty.is_active;
                      updateMutation.mutate({
                        id: selectedParty.id,
                        data: { ...selectedParty, is_active: newStatus }
                      });
                    }}
                    style={({ hovered }: any) => [
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        backgroundColor: selectedParty.is_active ? (isDarkMode ? "#14532D" : "#DCFCE7") : (isDarkMode ? "#450A0A" : "#FEE2E2"),
                        borderColor: selectedParty.is_active ? (isDarkMode ? "#22C55E" : "#86EFAC") : (isDarkMode ? "#EF4444" : "#FCA5A5"),
                        borderWidth: 1,
                        borderRadius: 14,
                        paddingHorizontal: 10,
                        paddingVertical: 3
                      },
                      hovered && { opacity: 0.85 }
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "800", fontFamily: "Segoe UI Variable Text", color: selectedParty.is_active ? (isDarkMode ? "#86EFAC" : "#16A34A") : (isDarkMode ? "#FCA5A5" : "#DC2626") }}>
                      {selectedParty.is_active ? "ACTIVE" : "INACTIVE"}
                    </Text>
                    <View style={{
                      width: 26,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: selectedParty.is_active ? "#16A34A" : "#94A3B8",
                      padding: 2,
                      justifyContent: "center",
                      alignItems: selectedParty.is_active ? "flex-end" : "flex-start"
                    }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#FFFFFF" }} />
                    </View>
                  </Pressable>
                </View>
              </View>

              <Pressable onPress={() => setSelectedParty(null)} style={({ hovered }: any) => ({ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: hovered ? "#E81123" : (isDarkMode ? "rgba(239,68,68,0.15)" : "#FEE2E2") })}>
                <Text style={{ fontSize: 16, fontWeight: "bold", color: isDarkMode ? "#EF4444" : "#DC2626" }}>✕</Text>
              </Pressable>
            </View>

            {/* Outstanding Balance Highlight Card */}
            <View style={{ borderWidth: 1, borderColor: isDarkMode ? "#1E3A5F" : "#BFDBFE", borderRadius: 10, padding: 16, backgroundColor: isDarkMode ? "#1A2536" : "#EFF6FF", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ fontSize: 11, fontWeight: "800", color: C.textSecondary, letterSpacing: 0.8 }}>CURRENT OUTSTANDING BALANCE</Text>
                <Text style={{ fontSize: 24, fontWeight: "900", fontFamily: "Segoe UI Variable Display", color: Number(selectedParty.outstanding_balance || 0) > 0 ? (isCustomer ? C.accent : "#EF4444") : C.textPrimary, marginTop: 2 }}>
                  ₹{Number(selectedParty.outstanding_balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{ backgroundColor: isDarkMode ? "rgba(56,189,248,0.15)" : "#FFFFFF", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: isDarkMode ? "transparent" : "#BFDBFE" }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: C.accent }}>
                  {isCustomer ? "RECEIVABLE" : "PAYABLE"}
                </Text>
              </View>
            </View>

            {/* Action Toolbar */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button title="✎ Edit Profile" onPress={() => openEdit(selectedParty)} variant="primary" size="medium" style={{ flex: 1 }} />
              <Button icon={<Text style={{ fontFamily: "Segoe MDL2 Assets", fontSize: 14, color: "#EF4444", fontWeight: "bold" }}>{"\uE74D"}</Text>} title="Delete Record" onPress={() => deleteMutation.mutate(selectedParty.id)} variant="secondary" size="medium" style={{ flex: 1 }} textStyle={{ color: "#EF4444" }} />
            </View>

            {/* Card 1: CONTACT INFORMATION */}
            <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 16, backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC", gap: 10 }}>
              <SecHeader label="CONTACT INFORMATION" accent={C.accent} />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}><DetailRow label="PHONE" value={selectedParty.phone} C={C} /></View>
                <View style={{ flex: 1 }}><DetailRow label="MOBILE NO." value={selectedParty.mobile_no} C={C} /></View>
              </View>
              <DetailRow label="EMAIL ADDRESS" value={selectedParty.email} C={C} />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}><DetailRow label="GSTIN NUMBER" value={selectedParty.gst_number} C={C} /></View>
                <View style={{ flex: 1 }}><DetailRow label="GST TREATMENT" value={selectedParty.gst_treatment} C={C} /></View>
              </View>
              <DetailRow label="PAN NUMBER" value={selectedParty.pan_number} C={C} />
            </View>

            {/* Card 2: ADDRESS & STATION */}
            <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 16, backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC", gap: 10 }}>
              <SecHeader label="ADDRESS & STATION" accent={C.accent} />
              <DetailRow label="ADDRESS LINE 1" value={selectedParty.address} C={C} />
              {selectedParty.street2 && <DetailRow label="ADDRESS LINE 2" value={selectedParty.street2} C={C} />}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}><DetailRow label="CITY" value={selectedParty.city} C={C} /></View>
                <View style={{ flex: 1 }}><DetailRow label="STATE" value={selectedParty.state} C={C} /></View>
                <View style={{ flex: 0.8 }}><DetailRow label="PINCODE" value={selectedParty.pincode} C={C} /></View>
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}><DetailRow label="COUNTRY" value={selectedParty.country} C={C} /></View>
                <View style={{ flex: 1 }}><DetailRow label="STATION / AREA" value={selectedParty.station} C={C} /></View>
              </View>
            </View>

            {/* Card 3: FINANCIAL TERMS & CREDIT STANDING */}
            <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 16, backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC", gap: 10 }}>
              <SecHeader label="FINANCIAL TERMS & CREDIT STANDING" accent={C.accent} />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}><DetailRow label="OPENING BALANCE" value={`₹${Number(selectedParty.opening_balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })} ${(selectedParty.opening_balance_type || "dr").toUpperCase()}`} C={C} /></View>
                <View style={{ flex: 1 }}><DetailRow label="PAYMENT TERMS" value={selectedParty.payment_terms} C={C} /></View>
              </View>
              {isCustomer && (
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}><DetailRow label="CREDIT LIMIT" value={`₹${Number(selectedParty.credit_limit || 0).toLocaleString("en-IN")}`} C={C} /></View>
                  <View style={{ flex: 1 }}><DetailRow label="CREDIT DAYS" value={`${selectedParty.credit_days || 0} days`} C={C} /></View>
                </View>
              )}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}><DetailRow label="DISCOUNT %" value={selectedParty.discount_pct ? `${selectedParty.discount_pct}%` : "—"} C={C} /></View>
                <View style={{ flex: 1 }}><DetailRow label="TDS RATE %" value={selectedParty.tds_rate ? `${selectedParty.tds_rate}%` : "—"} C={C} /></View>
              </View>
            </View>

            {/* Card 4: BANKING & SETTLEMENT DETAILS */}
            {(selectedParty.bank_name || selectedParty.bank_account_no) && (
              <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 16, backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC", gap: 10 }}>
                <SecHeader label="BANKING DETAILS" accent={C.accent} />
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}><DetailRow label="BANK NAME" value={selectedParty.bank_name} C={C} /></View>
                  <View style={{ flex: 1 }}><DetailRow label="BRANCH" value={selectedParty.bank_branch} C={C} /></View>
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}><DetailRow label="ACCOUNT NO." value={selectedParty.bank_account_no} C={C} /></View>
                  <View style={{ flex: 1 }}><DetailRow label="IFSC CODE" value={selectedParty.ifsc_code} C={C} /></View>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* ─── ADD / EDIT FULLSCREEN MODAL ─── */}
      <FullScreenModal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setFormTab(1); setIsFullScreenOpen(false); }}
        title={isEditMode ? `Edit ${entityLabel}` : `Add New ${entityLabel}`}
        subtitle={isEditMode ? `Update ${entityLabel.toLowerCase()} profile and financial parameters` : `Register a new ${entityLabel.toLowerCase()} in your directory`}
        breadcrumb={`parties / ${entityLabelPlural.toLowerCase()}`}
        scrollEnabled={true}
        footerActions={
          <View style={{ flexDirection: "row", gap: 10, flex: 1, justifyContent: "space-between", alignItems: "center" }}>
            {/* Step indicator — matches invoice modal style exactly */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ flexDirection: "row", gap: 5 }}>
                {[1, 2, 3, 4].map(n => (
                  <View key={n} style={{ width: 28, height: 4, borderRadius: 2, backgroundColor: formTab >= n ? C.accent : (isDarkMode ? "#3D3D3D" : "#E5E7EB") }} />
                ))}
              </View>
              <Text style={{ fontSize: 13.5, fontWeight: "700", fontFamily: "Segoe UI Variable Text", color: C.textSecondary, letterSpacing: 0.5 }}>
                STEP {formTab} OF 4{[" — BASIC INFO", " — TAX & GST", " — FINANCIAL", " — BANK DETAILS"][formTab - 1]}
              </Text>
            </View>
            {/* Action buttons */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {formTab > 1 && <Button title="‹ Back" onPress={() => setFormTab(t => Math.max(1, t - 1) as any)} variant="secondary" size="large" style={{ minWidth: 100 }} />}
              <Button title={`Discard ${entityLabel}`} onPress={() => { setIsFormOpen(false); setFormTab(1); setIsFullScreenOpen(false); }} variant="secondary" size="large" style={{ minWidth: 140 }} />
              {formTab < 4
                ? <Button title="Next ›" onPress={() => setFormTab(t => Math.min(4, t + 1) as any)} variant="primary" size="large" style={{ minWidth: 120 }} />
                : <Button title={isEditMode ? `Update ${entityLabel}` : `Save ${entityLabel}`} onPress={handleSave} variant="primary" size="large" loading={createMutation.isPending || updateMutation.isPending} loadingText={isEditMode ? `Updating ${entityLabel}...` : `Saving ${entityLabel}...`} style={{ minWidth: 160 }} />
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
                  <Text style={{ fontSize: 12, fontWeight: "700", color: C.textSecondary, letterSpacing: 0.8, marginBottom: 4 }}>ENTITY TYPE</Text>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: C.accent, fontFamily: "Segoe UI Variable Display" }}>
                    {isCustomer ? "📦 Customer / Buyer" : "🏭 Vendor / Supplier"}
                  </Text>
                </View>
                <Input label="LEGAL / BUSINESS NAME *" value={formData.name} onChangeText={v => set("name", v)} placeholder="Enter firm name..." />
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}><Input label="PHONE" value={formData.phone} onChangeText={v => set("phone", v)} placeholder="+91 99999 00000" keyboardType="phone-pad" /></View>
                  <View style={{ flex: 1 }}><Input label="MOBILE NO." value={formData.mobile_no} onChangeText={v => set("mobile_no", v)} placeholder="+91 99999 11111" keyboardType="phone-pad" /></View>
                  <View style={{ flex: 1 }}><Input label="SECONDARY PHONE" value={formData.secondary_phone} onChangeText={v => set("secondary_phone", v)} placeholder="+91 99999 22222" keyboardType="phone-pad" /></View>
                </View>
                <Input label="EMAIL ADDRESS" value={formData.email} onChangeText={v => set("email", v)} placeholder="account@company.com" keyboardType="email-address" />
                <Input label="ADDRESS LINE 1" value={formData.address} onChangeText={v => set("address", v)} placeholder="Street / Building / Area..." />
                <Input label="ADDRESS LINE 2" value={formData.street2} onChangeText={v => set("street2", v)} placeholder="Floor, Wing, Landmark..." />
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}><Input label="CITY" value={formData.city} onChangeText={v => set("city", v)} placeholder="Surat" /></View>
                  <View style={{ flex: 1 }}><Input label="STATE" value={formData.state} onChangeText={v => set("state", v)} placeholder="Gujarat" /></View>
                  <View style={{ flex: 0.7 }}><Input label="PINCODE" value={formData.pincode} onChangeText={v => set("pincode", v)} placeholder="395003" keyboardType="numeric" /></View>
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}><Input label="COUNTRY" value={formData.country} onChangeText={v => set("country", v)} placeholder="India" /></View>
                  <View style={{ flex: 1 }}><Input label="STATION / AREA" value={formData.station} onChangeText={v => set("station", v)} placeholder="Station or area..." /></View>
                </View>
              </View>
              <View style={{ flex: 1, gap: 14 }}>
                {/* Live Entry Preview Card — mirrors invoice GST strip style */}
                <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 8, backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF", padding: 16, gap: 14 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: C.accent, letterSpacing: 0.8, marginBottom: 2 }}>ENTITY PREVIEW</Text>
                  {/* Name — large display like Net Amount in invoice */}
                  <View style={{ borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 12 }}>
                    <Text style={{ fontSize: 13, color: C.textSecondary, marginBottom: 3 }}>BUSINESS NAME</Text>
                    <Text style={{ fontSize: 22, fontWeight: "900", fontFamily: "Segoe UI Variable Display", color: formData.name ? C.textPrimary : C.textSecondary }} numberOfLines={2}>
                      {formData.name || "Enter name above..."}
                    </Text>
                  </View>
                  {/* Contact strip — 3 items side by side like invoice CGST/SGST strip */}
                  <View style={{ flexDirection: "row", gap: 0 }}>
                    <View style={{ flex: 1, paddingRight: 12, borderRightWidth: 1, borderRightColor: C.border }}>
                      <Text style={{ fontSize: 12, color: C.textSecondary, marginBottom: 3 }}>PHONE</Text>
                      <Text style={{ fontSize: 15, fontWeight: "800", fontFamily: "Segoe UI Variable Display", color: C.textPrimary }} numberOfLines={1}>{formData.phone || "—"}</Text>
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 12, borderRightWidth: 1, borderRightColor: C.border }}>
                      <Text style={{ fontSize: 12, color: C.textSecondary, marginBottom: 3 }}>CITY</Text>
                      <Text style={{ fontSize: 15, fontWeight: "800", fontFamily: "Segoe UI Variable Display", color: C.textPrimary }} numberOfLines={1}>{formData.city || "—"}</Text>
                    </View>
                    <View style={{ flex: 1, paddingLeft: 12 }}>
                      <Text style={{ fontSize: 12, color: C.textSecondary, marginBottom: 3 }}>STATE</Text>
                      <Text style={{ fontSize: 15, fontWeight: "800", fontFamily: "Segoe UI Variable Display", color: C.textPrimary }} numberOfLines={1}>{formData.state || "—"}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, color: C.textSecondary, fontFamily: "Segoe UI Variable Text" }}>
                    {isCustomer ? "Customer account · " : "Vendor account · "}
                    {formData.country || "India"} · {formData.is_active ? "Active" : "Inactive"}
                  </Text>
                </View>
                <Toggle value={formData.is_active} onChange={v => set("is_active", v)} label="Account Active Status" C={C} />
              </View>
            </View>
          )}

          {/* ── TAB 2: Tax & GST ── */}
          {formTab === 2 && (
            <View style={{ flexDirection: "row", gap: 24 }}>
              <View style={{ flex: 1.4, gap: 14 }}>
                <View style={{ flexDirection: "row", gap: 12, zIndex: 100 }}>
                  <View style={{ flex: 1.5 }}><InlineSelect label="GST TREATMENT" value={formData.gst_treatment} options={GST_TREATMENTS} onChange={v => set("gst_treatment", v)} C={C} /></View>
                  <View style={{ flex: 1 }}><Input label="GSTIN" value={formData.gst_number} onChangeText={v => set("gst_number", v.toUpperCase())} placeholder="24XXXXX1234X1Z5" /></View>
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}><Input label="PAN NUMBER" value={formData.pan_number} onChangeText={v => set("pan_number", v.toUpperCase())} placeholder="ABCDE1234F" /></View>
                  <View style={{ flex: 1 }}><Input label="STATE CODE" value={formData.state_code} onChangeText={v => set("state_code", v)} placeholder="24" /></View>
                </View>
                <View style={{ flexDirection: "row", gap: 12, zIndex: 90 }}>
                  <View style={{ flex: 1 }}><InlineSelect label="TYPE OF TRADER" value={formData.type_of_trader} options={TRADER_TYPES} onChange={v => set("type_of_trader", v)} C={C} /></View>
                  <View style={{ flex: 1 }}><Input label="GST FILLING METHOD" value={formData.gst_filling_method} onChangeText={v => set("gst_filling_method", v)} placeholder="Monthly / Quarterly..." /></View>
                </View>
                <Input label="MSME REGISTRATION NO." value={formData.msme_no} onChangeText={v => set("msme_no", v)} placeholder="UDYAM-GJ-00-XXXXXXXX" />
              </View>
              <View style={{ flex: 1 }}>
                {/* Live GST Preview — matches invoice GST strip visual style */}
                <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 8, backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF", padding: 16, gap: 14 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: C.accent, letterSpacing: 0.8, marginBottom: 2 }}>GST CONFIGURATION PREVIEW</Text>
                  {/* Tax Rate — big number like invoice GST rate */}
                  <View style={{ flexDirection: "row", gap: 0 }}>
                    <View style={{ flex: 1, paddingRight: 16, borderRightWidth: 1, borderRightColor: C.border }}>
                      <Text style={{ fontSize: 13, color: C.textSecondary, marginBottom: 3 }}>DEFAULT TAX RATE</Text>
                      <Text style={{ fontSize: 30, fontWeight: "900", fontFamily: "Segoe UI Variable Display", color: C.accent }}>
                        {company?.is_gst_applicable ? `${company?.default_gst_rate || company?.default_tax_rate || "18"}` : "0"}%
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
                  {/* Treatment + GSTIN row */}
                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 13, color: C.textSecondary }}>TREATMENT</Text>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: C.textPrimary, maxWidth: 160, textAlign: "right" }} numberOfLines={1}>{formData.gst_treatment}</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 13, color: C.textSecondary }}>GSTIN</Text>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: formData.gst_number ? C.textPrimary : C.textSecondary }}>{formData.gst_number || "Not entered"}</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 13, color: C.textSecondary }}>SUPPLY TYPE (GLOBAL)</Text>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: C.textPrimary }}>{company?.hsn_sac_type || "Goods"}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, color: C.textSecondary }}>Auto-applied on invoices · Change rate per item</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── TAB 3: Financial ── */}
          {formTab === 3 && (
            <View style={{ flexDirection: "row", gap: 24 }}>
              <View style={{ flex: 1.4, gap: 14 }}>
                <View style={{ backgroundColor: isDarkMode ? "#1A2536" : "#EFF6FF", borderWidth: 1, borderColor: isDarkMode ? "#1E3A5F" : "#BFDBFE", borderRadius: 8, padding: 14 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: C.textSecondary, letterSpacing: 0.8, marginBottom: 4 }}>OPENING BALANCE NOTE</Text>
                  <Text style={{ fontSize: 13, color: C.textSecondary, fontFamily: "Segoe UI Variable Text" }}>Opening balance is the amount this party owes you (Dr) or you owe them (Cr) at first entry.</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 12, zIndex: 100 }}>
                  <View style={{ flex: 1.5 }}><Input label="OPENING BALANCE (₹)" value={formData.opening_balance} onChangeText={v => set("opening_balance", v)} placeholder="0.00" keyboardType="numeric" /></View>
                  <View style={{ flex: 1 }}><InlineSelect label="TYPE" value={formData.opening_balance_type} options={OB_TYPES} onChange={v => set("opening_balance_type", v)} C={C} /></View>
                </View>
                <View style={{ flexDirection: "row", gap: 12, zIndex: 90 }}>
                  <View style={{ flex: 1.5 }}><InlineSelect label="PAYMENT TERMS" value={formData.payment_terms} options={PAYMENT_TERMS_OPTS} onChange={v => set("payment_terms", v)} C={C} /></View>
                  <View style={{ flex: 1 }}><Input label="CREDIT DAYS" value={formData.credit_days} onChangeText={v => set("credit_days", v)} placeholder="0" keyboardType="numeric" /></View>
                </View>
                {isCustomer && <Input label="CREDIT LIMIT (₹)" value={formData.credit_limit} onChangeText={v => set("credit_limit", v)} placeholder="0.00" keyboardType="numeric" />}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}><Input label="DISCOUNT %" value={formData.discount_pct} onChangeText={v => set("discount_pct", v)} placeholder="0" keyboardType="numeric" /></View>
                  <View style={{ flex: 1 }}><Input label="TDS RATE %" value={formData.tds_rate} onChangeText={v => set("tds_rate", v)} placeholder="0" keyboardType="numeric" /></View>
                </View>
                <View style={{ gap: 12, marginTop: 4 }}>
                  <Toggle value={formData.bill_by_bill} onChange={v => set("bill_by_bill", v)} label="Bill-by-Bill Accounting" C={C} />
                  <Toggle value={formData.check_credit_days} onChange={v => set("check_credit_days", v)} label="Enforce Credit Day Limit" C={C} />
                </View>
              </View>
              <View style={{ width: 260 }}>
                <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 16, backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF" }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.8, color: C.accent, marginBottom: 12 }}>CREDIT SUMMARY</Text>
                  {[
                    { label: "Opening Balance", value: `₹${parseFloat(formData.opening_balance || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })} ${(formData.opening_balance_type || "dr").toUpperCase()}` },
                    ...(isCustomer ? [{ label: "Credit Limit", value: `₹${parseFloat(formData.credit_limit || "0").toLocaleString("en-IN")}` }] : []),
                    { label: "Credit Days", value: `${formData.credit_days || 0} days` },
                    { label: "Payment Terms", value: formData.payment_terms },
                    { label: "Discount", value: `${formData.discount_pct || 0}%` },
                    { label: "TDS Rate", value: `${formData.tds_rate || 0}%` },
                  ].map((row, i, arr) => (
                    <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: C.border, paddingBottom: 8, marginBottom: 8 }}>
                      <Text style={{ fontSize: 12.5, color: C.textSecondary, fontFamily: "Segoe UI Variable Text" }}>{row.label}</Text>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: C.textPrimary, fontFamily: "Segoe UI Variable Text" }}>{row.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* ── TAB 4: Bank Details ── */}
          {formTab === 4 && (
            <View style={{ flexDirection: "row", gap: 24 }}>
              <View style={{ flex: 1.4, gap: 14 }}>
                <View style={{ backgroundColor: isDarkMode ? "#1A2536" : "#EFF6FF", borderWidth: 1, borderColor: isDarkMode ? "#1E3A5F" : "#BFDBFE", borderRadius: 8, padding: 14 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: C.textSecondary, letterSpacing: 0.8, marginBottom: 4 }}>BANK ACCOUNT DETAILS</Text>
                  <Text style={{ fontSize: 13, color: C.textSecondary, fontFamily: "Segoe UI Variable Text" }}>Bank details are used for NEFT/RTGS payment processing and remittance advices.</Text>
                </View>
                <Input label="BANK NAME" value={formData.bank_name} onChangeText={v => set("bank_name", v)} placeholder="State Bank of India" />
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}><Input label="BRANCH" value={formData.bank_branch} onChangeText={v => set("bank_branch", v)} placeholder="Surat Main Branch" /></View>
                  <View style={{ flex: 1 }}><Input label="IFSC CODE" value={formData.ifsc_code} onChangeText={v => set("ifsc_code", v.toUpperCase())} placeholder="SBIN0000XXX" /></View>
                </View>
                <Input label="ACCOUNT NUMBER" value={formData.bank_account_no} onChangeText={v => set("bank_account_no", v)} placeholder="3081XXXXXXXX" keyboardType="numeric" />
                {(formData.bank_name || formData.bank_account_no) && (
                  <View style={{ borderWidth: 4, borderColor: C.border, borderRadius: 10, padding: 16, backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF" }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.8, color: C.textSecondary, marginBottom: 8 }}>BANK DETAILS PREVIEW</Text>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: C.textPrimary, fontFamily: "Segoe UI Variable Display" }}>{formData.bank_name || "—"}</Text>
                    <View style={{ height: 1, backgroundColor: C.border, marginVertical: 8 }} />
                    <Text style={{ fontSize: 14, color: C.textSecondary, fontFamily: "Segoe UI Variable Text" }}>
                      <Text style={{ fontWeight: "600", color: C.textPrimary }}>Account: </Text>{formData.bank_account_no || "—"}
                    </Text>
                    <Text style={{ fontSize: 14, color: C.textSecondary, fontFamily: "Segoe UI Variable Text" }}>
                      <Text style={{ fontWeight: "600", color: C.textPrimary }}>IFSC: </Text>{formData.ifsc_code || "—"}
                    </Text>
                    <Text style={{ fontSize: 14, color: C.textSecondary, fontFamily: "Segoe UI Variable Text" }}>
                      <Text style={{ fontWeight: "600", color: C.textPrimary }}>Branch: </Text>{formData.bank_branch || "—"}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ width: 260 }}>
                <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 16, backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF" }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.8, color: C.accent, marginBottom: 12 }}>RECORD SUMMARY</Text>
                  {[
                    { label: "Name", value: formData.name || "—" },
                    { label: "GSTIN", value: formData.gst_number || "—" },
                    { label: "City", value: formData.city || "—" },
                    { label: "Treatment", value: formData.gst_treatment },
                    { label: "Payment", value: formData.payment_terms },
                    ...(isCustomer ? [{ label: "Credit Limit", value: `₹${parseFloat(formData.credit_limit || "0").toLocaleString("en-IN")}` }] : []),
                  ].map((row, i, arr) => (
                    <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: C.border, paddingBottom: 8, marginBottom: 8 }}>
                      <Text style={{ fontSize: 12.5, color: C.textSecondary, fontFamily: "Segoe UI Variable Text" }}>{row.label}</Text>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: C.textPrimary, fontFamily: "Segoe UI Variable Text", maxWidth: 140, textAlign: "right" }} numberOfLines={1}>{row.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}
          </View>
      </FullScreenModal>
      <ModuleHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        initialCategory={helpModalCategory}
      />
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
