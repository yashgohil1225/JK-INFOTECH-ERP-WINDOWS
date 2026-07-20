// =============================================================
// JK INFOTECH ERP — Reusable Search & Filter Toolbar
// File : src/components/ui/SearchToolbar.tsx
// =============================================================

import React from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { useUIStore } from "../../store/uiStore";

interface SearchToolbarProps {
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  children?: React.ReactNode;
}

export function SearchToolbar({
  placeholder = "Search...",
  value,
  onChangeText,
  children
}: SearchToolbarProps) {
  const { isDarkMode } = useUIStore();

  const colors = isDarkMode
    ? {
        inputBg: "#1E293B",
        inputBorder: "#334155",
        textPrimary: "#F8FAFC",
        textSecondary: "#94A3B8",
      }
    : {
        inputBg: "#FFFFFF",
        inputBorder: "#CBD5E1",
        textPrimary: "#0F172A",
        textSecondary: "#64748B",
      };

  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          value={value}
          onChangeText={onChangeText}
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.inputBorder,
              color: colors.textPrimary
            }
          ]}
        />
      </View>
      {children && <View style={styles.actions}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    fontFamily: "Segoe UI Variable Text",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  }
});
