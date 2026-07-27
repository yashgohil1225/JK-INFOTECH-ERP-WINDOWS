// =============================================================
// JK INFOTECH ERP — Reusable Status Badge Component (Fluent 2)
// File : src/components/ui/StatusBadge.tsx
// =============================================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useUIStore } from "../../store/uiStore";

export type StatusType =
  | "PAID" | "UNPAID" | "PARTIAL" | "OVERDUE" | "DRAFT" | "CANCELLED"
  | "CREATE" | "UPDATE" | "DELETE" | "LOW_STOCK" | "ACTIVE" | "INACTIVE"
  | string;

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: "small" | "medium";
}

export function StatusBadge({ status, label, size = "medium" }: StatusBadgeProps) {
  const { isDarkMode } = useUIStore();
  const normalized = (status || "").toUpperCase().trim();
  const displayText = label || normalized;

  let bg = isDarkMode ? "#334155" : "#E2E8F0";
  let text = isDarkMode ? "#F8FAFC" : "#0F172A";
  let border = "transparent";

  switch (normalized) {
    case "PAID":
    case "CREATE":
    case "ACTIVE":
      bg = isDarkMode ? "#064E3B" : "#ECFDF5";
      text = isDarkMode ? "#34D399" : "#059669";
      border = isDarkMode ? "#059669" : "#A7F3D0";
      break;
    case "UNPAID":
    case "OVERDUE":
    case "DELETE":
    case "INACTIVE":
      bg = isDarkMode ? "#4C0519" : "#FFF1F2";
      text = isDarkMode ? "#FB7185" : "#E11D48";
      border = isDarkMode ? "#E11D48" : "#FECDD3";
      break;
    case "PARTIAL":
    case "PENDING":
    case "LOW_STOCK":
    case "UPDATE":
      bg = isDarkMode ? "#451A03" : "#FEF3C7";
      text = isDarkMode ? "#FBBF24" : "#D97706";
      border = isDarkMode ? "#D97706" : "#FDE68A";
      break;
    case "DRAFT":
    case "CANCELLED":
      bg = isDarkMode ? "#1E293B" : "#F1F5F9";
      text = isDarkMode ? "#94A3B8" : "#64748B";
      border = isDarkMode ? "#334155" : "#CBD5E1";
      break;
  }

  const isSmall = size === "small";

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderColor: border,
          paddingHorizontal: isSmall ? 6 : 10,
          paddingVertical: isSmall ? 2 : 4,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: text }]} />
      <Text style={[styles.text, { color: text, fontSize: isSmall ? 11 : 12.5 }]}>
        {displayText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Display",
    letterSpacing: 0.5,
  },
});
