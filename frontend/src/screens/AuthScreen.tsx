// =============================================================
// JK INFOTECH ERP — Login Screen (Native Windows Style)
// File : src/screens/AuthScreen.tsx
// =============================================================

import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";

export default function AuthScreen() {
  const { isDarkMode } = useUIStore();
  const { login, isAuthenticating, error, clearError } = useAuthStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!username || !password) return;
    try {
      await login({ login_id: username, password, remember_me: true });
    } catch (e) {
      // Handled by store error
    }
  };

  const colors = isDarkMode
    ? {
        textPrimary: "#FFFFFF",
        textSecondary: "#A0A0A0",
        inputBg: "rgba(255, 255, 255, 0.06)",
        inputBorder: "rgba(255, 255, 255, 0.12)",
        buttonBg: "#FFFFFF",
        buttonText: "#000000",
        cardBg: "rgba(32, 32, 32, 0.8)",
        errorText: "#FF6161"
      }
    : {
        textPrimary: "#1A1A1A",
        textSecondary: "#5F5F5F",
        inputBg: "rgba(0, 0, 0, 0.03)",
        inputBorder: "rgba(0, 0, 0, 0.12)",
        buttonBg: "#000000",
        buttonText: "#FFFFFF",
        cardBg: "rgba(255, 255, 255, 0.8)",
        errorText: "#A80000"
      };

  return (
    <View style={styles.container}>
      <View style={[styles.loginCard, { backgroundColor: colors.cardBg, borderColor: colors.inputBorder }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>ENTERPRISE LOGIN</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>JK INFOTECH ERP SECURE TERMINAL</Text>

        {error && (
          <Pressable onPress={clearError} style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: colors.errorText }]}>{error}</Text>
          </Pressable>
        )}

        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Username / Email</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
            placeholder="admin@jkinfotech.com"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={[styles.label, { color: colors.textPrimary }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
            placeholder="••••••••"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
          />

          <Pressable
            disabled={isAuthenticating}
            onPress={handleLogin}
            style={(state: any) => [
              styles.submitBtn,
              { backgroundColor: colors.buttonBg },
              state?.hovered && { opacity: 0.9 }
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {isAuthenticating && <ActivityIndicator color={colors.buttonText} size="small" style={{ width: 18, height: 18 }} />}
              <Text style={[styles.submitBtnText, { color: colors.buttonText }]}>LOG IN</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  loginCard: {
    width: 380,
    padding: 32,
    borderRadius: 8, // 8px corner radius
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  title: {
    fontSize: 23,
    fontWeight: "800",
    fontFamily: "Segoe UI Variable Display",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
    textAlign: "center",
    marginTop: 4,
    letterSpacing: 1.5,
    marginBottom: 24,
  },
  errorContainer: {
    padding: 10,
    borderRadius: 4,
    backgroundColor: "rgba(255, 97, 97, 0.1)",
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
    textAlign: "center",
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  input: {
    height: 38,
    borderWidth: 1,
    borderRadius: 4, // 4px corner radius
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: "Segoe UI Variable Text",
    textAlignVertical: "center",
  },
  submitBtn: {
    height: 40,
    borderRadius: 4, // 4px corner radius
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1,
  }
});
