// =============================================================
// JK INFOTECH ERP — License Activation Screen (WinUI 3 Style)
// File : src/screens/LicenseScreen.tsx
// =============================================================

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Clipboard,
} from "react-native";
import { useLicenseStore } from "../store/licenseStore";
import { useUIStore } from "../store/uiStore";
import { playSystemSound } from "../utils/sound";

export default function LicenseScreen() {
  const { isDarkMode } = useUIStore();
  const {
    isFrozen,
    freezeReason,
    hwid,
    checking,
    activating,
    error,
    checkLicenseStatus,
    activateLicense,
    clearError,
  } = useLicenseStore();

  const [copied, setCopied] = useState(false);
  const [masterKeyInput, setMasterKeyInput] = useState("");
  const [masterDuration, setMasterDuration] = useState("12"); // "1", "3", "6", "12", "lifetime", "5min"
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  useEffect(() => {
    playSystemSound("error");
  }, []);

  const handleCopyHwid = () => {
    if (hwid) {
      Clipboard.setString(hwid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isMasterKey = masterKeyInput.trim().toUpperCase().startsWith("JKERP-");

  const handleActivateMaster = async () => {
    if (!masterKeyInput.trim()) return;
    await activateLicense(masterKeyInput.trim(), isMasterKey ? masterDuration : undefined);
  };

  const getReasonText = () => {
    switch (freezeReason) {
      case "SYSTEM_UNREGISTERED":
        return "This client installation is currently unregistered. Please enter a valid activation key to bind your hardware.";
      case "LICENSE_CORRUPTED":
        return "The local cryptographic license key appears to be corrupted or modified. Please reactivate.";
      case "HWID_MISMATCH":
        return "Hardware ID binding mismatch detected. This license is registered to another PC. Please contact support.";
      case "MEMBERSHIP_EXPIRED":
        return "Your enterprise subscription membership has expired. Please contact support to renew your license.";
      case "SYSTEM_CLOCK_TAMPERED":
        return "System clock tampering detected. System times cannot be verified. Please fix your PC clock.";
      default:
        return "System is frozen due to hardware ID mismatch or missing activation.";
    }
  };

  const colors = isDarkMode
    ? {
        background: "#0F172A",
        cardBg: "#1E293B",
        cardBorder: "#334155",
        textPrimary: "#F8FAFC",
        textSecondary: "#94A3B8",
        accent: "#38BDF8",
        accentLight: "rgba(56, 189, 248, 0.12)",
        btnBg: "#334155",
        btnText: "#F8FAFC",
        inputBg: "#0F172A",
        inputText: "#F8FAFC",
        inputBorder: "#334155",
        success: "#4ADE80",
        error: "#F87171",
        alertBg: "rgba(248, 113, 113, 0.1)",
        activeGlow: "rgba(56, 189, 248, 0.4)",
      }
    : {
        background: "#F8FAFC",
        cardBg: "#FFFFFF",
        cardBorder: "#E2E8F0",
        textPrimary: "#0F172A",
        textSecondary: "#64748B",
        accent: "#0284C7",
        accentLight: "rgba(2, 132, 199, 0.08)",
        btnBg: "#E2E8F0",
        btnText: "#0F172A",
        inputBg: "#FFFFFF",
        inputText: "#0F172A",
        inputBorder: "#CBD5E1",
        success: "#16A34A",
        error: "#DC2626",
        alertBg: "rgba(220, 38, 38, 0.08)",
        activeGlow: "rgba(2, 132, 199, 0.2)",
      };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        
        {/* Header */}
        <Text style={[styles.breadcrumbs, { color: colors.accent }]}>SECURITY / LICENSING</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Client Activation</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          JK INFOTECH ERP SECURE TERMINAL BINDING
        </Text>

        {/* Lock Alert Box */}
        <View style={[styles.alertBox, { backgroundColor: colors.alertBg, borderColor: colors.error }]}>
          <Text style={[styles.alertIcon, { fontFamily: "Segoe MDL2 Assets", color: colors.error }]}>
            {"\uE72E"} {/* Shield Alert Icon */}
          </Text>
          <View style={styles.alertContent}>
            <Text style={[styles.alertTitle, { color: colors.textPrimary }]}>
              System Frozen / Locked
            </Text>
            <Text style={[styles.alertDesc, { color: colors.textSecondary }]}>
              {getReasonText()}
            </Text>
          </View>
        </View>

        {/* Hardware ID Display */}
        <View style={[styles.hwidContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
          <View style={styles.hwidTextSection}>
            <Text style={[styles.hwidLabel, { color: colors.textSecondary }]}>Hardware binding signature (HWID)</Text>
            <Text style={[styles.hwidValue, { color: colors.textPrimary }]} numberOfLines={1}>
              {checking ? "Scanning secure hardware..." : hwid || "UNKNOWN"}
            </Text>
          </View>
          <Pressable
            disabled={checking || !hwid}
            onPress={handleCopyHwid}
            onHoverIn={() => setHoveredBtn("copy")}
            onHoverOut={() => setHoveredBtn(null)}
            style={[
              styles.copyBtn,
              { backgroundColor: hoveredBtn === "copy" ? colors.accentLight : colors.btnBg }
            ]}
          >
            <Text style={[styles.copyBtnText, { color: hoveredBtn === "copy" ? colors.accent : colors.btnText }]}>
              {copied ? "COPIED" : "COPY HWID"}
            </Text>
          </Pressable>
        </View>

        {/* Activation Key Input */}
        <View style={styles.section}>
          <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Activation Key</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }
            ]}
            value={masterKeyInput}
            onChangeText={setMasterKeyInput}
            placeholder="Enter your activation key..."
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
          />

          {error && (
            <Pressable onPress={clearError} style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </Pressable>
          )}

          {isMasterKey && (
            <>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary, marginTop: 8 }]}>Master Override Duration</Text>
              <View style={styles.durationRow}>
                {[
                  { label: "5 Min", value: "5min" },
                  { label: "1 Mon", value: "1" },
                  { label: "3 Mon", value: "3" },
                  { label: "6 Mon", value: "6" },
                  { label: "12 Mon", value: "12" },
                  { label: "Lifetime", value: "lifetime" },
                ].map((dur) => {
                  const isSel = masterDuration === dur.value;
                  return (
                    <Pressable
                      key={dur.value}
                      onPress={() => setMasterDuration(dur.value)}
                      style={({ hovered }: any) => [
                        styles.durBtn,
                        {
                          backgroundColor: isSel ? colors.accentLight : colors.inputBg,
                          borderColor: isSel ? colors.accent : colors.inputBorder
                        },
                        hovered && !isSel && { backgroundColor: colors.btnBg }
                      ]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "700", color: isSel ? colors.accent : colors.textSecondary }}>
                        {dur.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <Pressable
            disabled={activating || checking}
            onPress={handleActivateMaster}
            onHoverIn={() => setHoveredBtn("activate")}
            onHoverOut={() => setHoveredBtn(null)}
            style={({ pressed }: any) => [
              styles.submitBtn,
              { backgroundColor: colors.accent },
              hoveredBtn === "activate" && { opacity: 0.9 },
              pressed && { transform: [{ scale: 0.99 }] }
            ]}
          >
            {activating ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>ACTIVATE LICENSE</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 580,
    borderRadius: 8,
    borderWidth: 1,
    padding: 32,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  breadcrumbs: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    fontFamily: "Segoe UI Variable Text",
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    fontFamily: "Segoe UI Variable Display",
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    fontFamily: "Segoe UI Variable Text",
    marginTop: 2,
    marginBottom: 20,
  },
  alertBox: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 6,
    padding: 16,
    marginBottom: 20,
    gap: 12,
    alignItems: "center",
  },
  alertIcon: {
    fontSize: 24,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Display",
  },
  alertDesc: {
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: "Segoe UI Variable Text",
    marginTop: 2,
  },
  hwidContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    justifyContent: "space-between",
    gap: 16,
  },
  hwidTextSection: {
    flex: 1,
  },
  hwidLabel: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
    marginBottom: 2,
  },
  hwidValue: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Consolas",
  },
  copyBtn: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
  },
  section: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: "Segoe UI Variable Text",
    textAlignVertical: "top",
  },
  errorContainer: {
    padding: 10,
    borderRadius: 4,
    backgroundColor: "rgba(248, 113, 113, 0.08)",
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
    textAlign: "center",
  },
  submitBtn: {
    height: 40,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.8,
  },
  divider: {
    borderBottomWidth: 1,
    marginVertical: 20,
  },
  expandHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  expandTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
  },
  expandIcon: {
    fontSize: 12,
  },
  masterPanel: {
    marginTop: 16,
    gap: 8,
  },
  durationRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  durBtn: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  masterSubmitBtn: {
    height: 34,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  masterSubmitBtnText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
