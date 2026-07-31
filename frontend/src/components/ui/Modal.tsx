// =============================================================
// JK INFOTECH ERP — Reusable Dialogue Modal (WinUI Design)
// File : src/components/ui/Modal.tsx
// =============================================================

import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated, ScrollView, useWindowDimensions } from "react-native";
import { useUIStore } from "../../store/uiStore";
import { ModalStackManager } from "../../utils/modalStackManager";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  width?: number | string;
  isFullScreen?: boolean;
  scrollEnabled?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footerActions,
  width = 500,
  isFullScreen = false,
  scrollEnabled = true
}: ModalProps) {
  const { isDarkMode } = useUIStore();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [visible, setVisible] = useState(isOpen);
  const modalIdRef = useRef(`modal_${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    if (isOpen) {
      ModalStackManager.register(modalIdRef.current, onClose);
    } else {
      ModalStackManager.unregister(modalIdRef.current);
    }
    return () => {
      ModalStackManager.unregister(modalIdRef.current);
    };
  }, [isOpen, onClose]);

  // Animation refs
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 160,
            useNativeDriver: false
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 9,
            tension: 90,
            useNativeDriver: false
          })
        ]).start();
      });
    } else {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver: false
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.94,
          duration: 120,
          useNativeDriver: false
        })
      ]).start(({ finished }) => {
        if (finished) {
          setVisible(false);
        }
      });
    }
  }, [isOpen]);

  const colors = isDarkMode
    ? {
      overlayBg: "rgba(0, 0, 0, 0.55)",
      cardBg: "#1E1E1E",
      border: "rgba(255, 255, 255, 0.22)",
      headerBg: "#252525",
      footerBg: "#1A1A1A",
      textPrimary: "#FFFFFF",
      textSecondary: "#A0A0A0",
      closeBg: "rgba(239, 68, 68, 0.15)",
      closeHover: "#E81123",
      closeText: "#F87171",
      divider: "rgba(255, 255, 255, 0.15)"
    }
    : {
      overlayBg: "rgba(0, 0, 0, 0.40)",
      cardBg: "#FFFFFF",
      border: "rgba(0, 0, 0, 0.20)",
      headerBg: "#FAFAFA",
      footerBg: "#F7F7F7",
      textPrimary: "#1A1A1A",
      textSecondary: "#5F5F5F",
      closeBg: "#FEE2E2",
      closeHover: "#E81123",
      closeText: "#DC2626",
      divider: "rgba(0, 0, 0, 0.12)"
    };

  if (!visible) return null;

  return (
    <View 
      focusable={false}
      style={[
        styles.overlayWrapper,
        {
          backgroundColor: colors.overlayBg
        }
      ]}
    >
      {/* Dimmed Backdrop area to catch clicks outside the modal card */}
      <Pressable
        onPress={onClose}
        focusable={false}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}
      />

      {/* Spring Animated Card */}
      <Animated.View
        focusable={false}
        style={[
          styles.modalCard,
          {
            width: (isFullScreen ? windowWidth : width) as any,
            backgroundColor: colors.cardBg,
            borderColor: colors.border,
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
            zIndex: 10
          },
          isFullScreen && {
            width: windowWidth,
            height: windowHeight,
            maxHeight: windowHeight,
            borderRadius: 0,
            borderWidth: 0,
            marginHorizontal: 0,
          }
        ]}
      >
        {/* Header — subtle background tint, no heavy border */}
        <View
          focusable={false}
          style={[
            styles.header,
            { backgroundColor: colors.headerBg, borderBottomColor: colors.divider },
            isFullScreen && { paddingLeft: 32, paddingRight: 20 }
          ]}
        >
          <Text style={[styles.titleText, { color: colors.textPrimary }]}>{title}</Text>
          <Pressable
            onPress={onClose}
            style={({ hovered, pressed }: any) => [
              styles.closeBtn,
              { backgroundColor: colors.closeBg },
              hovered && { backgroundColor: colors.closeHover },
              pressed && { transform: [{ scale: 0.90 }] }
            ]}
          >
            {({ hovered }: any) => (
              <Text style={[styles.closeIcon, { fontFamily: "Segoe MDL2 Assets", color: hovered ? "#FFFFFF" : colors.closeText }]}>
                {"\uE711"}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Scrollable Content */}
        {scrollEnabled ? (
          <ScrollView 
            focusable={false}
            style={styles.contentBody} 
            contentContainerStyle={[
              { paddingHorizontal: 20, paddingVertical: 16 },
              isFullScreen && { paddingHorizontal: 32, paddingVertical: 24 }
            ]}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View 
            focusable={false}
            style={[
              styles.contentBody,
              { paddingHorizontal: 20, paddingVertical: 16 },
              isFullScreen && { paddingHorizontal: 32, paddingVertical: 24 }
            ]}
          >
            {children}
          </View>
        )}

        {/* Footer Actions — subtle top line */}
        {footerActions && (
          <View
            style={[
              styles.footer,
              { backgroundColor: colors.footerBg, borderTopColor: colors.divider },
              isFullScreen && { paddingHorizontal: 32 }
            ]}
          >
            {footerActions}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayWrapper: {
    flex: 1,
    // Covers the ENTIRE window including sidebar
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    // Must sit above everything: sidebar (z ~100), DataTable headers, etc.
    zIndex: 99999,
    elevation: 99999,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalCard: {
    borderRadius: 10,
    borderWidth: 1,
    maxHeight: "82%",
    flexDirection: "column",
    // Windows-style elevation shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
    // Horizontal margin so modal doesn't touch screen edges
    marginHorizontal: 24,
    overflow: "hidden",
  },
  header: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 20,
    paddingRight: 12,
    borderBottomWidth: 1,
  },
  titleText: {
    fontSize: 17.5,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Display",
    letterSpacing: 0.1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  closeIcon: {
    fontSize: 12,
  },
  contentBody: {
    flexGrow: 1,
    flexShrink: 1,
  },
  footer: {
    minHeight: 60,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  }
});
