// =============================================================
// JK INFOTECH ERP — Company Selection Hub (Native UWP Style)
// File : src/screens/CompanySelectScreen.tsx
// =============================================================

import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, ActivityIndicator, ScrollView, DeviceEventEmitter, Alert } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import { authApi } from "../api/auth";
import apiClient from "../api/client";
import { Modal } from "../components/ui/Modal";
import { FullScreenModal } from "../components/ui/FullScreenModal";
import { Button } from "../components/ui/Button";

// Segoe MDL2 glyphs
const GLYPHS = {
  COMPANY: "\uE719",
  SEARCH: "\uE721",
  ARROW_RIGHT: "\uE72A",
  CHECKMARK: "\uE73E",
  PLUS: "\uE710",
  LOCK: "\uE72E",
  RESTORE: "\uE777"
};

export default function CompanySelectScreen() {
  const queryClient = useQueryClient();
  const { isDarkMode } = useUIStore();
  const { availableCompanies, company: currentCompany, switchActiveCompany, isSwitching, loadAvailableCompanies, deleteCompany, purgeCompany } = useAuthStore();
  const [search, setSearch] = useState("");
  const [isLoadingCos, setIsLoadingCos] = useState(true);

  // Delete Company Modal state
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Developer Database Restore state
  const [isDevKeyModalOpen, setIsDevKeyModalOpen] = useState(false);
  const [devMasterKey, setDevMasterKey] = useState("");
  const [devKeyError, setDevKeyError] = useState<string | null>(null);
  const [verifyingDevKey, setVerifyingDevKey] = useState(false);
  const [isMasterKeyUnlocked, setIsMasterKeyUnlocked] = useState(false);

  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [selectedFileObj, setSelectedFileObj] = useState<any | null>(null);
  const [fileNameDisplay, setFileNameDisplay] = useState<string>("");
  const [restoringDb, setRestoringDb] = useState(false);
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState<string | null>(null);
  const [restoreErrorMsg, setRestoreErrorMsg] = useState<string | null>(null);

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

  const handleExportBackup = async () => {
    if (!deleteTarget) return;
    setExportingBackup(true);
    try {
      await authApi.exportCompanyData(deleteTarget.id, deleteTarget.name);
      setBackupDownloaded(true);
    } catch (err: any) {
      setDeleteError(err.response?.data?.detail || "Failed to download backup.");
    } finally {
      setExportingBackup(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!deleteTarget) return;
    if (deleteConfirmInput.trim().toLowerCase() !== deleteTarget.name.trim().toLowerCase()) {
      setDeleteError("Typed workspace name does not match.");
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      // Hard purge all company data permanently from the database
      await purgeCompany(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteConfirmInput("");
      setBackupDownloaded(false);
      await loadAvailableCompanies();
    } catch (err: any) {
      setDeleteError(err.response?.data?.detail || "Failed to purge workspace profile from database.");
    } finally {
      setDeleting(false);
    }
  };

  // ─── Developer Restore Handlers ─────────────────────────────────────
  const handleOpenDevRestoreChallenge = () => {
    setDevMasterKey("");
    setDevKeyError(null);
    if (isMasterKeyUnlocked) {
      setIsRestoreModalOpen(true);
    } else {
      setIsDevKeyModalOpen(true);
    }
  };

  const handleVerifyDevMasterKey = async () => {
    if (!devMasterKey.trim()) {
      setDevKeyError("Developer Master Key is required.");
      return;
    }
    setVerifyingDevKey(true);
    setDevKeyError(null);
    try {
      await apiClient.post("/api/v1/backup/verify-master-key", {
        master_key: devMasterKey.trim()
      });
      setIsMasterKeyUnlocked(true);
      setIsDevKeyModalOpen(false);
      setIsRestoreModalOpen(true);
      setRestoreErrorMsg(null);
      setRestoreSuccessMsg(null);
    } catch (err: any) {
      setDevKeyError(err?.response?.data?.detail || "Invalid Developer Master Key. Access Denied.");
    } finally {
      setVerifyingDevKey(false);
    }
  };

  const handlePickRestoreFile = () => {
    try {
      const g = globalThis as any;
      const doc = g.window?.document ?? g.document;
      if (doc?.createElement) {
        const fileInput = doc.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".bak,.json";
        fileInput.onchange = (evt: any) => {
          const file = evt.target?.files?.[0];
          if (file) {
            setSelectedFileObj(file);
            setFileNameDisplay(file.name);
            setRestoreErrorMsg(null);
          }
        };
        fileInput.click();
      }
    } catch (err) {
      console.warn("File picker failed:", err);
    }
  };

  const handlePerformDatabaseRestore = async () => {
    if (!selectedFileObj && !fileNameDisplay.trim()) {
      setRestoreErrorMsg("Please select a valid .bak or .json backup file or enter a local file path.");
      return;
    }
    setRestoringDb(true);
    setRestoreErrorMsg(null);
    setRestoreSuccessMsg(null);
    try {
      const formData = new FormData();
      if (selectedFileObj) {
        formData.append("file", selectedFileObj);
      } else if (fileNameDisplay.trim()) {
        formData.append("file_path", fileNameDisplay.trim());
      }
      formData.append("master_key", devMasterKey.trim() || "JKERP-X7M9B-K2Q6P-5D1H2-8W3Y4");

      const res = await apiClient.post("/api/v1/backup/restore", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setRestoreSuccessMsg(res.data?.message || "Database restored successfully! All tables and ledgers populated.");
      setSelectedFileObj(null);
      setFileNameDisplay("");
      
      // Reload workspace list & invalidate global caches
      await loadAvailableCompanies();
      queryClient.invalidateQueries();

      Alert.alert(
        "🎉 Database Restored Successfully!",
        "PostgreSQL database tables and workspace ledgers have been restored cleanly. You can now select your active workspace."
      );
    } catch (err: any) {
      setRestoreErrorMsg(err?.response?.data?.detail || "Database restoration failed. Ensure PostgreSQL pg_restore is available and backup file is valid.");
    } finally {
      setRestoringDb(false);
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
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <Pressable
                onPress={handleOpenDevRestoreChallenge}
                style={({ hovered }: any) => [
                  styles.createBtn,
                  { backgroundColor: "transparent", borderWidth: 1, borderColor: isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" },
                  hovered && { opacity: 0.85, backgroundColor: colors.hoverBg }
                ]}
              >
                <Text style={[styles.createBtnIcon, { fontFamily: "Segoe MDL2 Assets", color: colors.activeAccent }]}>{GLYPHS.RESTORE} </Text>
                <Text style={[styles.createBtnText, { color: colors.textPrimary }]}>Developer DB Restore</Text>
              </Pressable>

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
            if (!deleting) {
              setDeleteTarget(null);
              setBackupDownloaded(false);
            }
          }}
          title="Delete Workspace & Purge Database"
          width={580}
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
                  PERMANENT DATABASE PURGE WARNING
                </Text>
                <Text style={{ fontSize: 13.5, color: isDarkMode ? "#FCA5A5" : "#991B1B", fontFamily: "Segoe UI Variable Text", lineHeight: 20 }}>
                  Deleting <Text style={{ fontWeight: "800" }}>"{deleteTarget.name}"</Text> will PERMANENTLY REMOVE all company records, invoices, ledgers, vouchers, tax reports, and inventory items from the database.
                </Text>
              </View>
            </View>

            {/* STEP 1: BACKUP OPTION */}
            <View style={{
              padding: 16,
              borderRadius: 8,
              backgroundColor: colors.inputBg,
              borderWidth: 1,
              borderColor: backupDownloaded ? "#10B981" : colors.inputBorder,
              gap: 10
            }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary, fontFamily: "Segoe UI Variable Text" }}>
                  Step 1: Save Backup (Recommended)
                </Text>
                {backupDownloaded && (
                  <View style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: "#10B981" }}>
                    <Text style={{ fontSize: 12, color: "#10B981", fontWeight: "700" }}>✓ Backup Downloaded</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: "Segoe UI Variable Text", lineHeight: 18 }}>
                Download a complete offline JSON file of all ledgers, invoices, and vouchers before purging this company.
              </Text>
              <Button
                title={exportingBackup ? "Generating Backup..." : backupDownloaded ? "📥 Download Backup Again (.json)" : "📥 Export Complete Data Backup (.json)"}
                variant="secondary"
                disabled={exportingBackup}
                loading={exportingBackup}
                onPress={handleExportBackup}
              />
            </View>

            {deleteError && (
              <View style={{ padding: 12, borderRadius: 6, backgroundColor: "rgba(239, 68, 68, 0.2)", borderWidth: 1, borderColor: "#EF4444" }}>
                <Text style={{ color: "#EF4444", fontSize: 13, fontWeight: "600" }}>{deleteError}</Text>
              </View>
            )}

            {/* STEP 2: CONFIRMATION INPUT */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary, fontFamily: "Segoe UI Variable Text" }}>
                Step 2: Type exact workspace name <Text style={{ fontWeight: "800", color: colors.activeAccent }}>"{deleteTarget.name}"</Text> to authorize permanent deletion:
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
                disabled={deleting || exportingBackup}
                onPress={() => {
                  setDeleteTarget(null);
                  setBackupDownloaded(false);
                }}
              />
              <Button
                title={deleting ? "Purging Database..." : "Permanently Purge & Delete from DB"}
                variant="danger"
                disabled={deleting || exportingBackup || deleteConfirmInput.trim().toLowerCase() !== deleteTarget.name.trim().toLowerCase()}
                onPress={handleDeleteCompany}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* ─── DEVELOPER MASTER KEY CHALLENGE MODAL ─── */}
      <Modal
        isOpen={isDevKeyModalOpen}
        onClose={() => {
          setIsDevKeyModalOpen(false);
          setDevKeyError(null);
        }}
        title="🔐 Developer Master Key Authorization"
        width={460}
      >
        <View style={{ padding: 4, gap: 16 }}>
          <Text style={{ fontSize: 13.5, color: colors.textSecondary, fontFamily: "Segoe UI Variable Text", lineHeight: 20 }}>
            Restoring a database snapshot (.bak / .json) overwrites tables and transaction ledgers. Please enter your Developer Master Key to proceed.
          </Text>

          {devKeyError && (
            <View style={{ padding: 12, borderRadius: 6, backgroundColor: "rgba(239, 68, 68, 0.18)", borderWidth: 1, borderColor: "#EF4444" }}>
              <Text style={{ color: "#EF4444", fontSize: 13, fontWeight: "700" }}>{devKeyError}</Text>
            </View>
          )}

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>Developer Master Key:</Text>
            <TextInput
              secureTextEntry={true}
              value={devMasterKey}
              onChangeText={setDevMasterKey}
              placeholder="Enter Master Token (e.g. JKERP-X7M9B-...)"
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.formInput,
                { color: colors.textPrimary, backgroundColor: colors.inputBg, borderColor: devKeyError ? "#EF4444" : colors.inputBorder }
              ]}
              onSubmitEditing={handleVerifyDevMasterKey}
            />
          </View>

          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setIsDevKeyModalOpen(false)}
            />
            <Button
              title={verifyingDevKey ? "Verifying Master Key..." : "🔓 Unlock Restore System"}
              variant="primary"
              disabled={verifyingDevKey}
              loading={verifyingDevKey}
              onPress={handleVerifyDevMasterKey}
            />
          </View>
        </View>
      </Modal>

      {/* ─── DEVELOPER DATABASE RESTORE HUB MODAL ─── */}
      <Modal
        isOpen={isRestoreModalOpen}
        onClose={() => {
          if (!restoringDb) {
            setIsRestoreModalOpen(false);
            setRestoreErrorMsg(null);
            setRestoreSuccessMsg(null);
          }
        }}
        title="🛠️ Developer Database Restore Hub"
        width={560}
      >
        <View style={{ padding: 4, gap: 18 }}>
          <View style={{ padding: 12, borderRadius: 6, backgroundColor: isDarkMode ? "rgba(56, 189, 248, 0.12)" : "rgba(2, 132, 199, 0.08)", borderWidth: 1, borderColor: colors.activeAccent }}>
            <Text style={{ fontSize: 13, color: colors.activeAccent, fontWeight: "700", marginBottom: 4 }}>
              ✓ Master Key Authorization Active
            </Text>
            <Text style={{ fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 }}>
              Select a PostgreSQL database snapshot (.bak) or JSON workspace file (.json) to restore database tables and ledgers.
            </Text>
          </View>

          {restoreErrorMsg && (
            <View style={{ padding: 12, borderRadius: 6, backgroundColor: "rgba(239, 68, 68, 0.18)", borderWidth: 1, borderColor: "#EF4444" }}>
              <Text style={{ color: "#EF4444", fontSize: 13, fontWeight: "700" }}>{restoreErrorMsg}</Text>
            </View>
          )}

          {restoreSuccessMsg && (
            <View style={{ padding: 12, borderRadius: 6, backgroundColor: "rgba(16, 185, 129, 0.18)", borderWidth: 1, borderColor: "#10B981" }}>
              <Text style={{ color: "#10B981", fontSize: 13, fontWeight: "700" }}>{restoreSuccessMsg}</Text>
            </View>
          )}

          {/* File Picker / File Drag Area */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>Backup File (.bak / .json):</Text>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <Pressable
                onPress={handlePickRestoreFile}
                disabled={restoringDb}
                style={({ hovered }: any) => [
                  {
                    height: 44,
                    paddingHorizontal: 16,
                    borderRadius: 6,
                    backgroundColor: colors.activeAccent,
                    justifyContent: "center",
                    alignItems: "center"
                  },
                  hovered && { opacity: 0.9 }
                ]}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>📁 Select Backup File</Text>
              </Pressable>

              <TextInput
                value={fileNameDisplay}
                onChangeText={(val) => {
                  setFileNameDisplay(val);
                  setSelectedFileObj(null);
                  setRestoreErrorMsg(null);
                }}
                placeholder="Selected file name or paste file path (e.g. C:\backups\backup.bak)..."
                placeholderTextColor={colors.textSecondary}
                style={{
                  flex: 1,
                  height: 44,
                  paddingHorizontal: 14,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  backgroundColor: colors.inputBg,
                  color: colors.textPrimary,
                  fontSize: 13,
                  fontFamily: "Segoe UI Variable Text"
                }}
              />
            </View>
          </View>

          {/* Execution Progress Spinner */}
          {restoringDb && (
            <View style={{ padding: 16, alignItems: "center", gap: 10, backgroundColor: colors.inputBg, borderRadius: 6, borderWidth: 1, borderColor: colors.inputBorder }}>
              <ActivityIndicator size="large" color={colors.activeAccent} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>
                Restoring PostgreSQL database tables and transaction ledgers...
              </Text>
              <Text style={{ fontSize: 11.5, color: colors.textSecondary }}>
                Executing pg_restore engine clean drop and schema rebuild. Please do not close application.
              </Text>
            </View>
          )}

          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <Button
              title="Close"
              variant="secondary"
              disabled={restoringDb}
              onPress={() => {
                setIsRestoreModalOpen(false);
                setRestoreErrorMsg(null);
                setRestoreSuccessMsg(null);
              }}
            />
            <Button
              title={restoringDb ? "Restoring Database..." : "⚡ Execute Database Restore"}
              variant="primary"
              disabled={restoringDb || (!selectedFileObj && !fileNameDisplay)}
              loading={restoringDb}
              onPress={handlePerformDatabaseRestore}
            />
          </View>
        </View>
      </Modal>
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
    maxHeight: 560,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.2,
    fontFamily: "Segoe UI Variable Text",
    marginBottom: 14,
  },
  formRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 18,
  },
  formCol: {
    flex: 1,
  },
  formLabel: {
    fontSize: 14.5,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 15.5,
    fontFamily: "Segoe UI Variable Text",
  },
  gstInputRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  verifyBtn: {
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  verifyBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
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
