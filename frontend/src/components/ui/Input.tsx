// =============================================================
// JK INFOTECH ERP — Reusable TextInput with Focus Highlights
// File : src/components/ui/Input.tsx
// =============================================================

import React, { useState } from "react";
import { View, TextInput, Text, StyleSheet } from "react-native";
import { useUIStore } from "../../store/uiStore";

interface InputProps {
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  label?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "numeric" | "email-address" | "phone-pad";
  editable?: boolean;
  style?: any;
  onSubmitEditing?: () => void;
  containerStyle?: any;
  onBlur?: () => void;
  tabIndex?: number;
}

export const Input = React.forwardRef<TextInput, InputProps>(({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor,
  label,
  secureTextEntry = false,
  keyboardType = "default",
  editable = true,
  style,
  onSubmitEditing,
  containerStyle,
  onBlur: onBlurProp,
  tabIndex,
}, ref) => {
  const { isDarkMode } = useUIStore();
  const [isFocused, setIsFocused] = useState(false);

  const colors = isDarkMode
    ? {
        inputBg: "#1E293B",
        border: "#334155",
        text: "#F8FAFC",
        textSecondary: "#94A3B8",
        accent: "#38BDF8",
      }
    : {
        inputBg: "#FFFFFF",
        border: "#CBD5E1",
        text: "#0F172A",
        textSecondary: "#64748B",
        accent: "#0078D4",
      };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
      <TextInput
        ref={ref}
        style={[
          styles.textInput,
          {
            backgroundColor: colors.inputBg,
            borderColor: isFocused ? colors.accent : colors.border,
            color: editable ? colors.text : colors.textSecondary,
          },
          style,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor || colors.textSecondary}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        editable={editable}
        onFocus={() => setIsFocused(true)}
        onBlur={() => { setIsFocused(false); onBlurProp?.(); }}
        onSubmitEditing={onSubmitEditing}
        textAlignVertical="center"
        {...(tabIndex !== undefined ? { tabIndex } as any : {})}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 8,
    width: "100%",
  },
  label: {
    fontSize: 15.5,
    fontWeight: "700",
    letterSpacing: 0.5,
    fontFamily: "Segoe UI Variable Text",
  },
  textInput: {
    height: 44,
    paddingTop: 6,
    paddingBottom: 6,
    textAlignVertical: "center",
    borderWidth: 2,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 18,
    fontFamily: "Segoe UI Variable Text",
  },
});
