// =============================================================
// JK INFOTECH ERP — Company Selection Hub (Native UWP Style)
// File : src/screens/CompanySelectScreen.tsx
// =============================================================

import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, ActivityIndicator, ScrollView, DeviceEventEmitter } from "react-native";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import { authApi } from "../api/auth";
import { Modal } from "../components/ui/Modal";
import { FullScreenModal } from "../components/ui/FullScreenModal";
import { Button } from "../components/ui/Button";

// Segoe MDL2 glyphs
const GLYPHS = {
  COMPANY: "\uE719",
  SEARCH: "\uE721",
  ARROW_RIGHT: "\uE72A",
  CHECKMARK: "\uE73E",
  PLUS: "\uE710"
};

export default function CompanySelectScreen() {
  const { isDarkMode } = useUIStore();
  const { availableCompanies, company: currentCompany, switchActiveCompany, isSwitching, loadAvailableCompanies, deleteCompany } = useAuthStore();
  const [search, setSearch] = useState("");
  const [isLoadingCos, setIsLoadingCos] = useState(true);

  // Delete Company Modal state
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Automatically fetch companies from backend whenever CompanySelectScreen mounts
  useEffect(() => {
    let isMounted = true;
    setIsLoadingCos(true);
    loadAvailableCompanies()
      .catch(err => console.warn("Failed to fetch companies on hub mount:", err))
      .finally(() => {
        if (isMounted) setIsLoadingCos(false);
      });
    return () => { isMounted = false; };
  }, []);

  // Create Company Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [coName, setCoName] = useState("");
  const [coGst, setCoGst] = useState("");
  const [coPan, setCoPan] = useState("");
  const [coTan, setCoTan] = useState("");
  const [coEmail, setCoEmail] = useState("");
  const [coPhone, setCoPhone] = useState("");
  const [coMobile, setCoMobile] = useState("");
  const [coState, setCoState] = useState("");
  const [coAddress1, setCoAddress1] = useState("");
  const [coAddress2, setCoAddress2] = useState("");
  const [coAddress3, setCoAddress3] = useState("");
  const [coAddress4, setCoAddress4] = useState("");
  const [coPincode, setCoPincode] = useState("");
  const [coBank, setCoBank] = useState("");
  const [coBranch, setCoBranch] = useState("");
  const [coAccNo, setCoAccNo] = useState("");
  const [coIfsc, setCoIfsc] = useState("");

  // Verification & Loading states
  const [gstLoading, setGstLoading] = useState(false);
  const [gstVerified, setGstVerified] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const colors = isDarkMode
    ? {
        textPrimary: "#FFFFFF",
        textSecondary: "#A0A0A0",
        bg: "#1e1e1e",
        cardBg: "rgba(32, 32, 32, 0.7)",
        cardBorder: "rgba(255, 255, 255, 0.08)",
        cardBorderActive: "#60CDFF",
        inputBg: "rgba(255, 255, 255, 0.06)",
        inputBorder: "rgba(255, 255, 255, 0.12)",
        activeAccent: "#60CDFF",
        hoverBg: "rgba(255, 255, 255, 0.08)",
        shadow: "rgba(0, 0, 0, 0.4)"
      }
    : {
        textPrimary: "#1A1A1A",
        textSecondary: "#5F5F5F",
        bg: "#f3f3f3",
        cardBg: "rgba(255, 255, 255, 0.7)",
        cardBorder: "rgba(0, 0, 0, 0.08)",
        cardBorderActive: "#0078D4",
        inputBg: "rgba(0, 0, 0, 0.03)",
        inputBorder: "rgba(0, 0, 0, 0.12)",
        activeAccent: "#0078D4",
        hoverBg: "rgba(0, 0, 0, 0.05)",
        shadow: "rgba(0, 0, 0, 0.08)"
      };

  const filteredCompanies = availableCompanies?.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.gst_number && c.gst_number.toLowerCase().includes(search.toLowerCase()))
  ) || [];

  const handleCompanySelect = async (companyId: string) => {
    try {
      await switchActiveCompany(companyId);
    } catch (e) {
      console.error("Workspace switch failed", e);
    }
  };

  const handleVerifyGST = async () => {
    if (!coGst) return;
    setGstLoading(true);
    setGstVerified(null);
    try {
      const res = await authApi.verifyGST(coGst);
      setGstVerified(res.is_valid);
      // Autofill state if available
      if (res.is_valid && coGst.length >= 2) {
        const stateCode = coGst.substring(0, 2);
        // Basic Indian State GST code map autofill hint
        const stateMap: Record<string, string> = {
          "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
          "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
          "27": "Maharashtra", "29": "Karnataka", "32": "Kerala", "33": "Tamil Nadu", "36": "Telangana"
        };
        if (stateMap[stateCode] && !coState) {
          setCoState(stateMap[stateCode]);
        }
      }
    } catch (err: any) {
      setGstVerified(false);
    } finally {
      setGstLoading(false);
    }
  };

  const handleCreateCompany = async () => {
    if (!coName.trim()) {
      setCreateError("Company Name is required.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const payload = {
        name: coName.trim(),
        gst_number: coGst.trim() || undefined,
        pan_number: coPan.trim() || undefined,
        tan_no: coTan.trim() || undefined,
        email: coEmail.trim() || undefined,
        phone: coPhone.trim() || undefined,
        mobile_no: coMobile.trim() || undefined,
        registered_state: coState.trim() || undefined,
        office_address_1: coAddress1.trim() || undefined,
        office_address_2: coAddress2.trim() || undefined,
        office_address_3: coAddress3.trim() || undefined,
        office_address_4: coAddress4.trim() || undefined,
        pincode: coPincode.trim() || undefined,
        bank_name: coBank.trim() || undefined,
        bank_branch: coBranch.trim() || undefined,
        account_no: coAccNo.trim() || undefined,
        ifsc_code: coIfsc.trim() || undefined,
        currency: "INR",
        timezone: "Asia/Kolkata"
      };

      const newCompany = await authApi.createCompany(payload);
      
      // Reset Modal Fields
      setCoName(""); setCoGst(""); setCoPan(""); setCoTan(""); setCoEmail("");
      setCoPhone(""); setCoMobile(""); setCoState(""); setCoAddress1(""); setCoAddress2("");
      setCoAddress3(""); setCoAddress4(""); setCoPincode(""); setCoBank(""); setCoBranch("");
      setCoAccNo(""); setCoIfsc(""); setGstVerified(null);
      setIsCreateOpen(false);

      // Load available companies & auto-select the newly created company
      await loadAvailableCompanies();
      await handleCompanySelect(newCompany.id);
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to create company. Please try again.";
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  // Listen to global keyboard shortcuts
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("globalKeyDown", (e) => {
      if (!e) return;
      const { key, ctrlKey } = e;
      
      if (key === "Escape") {
        setIsCreateOpen(false);
      }
      
      // Ctrl + S inside the Create Company modal will trigger submit!
      if (isCreateOpen && ctrlKey && (key === "s" || key === "S")) {
        handleCreateCompany();
      }
    });
    return () => sub.remove();
  }, [isCreateOpen, coName, coGst, coPan, coTan, coEmail, coPhone, coMobile, coState, coAddress1, coAddress2, coAddress3, coAddress4, coPincode, coBank, coBranch, coAccNo, coIfsc]);

  const handleDeleteCompany = async () => {
    if (!deleteTarget) return;
    if (deleteConfirmInput.trim().toLowerCase() !== deleteTarget.name.trim().toLowerCase()) {
      setDeleteError("Typed workspace name does not match.");
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCompany(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteConfirmInput("");
      await loadAvailableCompanies();
    } catch (err: any) {
      setDeleteError(err.response?.data?.detail || "Failed to delete workspace profile.");
    } finally {
      setDeleting(false);
    }
  };

  const renderCompanyItem = ({ item }: { item: any }) => {
    const isActive = item.id === currentCompany?.id;
    return (
      <Pressable
        disabled={isSwitching}
        onPress={() => handleCompanySelect(item.id)}
        style={(state: any) => [
          styles.card,
          {
            backgroundColor: colors.cardBg,
            borderColor: isActive ? colors.cardBorderActive : colors.cardBorder,
            shadowColor: colors.shadow
          },
          state?.hovered && !isActive && { backgroundColor: colors.hoverBg, borderColor: colors.activeAccent }
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={[styles.companyIcon, { fontFamily: "Segoe MDL2 Assets", color: isActive ? colors.activeAccent : colors.textSecondary }]}>
              {GLYPHS.COMPANY}
            </Text>
            {isActive && (
              <View style={[styles.activeBadge, { backgroundColor: colors.activeAccent }]}>
                <Text style={styles.activeBadgeText}>ACTIVE</Text>
              </View>
            )}
          </View>

          {/* Delete Workspace Trash Button */}
          <Pressable
            onPress={(e: any) => {
              e?.stopPropagation?.();
              setDeleteTarget(item);
              setDeleteConfirmInput("");
              setDeleteError(null);
            }}
            style={({ hovered }: any) => [
              {
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 4,
                backgroundColor: hovered ? "rgba(239, 68, 68, 0.15)" : "transparent"
              }
            ]}
          >
            <Text style={{ fontFamily: "Segoe MDL2 Assets", color: "#EF4444", fontSize: 16 }}>{"\uE74D"}</Text>
          </Pressable>
        </View>

        <View style={styles.cardBody}>
          <Text style={[styles.companyName, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.tagsContainer}>
            {item.gst_number && (
              <Text style={[styles.tag, { color: colors.activeAccent, borderColor: colors.cardBorder }]}>
                GST: {item.gst_number}
              </Text>
            )}
            <Text style={[styles.tag, { color: colors.textSecondary, borderColor: colors.cardBorder }]}>
              {item.registered_state || item.state || "National"}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>VERSION {item.version || "1.0.0"}</Text>
          <Text style={[styles.arrowIcon, { fontFamily: "Segoe MDL2 Assets", color: colors.activeAccent }]}>
            {isActive ? GLYPHS.CHECKMARK : GLYPHS.ARROW_RIGHT}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.content}>
        
        {/* Header Block with Breadcrumbs & Action Row aligning with standard layout */}
        <View style={styles.header}>
          <Text style={[styles.breadcrumbs, { color: colors.activeAccent }]}>COMPANIES / HUB</Text>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Select Workspace</Text>
            <Pressable
              onPress={() => setIsCreateOpen(true)}
              style={({ hovered }: any) => [
                styles.createBtn,
                { backgroundColor: colors.activeAccent },
                hovered && { opacity: 0.9 }
              ]}
            >
              <Text style={[styles.createBtnIcon, { fontFamily: "Segoe MDL2 Assets" }]}>{GLYPHS.PLUS} </Text>
              <Text style={styles.createBtnText}>Setup New Company</Text>
            </Pressable>
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Select an authorized workspace or establish a new enterprise profile.
          </Text>
        </View>

        {/* Search */}
        <View style={[styles.searchWrapper, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
          <Text style={[styles.searchIcon, { fontFamily: "Segoe MDL2 Assets", color: colors.textSecondary }]}>
            {GLYPHS.SEARCH}
          </Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by workspace name or GSTIN..."
            placeholderTextColor={colors.textSecondary}
            style={[styles.searchInput, { color: colors.textPrimary }]}
          />
        </View>

        {/* Companies Grid */}
        {isSwitching || isLoadingCos ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.activeAccent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              {isSwitching ? "Configuring active company context..." : "Fetching authorized company workspaces..."}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredCompanies}
            renderItem={renderCompanyItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.listContainer}
            columnWrapperStyle={styles.columnWrapper}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textSecondary, marginBottom: 16 }]}>No company workspaces found.</Text>
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  <Pressable
                    onPress={() => {
                      setIsLoadingCos(true);
                      loadAvailableCompanies().finally(() => setIsLoadingCos(false));
                    }}
                    style={({ hovered }: any) => [
                      styles.createBtn,
                      { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.activeAccent },
                      hovered && { opacity: 0.85 }
                    ]}
                  >
                    <Text style={[styles.createBtnText, { color: colors.activeAccent }]}>Refresh Workspaces</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setIsCreateOpen(true)}
                    style={({ hovered }: any) => [
                      styles.createBtn,
                      { backgroundColor: colors.activeAccent },
                      hovered && { opacity: 0.9 }
                    ]}
                  >
                    <Text style={styles.createBtnText}>Create Your First Company</Text>
                  </Pressable>
                </View>
              </View>
            }
          />
        )}
      </View>
    </View>

    {/* Setup New Company Modal Dialog */}
    <FullScreenModal
      isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Setup New Company Profile"
        subtitle="Provide Indian GSTIN and PAN details to generate your ledger registers."
        breadcrumb="Workspace Selection / Create Company"
        footerActions={
          <View style={styles.modalFooterActions}>
            <Button
              onPress={() => setIsCreateOpen(false)}
              title="Cancel"
              variant="secondary"
            />
            <Button
              onPress={handleCreateCompany}
              title="Create Company"
              variant="primary"
              loading={creating}
              disabled={creating}
            />
          </View>
        }
      >
        {createError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{createError}</Text>
          </View>
        )}

          {/* Section 1: Basic Profile */}
          <Text style={[styles.sectionTitle, { color: colors.activeAccent }]}>BASIC BUSINESS DETAILS</Text>
          
          <View style={styles.formRow}>
            <View style={styles.formCol}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Company Legal Name *</Text>
              <TextInput
                value={coName}
                onChangeText={setCoName}
                placeholder="e.g. JK Infotech Pvt Ltd"
                placeholderTextColor={colors.textSecondary}
                style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formCol, { flex: 2 }]}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>GSTIN (Indian GST Number)</Text>
              <View style={styles.gstInputRow}>
                <TextInput
                  value={coGst}
                  onChangeText={setCoGst}
                  placeholder="e.g. 07AAAAA0000A1Z0"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.formInput, { flex: 1, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                />
                <Pressable
                  onPress={handleVerifyGST}
                  disabled={gstLoading || !coGst}
                  style={({ hovered }: any) => [
                    styles.verifyBtn,
                    { backgroundColor: colors.activeAccent },
                    hovered && { opacity: 0.9 }
                  ]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    {gstLoading && <ActivityIndicator size="small" color="#FFF" style={{ width: 16, height: 16 }} />}
                    <Text style={styles.verifyBtnText}>
                      {gstVerified === true ? "VERIFIED" : "VERIFY"}
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>
            <View style={styles.formCol}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>PAN Number</Text>
              <TextInput
                value={coPan}
                onChangeText={setCoPan}
                placeholder="e.g. ABCDE1234F"
                placeholderTextColor={colors.textSecondary}
                style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formCol}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>TAN Number</Text>
              <TextInput
                value={coTan}
                onChangeText={setCoTan}
                placeholder="e.g. DELA12345B"
                placeholderTextColor={colors.textSecondary}
                style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              />
            </View>
            <View style={styles.formCol}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Registered State</Text>
              <TextInput
                value={coState}
                onChangeText={setCoState}
                placeholder="e.g. Delhi"
                placeholderTextColor={colors.textSecondary}
                style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              />
            </View>
          </View>

          {/* Section 2: Contact & Address */}
          <Text style={[styles.sectionTitle, { color: colors.activeAccent, marginTop: 24 }]}>CONTACT & ADDRESS</Text>
          
          <View style={styles.formRow}>
            <View style={styles.formCol}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Email Address</Text>
              <TextInput
                value={coEmail}
                onChangeText={setCoEmail}
                placeholder="info@yourcompany.com"
                placeholderTextColor={colors.textSecondary}
                style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              />
            </View>
            <View style={styles.formCol}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Phone / Mobile</Text>
              <TextInput
                value={coMobile}
                onChangeText={setCoMobile}
                placeholder="e.g. 9876543210"
                placeholderTextColor={colors.textSecondary}
                style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formCol}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Address Line 1</Text>
              <TextInput
                value={coAddress1}
                onChangeText={setCoAddress1}
                placeholder="Building / Plot No."
                placeholderTextColor={colors.textSecondary}
                style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              />
            </View>
            <View style={styles.formCol}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Address Line 2</Text>
              <TextInput
                value={coAddress2}
                onChangeText={setCoAddress2}
                placeholder="Street / Area Name"
                placeholderTextColor={colors.textSecondary}
                style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formCol}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Address Line 3 / City</Text>
              <TextInput
                value={coAddress3}
                onChangeText={setCoAddress3}
                placeholder="City Name"
                placeholderTextColor={colors.textSecondary}
                style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              />
            </View>
            <View style={styles.formCol}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Pincode</Text>
              <TextInput
                value={coPincode}
                onChangeText={setCoPincode}
                placeholder="6-digit ZIP code"
                placeholderTextColor={colors.textSecondary}
                style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Section 3: Bank Details */}
          <Text style={[styles.sectionTitle, { color: colors.activeAccent, marginTop: 24 }]}>BANK ACCOUNT SETTINGS</Text>
          
          <View style={styles.formRow}>
            <View style={styles.formCol}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Bank Name</Text>
              <TextInput
                value={coBank}
                onChangeText={setCoBank}
                placeholder="e.g. State Bank of India"
                placeholderTextColor={colors.textSecondary}
                style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              />
            </View>
            <View style={styles.formCol}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Branch Name</Text>
              <TextInput
                value={coBranch}
                onChangeText={setCoBranch}
                placeholder="e.g. Connaught Place"
                placeholderTextColor={colors.textSecondary}
                style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formCol}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Account Number</Text>
              <TextInput
                value={coAccNo}
                onChangeText={setCoAccNo}
                placeholder="e.g. 123456789012"
                placeholderTextColor={colors.textSecondary}
                style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.formCol}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>IFSC Code</Text>
              <TextInput
                value={coIfsc}
                onChangeText={setCoIfsc}
                placeholder="e.g. SBIN0001234"
                placeholderTextColor={colors.textSecondary}
                style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              />
            </View>
          </View>
      </FullScreenModal>

      {/* Delete Workspace Safety Confirmation Modal */}
      {deleteTarget && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => {
            if (!deleting) setDeleteTarget(null);
          }}
          title="Delete Workspace Profile"
          width={540}
        >
          <View style={{ padding: 20, gap: 18 }}>
            {/* Warning Banner */}
            <View style={{
              flexDirection: "row",
              gap: 12,
              padding: 16,
              borderRadius: 8,
              backgroundColor: isDarkMode ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
              borderWidth: 1,
              borderColor: "#EF4444"
            }}>
              <Text style={{ fontFamily: "Segoe MDL2 Assets", color: "#EF4444", fontSize: 22 }}>{"\uE814"}</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#EF4444", fontFamily: "Segoe UI Variable Display" }}>
                  DESTRUCTIVE ACTION WARNING
                </Text>
                <Text style={{ fontSize: 13.5, color: isDarkMode ? "#FCA5A5" : "#991B1B", fontFamily: "Segoe UI Variable Text", lineHeight: 20 }}>
                  Deactivating <Text style={{ fontWeight: "800" }}>"{deleteTarget.name}"</Text> will restrict future access to this workspace and all associated vouchers, inventory registers, and tax reports.
                </Text>
              </View>
            </View>

            {deleteError && (
              <View style={{ padding: 12, borderRadius: 6, backgroundColor: "rgba(239, 68, 68, 0.2)", borderWidth: 1, borderColor: "#EF4444" }}>
                <Text style={{ color: "#EF4444", fontSize: 13, fontWeight: "600" }}>{deleteError}</Text>
              </View>
            )}

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary, fontFamily: "Segoe UI Variable Text" }}>
                To confirm deletion, please type the exact workspace name <Text style={{ fontWeight: "800", color: colors.activeAccent }}>"{deleteTarget.name}"</Text> below:
              </Text>
              <TextInput
                value={deleteConfirmInput}
                onChangeText={setDeleteConfirmInput}
                placeholder={deleteTarget.name}
                placeholderTextColor={colors.textSecondary}
                style={{
                  borderWidth: 1,
                  borderColor: deleteConfirmInput.trim().toLowerCase() === deleteTarget.name.trim().toLowerCase() ? colors.activeAccent : colors.inputBorder,
                  borderRadius: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 15,
                  color: colors.textPrimary,
                  backgroundColor: colors.inputBg
                }}
              />
            </View>

            <View style={{ flexDirection: "row", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
              <Button
                title="Cancel"
                variant="secondary"
                disabled={deleting}
                onPress={() => setDeleteTarget(null)}
              />
              <Button
                title={deleting ? "Deactivating..." : "Permanently Delete Workspace"}
                variant="danger"
                disabled={deleting || deleteConfirmInput.trim().toLowerCase() !== deleteTarget.name.trim().toLowerCase()}
                onPress={handleDeleteCompany}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    width: "100%",
    maxWidth: 720,
    flex: 1,
  },
  header: {
    marginBottom: 24,
  },
  breadcrumbs: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 6,
    fontFamily: "Segoe UI Variable Text",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    fontFamily: "Segoe UI Variable Display",
  },
  createBtn: {
    flexDirection: "row",
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  createBtnIcon: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "900",
  },
  createBtnText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Segoe UI Variable Text",
    lineHeight: 20,
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  searchIcon: {
    fontSize: 16.5,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Segoe UI Variable Text",
    paddingVertical: 8,
  },
  listContainer: {
    gap: 16,
  },
  columnWrapper: {
    gap: 16,
  },
  card: {
    flex: 1,
    height: 160,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    flexDirection: "column",
    justifyContent: "space-between",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  companyIcon: {
    fontSize: 28,
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 0.5,
  },
  cardBody: {
    flex: 1,
    justifyContent: "center",
  },
  companyName: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Display",
    marginBottom: 6,
  },
  tagsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  tag: {
    fontSize: 10.5,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 4,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  arrowIcon: {
    fontSize: 16.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: "Segoe UI Variable Text",
  },
  emptyContainer: {
    height: 240,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Segoe UI Variable Text",
  },
  
  // Modal Styles
  modalScroll: {
    flex: 1,
    maxHeight: 520,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: "900",
    letterSpacing: 1.2,
    fontFamily: "Segoe UI Variable Text",
    marginBottom: 12,
  },
  formRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 14,
  },
  formCol: {
    flex: 1,
  },
  formLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
    marginBottom: 4,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: "Segoe UI Variable Text",
  },
  gstInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  verifyBtn: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  verifyBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  modalFooterActions: {
    flexDirection: "row",
    gap: 8,
  },
  cancelBtn: {
    height: 32,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
  },
  saveBtn: {
    height: 32,
    borderRadius: 4,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "800",
    fontFamily: "Segoe UI Variable Text",
  },
  errorBanner: {
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    borderWidth: 1,
    borderColor: "#F87171",
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
  },
  errorText: {
    color: "#F87171",
    fontSize: 12.5,
    fontWeight: "600",
    textAlign: "center",
  }
});
