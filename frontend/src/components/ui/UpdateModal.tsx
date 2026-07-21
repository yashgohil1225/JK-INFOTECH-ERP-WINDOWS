import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from "react-native";
import { Modal } from "./Modal";
import { checkForCloudUpdate, UpdateInfo } from "../../services/CloudUpdateService";

export interface UpdateModalProps {
  checkOnMount?: boolean;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ checkOnMount = true }) => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    if (checkOnMount) {
      checkForUpdate();
    }
  }, [checkOnMount]);

  const checkForUpdate = async () => {
    const info = await checkForCloudUpdate();
    if (info && info.hasUpdate) {
      setUpdateInfo(info);
      setIsVisible(true);
    }
  };

  const handleInstallUpdate = async () => {
    if (!updateInfo || !updateInfo.downloadUrl) return;
    setIsDownloading(true);
    setDownloadProgress(30);

    try {
      // Simulate download progress indicator for UX
      setTimeout(() => setDownloadProgress(70), 1000);
      setTimeout(async () => {
        setDownloadProgress(100);
        // Open the installer URL or package in Windows default installer handler
        await Linking.openURL(updateInfo.downloadUrl);
        setIsDownloading(false);
        setIsVisible(false);
      }, 2000);
    } catch (e) {
      setIsDownloading(false);
    }
  };

  if (!isVisible || !updateInfo) return null;

  return (
    <Modal visible={isVisible} onClose={() => setIsVisible(false)} title="New Version Available">
      <View style={styles.container}>
        <View style={styles.badgeRow}>
          <Text style={styles.appTitle}>JK INFOTECH ERP</Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionBadgeText}>v{updateInfo.latestVersion}</Text>
          </View>
        </View>

        <Text style={styles.subtitle}>
          A new version of JK INFOTECH ERP (v{updateInfo.latestVersion}) is available. Current version is v{updateInfo.currentVersion}.
        </Text>

        <View style={styles.notesBox}>
          <Text style={styles.notesTitle}>What's New in v{updateInfo.latestVersion}:</Text>
          <Text style={styles.notesText}>{updateInfo.releaseNotes}</Text>
        </View>

        {isDownloading && (
          <View style={styles.progressSection}>
            <Text style={styles.progressLabel}>Downloading update... {downloadProgress}%</Text>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${downloadProgress}%` }]} />
            </View>
          </View>
        )}

        <View style={styles.actionsRow}>
          {!updateInfo.mandatory && !isDownloading && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setIsVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Remind Me Later</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.updateButton, isDownloading && { opacity: 0.6 }]}
            onPress={handleInstallUpdate}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.updateButtonText}>⚡ Download & Install</Text>
            )}
          </TouchableOpacity>
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
    fontSize: 12,
    color: "#0284C7",
    fontWeight: "600",
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#0284C7",
    borderRadius: 4,
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
});
