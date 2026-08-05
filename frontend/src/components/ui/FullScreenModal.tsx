// =============================================================
// JK INFOTECH ERP — Reusable Master Full Screen Modal
// File : src/components/ui/FullScreenModal.tsx
// =============================================================

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
  useWindowDimensions
} from "react-native";
import { useUIStore } from "../../store/uiStore";
import { ModalStackManager } from "../../utils/modalStackManager";

interface FullScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  breadcrumb?: string;
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  /** Content placed in the header between title block and close button */
  headerActions?: React.ReactNode;
  scrollEnabled?: boolean;
  onKeyDown?: (e: any) => void;
  onKeyUp?: (e: any) => void;
}

export function FullScreenModal({
  isOpen,
  onClose,
  title,
  subtitle,
  breadcrumb,
  children,
  footerActions,
  headerActions,
  scrollEnabled = true,
  onKeyDown,
  onKeyUp
}: FullScreenModalProps) {
  const { isDarkMode } = useUIStore();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [visible, setVisible] = useState(isOpen);

  const slideAnim = useRef(new Animated.Value(40)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const setIsFullScreenOpen = useUIStore(state => state.setIsFullScreenOpen);

  const wasOpenRef = useRef(false);
  const modalIdRef = useRef(`fullscreen_modal_${Math.random().toString(36).substring(2, 9)}`);

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

  useEffect(() => {
    if (isOpen) {
      if (!wasOpenRef.current) {
        wasOpenRef.current = true;
        setIsFullScreenOpen(true);
      }
      setVisible(true);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            friction: 8,
            tension: 80,
            useNativeDriver: true
          })
        ]).start();
      });
    } else {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true
        }),
        Animated.timing(slideAnim, {
          toValue: 30,
          duration: 150,
          useNativeDriver: true
        })
      ]).start(({ finished }) => {
        if (finished) {
          setVisible(false);
          if (wasOpenRef.current) {
            wasOpenRef.current = false;
            setIsFullScreenOpen(false);
          }
        }
      });
    }

    return () => {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        setIsFullScreenOpen(false);
      }
    };
  }, [isOpen, setIsFullScreenOpen]);

  const colors = isDarkMode
    ? {
      bg: "#0F172A", // Solid opaque background (Slate 900)
      headerBg: "#1E293B",
      border: "#334155",
      textPrimary: "#F8FAFC",
      textSecondary: "#94A3B8",
      closeBg: "rgba(239, 68, 68, 0.15)",
      closeHover: "#E81123",
      closeText: "#F87171",
      divider: "#334155",
      accent: "#38BDF8"
    }
    : {
      bg: "#F8FAFC", // Solid opaque background (Slate 50)
      headerBg: "#FFFFFF",
      border: "#E2E8F0",
      textPrimary: "#0F172A",
      textSecondary: "#64748B",
      closeBg: "#FEE2E2",
      closeHover: "#E81123",
      closeText: "#DC2626",
      divider: "#E2E8F0",
      accent: "#0284C7"
    };

  if (!visible) return null;

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <View
      {...({
        focusable: true,
        onKeyDown: (e: any) => {
          if (onKeyDown) onKeyDown(e);
          const k = e?.nativeEvent?.key || e?.key;
          if (k === "Escape" || k === "Esc") {
            onClose();
          }
        },
        onKeyUp
      } as any)}
      style={[
        styles.masterContainer,
        {
          backgroundColor: colors.bg,
          width: "100%",
          height: "100%",
        }
      ]}
    >
      <Animated.View
        focusable={false}
        style={[
          styles.innerCard,
          {
            opacity: opacityAnim,
            width: "100%",
            height: "100%",
          }
        ]}
      >
        {/* Fluent Title / Header Block */}
        <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.divider }]}>
          <View style={styles.headerLeft}>
            {breadcrumb ? (
              <Text style={[styles.breadcrumb, { color: colors.accent }]}>
                {breadcrumb.toUpperCase()}
              </Text>
            ) : null}
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
            ) : null}
          </View>

          {/* Header blank-space actions: step indicator + nav buttons */}
          {headerActions ? (
            <View style={styles.headerActionsArea}>
              {headerActions}
            </View>
          ) : null}

          <Pressable
            onPress={onClose}
            style={({ hovered, pressed }: any) => [
              styles.closeBtn,
              { backgroundColor: colors.closeBg },
              hovered && { backgroundColor: colors.closeHover },
              pressed && { transform: [{ scale: 0.92 }] }
            ]}
          >
            {({ hovered }: any) => (
              <Text style={[styles.closeIcon, { fontFamily: "Segoe MDL2 Assets", color: hovered ? "#FFFFFF" : colors.closeText }]}>
                {"\uE711"}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Scrollable / Non-scrollable Body */}
        {scrollEnabled ? (
          <ScrollView
            focusable={false}
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View focusable={false} style={[styles.body, { flex: 1 }]}>
            {children}
          </View>
        )}

        {/* Sticky Action Footer */}
        {footerActions ? (
          <View style={[styles.footer, { backgroundColor: colors.headerBg, borderTopColor: colors.divider }]}>
            {footerActions}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  masterContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999999, // Overlay the main screen and the sidebar completely
    elevation: 999999,
  },
  innerCard: {
    flex: 1,
    flexDirection: "column"
  },
  header: {
    height: 120,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    borderBottomWidth: 2,
  },
  headerLeft: {
    flex: 1,
    justifyContent: "center"
  },
  breadcrumb: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
    letterSpacing: 1.2,
    marginBottom: 5
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    fontFamily: "Segoe UI Variable Display"
  },
  subtitle: {
    fontSize: 20,
    fontFamily: "Segoe UI Variable Text",
    marginTop: 2
  },
  headerActionsArea: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flex: 2,
    paddingRight: 16,
    gap: 10
  },
  closeBtn: {
    width: 50,
    height: 50,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  closeIcon: {
    fontSize: 25
  },
  body: {
    flex: 1
  },
  bodyContent: {
    paddingHorizontal: 30,
    paddingTop: 30,
    paddingBottom: 25
  },
  footer: {
    minHeight: 64,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 17,
    paddingBottom: 24, // Offset to prevent Windows taskbar overlap
    gap: 20
  }
});
