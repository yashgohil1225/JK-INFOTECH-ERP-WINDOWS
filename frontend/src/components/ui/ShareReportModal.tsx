// =============================================================
// JK INFOTECH ERP — Share Report / Invoice Modal Component
// File : src/components/ui/ShareReportModal.tsx
// =============================================================

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Image
} from "react-native";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { useUIStore } from "../../store/uiStore";
import { useAuthStore } from "../../store/authStore";
import apiClient from "../../api/client";

interface ShareReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportTitle?: string;
  pdfUrl?: string;
  defaultFilename?: string;
}

export function ShareReportModal({
  isOpen,
  onClose,
  reportTitle = "Financial Report",
  pdfUrl,
  defaultFilename = "ERP_Report.pdf"
}: ShareReportModalProps) {
  const { isDarkMode } = useUIStore();
  const { company } = useAuthStore();

  const colors = isDarkMode
    ? {
        cardBg: "#1E293B",
        cardBorder: "#334155",
        textPrimary: "#F8FAFC",
        textSecondary: "#94A3B8",
        accent: "#38BDF8",
        inputBg: "#0F172A",
        inputBorder: "#334155",
        divider: "#334155"
      }
    : {
        cardBg: "#FFFFFF",
        cardBorder: "#E2E8F0",
        textPrimary: "#0F172A",
        textSecondary: "#64748B",
        accent: "#0284C7",
        inputBg: "#FFFFFF",
        inputBorder: "#CBD5E1",
        divider: "#E2E8F0"
      };

  const [activeTab, setActiveTab] = useState<"email" | "whatsapp">("email");
  const [loading, setLoading] = useState(false);

  // Email form
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // WhatsApp form
  const [recipientPhone, setRecipientPhone] = useState("");
  const [whatsappCaption, setWhatsappCaption] = useState("");

  // Populate from Company Settings (CA info)
  useEffect(() => {
    if (company && isOpen) {
      const settings = company.settings || {};
      const caConfig = settings.ca || {};

      const caEmail = caConfig.ca_email || company.email || "";
      const caPhone = caConfig.ca_phone || company.phone || company.mobile_no || "";

      setRecipientEmail(caEmail);
      setEmailSubject(`[${company.name}] ${reportTitle}`);
      setEmailBody(`Respected CA / Team,\n\nPlease find attached the ${reportTitle} for ${company.name}.\n\nThank you,\n${company.name}`);

      setRecipientPhone(caPhone);
      setWhatsappCaption(`Respected CA / Team, Please find attached ${reportTitle} for ${company.name}.`);
    }
  }, [company, isOpen, reportTitle]);

  const handleSendEmail = async () => {
    if (!recipientEmail.trim()) {
      Alert.alert("Validation", "Recipient email address is required.");
      return;
    }
    setLoading(true);
    try {
      await apiClient.post("/api/reports/send-email", {
        recipient_email: recipientEmail.trim(),
        subject: emailSubject.trim(),
        message: emailBody,
        pdf_url: pdfUrl,
        filename: defaultFilename
      });
      Alert.alert("Success", `Report email delivered successfully to ${recipientEmail}!`);
      onClose();
    } catch (err: any) {
      Alert.alert("Email Delivery Failed", err.response?.data?.detail || err.message || "Failed to send email.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!recipientPhone.trim()) {
      Alert.alert("Validation", "Recipient phone number is required.");
      return;
    }
    if (!pdfUrl) {
      Alert.alert("Validation", "PDF preview URL is required to send document via WhatsApp.");
      return;
    }
    setLoading(true);
    try {
      await apiClient.post("/api/reports/send-whatsapp", {
        recipient_phone: recipientPhone.trim(),
        message: whatsappCaption,
        pdf_url: pdfUrl,
        filename: defaultFilename
      });
      Alert.alert("Success", `Report PDF sent successfully via Meta WhatsApp API to ${recipientPhone}!`);
      onClose();
    } catch (err: any) {
      Alert.alert("WhatsApp Delivery Failed", err.response?.data?.detail || err.message || "Failed to send WhatsApp document.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Share ${reportTitle}`}
      maxWidth={540}
    >
      <View style={{ gap: 16 }}>
        {/* Tab Switcher */}
        <View style={{ flexDirection: "row", backgroundColor: colors.divider, borderRadius: 8, padding: 3 }}>
          <Pressable
            onPress={() => setActiveTab("email")}
            style={{
              flex: 1,
              paddingVertical: 8,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: 6,
              backgroundColor: activeTab === "email" ? colors.cardBg : "transparent"
            }}
          >
            <Image
              source={require("../email.png")}
              style={{ width: 18, height: 18 }}
              resizeMode="contain"
            />
            <Text style={{ fontSize: 13.5, fontWeight: "600", color: activeTab === "email" ? colors.accent : colors.textSecondary }}>
              Email (SMTP)
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("whatsapp")}
            style={{
              flex: 1,
              paddingVertical: 8,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: 6,
              backgroundColor: activeTab === "whatsapp" ? colors.cardBg : "transparent"
            }}
          >
            <Image
              source={require("../whatsapp.png")}
              style={{ width: 18, height: 18 }}
              resizeMode="contain"
            />
            <Text style={{ fontSize: 13.5, fontWeight: "600", color: activeTab === "whatsapp" ? colors.accent : colors.textSecondary }}>
              WhatsApp (Meta API)
            </Text>
          </Pressable>
        </View>

        {activeTab === "email" ? (
          <View style={{ gap: 12 }}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>RECIPIENT EMAIL (CA / CLIENT)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                value={recipientEmail}
                onChangeText={setRecipientEmail}
                placeholder="e.g. ca.accounts@auditfirm.com"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>SUBJECT</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                value={emailSubject}
                onChangeText={setEmailSubject}
                placeholder="Email Subject"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>MESSAGE BODY</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary, height: 90, textAlignVertical: "top" }]}
                value={emailBody}
                onChangeText={setEmailBody}
                multiline={true}
                placeholder="Message body text..."
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <Button title="Cancel" variant="secondary" onPress={onClose} disabled={loading} />
              <Button title="Send Email Attachment" variant="primary" onPress={handleSendEmail} disabled={loading} loading={loading} />
            </View>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>RECIPIENT WHATSAPP NUMBER</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                value={recipientPhone}
                onChangeText={setRecipientPhone}
                placeholder="e.g. +91 98765 43210"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>CAPTION / MESSAGE</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary, height: 90, textAlignVertical: "top" }]}
                value={whatsappCaption}
                onChangeText={setWhatsappCaption}
                multiline={true}
                placeholder="WhatsApp message caption..."
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <Button title="Cancel" variant="secondary" onPress={onClose} disabled={loading} />
              <Button title="Send WhatsApp Document" variant="primary" onPress={handleSendWhatsApp} disabled={loading} loading={loading} />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  formGroup: { gap: 6 },
  label: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, fontFamily: "Segoe UI Variable Text" },
  input: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, fontFamily: "Segoe UI Variable Text" }
});
