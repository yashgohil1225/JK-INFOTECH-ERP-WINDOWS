// =============================================================
// JK INFOTECH ERP — Master Full Screen Module & Setup Help Modal
// File : src/components/ui/ModuleHelpModal.tsx
// =============================================================

import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useUIStore } from "../../store/uiStore";
import { FullScreenModal } from "./FullScreenModal";

export type HelpCategory = 
  | "COMMUNICATION_SETUP"
  | "SALES_GUIDE"
  | "PURCHASES_GUIDE"
  | "INVENTORY_GUIDE"
  | "PARTIES_GUIDE"
  | "BANKING_GUIDE"
  | "REPORTS_GUIDE";

interface ModuleHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: HelpCategory;
}

export function ModuleHelpModal({ isOpen, onClose, initialCategory = "COMMUNICATION_SETUP" }: ModuleHelpModalProps) {
  const { isDarkMode } = useUIStore();
  const [activeCategory, setActiveCategory] = useState<HelpCategory>(initialCategory);

  if (!isOpen) return null;

  const colors = isDarkMode
    ? {
        modalBg: "#1E293B",
        borderColor: "#334155",
        textPrimary: "#F8FAFC",
        textSecondary: "#94A3B8",
        accent: "#38BDF8",
        cardBg: "#0F172A",
        activePillBg: "#0284C7",
        activePillText: "#FFFFFF",
      }
    : {
        modalBg: "#FFFFFF",
        borderColor: "#E2E8F0",
        textPrimary: "#0F172A",
        textSecondary: "#64748B",
        accent: "#0078D4",
        cardBg: "#F8FAFC",
        activePillBg: "#0078D4",
        activePillText: "#FFFFFF",
      };

  const categories: { key: HelpCategory; label: string; icon: string }[] = [
    { key: "COMMUNICATION_SETUP", label: "Email & WhatsApp Setup", icon: "💬" },
    { key: "SALES_GUIDE", label: "Sales & Invoices", icon: "🧾" },
    { key: "PURCHASES_GUIDE", label: "Purchases & Bills", icon: "🛍️" },
    { key: "INVENTORY_GUIDE", label: "Inventory & Stock", icon: "📦" },
    { key: "PARTIES_GUIDE", label: "Customers & Vendors", icon: "👤" },
    { key: "BANKING_GUIDE", label: "Bank & Cash", icon: "🏦" },
    { key: "REPORTS_GUIDE", label: "GST & Tax Reports", icon: "📊" },
  ];

  return (
    <FullScreenModal
      isOpen={isOpen}
      onClose={onClose}
      title="ERP Help & Setup Guide"
      subtitle="Easy step-by-step instructions to configure and use your ERP system"
      breadcrumb="HELP & DOCUMENTATION / SYSTEM GUIDES"
      scrollEnabled={true}
      footerActions={
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: "Segoe UI Variable Text" }}>
            💡 Need further assistance? Contact official support at <Text style={{ color: colors.accent, fontWeight: "700" }}>support@jkinfotech.com</Text>
          </Text>
          <Pressable onPress={onClose} style={[styles.doneBtn, { backgroundColor: colors.accent }]}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>Got It, Close</Text>
          </Pressable>
        </View>
      }
    >
      <View style={{ maxWidth: 980, alignSelf: "center", width: "100%", gap: 20, marginTop: 12 }}>
        {/* Category Tabs */}
        <View style={[styles.tabsRow, { borderBottomColor: colors.borderColor }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
            {categories.map((cat) => {
              const isActive = activeCategory === cat.key;
              return (
                <Pressable
                  key={cat.key}
                  onPress={() => setActiveCategory(cat.key)}
                  style={[
                    styles.tabPill,
                    { borderColor: isActive ? colors.accent : colors.borderColor },
                    isActive && { backgroundColor: colors.activePillBg },
                  ]}
                >
                  <Text style={{ fontSize: 15 }}>{cat.icon}</Text>
                  <Text style={[styles.tabText, { color: isActive ? colors.activePillText : colors.textSecondary }]}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Body Content */}
        <View style={styles.contentBody}>
          {activeCategory === "COMMUNICATION_SETUP" && (
            <View style={{ gap: 20 }}>
              <View style={[styles.guideCard, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
                <Text style={[styles.cardTitle, { color: colors.accent }]}>📧 Email (SMTP) Setup Guide</Text>
                <Text style={[styles.stepText, { color: colors.textPrimary }]}>
                  Follow these 5 simple steps to send sales invoices, credit notes, and account statements directly to your customers via Email:
                </Text>
                <View style={styles.stepList}>
                  <Text style={[styles.bullet, { color: colors.textPrimary }]}>1. <Text style={styles.bold}>SMTP Host Server</Text>: Enter your email server address (For Gmail: <Text style={{ color: colors.accent, fontWeight: "700" }}>smtp.gmail.com</Text> | For Outlook: <Text style={{ color: colors.accent, fontWeight: "700" }}>smtp.office365.com</Text>).</Text>
                  <Text style={[styles.bullet, { color: colors.textPrimary }]}>2. <Text style={styles.bold}>Port & Encryption</Text>: Select Port <Text style={styles.bold}>587</Text> with TLS enabled, or Port <Text style={styles.bold}>465</Text> with SSL enabled.</Text>
                  <Text style={[styles.bullet, { color: colors.textPrimary }]}>3. <Text style={styles.bold}>App Password (Important for Gmail/Yahoo)</Text>: Do NOT use your regular email password. Go to your Google Account ➔ Security ➔ 2-Step Verification ➔ <Text style={styles.bold}>App Passwords</Text>. Generate a 16-character App Password and paste it into the Password field.</Text>
                  <Text style={[styles.bullet, { color: colors.textPrimary }]}>4. <Text style={styles.bold}>Sender Name & Email</Text>: Type your company name (e.g., <Text style={styles.bold}>JK Infotech Sales Team</Text>) and official email address.</Text>
                  <Text style={[styles.bullet, { color: colors.textPrimary }]}>5. <Text style={styles.bold}>Send Test Email</Text>: Click the <Text style={{ color: colors.accent, fontWeight: "700" }}>"⚡ Send Test Email"</Text> button to confirm connection.</Text>
                </View>
              </View>

              <View style={[styles.guideCard, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
                <Text style={[styles.cardTitle, { color: colors.accent }]}>📱 WhatsApp Gateway Setup Guide</Text>
                <Text style={[styles.stepText, { color: colors.textPrimary }]}>
                  Automate WhatsApp notifications for new bills, payment reminders, and PDF shares:
                </Text>
                <View style={styles.stepList}>
                  <Text style={[styles.bullet, { color: colors.textPrimary }]}>1. <Text style={styles.bold}>Enable WhatsApp Messaging</Text>: Toggle the <Text style={styles.bold}>"Enable WhatsApp Integration"</Text> switch to ON.</Text>
                  <Text style={[styles.bullet, { color: colors.textPrimary }]}>2. <Text style={styles.bold}>Instance ID & API Key</Text>: Paste your WhatsApp Web API Instance ID and Secret Key from your gateway provider (e.g. UltraMsg, Wassenger, WATI).</Text>
                  <Text style={[styles.bullet, { color: colors.textPrimary }]}>3. <Text style={styles.bold}>Auto-Send On Invoice Save</Text>: Turn on <Text style={styles.bold}>"Auto Send Invoice Link"</Text> to send a WhatsApp message automatically whenever a new invoice is created.</Text>
                  <Text style={[styles.bullet, { color: colors.textPrimary }]}>4. <Text style={styles.bold}>Custom Message Template</Text>: Personalize message variables such as <Text style={{ color: colors.accent, fontWeight: "700" }}>{"{customer_name}"}</Text>, <Text style={{ color: colors.accent, fontWeight: "700" }}>{"{invoice_number}"}</Text>, and <Text style={{ color: colors.accent, fontWeight: "700" }}>{"{total_amount}"}</Text>.</Text>
                </View>
              </View>
            </View>
          )}

          {activeCategory === "SALES_GUIDE" && (
            <View style={[styles.guideCard, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
              <Text style={[styles.cardTitle, { color: colors.accent }]}>🧾 Sales & Invoice Guide</Text>
              <View style={styles.stepList}>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>Creating Invoices</Text>: Press <Text style={styles.bold}>F2</Text> or click <Text style={styles.bold}>"+ New Invoice"</Text>. Select a customer, pick items, set discounts, and save.</Text>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>Recording Payment Receipts</Text>: Click <Text style={styles.bold}>"Receive Payment"</Text> next to an unpaid or partial invoice to record cash or bank deposits.</Text>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>Sharing PDFs</Text>: Click the print icon 🖨️ to preview, print, download PDF, or send directly via Email/WhatsApp.</Text>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>Sales Returns & Credit Notes</Text>: Press <Text style={styles.bold}>Ctrl+F2</Text> to open Returns Screen to issue credit notes for returned goods.</Text>
              </View>
            </View>
          )}

          {activeCategory === "PURCHASES_GUIDE" && (
            <View style={[styles.guideCard, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
              <Text style={[styles.cardTitle, { color: colors.accent }]}>🛍️ Purchase & Vendor Bills Guide</Text>
              <View style={styles.stepList}>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>Adding Purchase Bills</Text>: Press <Text style={styles.bold}>F3</Text> or click <Text style={styles.bold}>"+ New Bill"</Text>. Enter vendor bill number, select items, and save to update stock automatically.</Text>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>Vendor Payments</Text>: Record payments made to vendors via Cash or Bank transfer to clear outstanding balances.</Text>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>Purchase Returns (Debit Notes)</Text>: Record goods returned to vendors to adjust payable amounts.</Text>
              </View>
            </View>
          )}

          {activeCategory === "INVENTORY_GUIDE" && (
            <View style={[styles.guideCard, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
              <Text style={[styles.cardTitle, { color: colors.accent }]}>📦 Inventory & Product Registry Guide</Text>
              <View style={styles.stepList}>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>Adding Products</Text>: Press <Text style={styles.bold}>F7</Text> to open Inventory. Add item name, SKU, HSN/SAC code, sale price, purchase price, and tax rate.</Text>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>Stock Adjustments</Text>: Use <Text style={styles.bold}>"⚡ Adjust Stock"</Text> to manually add or deduct physical stock with reason notes.</Text>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>Low Stock Alerts</Text>: Set reorder alert levels to get automatic notifications when inventory runs low.</Text>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>EAN-13 Barcodes</Text>: Click <Text style={styles.bold}>"Barcode Labels"</Text> to generate and print scan-ready product barcodes.</Text>
              </View>
            </View>
          )}

          {activeCategory === "PARTIES_GUIDE" && (
            <View style={[styles.guideCard, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
              <Text style={[styles.cardTitle, { color: colors.accent }]}>👤 Customers & Vendors Guide</Text>
              <View style={styles.stepList}>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>Adding Parties</Text>: Press <Text style={styles.bold}>F8</Text> to manage Customers and Vendors. Store phone numbers, email, GSTIN, and credit limits.</Text>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>Opening Balances</Text>: Enter opening debit or credit balance when onboarding existing customers or vendors.</Text>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>GSTIN Verification</Text>: Save verified GSTIN numbers for accurate B2B GSTR-1 and GSTR-3B tax filing.</Text>
              </View>
            </View>
          )}

          {activeCategory === "BANKING_GUIDE" && (
            <View style={[styles.guideCard, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
              <Text style={[styles.cardTitle, { color: colors.accent }]}>🏦 Bank Accounts & Cash Registry Guide</Text>
              <View style={styles.stepList}>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>Bank & Cash Accounts</Text>: Press <Text style={styles.bold}>F9</Text> to view live Cash in Hand, HDFC, SBI, ICICI, and online payment gateway accounts.</Text>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>Fund Transfers</Text>: Transfer money between bank accounts or record cash withdrawals and deposits.</Text>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>Direct Expenses</Text>: Record operational expenses (Rent, Electricity, Salary) linked directly to bank or cash accounts.</Text>
              </View>
            </View>
          )}

          {activeCategory === "REPORTS_GUIDE" && (
            <View style={[styles.guideCard, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
              <Text style={[styles.cardTitle, { color: colors.accent }]}>📊 GST & Tax Reports Guide</Text>
              <View style={styles.stepList}>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>GSTR-1 Report</Text>: B2B and B2C sales summary formatted for official GST portal upload.</Text>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>GSTR-3B Summary</Text>: Total outward supplies, eligible Input Tax Credit (ITC), and net GST payable.</Text>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>Profit & Loss Statement</Text>: Net sales, cost of goods sold (COGS), gross margin, operating expenses, and net profit.</Text>
                <Text style={[styles.bullet, { color: colors.textPrimary }]}>• <Text style={styles.bold}>Exporting Data</Text>: Export any report directly to Excel or PDF for your CA/Auditor with one click.</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </FullScreenModal>
  );
}

const styles = StyleSheet.create({
  tabsRow: {
    borderBottomWidth: 1,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 13.5,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
  },
  contentBody: {
    paddingVertical: 8,
  },
  guideCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 22,
    gap: 14,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Display",
  },
  stepText: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Segoe UI Variable Text",
  },
  stepList: {
    gap: 12,
    marginTop: 4,
  },
  bullet: {
    fontSize: 13.5,
    lineHeight: 22,
    fontFamily: "Segoe UI Variable Text",
  },
  bold: {
    fontWeight: "700",
  },
  doneBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
});
