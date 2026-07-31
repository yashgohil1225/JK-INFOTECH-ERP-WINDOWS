// =============================================================
// JK INFOTECH ERP — Banking & Cash Screen (Fluent Master-Detail Layout)
// File : src/screens/BankingScreen.tsx
// =============================================================

import React, { useState, useMemo } from "react";
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
import { ModuleHelpModal, HelpCategory } from "../components/ui/ModuleHelpModal";
import { Button } from "../components/ui/Button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/client";
import { DataTable, ColumnDefinition } from "../components/ui/DataTable";
import { invalidateAllQueries } from "../utils/queryHelpers";

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

function formatPaymentTimestamp(isoStr: string): string {
  if (!isoStr) return "—";
  const parts = isoStr.split("T");
  const datePart = toUIDate(parts[0]);
  if (parts.length === 2) {
    const timePart = parts[1].substring(0, 5); // HH:MM
    return `${datePart} ${timePart}`;
  }
  return datePart;
}

// ─── Interfaces ───────────────────────────────────────────────
interface Account {
  id: string;
  name: string;
  account_code?: string;
  account_type: string;
  account_subtype?: string;
  opening_balance: number;
}

interface Payment {
  id: string;
  payment_type: string; // RECEIPT | PAYMENT
  party_type?: string;  // customer | supplier | internal
  party_id?: string;
  payment_method: string;
  bank_account?: string;
  amount: number;
  payment_date: string;
  reference_type?: string;
  reference_number?: string;
  tds_amount?: number;
  notes?: string;
}

