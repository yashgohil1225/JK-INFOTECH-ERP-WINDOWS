// =============================================================
// JK INFOTECH ERP — Desktop PIN Lock Screen (Fluent/WinUI 3)
// File : src/screens/PinLockScreen.tsx
// =============================================================

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import { BrandMonogram } from "../components/ui/Icons";

export default function PinLockScreen() {
  const { isDarkMode } = useUIStore();
  const { user, company, verifyPin, isLoading, error, clearError, logout } = useAuthStore();

  const [pin, setPin] = useState("");
  const [showKeypad, setShowKeypad] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Focus input on mount & re-focus on click
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const submitPin = async (pinToVerify: string) => {
    if (pinToVerify.length < 4) {
      setLocalError("Please enter your 4-digit PIN.");
      return;
    }
    try {
      setLocalError(null);
      await verifyPin(pinToVerify);
    } catch (err: any) {
      setPin("");
      const errorMsg = err.response?.data?.detail || err?.message || "Invalid PIN. Please try again.";
      setLocalError(errorMsg);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleTextChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, "");
    setPin(clean);
    setLocalError(null);
    clearError();

    // Auto-submit only when maximum length of 6 digits is reached
    if (clean.length === 6) {
      submitPin(clean);
    }
  };

  const handleKeyPress = (digit: string) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setLocalError(null);
      clearError();

      if (nextPin.length === 6) {
        submitPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setLocalError(null);
    clearError();
  };

  const colors = isDarkMode
    ? {
        bg: "#0F172A",
        cardBg: "#1E293B",
        cardBorder: "#334155",
        textPrimary: "#F8FAFC",
        textSecondary: "#94A3B8",
        accent: "#38BDF8",
        accentHover: "#0EA5E9",
        inputBg: "#0F172A",
        inputBorder: "#38BDF8",
        keyBg: "#334155",
        keyHover: "#475569",
        keyText: "#F8FAFC",
        errorText: "#F87171",
      }
    : {
        bg: "#F8FAFC",
        cardBg: "#FFFFFF",
        cardBorder: "#E2E8F0",
        textPrimary: "#0F172A",
        textSecondary: "#64748B",
        accent: "#0284C7",
        accentHover: "#0369A1",
        inputBg: "#F8FAFC",
        inputBorder: "#0284C7",
        keyBg: "#F1F5F9",
        keyHover: "#E2E8F0",
        keyText: "#0F172A",
        errorText: "#DC2626",
      };

  const displayError = localError || error;

  return (
    <Pressable
      style={[styles.container, { backgroundColor: colors.bg }]}
      onPress={() => inputRef.current?.focus()}
    >
      <View
        style={[
          styles.lockCard,
          { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
        ]}
      >
        {/* Brand Monogram Header */}
        <View style={styles.brandRow}>
          <BrandMonogram size={48} />
          <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>
            JK INFOTECH ERP
          </Text>
        </View>

        {/* User Session Info */}
        <View style={styles.userBadge}>
          <View style={styles.statusPill}>
            <Text style={[styles.sessionStatus, { color: colors.accent }]}>
              🔒 SESSION LOCKED
            </Text>
          </View>
          <Text style={[styles.userName, { color: colors.textPrimary }]}>
            {user?.full_name || "Authorized User"}
          </Text>
          <Text style={[styles.companyName, { color: colors.textSecondary }]}>
            {company?.name || "Enterprise Workspace"}
          </Text>
        </View>

        {/* Main Keyboard PIN Input Field */}
        <View style={styles.pinInputContainer}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            TYPE PIN ON KEYBOARD / NUMPAD
          </Text>
          <TextInput
            ref={inputRef}
            style={[
              styles.pinInput,
              {
                backgroundColor: colors.inputBg,
                color: colors.textPrimary,
                borderColor: displayError ? colors.errorText : colors.inputBorder,
              },
            ]}
            value={pin}
            onChangeText={handleTextChange}
            placeholder="• • • • • •"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            secureTextEntry={true}
            maxLength={6}
            autoFocus={true}
            onSubmitEditing={() => submitPin(pin)}
          />
        </View>

        {/* Feedback Message */}
        {displayError ? (
          <Text style={[styles.errorText, { color: colors.errorText }]}>
            ⚠️ {displayError}
          </Text>
        ) : (
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            Type your 4 or 6-digit PIN and press Enter to unlock
          </Text>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <Pressable
            disabled={isLoading || pin.length < 4}
            onPress={() => submitPin(pin)}
            style={({ hovered }: any) => [
              styles.submitBtn,
              { backgroundColor: colors.accent },
              hovered && { backgroundColor: colors.accentHover },
              (isLoading || pin.length < 4) && { opacity: 0.5 },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {isLoading && <ActivityIndicator color="#FFFFFF" size="small" style={{ width: 18, height: 18 }} />}
              <Text style={styles.submitBtnText}>Unlock Workspace (Enter ↵)</Text>
            </View>
          </Pressable>

          {/* Toggle Onscreen Touch Keypad */}
          <Pressable
            onPress={() => setShowKeypad((prev) => !prev)}
            style={({ hovered }: any) => [
              styles.keypadToggleBtn,
              hovered && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.keypadToggleText, { color: colors.accent }]}>
              {showKeypad ? "⌨️ Hide Touch Keypad" : "📱 Show Touch Keypad"}
            </Text>
          </Pressable>
        </View>

        {/* Optional Touch Keypad (For touchscreens/tablets) */}
        {showKeypad && (
          <View style={styles.keypad}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <Pressable
                key={num}
                onPress={() => handleKeyPress(num)}
                style={({ hovered }: any) => [
                  styles.keyBtn,
                  { backgroundColor: hovered ? colors.keyHover : colors.keyBg },
                ]}
              >
                <Text style={[styles.keyBtnText, { color: colors.keyText }]}>
                  {num}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setPin("")}
              style={({ hovered }: any) => [
                styles.keyBtn,
                { backgroundColor: hovered ? colors.keyHover : colors.keyBg },
              ]}
            >
              <Text
                style={[
                  styles.keyBtnText,
                  { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
                ]}
              >
                CLEAR
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleKeyPress("0")}
              style={({ hovered }: any) => [
                styles.keyBtn,
                { backgroundColor: hovered ? colors.keyHover : colors.keyBg },
              ]}
            >
              <Text style={[styles.keyBtnText, { color: colors.keyText }]}>0</Text>
            </Pressable>
            <Pressable
              onPress={handleBackspace}
              style={({ hovered }: any) => [
                styles.keyBtn,
                { backgroundColor: hovered ? colors.keyHover : colors.keyBg },
              ]}
            >
              <Text
                style={[
                  styles.keyBtnText,
                  { color: colors.textSecondary, fontSize: 16 },
                ]}
              >
                ⌫
              </Text>
            </Pressable>
          </View>
        )}

        {/* Sign Out Option */}
        <Pressable
          onPress={() => logout()}
          style={({ hovered }: any) => [
            styles.switchBtn,
            hovered && { opacity: 0.8 },
          ]}
        >
          <Text style={[styles.switchBtnText, { color: colors.textSecondary }]}>
            Switch Account / Sign Out
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  lockCard: {
    width: 400,
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 16,
  },
  brandRow: {
    alignItems: "center",
    gap: 8,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1.5,
    fontFamily: "Segoe UI Variable Display",
  },
  userBadge: {
    alignItems: "center",
    gap: 4,
  },
  statusPill: {
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  sessionStatus: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    fontFamily: "Segoe UI Variable Text",
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Display",
    marginTop: 4,
  },
  companyName: {
    fontSize: 13.5,
    fontFamily: "Segoe UI Variable Text",
  },
  pinInputContainer: {
    width: "100%",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    fontFamily: "Segoe UI Variable Text",
  },
  pinInput: {
    width: "100%",
    height: 52,
    borderRadius: 8,
    borderWidth: 2,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 12,
    fontFamily: "Segoe UI Variable Display",
  },
  hintText: {
    fontSize: 12.5,
    fontFamily: "Segoe UI Variable Text",
    textAlign: "center",
  },
  errorText: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
    textAlign: "center",
  },
  actionsRow: {
    width: "100%",
    gap: 10,
    marginTop: 4,
  },
  submitBtn: {
    width: "100%",
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
  },
  keypadToggleBtn: {
    alignItems: "center",
    paddingVertical: 4,
  },
  keypadToggleText: {
    fontSize: 12.5,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  keypad: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 252,
    gap: 10,
    justifyContent: "center",
    marginTop: 6,
  },
  keyBtn: {
    width: 72,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  keyBtnText: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  switchBtn: {
    alignItems: "center",
    paddingVertical: 4,
    marginTop: 4,
  },
  switchBtnText: {
    fontSize: 12.5,
    fontFamily: "Segoe UI Variable Text",
  },
});
