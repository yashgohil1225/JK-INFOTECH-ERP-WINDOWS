// =============================================================
// JK INFOTECH ERP — Master Full Screen Quick Add Bank Account Modal
// File : src/components/ui/AddBankAccountModal.tsx
// =============================================================

import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { FullScreenModal } from "./FullScreenModal";
import { Input } from "./Input";
import { Button } from "./Button";
import { useUIStore } from "../../store/uiStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../../api/client";
import { invalidateAllQueries } from "../../utils/queryHelpers";

interface AddBankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName?: string;
  onAccountCreated?: (newAccount: { id: string; name: string; account_type: string }) => void;
}

export function AddBankAccountModal({
  isOpen,
  onClose,
  initialName = "",
  onAccountCreated
}: AddBankAccountModalProps) {
  const { isDarkMode } = useUIStore();
  const queryClient = useQueryClient();

  const [name, setName] = useState(initialName);
  const [accountCode, setAccountCode] = useState("");
  const [accountType, setAccountType] = useState<"BANK" | "CASH">("BANK");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setAccountCode("");
      setAccountType("BANK");
      setOpeningBalance("0");
      setAccountNumber("");
      setIfscCode("");
      setNotes("");
    }
  }, [isOpen, initialName]);

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/api/banking/accounts", payload);
      return res.data;
    },
    onSuccess: (newAccount: any) => {
      invalidateAllQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["bankingAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["allAccounts"] });
      Alert.alert("Success", `Account "${newAccount.name}" created successfully.`);
      if (onAccountCreated) {
        onAccountCreated(newAccount);
      }
      onClose();
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.detail || "Failed to create account.");
    }
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert("Validation", "Account name is required.");
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      account_code: accountCode.trim() || undefined,
      account_type: accountType,
      account_subtype: accountType,
      opening_balance: parseFloat(openingBalance) || 0,
      account_number: accountNumber.trim() || undefined,
      ifsc_code: ifscCode.trim() || undefined,
      notes: notes.trim() || undefined
    });
  };

  const C = isDarkMode
    ? {
        cardBg: "#1E293B",
        cardBorder: "#334155",
        textPrimary: "#F8FAFC",
        textSecondary: "#94A3B8",
        accent: "#38BDF8",
        accentBg: "#0C4A6E",
        border: "#334155",
        pillBg: "#0F172A"
      }
    : {
        cardBg: "#FFFFFF",
        cardBorder: "#CBD5E1",
        textPrimary: "#0F172A",
        textSecondary: "#64748B",
        accent: "#0284C7",
        accentBg: "#E0F2FE",
        border: "#CBD5E1",
        pillBg: "#F8FAFC"
      };

  return (
    <FullScreenModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Bank & Treasury Account"
      subtitle="Register a new liquid bank account or cash counter to receive and record transactions"
      breadcrumb="banking / quick account creation"
      onKeyDown={(e: any) => {
        const key = e.nativeEvent?.key || e.key;
        if (key === "Escape") {
          onClose();
        } else if (key === "Enter" && (e.ctrlKey || e.metaKey)) {
          handleSubmit();
        }
      }}
      footerActions={
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: C.pillBg, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: C.textSecondary, letterSpacing: 0.5 }}>ACCOUNT CATEGORY</Text>
              <Text style={{ fontSize: 17, fontWeight: "800", color: C.accent }}>
                {accountType === "BANK" ? "BANK ACCOUNT" : "CASH COUNTER"}
              </Text>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: C.pillBg, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: C.textSecondary, letterSpacing: 0.5 }}>INITIAL OPENING BALANCE</Text>
              <Text style={{ fontSize: 17, fontWeight: "800", color: "#10B981" }}>
                ₹{(parseFloat(openingBalance) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onClose}
              style={{ minWidth: 130, height: 46 }}
            />
            <Button
              title="Create Account"
              variant="primary"
              onPress={handleSubmit}
              loading={createMutation.isPending}
              loadingText="Creating Account..."
              style={{ minWidth: 180, height: 46 }}
            />
          </View>
        </View>
      }
    >
      <View style={{ gap: 24, paddingVertical: 12 }}>
        <View style={{ flexDirection: "row", gap: 28, flexWrap: "wrap" }}>
          
          {/* LEFT COLUMN: Main Account Identity */}
          <View style={{ flex: 1.2, minWidth: 400, gap: 22, padding: 26, borderRadius: 12, backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.cardBorder }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: C.accent, fontFamily: "Segoe UI Variable Display", letterSpacing: 0.8 }}>
              ACCOUNT IDENTITY & TYPE
            </Text>

            {/* Account Type Selector Pills */}
            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: C.textSecondary, fontFamily: "Segoe UI Variable Text" }}>
                ACCOUNT CLASSIFICATION *
              </Text>
              <View style={{ flexDirection: "row", gap: 14 }}>
                <Pressable
                  onPress={() => setAccountType("BANK")}
                  style={({ hovered }: any) => [
                    styles.typePill,
                    { borderColor: accountType === "BANK" ? C.accent : C.border },
                    accountType === "BANK" && { backgroundColor: C.accentBg },
                    hovered && { opacity: 0.85 }
                  ]}
                >
                  <Text style={[styles.typePillIcon, { color: C.accent }]}>{"\uE8C7"}</Text>
                  <View style={{ gap: 2 }}>
                    <Text style={[styles.typePillTitle, { color: accountType === "BANK" ? C.accent : C.textPrimary }]}>Bank Account</Text>
                    <Text style={[styles.typePillSub, { color: C.textSecondary }]}>NEFT / RTGS / UTR / Cheque</Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setAccountType("CASH")}
                  style={({ hovered }: any) => [
                    styles.typePill,
                    { borderColor: accountType === "CASH" ? C.accent : C.border },
                    accountType === "CASH" && { backgroundColor: C.accentBg },
                    hovered && { opacity: 0.85 }
                  ]}
                >
                  <Text style={[styles.typePillIcon, { color: C.accent }]}>{"\uEC32"}</Text>
                  <View style={{ gap: 2 }}>
                    <Text style={[styles.typePillTitle, { color: accountType === "CASH" ? C.accent : C.textPrimary }]}>Cash Counter</Text>
                    <Text style={[styles.typePillSub, { color: C.textSecondary }]}>Physical cash box</Text>
                  </View>
                </Pressable>
              </View>
            </View>

            <Input
              label="ACCOUNT / BANK NAME *"
              value={name}
              onChangeText={setName}
              placeholder={accountType === "BANK" ? "e.g. HDFC Bank, Axis Bank Current A/C" : "e.g. Petty Cash Box"}
              style={{ fontSize: 18 }}
            />

            <Input
              label="ACCOUNT CODE (OPTIONAL)"
              value={accountCode}
              onChangeText={setAccountCode}
              placeholder="e.g. 1002 or ACC-BANK-01"
              style={{ fontSize: 17 }}
            />

            {accountType === "BANK" && (
              <>
                <Input
                  label="ACCOUNT NUMBER (OPTIONAL)"
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  placeholder="e.g. 5010029384756"
                  style={{ fontSize: 17 }}
                />

                <Input
                  label="IFSC CODE (OPTIONAL)"
                  value={ifscCode}
                  onChangeText={v => setIfscCode(v.toUpperCase())}
                  placeholder="e.g. HDFC0001234"
                  style={{ fontSize: 17 }}
                />
              </>
            )}
          </View>

          {/* RIGHT COLUMN: Opening Balance & Treasury Notice */}
          <View style={{ flex: 1, minWidth: 380, gap: 22 }}>
            
            <View style={{ padding: 26, borderRadius: 12, backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.cardBorder, gap: 18 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: C.accent, fontFamily: "Segoe UI Variable Display", letterSpacing: 0.8 }}>
                OPENING BALANCE & NOTES
              </Text>

              <Input
                label="OPENING BALANCE (₹)"
                value={openingBalance}
                onChangeText={setOpeningBalance}
                keyboardType="numeric"
                placeholder="0.00"
                style={{ fontSize: 22, fontWeight: "800", color: "#10B981" }}
              />

              <Input
                label="REMARKS / NOTES"
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional internal remarks..."
                style={{ fontSize: 17 }}
              />
            </View>

            {/* Industrial Treasury Card Notice */}
            <View style={{ padding: 22, borderRadius: 12, backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC", borderWidth: 1, borderColor: C.border, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 20, color: C.accent }}>💡</Text>
                <Text style={{ fontSize: 16, fontWeight: "800", color: C.textPrimary, fontFamily: "Segoe UI Variable Display" }}>
                  Instant Integration
                </Text>
              </View>
              <Text style={{ fontSize: 14.5, color: C.textSecondary, fontFamily: "Segoe UI Variable Text", lineHeight: 22 }}>
                Creating this account will instantly make it available for receiving customer invoice payments and recording supplier bill settlements without leaving your current screen.
              </Text>
            </View>

          </View>

        </View>
      </View>
    </FullScreenModal>
  );
}

const styles = StyleSheet.create({
  typePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1.5
  },
  typePillIcon: {
    fontFamily: "Segoe MDL2 Assets",
    fontSize: 26
  },
  typePillTitle: {
    fontSize: 16,
    fontWeight: "800",
    fontFamily: "Segoe UI Variable Display"
  },
  typePillSub: {
    fontSize: 12.5,
    fontFamily: "Segoe UI Variable Text"
  }
});
