// =============================================================
// JK INFOTECH ERP — Reusable Popover ActionMenu (WinUI Style)
// File : src/components/ui/ActionMenu.tsx
// =============================================================

import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useUIStore } from "../../store/uiStore";

export interface ActionMenuItem {
  label: string;
  glyph?: string;
  onClick: () => void | Promise<void>;
  variant?: "default" | "danger";
}

interface ActionMenuProps {
  actions: ActionMenuItem[];
}

export function ActionMenu({ actions }: ActionMenuProps) {
  const { isDarkMode } = useUIStore();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<View>(null);

  const colors = isDarkMode
    ? {
        menuBg: "#2C2C2C",
        border: "rgba(255, 255, 255, 0.08)",
        hoverBg: "rgba(255, 255, 255, 0.08)",
        textPrimary: "#FFFFFF",
        textDanger: "#FF6161",
        triggerHover: "rgba(255, 255, 255, 0.08)"
      }
    : {
        menuBg: "#FFFFFF",
        border: "rgba(0, 0, 0, 0.08)",
        hoverBg: "rgba(0, 0, 0, 0.05)",
        textPrimary: "#1A1A1A",
        textDanger: "#A80000",
        triggerHover: "rgba(0, 0, 0, 0.06)"
      };

  const handleTriggerPress = () => {
    setIsOpen(!isOpen);
  };

  const handleActionPress = (action: ActionMenuItem) => {
    setIsOpen(false);
    action.onClick();
  };

  const renderItem = (item: ActionMenuItem, index: number) => {
    const isDanger = item.variant === "danger";
    return (
      <Pressable
        key={index}
        onPress={() => handleActionPress(item)}
        style={(state: any) => [
          styles.menuItem,
          state?.hovered && { backgroundColor: colors.hoverBg }
        ]}
      >
        {item.glyph && (
          <Text style={[styles.menuGlyph, { fontFamily: "Segoe MDL2 Assets", color: isDanger ? colors.textDanger : colors.textPrimary }]}>
            {item.glyph}
          </Text>
        )}
        <Text style={[styles.menuLabel, { color: isDanger ? colors.textDanger : colors.textPrimary }]}>
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View ref={triggerRef} style={{ zIndex: isOpen ? 99999 : 1, position: "relative" }}>
      {/* Trigger Button */}
      <Pressable
        onPress={handleTriggerPress}
        style={(state: any) => [
          styles.triggerBtn,
          state?.hovered && { backgroundColor: colors.triggerHover }
        ]}
      >
        <Text style={[styles.triggerGlyph, { fontFamily: "Segoe MDL2 Assets", color: colors.textPrimary }]}>
          {"\uE10C"} {/* More / Three Dots unicode glyph */}
        </Text>
      </Pressable>

      {/* Floating Menu Overlay */}
      {isOpen && (
        <>
          {/* Fullscreen backdrop to catch clicks outside the menu */}
          <Pressable 
            style={styles.fullscreenBackdrop} 
            onPress={() => setIsOpen(false)} 
          />
          
          {/* Menu Card positioned relative to trigger container */}
          <View
            style={[
              styles.menuCard,
              {
                backgroundColor: colors.menuBg,
                borderColor: colors.border
              }
            ]}
          >
            {actions.map((item, index) => renderItem(item, index))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  triggerBtn: {
    width: 32,
    height: 32,
    borderRadius: 4, // 4px corner radius
    alignItems: "center",
    justifyContent: "center",
  },
  triggerGlyph: {
    fontSize: 14,
  },
  fullscreenBackdrop: {
    position: "absolute",
    top: -2000,
    bottom: -2000,
    left: -2000,
    right: -2000,
    backgroundColor: "transparent",
    zIndex: 99998,
  },
  menuCard: {
    position: "absolute",
    right: 0,
    top: 36,
    width: 180,
    borderRadius: 4, // 4px corner radius
    borderWidth: 1,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    zIndex: 99999,
  },
  menuItem: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 12,
  },
  menuGlyph: {
    fontSize: 16.5,
    width: 20,
    textAlign: "center",
  },
  menuLabel: {
    fontSize: 14,
    fontFamily: "Segoe UI Variable Text",
  }
});
