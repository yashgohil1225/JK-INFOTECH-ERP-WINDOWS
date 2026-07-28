import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Modal } from "./Modal";
import { checkForCloudUpdate, UpdateInfo } from "../../services/CloudUpdateService";
import apiClient from "../../api/client";

export interface UpdateModalProps {
  checkOnMount?: boolean;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ checkOnMount = true }) => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [statusText, setStatusText] = useState<string>("");
  const [isReadyToInstall, setIsReadyToInstall] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [localInstallerFile, setLocalInstallerFile] = useState<string | null>(null);
  const pollTimerRef = useRef<any>(null);

  useEffect(() => {
    if (checkOnMount) {
      checkForUpdate();
    }

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [checkOnMount]);

  const checkForUpdate = async () => {
    // Zero-Touch background updating mode active: silently managed by backend worker.
    // Intrusive popup modal disabled to prevent user interruption.
    return;
  };

  const startInAppDownload = async () => {
    if (!updateInfo || !updateInfo.downloadUrl) return;

    setIsDownloading(true);
    setIsReadyToInstall(false);
    setDownloadProgress(0);
    setStatusText("Initiating in-app cloud download...");

    try {
      // Trigger backend download task
      await apiClient.post("/api/v1/system/download-update", {
        download_url: updateInfo.downloadUrl,
        version: updateInfo.latestVersion
      });

      // Poll progress every 300ms
      pollTimerRef.current = setInterval(async () => {
        try {
          const res = await apiClient.get("/api/v1/system/download-progress");
          const data = res.data;

          if (data) {
            setDownloadProgress(data.progress || 0);

            if (data.status === "downloading") {
              setStatusText(`Downloading update... ${data.progress}%`);
            } else if (data.status === "extracting") {
              setStatusText("Extracting release package...");
            } else if (data.status === "ready_to_install") {
              clearInterval(pollTimerRef.current);
              setIsDownloading(false);
              setIsReadyToInstall(true);
              setLocalInstallerFile(data.local_file);
              setStatusText(`Download Complete (100%). Ready to install v${updateInfo.latestVersion}`);
            } else if (data.status === "failed") {
              clearInterval(pollTimerRef.current);
              setIsDownloading(false);
              Alert.alert("Download Error", data.error || "Failed to download update package.");
            }
          }
        } catch (err) {
          // Silent catch on transient polling error
        }
      }, 300);

    } catch (e: any) {
      setIsDownloading(false);
      Alert.alert("Download Error", "Unable to start update download. Please check network connection.");
    }
  };

  const handleApplyUpdate = async () => {
    if (!updateInfo) return;
    setIsInstalling(true);
    setStatusText(`Installing v${updateInfo.latestVersion}... App will restart automatically.`);

    try {
      await apiClient.post("/api/v1/system/apply-update", {
        version: updateInfo.latestVersion,
        installer_path: localInstallerFile
      });

      setTimeout(() => {
        setIsVisible(false);
      }, 3000);
    } catch (e: any) {
      setIsInstalling(false);
      Alert.alert("Installation Error", "Could not trigger silent installer automatically.");
    }
  };

  if (!isVisible || !updateInfo) return null;

  return (
    <Modal isOpen={isVisible} onClose={() => !isDownloading && !isInstalling && setIsVisible(false)} title={`Software Update Available (v${updateInfo.latestVersion})`}>
      <View style={styles.container}>
        <View style={styles.badgeRow}>
          <Text style={styles.appTitle}>JK INFOTECH ERP</Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionBadgeText}>v{updateInfo.latestVersion}</Text>
          </View>
        </View>

        <Text style={styles.subtitle}>
          A new official release of JK INFOTECH ERP (v{updateInfo.latestVersion}) is available for upgrade. Current version is v{updateInfo.currentVersion}.
        </Text>

        <View style={styles.notesBox}>
          <Text style={styles.notesTitle}>What's New in v{updateInfo.latestVersion}:</Text>
          <Text style={styles.notesText}>{updateInfo.releaseNotes}</Text>
        </View>

        {(isDownloading || isReadyToInstall || isInstalling) && (
          <View style={styles.progressSection}>
            <Text style={styles.progressLabel}>{statusText}</Text>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${downloadProgress}%` }]} />
            </View>
          </View>
        )}

        <View style={styles.actionsRow}>
          {!updateInfo.mandatory && !isDownloading && !isInstalling && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setIsVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Remind Me Later</Text>
            </TouchableOpacity>
          )}

          {!isReadyToInstall ? (
            <TouchableOpacity
              style={[styles.updateButton, isDownloading && { opacity: 0.6 }]}
              onPress={startInAppDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.updateButtonText}>Downloading ({downloadProgress}%)...</Text>
                </View>
              ) : (
                <Text style={styles.updateButtonText}>⚡ Download Update In-App</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.installButton, isInstalling && { opacity: 0.6 }]}
              onPress={handleApplyUpdate}
              disabled={isInstalling}
            >
              {isInstalling ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.installButtonText}>Installing v{updateInfo.latestVersion}...</Text>
                </View>
              ) : (
                <Text style={styles.installButtonText}>✨ Install New Version (v{updateInfo.latestVersion}) & Restart</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  appTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    fontFamily: "Segoe UI Variable Display",
  },
  versionBadge: {
    backgroundColor: "#0284C7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  versionBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
    fontFamily: "Segoe UI Variable Text",
  },
  notesBox: {
    backgroundColor: "#F1F5F9",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#0284C7",
    gap: 4,
  },
  notesTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E293B",
  },
  notesText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 18,
  },
  progressSection: {
    gap: 6,
    marginTop: 4,
  },
  progressLabel: {
    fontSize: 13,
    color: "#0284C7",
    fontWeight: "700",
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: "#E2E8F0",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#0284C7",
    borderRadius: 5,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  cancelButtonText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "600",
  },
  updateButton: {
    backgroundColor: "#0284C7",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  updateButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  installButton: {
    backgroundColor: "#16A34A", // Emerald green for install action
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  installButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
