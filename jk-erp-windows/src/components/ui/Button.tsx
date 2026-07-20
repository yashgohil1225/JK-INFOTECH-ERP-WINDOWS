// =============================================================
// JK INFOTECH ERP — Reusable Button (Fluent Design)
// File : src/components/ui/Button.tsx
// =============================================================

import React from "react";
import { Pressable, Text, StyleSheet, ActivityIndicator, View } from "react-native";
import { useUIStore } from "../../store/uiStore";

interface ButtonProps {
  onPress: () => void;
  title?: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  loading?: boolean;
  style?: any;
  textStyle?: any;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  autoFocus?: boolean;
}

export function Button({
  onPress,
  title,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
  children,
  autoFocus = false,
}: ButtonProps) {
  const { isDarkMode } = useUIStore();

  const colors = isDarkMode
    ? {
        primaryBg: "#0284C7",
        primaryHover: "#0EA5E9",
        secondaryBg: "#334155",
        secondaryHover: "#475569",
        secondaryText: "#F8FAFC",
        dangerBg: "#DC2626",
        dangerHover: "#EF4444",
        textPrimary: "#FFFFFF",
        border: "#475569",
      }
    : {
        primaryBg: "#0078D4",
        primaryHover: "#106EBE",
        secondaryBg: "#F3F3F3",
        secondaryHover: "#EAEAEA",
        secondaryText: "#1C1C1C",
        dangerBg: "#E81123",
        dangerHover: "#F13E4D",
        textPrimary: "#FFFFFF",
        border: "#D2D2D2",
      };

  const [hovered, setHovered] = React.useState(false);

  const getButtonStyle = (pressed: boolean) => {
    const baseStyle: any[] = [styles.button];

    // Size
    if (size === "small") baseStyle.push(styles.btnSmall);
    else if (size === "large") baseStyle.push(styles.btnLarge);
    else baseStyle.push(styles.btnMedium);

    // Variant Colors
    if (variant === "primary") {
      baseStyle.push({
        backgroundColor: hovered ? colors.primaryHover : colors.primaryBg,
        borderColor: "transparent",
      });
    } else if (variant === "secondary") {
      baseStyle.push({
        backgroundColor: hovered ? colors.secondaryHover : colors.secondaryBg,
        borderWidth: 1,
        borderColor: colors.border,
      });
    } else if (variant === "danger") {
      baseStyle.push({
        backgroundColor: hovered ? colors.dangerHover : colors.dangerBg,
        borderColor: "transparent",
      });
    }

    if (pressed) {
      baseStyle.push({ opacity: 0.8, transform: [{ scale: 0.96 }] });
    }

    if (disabled) {
      baseStyle.push(styles.btnDisabled);
    }

    return [baseStyle, style];
  };

  const getTextStyle = () => {
    const baseText: any[] = [styles.text];

    if (size === "small") baseText.push({ fontSize: 13.5 });
    else if (size === "large") baseText.push({ fontSize: 17.5 });
    else baseText.push({ fontSize: 15.5 });

    if (variant === "primary" || variant === "danger") {
      baseText.push({ color: colors.textPrimary, fontWeight: "700" });
    } else if (variant === "secondary") {
      baseText.push({ color: colors.secondaryText, fontWeight: "600" });
    }

    return [baseText, textStyle];
  };

  return (
    <Pressable
      onPress={!disabled && !loading ? onPress : undefined}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }: any) => getButtonStyle(pressed)}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? colors.secondaryText : "#FFFFFF"} size="small" />
      ) : children ? (
        children
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {icon}
          {title ? <Text style={getTextStyle()}>{title}</Text> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSmall: {
    height: 32,
    paddingHorizontal: 12,
  },
  btnMedium: {
    height: 40,
    paddingHorizontal: 16,
  },
  btnLarge: {
    height: 48,
    paddingHorizontal: 24,
  },
  text: {
    fontFamily: "Segoe UI Variable Text",
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