// ─── Main Screen ───────────────────────────────────────────────
export default function BankingScreen() {
  const { isDarkMode } = useUIStore();
  const { company } = useAuthStore();
  const queryClient = useQueryClient();

  // Mode Selection
  const [activeRightTab, setActiveRightTab] = useState<"TRANSACTIONS" | "TRANSFER" | "CREATE_ACCOUNT">("TRANSACTIONS");
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  // Form States
  const [accountForm, setAccountForm] = useState({
    name: "",
    account_code: "",
    account_type: "BANK", // BANK or CASH
    opening_balance: "0"
  });

  const [transferForm, setTransferForm] = useState({
    source_account_id: "",
    destination_account_id: "",
    amount: "",
    notes: "Capital Deposit"
  });

  // Fluent design palette based on Dark/Light mode
  const colors = isDarkMode
    ? {
        background: "#0F172A",
        cardBg: "#1E293B",
        cardBorder: "#334155",
        textPrimary: "#F8FAFC",
        textSecondary: "#94A3B8",
        accent: "#38BDF8",
        accentHover: "#0EA5E9",
        inputBg: "#1E293B",
        inputBorder: "#334155",
        divider: "#334155",
        tableHeaderBg: "#334155",
        activeRowBg: "#0C4A6E",
        hoverRowBg: "#1E293B",
        statusActive: "#16A34A",
        statusInactive: "#DC2626",
        btnSecondaryBg: "#334155",
        btnSecondaryText: "#F8FAFC",
        badgeReceipt: "#14532D",
        badgePayment: "#450A0A"
      }
    : {
        background: "#F8FAFC",
        cardBg: "#FFFFFF",
        cardBorder: "#E2E8F0",
        textPrimary: "#0F172A",
        textSecondary: "#64748B",
        accent: "#0284C7",
        accentHover: "#0369A1",
        inputBg: "#FFFFFF",
        inputBorder: "#CBD5E1",
        divider: "#CBD5E1",
        tableHeaderBg: "#EBF3FA",
        activeRowBg: "#E0F2FE",
        hoverRowBg: "#F1F5F9",
        statusActive: "#16A34A",
        statusInactive: "#DC2626",
        btnSecondaryBg: "#E2E8F0",
        btnSecondaryText: "#0F172A",
        badgeReceipt: "#DCFCE7",
        badgePayment: "#FEE2E2"
      };

  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [helpModalCategory, setHelpModalCategory] = useState<HelpCategory>("BANKING_GUIDE");

  // --- Fetch Queries ---
  // 1. Fetch only Bank/Cash Accounts
  const { data: accounts = [], isLoading: isLoadingAccounts } = useQuery<Account[]>({
    queryKey: ["bankingAccounts", company?.id],
    queryFn: async () => {
      const res = await apiClient.get("/api/banking/accounts");
      return res.data;
    },
    staleTime: 0,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  // 2. Fetch all accounts (needed for capital transfer source accounts, i.e. Equity/Capital accounts)
  const { data: allAccounts = [] } = useQuery<Account[]>({
    queryKey: ["allAccounts", company?.id],
    queryFn: async () => {
      const res = await apiClient.get("/api/banking/accounts/all");
      return res.data;
    },
    staleTime: 0,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  // 3. Fetch Payments
  const { data: payments = [], isLoading: isLoadingPayments } = useQuery<Payment[]>({
    queryKey: ["payments", company?.id],
    queryFn: async () => {
      const res = await apiClient.get("/api/banking/payments");
      return res.data;
    },
    staleTime: 0,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  // Filter Equity source accounts (usually Capital Account or Retained Earnings)
  const equityAccounts = useMemo(() => {
    return allAccounts.filter(acc => acc.account_type === "EQUITY" || acc.name.toLowerCase().includes("capital"));
  }, [allAccounts]);

  // Filter payments by selected account card
  const displayedPayments = useMemo(() => {
    if (!selectedAccount) return payments;
    const isCash = selectedAccount.account_type === "CASH" || selectedAccount.name === "Cash In Hand";
    const accNameLower = selectedAccount.name.toLowerCase().trim();
    return payments.filter(p => {
      if (isCash) {
        return p.payment_method?.toUpperCase() === "CASH" || p.bank_account === "Cash In Hand";
      } else {
        if (p.bank_account && p.bank_account.toLowerCase().trim() === accNameLower) return true;
        if ((!p.bank_account || p.bank_account === "None") && p.payment_method?.toUpperCase() !== "CASH") return true;
        return false;
      }
    });
  }, [payments, selectedAccount]);

  // --- Mutations ---
  const createAccountMutation = useMutation({
    mutationFn: async (newAcc: any) => {
      const res = await apiClient.post("/api/banking/accounts", newAcc);
      return res.data;
    },
    onSuccess: (newAccount: Account) => {
      queryClient.setQueryData<Account[]>(["bankingAccounts", company?.id], (old = []) => {
        if (old.some(a => a.id === newAccount.id)) return old;
        return [...old, newAccount];
      });
      invalidateAllQueries(queryClient);
      Alert.alert("Success", "Bank / Cash Account created successfully.");
      setActiveRightTab("TRANSACTIONS");
      setAccountForm({ name: "", account_code: "", account_type: "BANK", opening_balance: "0" });
    },
    onError: (error: any) => {
      Alert.alert("Error", error.response?.data?.detail || "Failed to create account.");
    }
  });

  const transferCapitalMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/api/banking/transfer-capital", payload);
      return res.data;
    },
    onSuccess: () => {
      invalidateAllQueries(queryClient);
      Alert.alert("Success", "Capital deposit completed successfully.");
      setActiveRightTab("TRANSACTIONS");
      setTransferForm({ source_account_id: "", destination_account_id: "", amount: "", notes: "Capital Deposit" });
    },
    onError: (error: any) => {
      Alert.alert("Error", error.response?.data?.detail || "Capital Transfer failed.");
    }
  });

  // --- Action Handlers ---
  const handleCreateAccount = () => {
    if (!accountForm.name.trim()) {
      Alert.alert("Validation", "Account name is required.");
      return;
    }
    createAccountMutation.mutate({
      name: accountForm.name.trim(),
      account_code: accountForm.account_code.trim() || undefined,
      account_type: accountForm.account_type,
      account_subtype: accountForm.account_type,
      opening_balance: parseFloat(accountForm.opening_balance) || 0
    });
  };

  const handleTransferCapital = () => {
    if (!transferForm.source_account_id || !transferForm.destination_account_id || !transferForm.amount) {
      Alert.alert("Validation", "Please fill in all capital transfer fields.");
      return;
    }
    transferCapitalMutation.mutate({
      source_account_id: transferForm.source_account_id,
      destination_account_id: transferForm.destination_account_id,
      amount: parseFloat(transferForm.amount) || 0,
      transfer_date: new Date().toISOString(),
      notes: transferForm.notes
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* LEFT PANE: Accounts Grid & General Statistics */}
      <View style={[styles.masterPane, { borderRightColor: colors.divider }]}>
        {/* Header Block */}
        <View style={styles.header}>
          <Text style={[styles.breadcrumb, { color: colors.accent }]}>BANK & CASH</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Bank & Cash Accounts</Text>

          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Manage bank accounts, cash boxes, and money transfers.
          </Text>
        </View>

        {/* Treasury Cards list */}
        <Text style={[styles.sectionLabel, { color: colors.accent, marginTop: 8 }]}>BANK & CASH ACCOUNTS</Text>
        {isLoadingAccounts ? (
          <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 16 }} />
        ) : (
          <ScrollView style={styles.accountsScroll} showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingRight: 14 }}>
            <View style={styles.accountsGrid}>
              {accounts.map(acc => {
                const isBank = acc.account_type === "BANK" || acc.account_subtype?.toUpperCase() === "BANK";
                const isSelected = selectedAccount?.id === acc.id;
                return (
                  <Pressable
                    key={acc.id}
                    style={({ hovered }: any) => [
                      styles.accountCard,
                      { backgroundColor: colors.cardBg, borderColor: isSelected ? colors.accent : colors.cardBorder },
                      hovered && !isSelected && { backgroundColor: colors.hoverRowBg }
                    ]}
                    onPress={() => setSelectedAccount(isSelected ? null : acc)}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={[styles.cardIcon, { fontFamily: "Segoe MDL2 Assets", color: colors.accent }]}>
                        {isBank ? "\uE8C7" : "\uEC32"} {/* Bank or Cash Box Glyph */}
                      </Text>
                      <View style={[styles.badge, { backgroundColor: isBank ? "rgba(56,189,248,0.15)" : "rgba(22,163,74,0.15)" }]}>
                        <Text style={[styles.badgeText, { color: isBank ? colors.accent : colors.statusActive }]}>
                          {isBank ? "BANK" : "CASH"}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.accountName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {acc.name}
                    </Text>
                    {acc.account_code && (
                      <Text style={[styles.accountCode, { color: colors.textSecondary }]}>
                        Code: {acc.account_code}
                      </Text>
                    )}
                    <Text style={[styles.accountBalance, { color: colors.textPrimary }]}>
                      ₹{Number(acc.opening_balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* Bottom Panel Buttons */}
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.accent }]}
            onPress={() => {
              setActiveRightTab("CREATE_ACCOUNT");
              setSelectedAccount(null);
            }}
          >
            <Text style={styles.actionBtnText}>+ Add Account</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.btnSecondaryBg }]}
            onPress={() => {
              setActiveRightTab("TRANSFER");
              setSelectedAccount(null);
            }}
          >
            <Text style={[styles.actionBtnText, { color: colors.btnSecondaryText }]}>Fund Transfer</Text>
          </Pressable>
        </View>
      </View>

      {/* RIGHT PANE: Transactions Ledger & Form Wizards */}
      <View style={styles.detailPane}>
        {/* Navigation Header */}
        <View style={[styles.detailHeader, { borderBottomColor: colors.divider }]}>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <Pressable onPress={() => setActiveRightTab("TRANSACTIONS")}>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: activeRightTab === "TRANSACTIONS" ? colors.accent : colors.textSecondary,
                    fontWeight: activeRightTab === "TRANSACTIONS" ? "700" : "400"
                  }
                ]}
              >
                Transaction History
              </Text>
            </Pressable>
            <Pressable onPress={() => setActiveRightTab("TRANSFER")}>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: activeRightTab === "TRANSFER" ? colors.accent : colors.textSecondary,
                    fontWeight: activeRightTab === "TRANSFER" ? "700" : "400"
                  }
                ]}
              >
                Capital / Deposit
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Tab Content Panels */}
        {activeRightTab === "TRANSACTIONS" && (
          <View style={styles.ledgerContainer}>
            {selectedAccount && (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: isDarkMode ? "#1E293B" : "#F1F5F9", borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder }}>
                <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.accent }}>
                  Filtered by: {selectedAccount.name} ({displayedPayments.length} transactions)
                </Text>
                <Pressable onPress={() => setSelectedAccount(null)} style={({ hovered }: any) => [hovered && { opacity: 0.7 }]}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#EF4444", textDecorationLine: "underline" }}>Clear Filter</Text>
                </Pressable>
              </View>
            )}
            <DataTable
              data={displayedPayments}
              columns={[
                {
                  header: "DATE",
                  accessorKey: "payment_date",
                  flex: 1.3,
                  render: (row) => (
                    <Text style={[styles.rowCell, { color: colors.textPrimary }]} numberOfLines={1}>
                      {formatPaymentTimestamp(row.payment_date)}
                    </Text>
                  )
                },
                {
                  header: "REFERENCE / TYPE",
                  accessorKey: "reference_type",
                  flex: 1.6,
                  render: (row) => {
                    const isReceipt = row.payment_type === "RECEIPT";
                    return (
                      <View style={{ gap: 2 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <View
                            style={[
                              styles.typeBadge,
                              { backgroundColor: isReceipt ? colors.badgeReceipt : colors.badgePayment }
                            ]}
                          >
                            <Text style={{ fontSize: 11, fontWeight: "800", color: isReceipt ? colors.statusActive : colors.statusInactive }}>
                              {isReceipt ? "IN" : "OUT"}
                            </Text>
                          </View>
                          <Text style={[styles.rowCell, { color: colors.textPrimary, fontWeight: "600" }]} numberOfLines={1}>
                            {row.reference_type ? row.reference_type.toUpperCase().replace("_", " ") : "MANUAL"}
                          </Text>
                        </View>
                        {row.reference_number && (
                          <Text style={{ fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>
                            {row.payment_method === "CHEQUE" ? `Cheque No: ${row.reference_number}` : `Ref: ${row.reference_number}`}
                          </Text>
                        )}
                        {row.notes && (
                          <Text style={{ fontSize: 11.5, color: colors.textSecondary, fontStyle: "italic" }} numberOfLines={1}>
                            {row.notes}
                          </Text>
                        )}
                      </View>
                    );
                  }
                },
                {
                  header: "METHOD",
                  accessorKey: "payment_method",
                  flex: 1.2,
                  render: (row) => (
                    <Text style={[styles.rowCell, { color: colors.textSecondary }]} numberOfLines={1}>
                      {row.payment_method?.replace("_", " ")}
                    </Text>
                  )
                },
                {
                  header: "AMOUNT",
                  accessorKey: "amount",
                  flex: 1.3,
                  align: "right",
                  render: (row) => {
                    const isReceipt = row.payment_type === "RECEIPT";
                    return (
                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={[
                            styles.rowCell,
                            {
                              textAlign: "right",
                              fontWeight: "700",
                              color: isReceipt ? colors.statusActive : colors.statusInactive
                            }
                          ]}
                        >
                          {isReceipt ? "+" : "-"}₹{Number(row.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </Text>
                        {Number((row as any).tds_amount) > 0 && (
                          <Text style={{ fontSize: 11.5, color: "#EF4444", fontWeight: "700", marginTop: 1, textAlign: "right" }}>
                            + ₹{Number((row as any).tds_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })} TDS
                          </Text>
                        )}
                      </View>
                    );
                  }
                }
              ]}
              isLoading={isLoadingPayments}
              emptyMessage="No recorded transactions."
              loaderMessage="Loading transactions..."
            />
          </View>
        )}

        {activeRightTab === "TRANSFER" && (
          <ScrollView style={styles.formScroll} contentContainerStyle={{ gap: 16 }}>
            <View>
              <Text style={[styles.formTitle, { color: colors.textPrimary }]}>Capital / Direct Deposit</Text>
              <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>
                Deposit funds directly into your bank or cash account from owner capital or external sources.
              </Text>
            </View>

            {/* Source Account (Equity) */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Source Account (Equity / Capital) *</Text>
              <View style={[styles.customPicker, { borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}>
                <ScrollView style={{ maxHeight: 120 }}>
                  {equityAccounts.map(acc => (
                    <Pressable
                      key={acc.id}
                      style={[
                        styles.pickerItem,
                        { borderBottomColor: colors.divider },
                        transferForm.source_account_id === acc.id && { backgroundColor: colors.activeRowBg }
                      ]}
                      onPress={() => setTransferForm({ ...transferForm, source_account_id: acc.id })}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 15 }}>{acc.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Destination Account (Bank/Cash) */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Destination Account (Bank / Cash) *</Text>
              <View style={[styles.customPicker, { borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}>
                <ScrollView style={{ maxHeight: 120 }}>
                  {accounts.map(acc => (
                    <Pressable
                      key={acc.id}
                      style={[
                        styles.pickerItem,
                        { borderBottomColor: colors.divider },
                        transferForm.destination_account_id === acc.id && { backgroundColor: colors.activeRowBg }
                      ]}
                      onPress={() => setTransferForm({ ...transferForm, destination_account_id: acc.id })}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 15 }}>{acc.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Amount */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Deposit Amount (₹) *</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                value={transferForm.amount}
                onChangeText={v => setTransferForm({ ...transferForm, amount: v })}
                keyboardType="numeric"
              />
            </View>

            {/* Notes */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Narration / Notes</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary, height: 60, textAlignVertical: "top" }]}
                placeholder="Describe transfer purpose..."
                placeholderTextColor={colors.textSecondary}
                value={transferForm.notes}
                onChangeText={v => setTransferForm({ ...transferForm, notes: v })}
                multiline
              />
            </View>

            <Pressable
              style={[styles.submitBtn, { backgroundColor: colors.accent }]}
              onPress={handleTransferCapital}
              disabled={transferCapitalMutation.isPending}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {transferCapitalMutation.isPending && <ActivityIndicator color="#FFFFFF" size="small" style={{ width: 18, height: 18 }} />}
                <Text style={styles.submitBtnText}>Post Capital / Deposit</Text>
              </View>
            </Pressable>
          </ScrollView>
        )}

        {activeRightTab === "CREATE_ACCOUNT" && (
          <ScrollView style={styles.formScroll} contentContainerStyle={{ gap: 16 }}>
            <View>
              <Text style={[styles.formTitle, { color: colors.textPrimary }]}>Add Bank or Cash Account</Text>
              <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>
                Add a new bank account or cash box.
              </Text>
            </View>

            {/* Account Name */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Account Name *</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                placeholder="e.g. HDFC CURRENT A/C"
                placeholderTextColor={colors.textSecondary}
                value={accountForm.name}
                onChangeText={v => setAccountForm({ ...accountForm, name: v })}
              />
            </View>

            {/* Account Code */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Account Code (Optional)</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                placeholder="e.g. 1005"
                placeholderTextColor={colors.textSecondary}
                value={accountForm.account_code}
                onChangeText={v => setAccountForm({ ...accountForm, account_code: v })}
              />
            </View>

            {/* Account Type */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Account Type</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {["BANK", "CASH"].map(type => (
                  <Pressable
                    key={type}
                    style={[
                      styles.typeSelector,
                      { borderColor: accountForm.account_type === type ? colors.accent : colors.cardBorder },
                      accountForm.account_type === type && { backgroundColor: colors.activeRowBg }
                    ]}
                    onPress={() => setAccountForm({ ...accountForm, account_type: type })}
                  >
                    <Text style={{ color: accountForm.account_type === type ? colors.accent : colors.textSecondary, fontWeight: "600" }}>
                      {type}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Opening Balance */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Opening Balance (₹)</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                value={accountForm.opening_balance}
                onChangeText={v => setAccountForm({ ...accountForm, opening_balance: v })}
                keyboardType="numeric"
              />
            </View>

            <Pressable
              style={[styles.submitBtn, { backgroundColor: colors.accent }]}
              onPress={handleCreateAccount}
              disabled={createAccountMutation.isPending}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {createAccountMutation.isPending && <ActivityIndicator color="#FFFFFF" size="small" style={{ width: 18, height: 18 }} />}
                <Text style={styles.submitBtnText}>Create Account</Text>
              </View>
            </Pressable>
          </ScrollView>
        )}
      </View>
      <ModuleHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        initialCategory={helpModalCategory}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row"
  },
  masterPane: {
    flex: 0.45,
    borderRightWidth: 1,
    padding: 24,
    gap: 20,
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
  title: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Display",
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Segoe UI Variable Text",
  },
  sectionLabel: {
    fontSize: 12.5,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
    fontFamily: "Segoe UI Variable Text"
  },
  accountsScroll: {
    flex: 1,
    marginBottom: 16
  },
  accountsGrid: {
    gap: 12
  },
  accountCard: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  cardIcon: {
    fontSize: 25
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800"
  },
  accountName: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text"
  },
  accountCode: {
    fontSize: 12.5,
    fontFamily: "Segoe UI Variable Text"
  },
  accountBalance: {
    fontSize: 19.5,
    fontWeight: "800",
    fontFamily: "Segoe UI Variable Display"
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8
  },
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center"
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text"
  },

  // Right pane
  detailPane: {
    flex: 0.55,
    padding: 16
  },
  detailHeader: {
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 16
  },
  tabLabel: {
    fontSize: 17.5,
    fontFamily: "Segoe UI Variable Display"
  },
  ledgerContainer: {
    flex: 1
  },
  tableHeader: {
    flexDirection: "row",
    height: 38,
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 4,
    marginBottom: 8
  },
  headerCell: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text"
  },
  tableRow: {
    flexDirection: "row",
    height: 44,
    alignItems: "center",
    paddingHorizontal: 12,
    borderBottomWidth: 1
  },
  rowCell: {
    fontSize: 14.5,
    fontFamily: "Segoe UI Variable Text"
  },
  typeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyCard: {
    padding: 32,
    alignItems: "center"
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Segoe UI Variable Text"
  },

  // Forms
  formScroll: {
    flex: 1
  },
  formTitle: {
    fontSize: 18.5,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Display"
  },
  formSubtitle: {
    fontSize: 14,
    fontFamily: "Segoe UI Variable Text",
    marginTop: 2,
    marginBottom: 12
  },
  formGroup: {
    gap: 4,
    marginBottom: 12
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text"
  },
  textInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 15,
    fontFamily: "Segoe UI Variable Text",
    textAlignVertical: "center"
  },
  customPicker: {
    borderWidth: 1,
    borderRadius: 6,
    overflow: "hidden"
  },
  pickerItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  submitBtn: {
    height: 38,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text"
  },
  typeSelector: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center"
  }
});
