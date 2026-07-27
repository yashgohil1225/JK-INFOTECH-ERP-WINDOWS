// =============================================================
// JK INFOTECH ERP — Reusable WinUI 3 Toggle Switch
// File : src/components/ui/Toggle.tsx
// =============================================================

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useUIStore } from "../../store/uiStore";

interface ToggleProps {
  value: boolean;
  onChange?: (v: boolean) => void;
  onValueChange?: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
  onLabel?: string;
  offLabel?: string;
}

export function Toggle({
  value,
  onChange,
  onValueChange,
  label,
  disabled = false,
  onLabel = "On",
  offLabel = "Off"
}: ToggleProps) {
  const { isDarkMode } = useUIStore();

  const colors = isDarkMode
    ? {
        trackOn: "#38BDF8", // Theme active accent
        trackOff: "rgba(255, 255, 255, 0.1)",
        borderOn: "#38BDF8",
        borderOff: "rgba(255, 255, 255, 0.4)",
        thumb: "#FFFFFF",
        thumbDisabled: "#555555",
        textPrimary: "#F8FAFC",
        textSecondary: "#94A3B8"
      }
    : {
        trackOn: "#0284C7", // Theme active accent
        trackOff: "#E2E8F0",
        borderOn: "#0284C7",
        borderOff: "#94A3B8",
        thumb: "#FFFFFF",
        thumbDisabled: "#CCCCCC",
        textPrimary: "#0F172A",
        textSecondary: "#64748B"
      };

  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        const next = !value;
        onChange?.(next);
        onValueChange?.(next);
      }}
      style={({ hovered }: any) => [
        styles.container,
        disabled && { opacity: 0.5 },
        hovered && !disabled && { opacity: 0.95 }
      ]}
    >
      <View
        style={[
          styles.track,
          {
            backgroundColor: value ? colors.trackOn : colors.trackOff,
            borderColor: value ? colors.borderOn : colors.borderOff,
            alignItems: value ? "flex-end" : "flex-start"
          }
        ]}
      >
        <View
          style={[
            styles.thumb,
            {
              backgroundColor: disabled ? colors.thumbDisabled : colors.thumb
            }
          ]}
        />
      </View>
      
      {(label || onLabel || offLabel) && (
        <View style={styles.textContainer}>
          {label && (
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {label}
            </Text>
          )}
          <Text style={[styles.stateLabel, { color: value ? colors.trackOn : colors.textSecondary }]}>
            {value ? onLabel : offLabel}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 4,
  },
  track: {
    width: 44,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 2,
    justifyContent: "center",
  },
  thumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1,
    elevation: 2,
  },
  textContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  stateLabel: {
    fontSize: 13,
    fontWeight: "800",
    fontFamily: "Segoe UI Variable Text",
    textTransform: "uppercase",
  }
});
