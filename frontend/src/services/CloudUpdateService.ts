import pkg from "../../package.json";

export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseNotes: string;
  mandatory: boolean;
  downloadUrl: string;
}

// Configurable Cloud Update Check URL
const DEFAULT_UPDATE_URL = "https://raw.githubusercontent.com/yashgohil1225/JK-INFOTECH-ERP-WINDOWS/main/updates/version.json";

export const getCurrentAppVersion = (): string => {
  return pkg.version || "1.0.0";
};

export const checkForCloudUpdate = async (customUrl?: string): Promise<UpdateInfo | null> => {
  // Auto-updates disabled per user system preference
  return null;
};

// Simple semver comparison helper (e.g., "1.0.1" > "1.0.0")
const isNewerVersion = (current: string, latest: string): boolean => {
  const cParts = current.split('.').map((p) => parseInt(p, 10) || 0);
  const lParts = latest.split('.').map((p) => parseInt(p, 10) || 0);

  for (let i = 0; i < Math.max(cParts.length, lParts.length); i++) {
    const c = cParts[i] || 0;
    const l = lParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
};
