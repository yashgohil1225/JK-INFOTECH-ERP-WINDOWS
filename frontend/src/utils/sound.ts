// =============================================================
// JK INFOTECH ERP — System Sound (Error & Warning only)
// File : src/utils/sound.ts
//
// Plays native Windows system sounds ONLY for:
//   1. Error dialogs   → Windows Critical Stop sound
//   2. Warning dialogs → Windows Exclamation sound
//
// Sounds are triggered via the Alert.alert interceptor.
// No sounds on info dialogs, modal opens, or success messages.
// =============================================================

import { Alert } from "react-native";
import client from "../api/client";

export type SoundType = "error" | "warning";

/**
 * Play a Windows system sound for error or warning dialogs.
 *
 * Priority:
 *   1. Native C# module (PdfRenderer.PlaySystemSound) — real .wav playback
 *   2. Backend HTTP POST — delegates to Python/system call
 *
 * This is fire-and-forget; failures are silently swallowed.
 */
export function playSystemSound(type: SoundType): void {
  // 1. Try native C# module first (instant, no network)
  try {
    const { NativeModules } = require("react-native");
    const { PdfRenderer } = NativeModules || {};
    if (PdfRenderer && typeof PdfRenderer.PlaySystemSound === "function") {
      PdfRenderer.PlaySystemSound(type);
      return;
    }
  } catch (_) {}

  // 2. Fire-and-forget backend request
  client
    .post("/api/v1/system/play-sound", { sound_type: type })
    .catch(() => {});
}

// ─── Alert.alert Interceptor ────────────────────────────────────
// Monkey-patches Alert.alert once so that every error / warning
// dialog automatically triggers the correct Windows system sound
// BEFORE the dialog is shown.  Info / success alerts are silent.
// ─────────────────────────────────────────────────────────────────

let _interceptorInstalled = false;

export function initAlertSoundInterceptor(): void {
  if (_interceptorInstalled) return;
  _interceptorInstalled = true;

  const originalAlert = Alert.alert;

  Alert.alert = (
    title: string,
    message?: string,
    buttons?: any[],
    options?: any
  ) => {
    const t = (title || "").toLowerCase();
    const m = (message || "").toLowerCase();

    // Detect ERROR dialogs
    const isError =
      t.includes("error") ||
      t.includes("fail") ||
      m.includes("failed") ||
      m.includes("error") ||
      m.includes("invalid") ||
      m.includes("cannot");

    // Detect WARNING dialogs
    const isWarning =
      t.includes("warn") ||
      t.includes("validation") ||
      t.includes("restricted");

    if (isError) {
      playSystemSound("error");
    } else if (isWarning) {
      playSystemSound("warning");
    }
    // Info / success alerts → no sound (silent)

    return originalAlert(title, message, buttons, options);
  };
}
