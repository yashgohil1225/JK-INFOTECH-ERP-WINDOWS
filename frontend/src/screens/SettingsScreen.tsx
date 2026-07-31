import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  NativeModules,
  DeviceEventEmitter,
  useColorScheme,
} from "react-native";
import { useUIStore } from "../store/uiStore";
import { useAuthStore, getAccessToken } from "../store/authStore";
import { authApi } from "../api/auth";
import apiClient from "../api/client";
import { storage } from "../utils/storage";
import { Toggle } from "../components/ui/Toggle";
import { DataTable, ColumnDefinition } from "../components/ui/DataTable";
import { Modal } from "../components/ui/Modal";
import { FullScreenModal } from "../components/ui/FullScreenModal";
import { Button } from "../components/ui/Button";
import { sequencesApi, type Sequence } from "../api/sequences";
import { fiscalYearsApi, type FiscalYear } from "../api/fiscalYears";
import { backupApi, type BackupSettings } from "../api/backup";
import { DatePicker } from "../components/ui/DatePicker";

type TabType = "business" | "communication" | "interface" | "advanced" | "sequences" | "fiscal_years" | "backup" | "diagnostics";

// System Settings Screen for JK Infotech ERP
import { getCurrentAppVersion } from "../services/CloudUpdateService";
import { ModuleHelpModal, HelpCategory } from "../components/ui/ModuleHelpModal";

export default function SettingsScreen() {
  const systemColorScheme = useColorScheme();
  const { isDarkMode, themeMode, setThemeMode } = useUIStore();
  const { company, user, setCompany, loadMe } = useAuthStore();

  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [helpModalCategory, setHelpModalCategory] = useState<HelpCategory>("COMMUNICATION_SETUP");

  const colors = isDarkMode
    ? {
      background: "#0F172A",
      cardBg: "#1E293B",
      cardBorder: "#334155",
      textPrimary: "#F8FAFC",
      textSecondary: "#94A3B8",
      accent: "#38BDF8",
      accentLight: "rgba(56, 189, 248, 0.12)",
      btnBg: "#334155",
      btnText: "#F8FAFC",
      inputBg: "#0F172A",
      inputText: "#F8FAFC",
      inputBorder: "#334155",
      success: "#4ADE80",
      error: "#F87171",
      warning: "#FBBF24",
    }
    : {
      background: "#F8FAFC",
      cardBg: "#FFFFFF",
      cardBorder: "#E2E8F0",
      textPrimary: "#0F172A",
      textSecondary: "#64748B",
      accent: "#0284C7",
      accentLight: "rgba(2, 132, 199, 0.08)",
      btnBg: "#E2E8F0",
      btnText: "#0F172A",
      inputBg: "#FFFFFF",
      inputText: "#0F172A",
      inputBorder: "#CBD5E1",
      success: "#16A34A",
      error: "#DC2626",
      warning: "#D97706",
    };

  const [activeTab, setActiveTab] = useState<TabType>("business");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Business tab states
  const [coName, setCoName] = useState("");
  const [coGst, setCoGst] = useState("");
  const [coPan, setCoPan] = useState("");
  const [coTan, setCoTan] = useState("");
  const [coEmail, setCoEmail] = useState("");
  const [coPhone, setCoPhone] = useState("");
  const [coMobile, setCoMobile] = useState("");
  const [coState, setCoState] = useState("");
  const [coAddress1, setCoAddress1] = useState("");
  const [coAddress2, setCoAddress2] = useState("");
  const [coAddress3, setCoAddress3] = useState("");
  const [coAddress4, setCoAddress4] = useState("");
  const [coPincode, setCoPincode] = useState("");
  const [coBank, setCoBank] = useState("");
  const [coBranch, setCoBranch] = useState("");
  const [coAccNo, setCoAccNo] = useState("");
  const [coIfsc, setCoIfsc] = useState("");

  // GST Verification state
  const [gstLoading, setGstLoading] = useState(false);
  const [gstVerified, setGstVerified] = useState<boolean | null>(null);

  // Security states
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinCode, setPinCode] = useState("");
  const [confirmPinCode, setConfirmPinCode] = useState("");
  const [pinPassword, setPinPassword] = useState("");

  // Advanced States
  const [taxRate, setTaxRate] = useState("");
  const [gstRate, setGstRate] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [isGstRegistered, setIsGstRegistered] = useState(true);
  const [hsnSacType, setHsnSacType] = useState("Goods");

  // Diagnostics state
  const [diagLatency, setDiagLatency] = useState<number | null>(null);
  const [diagCheckTime, setDiagCheckTime] = useState<string | null>(null);
  const [diagChecking, setDiagChecking] = useState(false);

  // Communication & CA States
  const [caName, setCaName] = useState("");
  const [caEmail, setCaEmail] = useState("");
  const [caPhone, setCaPhone] = useState("");

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [smtpUseTls, setSmtpUseTls] = useState(true);

  const [waPhoneNumberId, setWaPhoneNumberId] = useState("");
  const [waAccessToken, setWaAccessToken] = useState("");
  const [waBusinessAccountId, setWaBusinessAccountId] = useState("");

  // Document sequences states
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [seqLoading, setSeqLoading] = useState(false);
  const [selectedSeq, setSelectedSeq] = useState<Sequence | null>(null);
  const [isSeqModalOpen, setIsSeqModalOpen] = useState(false);

  const [seqPrefix, setSeqPrefix] = useState("");
  const [seqSuffix, setSeqSuffix] = useState("");
  const [seqNextValue, setSeqNextValue] = useState("");
  const [seqPadding, setSeqPadding] = useState("");
  const [seqIsActive, setSeqIsActive] = useState(true);

  // Fiscal years state
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [fyLoading, setFyLoading] = useState(false);
  const [isNewFyModalOpen, setIsNewFyModalOpen] = useState(false);
  const [newFyLabel, setNewFyLabel] = useState("");
  const [newFyStart, setNewFyStart] = useState("");
  const [newFyEnd, setNewFyEnd] = useState("");
  const [newFyActive, setNewFyActive] = useState(true);

  // Closing wizard state
  const [isCloseFyWizardOpen, setIsCloseFyWizardOpen] = useState(false);
  const [fyToClose, setFyToClose] = useState<FiscalYear | null>(null);
  const [closingStep, setClosingStep] = useState(1); // 1: Audit, 2: Balances, 3: Sequences, 4: Notes/Lock
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResults, setAuditResults] = useState<any[]>([]);
  const [auditCanProceed, setAuditCanProceed] = useState(true);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [closingBalances, setClosingBalances] = useState<any>(null);
  const [calibLoading, setCalibLoading] = useState(false);
  const [seqCalibration, setSeqCalibration] = useState<any[]>([]);
  const [closingNotes, setClosingNotes] = useState("");
  const [backupBeforeClose, setBackupBeforeClose] = useState(true);

  // Auto Backup & Cloud Sync States
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [intervalDays, setIntervalDays] = useState("7");
  const [intervalMinutes, setIntervalMinutes] = useState(10080);
  const [targetDirectory, setTargetDirectory] = useState("");
  const [backupFormat, setBackupFormat] = useState<"bak" | "json" | "both">("bak");
  const [singleFileOverwrite, setSingleFileOverwrite] = useState(true);
  const [browsingFolder, setBrowsingFolder] = useState(false);

  const [cloudBackupEnabled, setCloudBackupEnabled] = useState(false);
  const [cloudProvider, setCloudProvider] = useState<"gdrive" | "s3" | "webhook">("gdrive");

  // Google Drive
  const [gdriveFolderId, setGdriveFolderId] = useState("");
  const [gdriveAccessToken, setGdriveAccessToken] = useState("");

  // AWS S3 / Cloudflare R2
  const [s3Bucket, setS3Bucket] = useState("");
  const [s3EndpointUrl, setS3EndpointUrl] = useState("");
  const [s3AccessKey, setS3AccessKey] = useState("");
  const [s3SecretKey, setS3SecretKey] = useState("");
  const [s3Region, setS3Region] = useState("us-east-1");

  // Custom Webhook
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  const [backupInfo, setBackupInfo] = useState<any>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupTesting, setBackupTesting] = useState(false);
  const [testingLocal, setTestingLocal] = useState(false);
  const [testingCloud, setTestingCloud] = useState(false);
  const [isCloudLocked, setIsCloudLocked] = useState(true);
  const [showUnlockWarning, setShowUnlockWarning] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  const fetchBackupSettings = async () => {
    setBackupLoading(true);
    try {
      const data = await backupApi.getBackupSettings();
      setAutoBackupEnabled(data.auto_backup_enabled ?? false);
      setIntervalDays(String(data.interval_days || 7));
      setIntervalMinutes(data.interval_minutes || (data.interval_days ? data.interval_days * 1440 : 10080));
      setTargetDirectory(data.target_directory || "");
      setBackupFormat(data.backup_format || "bak");
      setSingleFileOverwrite(data.single_file_overwrite ?? true);

      setCloudBackupEnabled(data.cloud_backup_enabled ?? false);
      setCloudProvider(data.cloud_provider || "gdrive");

      if (data.gdrive) {
        setGdriveFolderId(data.gdrive.folder_id || "");
        setGdriveAccessToken(data.gdrive.access_token || "");
      }
      if (data.s3) {
        setS3Bucket(data.s3.bucket || "");
        setS3EndpointUrl(data.s3.endpoint_url || "");
        setS3AccessKey(data.s3.access_key || "");
        setS3SecretKey(data.s3.secret_key || "");
        setS3Region(data.s3.region || "us-east-1");
      }
      if (data.webhook) {
        setWebhookUrl(data.webhook.webhook_url || "");
        setWebhookSecret(data.webhook.secret_header || "");
      }

      // Only set lock on initial page load if not already set
      if (backupInfo === null && (data.cloud_last_sync_status === "SUCCESS" || data.gdrive?.access_token)) {
        setIsCloudLocked(true);
      }

      setBackupInfo(data);
    } catch (err) {
      console.warn("Failed to fetch backup settings:", err);
    } finally {
      setBackupLoading(false);
    }
  };

  const formatBackupTimestamp = (isoString?: string) => {
    if (!isoString) return "No backup taken yet";
    try {
      let clean = isoString.trim();
      const d = new Date(clean);
      if (isNaN(d.getTime())) {
        return clean.replace("T", " ").split(".")[0];
      }

      // Use explicit local PC clock getters to avoid Hermes engine UTC default drift
      const year = d.getFullYear();
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = months[d.getMonth()];
      const day = String(d.getDate()).padStart(2, "0");

      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const seconds = String(d.getSeconds()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const strHours = String(hours).padStart(2, "0");

      return `${day}-${month}-${year}, ${strHours}:${minutes}:${seconds} ${ampm}`;
    } catch {
      return isoString;
    }
  };

  const fetchBackupStatusOnly = async () => {
    try {
      const data = await backupApi.getBackupSettings();
      setBackupInfo(data);
    } catch (err) {
      console.warn("Failed to fetch backup status:", err);
    }
  };

  useEffect(() => {
    if (activeTab === "backup") {
      fetchBackupSettings();
      const interval = setInterval(() => {
        fetchBackupStatusOnly();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const handleBrowseFolder = async () => {
    setBrowsingFolder(true);
    try {
      const res = await backupApi.browseFolder(targetDirectory);
      if (res && res.success && res.folder_path) {
        setTargetDirectory(res.folder_path);
      }
    } catch (err: any) {
      console.warn("Folder picker error:", err);
    } finally {
      setBrowsingFolder(false);
    }
  };

  const handleSaveBackupSettings = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const payload: Partial<BackupSettings> = {
        auto_backup_enabled: autoBackupEnabled,
        interval_days: parseFloat(intervalDays) || 7,
        interval_minutes: intervalMinutes,
        target_directory: targetDirectory.trim(),
        backup_format: backupFormat,
        single_file_overwrite: singleFileOverwrite,
        cloud_backup_enabled: cloudBackupEnabled,
        cloud_provider: cloudProvider,
        gdrive: {
          folder_id: gdriveFolderId.trim(),
          access_token: gdriveAccessToken.trim(),
        },
        s3: {
          bucket: s3Bucket.trim(),
          endpoint_url: s3EndpointUrl.trim(),
          access_key: s3AccessKey.trim(),
          secret_key: s3SecretKey.trim(),
          region: s3Region.trim(),
        },
        webhook: {
          webhook_url: webhookUrl.trim(),
          secret_header: webhookSecret.trim(),
        },
      };

      await backupApi.saveBackupSettings(payload);
      setMessage({ type: "success", text: "Auto-Backup & Cloud Sync settings saved successfully!" });
      await fetchBackupSettings();
    } catch (err: any) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Failed to save backup settings." });
    } finally {
      setLoading(false);
    }
  };

  const handleTestLocalBackup = async () => {
    setTestingLocal(true);
    setMessage(null);
    try {
      await handleSaveBackupSettings();
      const res = await backupApi.triggerAutoBackupNow();
      const details = res.result || {};
      setMessage({
        type: "success",
        text: `⚡ Local Backup Test Successful! Files saved at: ${(details.local_files || []).join(", ")}`
      });
      await fetchBackupSettings();
    } catch (err: any) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Local backup test failed." });
    } finally {
      setTestingLocal(false);
    }
  };

  const handleTestCloudUpload = async () => {
    setTestingCloud(true);
    setMessage(null);
    try {
      await handleSaveBackupSettings();
      const res = await backupApi.testCloudUpload();
      setIsCloudLocked(true);
      setMessage({
        type: "success",
        text: `🔒 Connection Verified & Locked! ${res.message || ""}`
      });
      await fetchBackupSettings();
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message || "Cloud upload test failed.";
      setMessage({ type: "error", text: `❌ ${errMsg}` });
      await fetchBackupSettings();
    } finally {
      setTestingCloud(false);
    }
  };

  const fetchFiscalYears = async () => {
    setFyLoading(true);
    try {
      const data = await fiscalYearsApi.getFiscalYears();
      setFiscalYears(data);
    } catch (err) {
      console.warn("Failed to fetch fiscal years:", err);
    } finally {
      setFyLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "fiscal_years") {
      fetchFiscalYears();
    }
  }, [activeTab]);

  // Listen to global keyboard shortcuts
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("globalKeyDown", (e) => {
      if (!e) return;
      const { key, ctrlKey } = e;

      if (key === "Escape") {
        setIsSeqModalOpen(false);
        setIsNewFyModalOpen(false);
        setIsCloseFyWizardOpen(false);
      }

      // Ctrl + S triggers saves or next wizard steps!
      if (ctrlKey && (key === "s" || key === "S")) {
        if (isSeqModalOpen) {
          handleSaveSequence();
        } else if (isNewFyModalOpen) {
          handleCreateFiscalYear();
        } else if (isCloseFyWizardOpen) {
          if (closingStep < 4) {
            handleNextClosingStep();
          } else if (closingStep === 4) {
            executeCloseFiscalYear();
          }
        }
      }
    });
    return () => sub.remove();
  }, [
    isSeqModalOpen, seqPrefix, seqSuffix, seqNextValue, seqPadding, seqIsActive, selectedSeq,
    isNewFyModalOpen, newFyLabel, newFyStart, newFyEnd, newFyActive,
    isCloseFyWizardOpen, closingStep, closingNotes, fyToClose, auditCanProceed, backupBeforeClose
  ]);

  const handleSetActiveFy = async (fyId: string) => {
    setLoading(true);
    try {
      await fiscalYearsApi.setCurrentFiscalYear(fyId);
      setMessage({ type: "success", text: "Active Financial Year updated successfully!" });
      await loadMe();
      fetchFiscalYears();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.detail || "Failed to update active financial year.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateFyModal = () => {
    // Check if an active unclosed FY exists
    const activeUnclosedFy = fiscalYears.find(f => !f.closed_at);
    if (activeUnclosedFy) {
      const startParts = activeUnclosedFy.start_date.split("-");
      const endParts = activeUnclosedFy.end_date.split("-");
      const fmtStart = startParts.length === 3 ? `${startParts[2]}/${startParts[1]}/${startParts[0]}` : activeUnclosedFy.start_date;
      const fmtEnd = endParts.length === 3 ? `${endParts[2]}/${endParts[1]}/${endParts[0]}` : activeUnclosedFy.end_date;

      Alert.alert(
        "Active Financial Year Running",
        `Financial Year '${activeUnclosedFy.label}' (${fmtStart} to ${fmtEnd}) is currently active.\n\nA new Financial Year can only be created after the current active year ends on ${fmtEnd} and is closed via the Year Closing Wizard.`,
        [{ text: "Understood", style: "default" }]
      );
      return;
    }

    // Find the latest closed FY to compute next consecutive dates
    const sortedFys = [...fiscalYears].sort((a, b) => b.end_date.localeCompare(a.end_date));
    if (sortedFys.length > 0) {
      const lastFy = sortedFys[0];
      const lastEndYear = parseInt(lastFy.end_date.split("-")[0], 10);
      const nextStart = `${lastEndYear}-04-01`;
      const nextEnd = `${lastEndYear + 1}-03-31`;
      const nextLabel = `FY ${lastEndYear}-${String(lastEndYear + 1).slice(-2)}`;

      setNewFyStart(nextStart);
      setNewFyEnd(nextEnd);
      setNewFyLabel(nextLabel);
      setNewFyActive(true);
    }

    setIsNewFyModalOpen(true);
  };

  const handleCreateFiscalYear = async () => {
    if (!newFyLabel.trim()) {
      Alert.alert("Validation", "Label is required (e.g. FY 2026-27).");
      return;
    }
    if (!newFyStart || !newFyEnd) {
      Alert.alert("Validation", "Start and End dates are required.");
      return;
    }

    // Standard date format validations for FY (April 1st to March 31st)
    const startParts = newFyStart.split("-");
    const endParts = newFyEnd.split("-");
    if (startParts[1] !== "04" || startParts[2] !== "01") {
      Alert.alert("Compliance Alert", "Financial Year must start strictly on April 1st.");
      return;
    }
    if (endParts[1] !== "03" || endParts[2] !== "31") {
      Alert.alert("Compliance Alert", "Financial Year must end strictly on March 31st of the next calendar year.");
      return;
    }
    const startYear = parseInt(startParts[0], 10);
    const endYear = parseInt(endParts[0], 10);
    if (endYear !== startYear + 1) {
      Alert.alert("Compliance Alert", "Financial Year end date must be exactly in the next calendar year.");
      return;
    }

    setLoading(true);
    try {
      await fiscalYearsApi.createFiscalYear({
        label: newFyLabel.trim(),
        start_date: newFyStart,
        end_date: newFyEnd,
        is_active: newFyActive
      });
      setIsNewFyModalOpen(false);
      setMessage({ type: "success", text: "New Financial Year created successfully!" });
      await loadMe();
      fetchFiscalYears();

      // Reset form
      setNewFyLabel("");
      setNewFyStart("");
      setNewFyEnd("");
      setNewFyActive(true);
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.detail || "Failed to create financial year.");
    } finally {
      setLoading(false);
    }
  };

  const promptNextFyInitialization = (closedFy: FiscalYear) => {
    const closedYearEnd = closedFy.end_date;
    const closedEndYear = parseInt(closedYearEnd.split("-")[0], 10);
    const nextStart = `${closedEndYear}-04-01`;
    const nextEnd = `${closedEndYear + 1}-03-31`;
    const nextLabel = `FY ${closedEndYear}-${String(closedEndYear + 1).slice(-2)}`;

    Alert.alert(
      "Financial Year Closed Successfully! 🎉",
      `Financial Year '${closedFy.label}' has been locked and retained earnings have been posted.\n\nWould you like to initialize the new Financial Year '${nextLabel}' (${nextStart.split("-").reverse().join("/")} to ${nextEnd.split("-").reverse().join("/")}) now?`,
      [
        { text: "Later", style: "cancel" },
        {
          text: `Initialize ${nextLabel}`,
          onPress: () => {
            setNewFyStart(nextStart);
            setNewFyEnd(nextEnd);
            setNewFyLabel(nextLabel);
            setNewFyActive(true);
            setIsNewFyModalOpen(true);
          }
        }
      ]
    );
  };

  const startCloseFyWizard = async (fy: FiscalYear) => {
    // Check if current system date is before end_date
    const todayStr = new Date().toISOString().split("T")[0];
    if (todayStr <= fy.end_date) {
      const dateParts = fy.end_date.split("-");
      const formattedEnd = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : fy.end_date;
      Alert.alert(
        "Premature Year Closing Restricted",
        `Financial Year '${fy.label}' ends on ${formattedEnd}.\n\nThe system does not allow closing a Financial Year before its period has ended. Year closing procedures can only be executed after ${formattedEnd}.`,
        [{ text: "OK", style: "default" }]
      );
      return;
    }

    setFyToClose(fy);
    setClosingStep(1);
    setIsCloseFyWizardOpen(true);
    setClosingNotes("");

    // Step 1: Fetch audit checks
    setAuditLoading(true);
    try {
      const audit = await fiscalYearsApi.getPreClosingAudit();
      setAuditResults(audit.results);
      setAuditCanProceed(audit.can_proceed);
    } catch (err) {
      console.warn("Failed to fetch pre-closing audit checks:", err);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleNextClosingStep = async () => {
    if (closingStep === 1) {
      // Step 2: Fetch balances
      setClosingStep(2);
      setBalancesLoading(true);
      try {
        const balances = await fiscalYearsApi.getClosingBalances();
        setClosingBalances(balances);
      } catch (err) {
        console.warn("Failed to fetch closing balances:", err);
      } finally {
        setBalancesLoading(false);
      }
    } else if (closingStep === 2) {
      // Step 3: Fetch sequences
      setClosingStep(3);
      setCalibLoading(true);
      try {
        const calib = await fiscalYearsApi.getSequenceCalibration(fyToClose?.id);
        setSeqCalibration(calib);
      } catch (err) {
        console.warn("Failed to fetch sequence calibration:", err);
      } finally {
        setCalibLoading(false);
      }
    } else if (closingStep === 3) {
      setClosingStep(4);
    }
  };

  const executeCloseFiscalYear = async () => {
    if (!fyToClose) return;
    setLoading(true);
    try {
      if (backupBeforeClose) {
        const { PdfRenderer: pdfModule } = NativeModules;
        if (pdfModule && pdfModule.SaveFileWithToken) {
          const token = getAccessToken() || "";
          const downloadUrl = `${apiClient.defaults.baseURL}/api/v1/backup/create?token=${encodeURIComponent(token)}`;
          const timestamp = new Date().toISOString().split("T")[0];
          const companyClean = (company?.name || "Company")
            .replace(/[^a-zA-Z0-9]/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_+|_+$/g, "");
          const fyClean = fyToClose.label
            .replace(/[^a-zA-Z0-9]/g, "_")
            .replace(/_+/g, "_");
          const suggestedName = `${companyClean}_Backup_${fyClean}_${timestamp}`;

          await pdfModule.SaveFileWithToken(
            downloadUrl,
            suggestedName,
            "PostgreSQL Backup File (*.bak)",
            ".bak",
            token
          );
        } else {
          console.warn("SaveFileWithToken not supported by native Windows modules");
        }
      }

      await fiscalYearsApi.closeFiscalYear(fyToClose.id, closingNotes);
      setIsCloseFyWizardOpen(false);
      setMessage({ type: "success", text: `Financial Year '${fyToClose.label}' closed successfully!` });
      await loadMe();
      await fetchFiscalYears();
      promptNextFyInitialization(fyToClose);
    } catch (err: any) {
      const errMsg = err.message || "";
      if (errMsg.toLowerCase().includes("cancel") || errMsg.toLowerCase().includes("user cancelled") || errMsg.toLowerCase().includes("cancelled")) {
        setLoading(false);
        Alert.alert(
          "Backup Cancelled",
          "You cancelled the database backup. Do you want to proceed and close the financial year without a backup?",
          [
            { text: "Retry Backup", onPress: () => executeCloseFiscalYear() },
            {
              text: "Close Without Backup",
              onPress: async () => {
                setLoading(true);
                try {
                  await fiscalYearsApi.closeFiscalYear(fyToClose.id, closingNotes);
                  setIsCloseFyWizardOpen(false);
                  setMessage({ type: "success", text: `Financial Year '${fyToClose.label}' closed successfully!` });
                  await loadMe();
                  await fetchFiscalYears();
                  promptNextFyInitialization(fyToClose);
                } catch (closeErr: any) {
                  Alert.alert("Error", closeErr.response?.data?.detail || closeErr.message || "Failed to close financial year.");
                } finally {
                  setLoading(false);
                }
              }
            },
            { text: "Cancel Close", style: "cancel" }
          ]
        );
        return;
      }
      Alert.alert("Error", err.response?.data?.detail || err.message || "Failed to close financial year.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSequences = async () => {
    setSeqLoading(true);
    try {
      const data = await sequencesApi.getSequences();
      setSequences(data);
    } catch (err) {
      console.warn("Failed to fetch sequences:", err);
    } finally {
      setSeqLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "sequences") {
      fetchSequences();
    }
  }, [activeTab]);

  const handleEditSequence = (seq: Sequence) => {
    console.log("handleEditSequence fired:", seq.document_type);
    setSelectedSeq(seq);
    setSeqPrefix(seq.prefix || "");
    setSeqSuffix(seq.suffix || "");
    setSeqNextValue(String(seq.next_value));
    setSeqPadding(String(seq.padding));
    setSeqIsActive(seq.is_active);
    setIsSeqModalOpen(true);
    console.log("Modal should open now, isSeqModalOpen = true");
  };

  const handleSaveSequence = async () => {
    if (!selectedSeq) return;
    const nextVal = parseInt(seqNextValue) || 1;
    const paddingVal = parseInt(seqPadding);
    if (isNaN(paddingVal) || paddingVal < 1 || paddingVal > 10) {
      Alert.alert("Validation", "Padding must be between 1 and 10.");
      return;
    }

    setLoading(true);
    try {
      await sequencesApi.updateSequence(selectedSeq.id, {
        prefix: seqPrefix || "",
        suffix: seqSuffix || "",
        next_value: nextVal,
        padding: paddingVal,
        is_active: seqIsActive,
      });
      setIsSeqModalOpen(false);
      setMessage({ type: "success", text: "Document sequence updated successfully!" });
      fetchSequences();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.detail || "Failed to update sequence.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetSequences = async () => {
    Alert.alert(
      "Reset Sequences",
      "Are you sure you want to reset all document sequences to factory default formats? This will not reset your next index values.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setSeqLoading(true);
            try {
              await sequencesApi.resetSequences();
              setMessage({ type: "success", text: "Document sequences reset successfully!" });
              fetchSequences();
            } catch (err: any) {
              Alert.alert("Error", err.response?.data?.detail || "Failed to reset sequences.");
            } finally {
              setSeqLoading(false);
            }
          }
        }
      ]
    );
  };

  // Initialize fields
  useEffect(() => {
    if (company) {
      setCoName(company.name || "");
      setCoGst(company.gst_number || "");
      setCoPan(company.pan_number || "");
      setCoTan(company.tan_no || "");
      setCoEmail(company.email || "");
      setCoPhone(company.phone || "");
      setCoMobile(company.mobile_no || "");
      setCoState(company.registered_state || "");
      setCoAddress1(company.office_address_1 || "");
      setCoAddress2(company.office_address_2 || "");
      setCoAddress3(company.office_address_3 || "");
      setCoAddress4(company.office_address_4 || "");
      setCoPincode(company.pincode || "");
      setCoBank(company.bank_name || "");
      setCoBranch(company.bank_branch || "");
      setCoAccNo(company.account_no || "");
      setCoIfsc(company.ifsc_code || "");

      setTaxRate(company.default_tax_rate ? String(company.default_tax_rate) : "");
      setGstRate(company.default_gst_rate ? String(company.default_gst_rate) : "");
      setHsnCode(company.default_hsn_sac_code || "");
      setIsGstRegistered(company.is_gst_applicable ?? true);
      setHsnSacType(company.hsn_sac_type || "Goods");

      const settings = company.settings || {};
      const caConfig = settings.ca || {};
      const smtpConfig = settings.smtp || {};
      const waConfig = settings.whatsapp || {};

      setCaName(caConfig.ca_name || "");
      setCaEmail(caConfig.ca_email || "");
      setCaPhone(caConfig.ca_phone || "");

      setSmtpHost(smtpConfig.smtp_host || "");
      setSmtpPort(smtpConfig.smtp_port ? String(smtpConfig.smtp_port) : "587");
      setSmtpUsername(smtpConfig.smtp_username || "");
      setSmtpPassword(smtpConfig.smtp_password || "");
      setSmtpFromEmail(smtpConfig.smtp_from_email || "");
      setSmtpUseTls(smtpConfig.smtp_use_tls ?? true);

      setWaPhoneNumberId(waConfig.wa_phone_number_id || "");
      setWaAccessToken(waConfig.wa_access_token || "");
      setWaBusinessAccountId(waConfig.wa_business_account_id || "");
    }
    if (user) {
      setPinEnabled(user.pin_login_enabled);
    }
  }, [company, user]);

  // Alert autofade
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Action: Save company profile
  const handleSaveCompany = async () => {
    if (!coName.trim()) {
      setMessage({ type: "error", text: "Company name cannot be blank." });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const updated = await authApi.updateCompanyProfile({
        name: coName,
        gst_number: coGst || undefined,
        pan_number: coPan || undefined,
        tan_no: coTan || undefined,
        email: coEmail || undefined,
        phone: coPhone || undefined,
        mobile_no: coMobile || undefined,
        registered_state: coState || undefined,
        office_address_1: coAddress1 || undefined,
        office_address_2: coAddress2 || undefined,
        office_address_3: coAddress3 || undefined,
        office_address_4: coAddress4 || undefined,
        pincode: coPincode || undefined,
        bank_name: coBank || undefined,
        bank_branch: coBranch || undefined,
        account_no: coAccNo || undefined,
        ifsc_code: coIfsc || undefined,
        default_tax_rate: taxRate ? parseFloat(taxRate) : undefined,
        default_gst_rate: gstRate ? parseFloat(gstRate) as any : undefined,
        default_hsn_sac_code: hsnCode || undefined,
        is_gst_applicable: isGstRegistered,
        hsn_sac_type: hsnSacType,
      });
      setCompany(updated);
      setMessage({ type: "success", text: "Business profile saved successfully!" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Failed to update profile." });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCommunicationSettings = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const currentSettings = company?.settings || {};
      const updatedSettings = {
        ...currentSettings,
        ca: {
          ca_name: caName.trim(),
          ca_email: caEmail.trim(),
          ca_phone: caPhone.trim()
        },
        smtp: {
          smtp_host: smtpHost.trim(),
          smtp_port: parseInt(smtpPort) || 587,
          smtp_username: smtpUsername.trim(),
          smtp_password: smtpPassword.trim(),
          smtp_from_email: smtpFromEmail.trim(),
          smtp_use_tls: smtpUseTls
        },
        whatsapp: {
          wa_phone_number_id: waPhoneNumberId.trim(),
          wa_access_token: waAccessToken.trim(),
          wa_business_account_id: waBusinessAccountId.trim()
        }
      };

      const updated = await authApi.updateCompanyProfile({ settings: updatedSettings });
      setCompany(updated);
      setMessage({ type: "success", text: "Communication & CA Settings saved successfully!" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Failed to save communication settings." });
    } finally {
      setLoading(false);
    }
  };

  // Action: Verify GST number
  const handleVerifyGST = async () => {
    if (!coGst.trim()) {
      setMessage({ type: "error", text: "Please enter a GSTIN to verify." });
      return;
    }
    setGstLoading(true);
    setGstVerified(null);
    try {
      const response = await authApi.verifyGST(coGst);
      if (response.is_valid) {
        setGstVerified(true);
        setMessage({ type: "success", text: `GSTIN is valid and active.` });
      } else {
        setGstVerified(false);
        setMessage({ type: "error", text: "GSTIN is invalid." });
      }
    } catch (err: any) {
      setGstVerified(false);
      setMessage({ type: "error", text: err.response?.data?.detail || "GST verification failed." });
    } finally {
      setGstLoading(false);
    }
  };

  // Action: Toggle Pin Login enable/disable
  const handleTogglePinLogin = async () => {
    if (!pinEnabled && !user?.has_pin) {
      setMessage({
        type: "error",
        text: "Please configure a 4 or 6-digit Security PIN below first before enabling PIN screen lock."
      });
      return;
    }
    setLoading(true);
    try {
      await authApi.updateSecuritySettings({ pin_login_enabled: !pinEnabled });
      setPinEnabled(!pinEnabled);
      await loadMe();
      setMessage({ type: "success", text: `PIN login is now ${!pinEnabled ? "enabled" : "disabled"}.` });
    } catch (err: any) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Failed to toggle PIN security." });
    } finally {
      setLoading(false);
    }
  };

  // Action: Setup Pin lock code
  const handleSetupPin = async () => {
    if (!pinCode.trim() || pinCode.length < 4) {
      setMessage({ type: "error", text: "PIN must be at least 4 digits." });
      return;
    }
    if (confirmPinCode && pinCode !== confirmPinCode) {
      setMessage({ type: "error", text: "New PIN and Confirm PIN do not match." });
      return;
    }
    setLoading(true);
    try {
      await authApi.setPin({ pin: pinCode });
      setPinCode("");
      setConfirmPinCode("");
      await loadMe();
      setMessage({ type: "success", text: "Security PIN has been updated & saved successfully." });
    } catch (err: any) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Failed to set security PIN." });
    } finally {
      setLoading(false);
    }
  };

  // Action: Run system diagnostics check
  const handleRunDiagnostics = async () => {
    setDiagChecking(true);
    const start = Date.now();
    try {
      await authApi.me();
      setDiagLatency(Date.now() - start);
      setDiagCheckTime(new Date().toLocaleTimeString());
    } catch (err) {
      setDiagLatency(null);
      setDiagCheckTime("Failed");
    } finally {
      setDiagChecking(false);
    }
  };

  const [hoveredTab, setHoveredTab] = useState<TabType | null>(null);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Screen Header Block ────────────────────────────────── */}
      <View style={styles.headerBlock}>
        <Text style={[styles.breadcrumb, { color: colors.accent }]}>SYSTEM / CONFIGURATION</Text>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>System Settings</Text>
          {activeTab !== "diagnostics" && activeTab !== "interface" && (
            <Pressable
              onHoverIn={() => setHoveredBtn("save")}
              onHoverOut={() => setHoveredBtn(null)}
              onPress={() => {
                if (activeTab === "communication") {
                  handleSaveCommunicationSettings();
                } else if (activeTab === "backup") {
                  handleSaveBackupSettings();
                } else {
                  handleSaveCompany();
                }
              }}
              disabled={loading}
              style={[
                styles.saveBtn,
                { backgroundColor: hoveredBtn === "save" ? colors.accentLight : colors.accent, borderColor: colors.accent },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {loading && <ActivityIndicator size="small" color={hoveredBtn === "save" ? colors.accent : "#FFFFFF"} style={{ width: 18, height: 18 }} />}
                <Text style={[styles.saveBtnText, { color: hoveredBtn === "save" ? colors.accent : "#FFFFFF" }]}>
                  Save Changes
                </Text>
              </View>
            </Pressable>
          )}
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Manage application configurations, company details, default tax rates, interface security, and runtime diagnostics.
        </Text>

        {/* ── Brand Official Support Contact Card ──────────────────── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.cardBg,
            borderWidth: 1,
            borderColor: isDarkMode ? "rgba(56, 189, 248, 0.3)" : "rgba(2, 132, 199, 0.25)",
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 10,
            marginTop: 12,
            flexWrap: "wrap",
            gap: 12
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 18 }}>🎧</Text>
            <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary, fontFamily: "Segoe UI Variable Text" }}>
              JK Infotech ERP Support:
            </Text>
            <Text style={{ fontSize: 13, color: colors.accent, fontWeight: "700", fontFamily: "Consolas" }}>
              ✉️ support@jkinfotech.com
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>|</Text>
            <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: "700", fontFamily: "Segoe UI Variable Text" }}>
              📞 +91 91045 42969 / +91 98765 43210
            </Text>
          </View>
          <View style={{ backgroundColor: "rgba(74, 222, 128, 0.15)", borderWidth: 1, borderColor: colors.success, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.success }}>🟢 Official Brand Desk</Text>
          </View>
        </View>
      </View>

      {/* Alert Bar */}
      {message && (
        <View
          style={[
            styles.alertBar,
            {
              backgroundColor: message.type === "success" ? "rgba(74, 222, 128, 0.12)" : "rgba(248, 113, 113, 0.12)",
              borderColor: message.type === "success" ? colors.success : colors.error,
            },
          ]}
        >
          <Text style={[styles.alertText, { color: message.type === "success" ? colors.success : colors.error }]}>
            {message.type === "success" ? "✓  " : "⚠  "} {message.text}
          </Text>
        </View>
      )}

      {/* ── Main Layout Container ──────────────────────────────── */}
      <View style={styles.contentContainer}>
        {/* Left Tab Bar Column */}
        <View style={[styles.tabSelector, { borderColor: colors.cardBorder }]}>
          {(["business", "communication", "interface", "advanced", "sequences", "fiscal_years", "backup", "diagnostics"] as TabType[]).map((tab) => {
            const isActive = activeTab === tab;
            const isHovered = hoveredTab === tab;
            const tabLabels = {
              business: "🏢  Business Profile",
              communication: "💬  CA & Communication",
              interface: "🎨  User & Interface",
              advanced: "⚙️  Advanced Config",
              sequences: "🔢  Document Numbering",
              fiscal_years: "📅  Financial Years",
              backup: "💾  Auto-Backup & Cloud",
              diagnostics: "ℹ️  Diagnostics & System",
            };
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                onHoverIn={() => setHoveredTab(tab)}
                onHoverOut={() => setHoveredTab(null)}
                style={[
                  styles.tabBtn,
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderLeftWidth: 3.5,
                    borderLeftColor: isActive ? colors.accent : "transparent",
                    paddingLeft: 12,
                    paddingVertical: 11
                  },
                  isActive && { backgroundColor: colors.accentLight },
                  isHovered && !isActive && { backgroundColor: colors.btnBg },
                ]}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: isActive ? colors.accent : colors.textPrimary, fontSize: 14.5 },
                    isActive && { fontWeight: "700" },
                  ]}
                >
                  {tabLabels[tab]}
                </Text>
                {isActive && (
                  <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.accent }} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Right Settings Form panel */}
        <ScrollView
          style={styles.formPanel}
          contentContainerStyle={styles.formScrollContent}
          indicatorStyle={isDarkMode ? "white" : "black"}
        >
          {activeTab === "communication" && (
            <View style={{ gap: 20 }}>
              {/* Header with Setup Guide Button */}
              <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
                <View>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>CA & Communication Settings</Text>
                  <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>Configure Email (SMTP), WhatsApp Messaging, and CA Report Sharing</Text>
                </View>
                <Button
                  title="❓ Setup Guide & Help"
                  variant="secondary"
                  onPress={() => {
                    setHelpModalCategory("COMMUNICATION_SETUP");
                    setIsHelpModalOpen(true);
                  }}
                />
              </View>

              {/* CA Contact Card */}
              <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Chartered Accountant (CA) & Auditor Details</Text>
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                  Specify your CA or tax consultant details for quick report dispatching.
                </Text>
                <View style={styles.formGrid}>
                  <View style={styles.inputField}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>CA / FIRM NAME</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                      value={caName}
                      onChangeText={setCaName}
                      placeholder="e.g. M/s Mehta & Associates"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  <View style={styles.inputField}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>CA EMAIL ADDRESS</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                      value={caEmail}
                      onChangeText={setCaEmail}
                      placeholder="ca.reports@auditfirm.com"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  <View style={styles.inputField}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>CA WHATSAPP PHONE NUMBER</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                      value={caPhone}
                      onChangeText={setCaPhone}
                      placeholder="+91 98765 43210"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                </View>
              </View>

              {/* SMTP Configuration Card */}
              <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>SMTP Email Gateway Setup</Text>
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                  Configure your business email SMTP server to send report attachments directly.
                </Text>
                <View style={styles.formGrid}>
                  <View style={styles.inputField}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>SMTP HOST</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                      value={smtpHost}
                      onChangeText={setSmtpHost}
                      placeholder="smtp.gmail.com or smtp.office365.com"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  <View style={styles.inputField}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>SMTP PORT</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                      value={smtpPort}
                      onChangeText={setSmtpPort}
                      placeholder="587 or 465"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  <View style={styles.inputField}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>SMTP USERNAME (EMAIL)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                      value={smtpUsername}
                      onChangeText={setSmtpUsername}
                      placeholder="billing@yourdomain.com"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  <View style={styles.inputField}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>SMTP APP PASSWORD</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                      value={smtpPassword}
                      onChangeText={setSmtpPassword}
                      secureTextEntry={true}
                      placeholder="••••••••••••••••"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  <View style={styles.inputField}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>SENDER FROM EMAIL</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                      value={smtpFromEmail}
                      onChangeText={setSmtpFromEmail}
                      placeholder="accounts@yourdomain.com"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                </View>
                <View style={{ marginTop: 12, alignItems: "flex-start" }}>
                  <Button
                    title="Send Test Email"
                    variant="secondary"
                    onPress={async () => {
                      if (!smtpHost || !smtpUsername || !smtpPassword) {
                        Alert.alert("Validation", "Please fill in SMTP Host, Username, and Password first.");
                        return;
                      }
                      setLoading(true);
                      try {
                        await apiClient.post("/api/reports/test-smtp", {
                          test_email: smtpUsername.trim(),
                          smtp_host: smtpHost.trim(),
                          smtp_port: parseInt(smtpPort) || 587,
                          smtp_username: smtpUsername.trim(),
                          smtp_password: smtpPassword.trim(),
                          smtp_from_email: smtpFromEmail.trim(),
                          smtp_use_tls: smtpUseTls
                        });
                        Alert.alert("Success", `Test email sent to ${smtpUsername}! Connection verified.`);
                      } catch (err: any) {
                        Alert.alert("SMTP Error", err.response?.data?.detail || "SMTP test failed.");
                      } finally {
                        setLoading(false);
                      }
                    }}
                  />
                </View>
              </View>

              {/* Meta WhatsApp Cloud API Setup Card */}
              <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Meta WhatsApp Business API Setup</Text>
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                  Enter Meta Developer Portal WhatsApp Cloud API credentials for automated document dispatch.
                </Text>
                <View style={styles.formGrid}>
                  <View style={styles.inputField}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>PHONE NUMBER ID</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                      value={waPhoneNumberId}
                      onChangeText={setWaPhoneNumberId}
                      placeholder="e.g. 109283746501928"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  <View style={styles.inputField}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>BUSINESS ACCOUNT ID</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                      value={waBusinessAccountId}
                      onChangeText={setWaBusinessAccountId}
                      placeholder="e.g. 192837465019283"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  <View style={[styles.inputField, { width: "100%" }]}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>SYSTEM USER ACCESS TOKEN</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                      value={waAccessToken}
                      onChangeText={setWaAccessToken}
                      secureTextEntry={true}
                      placeholder="EAAG..."
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                </View>
              </View>

              <View style={{ alignItems: "flex-end", marginTop: 8 }}>
                <Button
                  title="Save Communication Settings"
                  variant="primary"
                  onPress={handleSaveCommunicationSettings}
                  disabled={loading}
                />
              </View>
            </View>
          )}

          {activeTab === "business" && (
            <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Company Information</Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                Modify public business profile credentials printed on sales invoices and reports.
              </Text>

              {/* Grid Input Fields */}
              <View style={styles.gridRow}>
                <View style={styles.gridCol}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Company Name *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
                    value={coName}
                    onChangeText={setCoName}
                    placeholder="Enter company name"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.gridCol}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>GSTIN / Tax ID</Text>
                  <View style={styles.inputWithAction}>
                    <TextInput
                      style={[
                        styles.input,
                        { flex: 1, backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder },
                        gstVerified === true && { borderColor: colors.success },
                        gstVerified === false && { borderColor: colors.error },
                      ]}
                      value={coGst}
                      onChangeText={(txt) => {
                        setCoGst(txt);
                        setGstVerified(null);
                      }}
                      placeholder="e.g. 07AAAAA1111A1Z1"
                      placeholderTextColor={colors.textSecondary}
                      autoCapitalize="characters"
                    />
                    <Pressable
                      onPress={handleVerifyGST}
                      disabled={gstLoading}
                      onHoverIn={() => setHoveredBtn("verifyGst")}
                      onHoverOut={() => setHoveredBtn(null)}
                      style={[
                        styles.verifyBtn,
                        { backgroundColor: hoveredBtn === "verifyGst" ? colors.accentLight : colors.btnBg, borderColor: colors.inputBorder },
                      ]}
                    >
                      {gstLoading ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <Text style={[styles.verifyBtnText, { color: colors.textPrimary }]}>Verify GST</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.gridRow}>
                <View style={styles.gridCol}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>PAN Number</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
                    value={coPan}
                    onChangeText={setCoPan}
                    placeholder="Enter 10-digit PAN"
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="characters"
                  />
                </View>
                <View style={styles.gridCol}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>TAN Number</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
                    value={coTan}
                    onChangeText={setCoTan}
                    placeholder="Enter TAN"
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              <View style={styles.gridRow}>
                <View style={styles.gridCol}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Contact Email</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
                    value={coEmail}
                    onChangeText={setCoEmail}
                    placeholder="billing@company.com"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="email-address"
                  />
                </View>
                <View style={styles.gridCol}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Mobile Number</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
                    value={coMobile}
                    onChangeText={setCoMobile}
                    placeholder="10-digit phone"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.gridRow}>
                <View style={styles.gridCol}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Registered State</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
                    value={coState}
                    onChangeText={setCoState}
                    placeholder="e.g. Delhi"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.gridCol}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Pincode</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
                    value={coPincode}
                    onChangeText={setCoPincode}
                    placeholder="6-digit ZIP code"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={[styles.cardSubTitle, { color: colors.textPrimary, marginTop: 16 }]}>Primary Office Address</Text>
              <TextInput
                style={[styles.addressInput, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
                value={coAddress1}
                onChangeText={setCoAddress1}
                placeholder="Address Line 1"
                placeholderTextColor={colors.textSecondary}
              />
              <TextInput
                style={[styles.addressInput, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder, marginTop: 8 }]}
                value={coAddress2}
                onChangeText={setCoAddress2}
                placeholder="Address Line 2"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.cardSubTitle, { color: colors.textPrimary, marginTop: 20 }]}>Settlement Bank Account Details</Text>
              <View style={styles.gridRow}>
                <View style={styles.gridCol}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Bank Name</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
                    value={coBank}
                    onChangeText={setCoBank}
                    placeholder="e.g. HDFC Bank"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.gridCol}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Bank Branch</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
                    value={coBranch}
                    onChangeText={setCoBranch}
                    placeholder="Branch name"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.gridRow}>
                <View style={styles.gridCol}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Account Number</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
                    value={coAccNo}
                    onChangeText={setCoAccNo}
                    placeholder="Enter account no"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.gridCol}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>IFSC Code</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
                    value={coIfsc}
                    onChangeText={setCoIfsc}
                    placeholder="e.g. HDFC0000123"
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
            </View>
          )}

          {activeTab === "interface" && (
            <View style={styles.tabWrapper}>
              {/* Card 1: Theme selection */}
              <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, gap: 16 }]}>
                <View>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Interface Theme Preference</Text>
                  <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                    Choose your preferred visual theme for JK INFOTECH ERP. Your theme choice is automatically persisted across sessions.
                  </Text>
                </View>

                <View style={{ flexDirection: "row", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
                  {[
                    { mode: "dark", label: "Dark Mode", desc: "High contrast dark aesthetic", glyph: "\uE708" },
                    { mode: "light", label: "Light Mode", desc: "Clean, high-visibility bright layout", glyph: "\uE706" },
                    { mode: "system", label: "System Default", desc: "Automatically match Windows system theme", glyph: "\uE7F8" }
                  ].map((item) => {
                    const isSelected = themeMode === item.mode;
                    return (
                      <Pressable
                        key={item.mode}
                        onPress={() => setThemeMode(item.mode as any, systemColorScheme)}
                        style={({ hovered }: any) => [
                          {
                            flex: 1,
                            minWidth: 200,
                            padding: 18,
                            borderRadius: 8,
                            borderWidth: 2,
                            borderColor: isSelected ? colors.accent : colors.cardBorder,
                            backgroundColor: isSelected ? colors.accentLight : colors.inputBg,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 14
                          },
                          hovered && !isSelected && { backgroundColor: colors.btnBg }
                        ]}
                      >
                        <Text style={{ fontFamily: "Segoe MDL2 Assets", fontSize: 26, color: isSelected ? colors.accent : colors.textSecondary }}>
                          {item.glyph}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 16, fontWeight: "700", color: isSelected ? colors.accent : colors.textPrimary, fontFamily: "Segoe UI Variable Text" }}>
                            {item.label}
                          </Text>
                          <Text style={{ fontSize: 12.5, color: colors.textSecondary, fontFamily: "Segoe UI Variable Text", marginTop: 2 }}>
                            {item.desc}
                          </Text>
                        </View>
                        {isSelected && (
                          <Text style={{ fontFamily: "Segoe MDL2 Assets", fontSize: 18, color: colors.accent, fontWeight: "900" }}>
                            {"\uE73E"}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {activeTab === "advanced" && (
            <View style={styles.tabWrapper}>
              <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Default Transaction Preferences</Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                  Setup default tax metrics to pre-populate line items on sales invoices and purchase bills.
                </Text>

                {/* Toggle: Are you GST Registered? */}
                <View style={{ marginBottom: 20 }}>
                  <Toggle
                    value={isGstRegistered}
                    onChange={setIsGstRegistered}
                    label="GST Registration Status"
                    onLabel="Registered"
                    offLabel="Unregistered"
                  />
                </View>

                {isGstRegistered ? (
                  <>
                    <View style={styles.gridRow}>
                      <View style={styles.gridCol}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Default GST Rate (%)</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
                          value={gstRate}
                          onChangeText={(txt) => {
                            setGstRate(txt);
                            setTaxRate(txt);
                          }}
                          placeholder="e.g. 18"
                          placeholderTextColor={colors.textSecondary}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.gridCol}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Type of Supply</Text>
                        <View style={{ flexDirection: "row", gap: 10 }}>
                          <Pressable
                            onPress={() => setHsnSacType("Goods")}
                            style={({ hovered }: any) => ({
                              flex: 1,
                              height: 40,
                              borderRadius: 6,
                              borderWidth: 2,
                              borderColor: hsnSacType === "Goods" ? colors.accent : colors.cardBorder,
                              backgroundColor: hsnSacType === "Goods" ? colors.accentLight : (hovered ? colors.btnBg : colors.inputBg),
                              alignItems: "center",
                              justifyContent: "center"
                            })}
                          >
                            <Text style={{ color: hsnSacType === "Goods" ? colors.accent : colors.textSecondary, fontWeight: "700", fontSize: 13 }}>GOODS</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => setHsnSacType("Service")}
                            style={({ hovered }: any) => ({
                              flex: 1,
                              height: 40,
                              borderRadius: 6,
                              borderWidth: 2,
                              borderColor: hsnSacType === "Service" ? colors.accent : colors.cardBorder,
                              backgroundColor: hsnSacType === "Service" ? colors.accentLight : (hovered ? colors.btnBg : colors.inputBg),
                              alignItems: "center",
                              justifyContent: "center"
                            })}
                          >
                            <Text style={{ color: hsnSacType === "Service" ? colors.accent : colors.textSecondary, fontWeight: "700", fontSize: 13 }}>SERVICES</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>

                    <View style={styles.gridRow}>
                      <View style={[styles.gridCol, { flex: 0.5 }]}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          Default {hsnSacType === "Goods" ? "HSN Code" : "SAC Code"}
                        </Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
                          value={hsnCode}
                          onChangeText={setHsnCode}
                          placeholder={hsnSacType === "Goods" ? "e.g. 8471" : "e.g. 998311"}
                          placeholderTextColor={colors.textSecondary}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  </>
                ) : (
                  <View style={{ backgroundColor: isDarkMode ? "#1A2536" : "#F1F5F9", borderWidth: 1, borderColor: isDarkMode ? "#1E3A5F" : "#E2E8F0", borderRadius: 8, padding: 16, marginTop: 10 }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: "Segoe UI Variable Text", lineHeight: 18 }}>
                      GST preferences and HSN/SAC codes are not active for unregistered businesses. Line items will default to zero tax.
                    </Text>
                  </View>
                )}
              </View>

              {/* Card 2: Security settings */}
              <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, marginTop: 20 }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>PIN Security & Screen Lock</Text>
                  <View style={{
                    backgroundColor: user?.has_pin ? (isDarkMode ? "#14532D" : "#DCFCE7") : (isDarkMode ? "#451A03" : "#FEF3C7"),
                    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 1,
                    borderColor: user?.has_pin ? (isDarkMode ? "#22C55E" : "#16A34A") : (isDarkMode ? "#F59E0B" : "#D97706")
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: "800", color: user?.has_pin ? (isDarkMode ? "#4ADE80" : "#15803D") : (isDarkMode ? "#FBBF24" : "#B45309"), fontFamily: "Segoe UI Variable Text" }}>
                      {user?.has_pin ? "✓ PIN CONFIGURED" : "⚠️ NO PIN CONFIGURED"}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.cardDesc, { color: colors.textSecondary, marginBottom: 16 }]}>
                  Configure a secure 4 or 6-digit PIN code to protect application startup and quick session unlocks.
                </Text>

                {/* Section A: Always-visible PIN Configuration Form */}
                <View style={{
                  backgroundColor: isDarkMode ? "rgba(15, 23, 42, 0.6)" : "#F8FAFC",
                  padding: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.cardBorder, marginBottom: 16
                }}>
                  <Text style={[styles.cardSubTitle, { color: colors.textPrimary, marginBottom: 12, fontSize: 14, fontWeight: "700" }]}>
                    {user?.has_pin ? "Update Existing Security PIN" : "Configure New Security PIN"}
                  </Text>
                  <View style={styles.gridRow}>
                    <View style={styles.gridCol}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>New PIN Code (4 or 6 Digits)</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
                        value={pinCode}
                        onChangeText={setPinCode}
                        placeholder="e.g. 1234 or 9876"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="numeric"
                        secureTextEntry
                        maxLength={6}
                      />
                    </View>
                    <View style={styles.gridCol}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Confirm New PIN</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
                        value={confirmPinCode}
                        onChangeText={setConfirmPinCode}
                        placeholder="Re-enter new PIN"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="numeric"
                        secureTextEntry
                        maxLength={6}
                      />
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 12 }}>
                    <Pressable
                      onPress={handleSetupPin}
                      onHoverIn={() => setHoveredBtn("pinSetup")}
                      onHoverOut={() => setHoveredBtn(null)}
                      style={({ pressed }: any) => [
                        styles.btn,
                        {
                          backgroundColor: colors.accent,
                          opacity: hoveredBtn === "pinSetup" ? 0.9 : 1,
                          paddingHorizontal: 20,
                          height: 38,
                          borderRadius: 6,
                        },
                        pressed && { opacity: 0.9 },
                      ]}
                    >
                    <Text style={[styles.btnText, { color: "#FFFFFF", fontWeight: "700" }]}>
                      {user?.has_pin ? "Update Security PIN" : "Save Security PIN"}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Section B: Enable/Disable PIN Screen Lock */}
              <View style={{ borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: 16, marginTop: 4 }}>
                <Toggle
                  value={pinEnabled}
                  onChange={handleTogglePinLogin}
                  label="Require PIN screen lock"
                  onLabel="Active"
                  offLabel="Disabled"
                />
                <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 6, fontFamily: "Segoe UI Variable Text" }}>
                  When active, the ERP system will require your 4/6-digit PIN screen lock on app startup or session unlock.
                </Text>
              </View>
            </View>

              {/* Card 3: Barcode settings */}
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, marginTop: 20 }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Barcode Integration</Text>
            <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
              Enable EAN-13 barcode generation for products and support barcode scanner lookups in inventory and invoicing modules.
            </Text>

            <Toggle
              value={!!company?.settings?.enable_barcodes}
              onChange={async (nextVal) => {
                const currentSettings = company?.settings || {};
                setLoading(true);
                try {
                  const updated = await authApi.updateCompanyProfile({
                    settings: { ...currentSettings, enable_barcodes: nextVal }
                  });
                  setCompany(updated);
                  setMessage({ type: "success", text: `Barcode support ${nextVal ? "enabled" : "disabled"} successfully!` });
                } catch (err: any) {
                  setMessage({ type: "error", text: err.response?.data?.detail || "Failed to update barcode settings." });
                } finally {
                  setLoading(false);
                }
              }}
              label="Barcode Scanner & Generation Support"
              onLabel="Enabled"
              offLabel="Disabled"
            />
          </View>
      </View>
          )}

      {activeTab === "sequences" && (
        <View style={styles.tabWrapper}>
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Document Numbering System</Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                  Configure auto-generation patterns, suffixes, and padding sizes for invoicing, purchase bills, orders, and receipts.
                </Text>
              </View>
              <Pressable
                onPress={handleResetSequences}
                style={({ hovered }: any) => [
                  styles.btn,
                  { height: 32, paddingHorizontal: 12, marginTop: 0, backgroundColor: hovered ? colors.accentLight : colors.btnBg, borderColor: colors.accent }
                ]}
              >
                <Text style={[styles.btnText, { color: colors.textPrimary, fontSize: 12.5 }]}>Reset Default Prefixes</Text>
              </Pressable>
            </View>

            {seqLoading ? (
              <View style={{ padding: 40, alignItems: "center" }}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14 }}>Fetching document numbering patterns...</Text>
              </View>
            ) : (
              <DataTable
                virtualized={false}
                data={sequences}
                columns={[
                  { header: "DOCUMENT TYPE", accessorKey: "document_type", flex: 2 },
                  {
                    header: "CURRENT PATTERN",
                    accessorKey: "id",
                    flex: 2.5,
                    render: (row: Sequence) => {
                      const numStr = String(row.next_value).padStart(row.padding, "0");
                      const prefix = row.prefix || "";
                      const suffix = row.suffix || "";
                      return (
                        <Text style={{ fontFamily: "Consolas", fontWeight: "700", fontSize: 13.5, color: colors.accent }}>
                          {`${prefix}${numStr}${suffix}`}
                        </Text>
                      );
                    }
                  },
                  { header: "PREFIX", accessorKey: "prefix", flex: 1.2, render: (row: Sequence) => <Text style={{ color: colors.textPrimary }}>{row.prefix || "—"}</Text> },
                  { header: "SUFFIX", accessorKey: "suffix", flex: 1.2, render: (row: Sequence) => <Text style={{ color: colors.textPrimary }}>{row.suffix || "—"}</Text> },
                  { header: "NEXT INDEX", accessorKey: "next_value", flex: 1, render: (row: Sequence) => <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{row.next_value}</Text> },
                  { header: "PADDING", accessorKey: "padding", flex: 0.8, render: (row: Sequence) => <Text style={{ color: colors.textPrimary }}>{row.padding}</Text> },
                  {
                    header: "STATUS",
                    accessorKey: "is_active",
                    flex: 1,
                    render: (row: Sequence) => (
                      <View style={{ alignSelf: "flex-start", backgroundColor: row.is_active ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: row.is_active ? colors.success : colors.error, fontSize: 11, fontWeight: "800" }}>
                          {row.is_active ? "ACTIVE" : "INACTIVE"}
                        </Text>
                      </View>
                    )
                  },
                  {
                    header: "ACTION",
                    accessorKey: "id",
                    width: 80,
                    render: (row: Sequence) => (
                      <Pressable
                        onPress={() => handleEditSequence(row)}
                        style={({ hovered }: any) => [
                          { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: colors.accent, justifyContent: "center", alignItems: "center" },
                          hovered && { backgroundColor: colors.accentLight }
                        ]}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accent }}>Configure</Text>
                      </Pressable>
                    )
                  }
                ]}
              />
            )}
          </View>
        </View>
      )}

      {activeTab === "fiscal_years" && (
        <View style={styles.tabWrapper}>
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Financial Years Setup</Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                  Define fiscal periods (April 1st to March 31st) for taxation, select active fiscal year, or execute year-end ledger closing procedures.
                </Text>
              </View>
              <Pressable
                onPress={handleOpenCreateFyModal}
                style={({ hovered }: any) => [
                  styles.btn,
                  { height: 32, paddingHorizontal: 12, marginTop: 0, backgroundColor: colors.accent, borderColor: colors.accent }
                ]}
              >
                <Text style={[styles.btnText, { color: "#FFFFFF", fontSize: 12.5, fontWeight: "700" }]}>+ Create New FY</Text>
              </Pressable>
            </View>

            {fyLoading ? (
              <View style={{ padding: 40, alignItems: "center" }}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14 }}>Fetching financial years...</Text>
              </View>
            ) : (
              <DataTable
                virtualized={false}
                data={fiscalYears}
                columns={[
                  {
                    header: "LABEL",
                    accessorKey: "label",
                    flex: 1.5,
                    render: (row: FiscalYear) => {
                      const isActive = company?.current_fy_id === row.id;
                      return (
                        <Text style={{ fontWeight: "700", fontSize: 14, color: isActive ? colors.accent : colors.textPrimary }}>
                          {row.label} {isActive && " (Current)"}
                        </Text>
                      );
                    }
                  },
                  {
                    header: "START DATE",
                    accessorKey: "start_date",
                    flex: 1.2,
                    render: (row: FiscalYear) => {
                      const dateParts = row.start_date.split("-");
                      const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : row.start_date;
                      return <Text style={{ color: colors.textPrimary }}>{formattedDate}</Text>;
                    }
                  },
                  {
                    header: "END DATE",
                    accessorKey: "end_date",
                    flex: 1.2,
                    render: (row: FiscalYear) => {
                      const dateParts = row.end_date.split("-");
                      const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : row.end_date;
                      return <Text style={{ color: colors.textPrimary }}>{formattedDate}</Text>;
                    }
                  },
                  {
                    header: "STATUS",
                    accessorKey: "is_active",
                    flex: 1.2,
                    render: (row: FiscalYear) => {
                      const isClosed = row.closed_at !== null;
                      const isActive = company?.current_fy_id === row.id;

                      if (isClosed) {
                        return (
                          <View style={{ alignSelf: "flex-start", backgroundColor: "rgba(239, 68, 68, 0.1)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ color: colors.error, fontSize: 11, fontWeight: "800" }}>LOCKED / CLOSED</Text>
                          </View>
                        );
                      }

                      return (
                        <View style={{ alignSelf: "flex-start", backgroundColor: isActive ? "rgba(34, 197, 94, 0.12)" : "rgba(148, 163, 184, 0.15)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ color: isActive ? colors.success : colors.textSecondary, fontSize: 11, fontWeight: "800" }}>
                            {isActive ? "ACTIVE" : "INACTIVE"}
                          </Text>
                        </View>
                      );
                    }
                  },
                  {
                    header: "ACTIONS",
                    accessorKey: "id",
                    flex: 2,
                    render: (row: FiscalYear) => {
                      const isCurrent = company?.current_fy_id === row.id;
                      if (row.closed_at) {
                        const dateParts = row.closed_at.split("T")[0].split("-");
                        const closedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : row.closed_at;
                        return (
                          <Text style={{ fontSize: 12, fontStyle: "italic", color: colors.textSecondary }}>
                            Closed on {closedDate}
                          </Text>
                        );
                      }

                      return (
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          {!isCurrent && (
                            <Pressable
                              onPress={() => handleSetActiveFy(row.id)}
                              style={({ hovered }: any) => [
                                { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: colors.accent, justifyContent: "center", alignItems: "center" },
                                hovered && { backgroundColor: colors.accentLight }
                              ]}
                            >
                              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accent }}>Set Current</Text>
                            </Pressable>
                          )}
                          {isCurrent && (
                            <Pressable
                              onPress={() => startCloseFyWizard(row)}
                              style={({ hovered }: any) => [
                                { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, backgroundColor: colors.error, justifyContent: "center", alignItems: "center" },
                                hovered && { opacity: 0.8 }
                              ]}
                            >
                              <Text style={{ fontSize: 12, fontWeight: "800", color: "#FFFFFF" }}>Close Year Wizard</Text>
                            </Pressable>
                          )}
                        </View>
                      );
                    }
                  }
                ]}
              />
            )}
          </View>
        </View>
      )}

      {activeTab === "diagnostics" && (
        <View style={styles.tabWrapper}>
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>System & Diagnostics Engine</Text>
            <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
              Run ping requests and inspect native UWP database sync states.
            </Text>

            <View style={styles.diagnosticRow}>
              <Text style={[styles.diagLabel, { color: colors.textSecondary }]}>Backend base URL:</Text>
              <Text style={[styles.diagValue, { color: colors.textPrimary }]}>http://localhost:8000 (Local Host)</Text>
            </View>

            <View style={styles.diagnosticRow}>
              <Text style={[styles.diagLabel, { color: colors.textSecondary }]}>Database sync status:</Text>
              <Text style={[styles.diagValue, { color: colors.success }]}>● Running / Heartbeat synced</Text>
            </View>

            <View style={styles.diagnosticRow}>
              <Text style={[styles.diagLabel, { color: colors.textSecondary }]}>Ping Latency:</Text>
              <Text style={[styles.diagValue, { color: colors.textPrimary }]}>
                {diagLatency !== null ? `${diagLatency} ms (Checked at ${diagCheckTime})` : "Not verified"}
              </Text>
            </View>

            <Pressable
              onPress={handleRunDiagnostics}
              disabled={diagChecking}
              onHoverIn={() => setHoveredBtn("runDiag")}
              onHoverOut={() => setHoveredBtn(null)}
              style={[
                styles.btn,
                { backgroundColor: hoveredBtn === "runDiag" ? colors.accent : colors.btnBg, marginTop: 12 },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {diagChecking && <ActivityIndicator size="small" color={colors.textPrimary} style={{ width: 18, height: 18 }} />}
                <Text style={[styles.btnText, { color: hoveredBtn === "runDiag" ? "#000000" : colors.btnText }]}>
                  Run Diagnostics Check
                </Text>
              </View>
            </Pressable>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, marginTop: 20 }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Application Environment Info</Text>
            <View style={styles.diagnosticRow}>
              <Text style={[styles.diagLabel, { color: colors.textSecondary }]}>App Client Version:</Text>
              <Text style={[styles.diagValue, { color: colors.textPrimary }]}>v{getCurrentAppVersion()} (React Native Windows x64)</Text>
            </View>
            <View style={styles.diagnosticRow}>
              <Text style={[styles.diagLabel, { color: colors.textSecondary }]}>Database Engine:</Text>
              <Text style={[styles.diagValue, { color: colors.textPrimary }]}>PostgreSQL 16.3 (Local Server)</Text>
            </View>
            <View style={styles.diagnosticRow}>
              <Text style={[styles.diagLabel, { color: colors.textSecondary }]}>Core Host OS:</Text>
              <Text style={[styles.diagValue, { color: colors.textPrimary }]}>Windows Desktop WinUI</Text>
            </View>
          </View>

          {/* Official Brand Technical Support Card */}
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: isDarkMode ? "rgba(56, 189, 248, 0.3)" : "rgba(2, 132, 199, 0.25)", marginTop: 20, gap: 12 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 20 }}>🎧</Text>
                <Text style={[styles.cardTitle, { color: colors.textPrimary, marginBottom: 0 }]}>JK Infotech Official Brand Support</Text>
              </View>
              <View style={{ backgroundColor: "rgba(74, 222, 128, 0.15)", borderWidth: 1, borderColor: colors.success, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.success }}>🟢 Priority Helpdesk Active</Text>
              </View>
            </View>
            <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: "Segoe UI Variable Text", lineHeight: 18 }}>
              For custom ERP modules, multi-branch server syncing, hardware scanner setup, or priority tech support, reach out to our official desk:
            </Text>
            <View style={{ flexDirection: "row", gap: 16, marginTop: 4, flexWrap: "wrap" }}>
              <View style={{ flex: 1, minWidth: 220, padding: 12, borderRadius: 8, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.cardBorder, gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.5 }}>OFFICIAL EMAIL SUPPORT</Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.accent, fontFamily: "Consolas" }}>
                  ✉️ support@jkinfotech.com
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 220, padding: 12, borderRadius: 8, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.cardBorder, gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.5 }}>HELPLINE & MOBILE CONTACT</Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary, fontFamily: "Segoe UI Variable Text" }}>
                  📞 +91 91045 42969 / +91 98765 43210
                </Text>
              </View>
            </View>
          </View>

          {/* Cache Reset section */}
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, marginTop: 20 }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Reset Application State & Restart</Text>
            <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
              Clears local storage values, active session tokens, and cached configurations. The application will restart and establish a fresh connection.
            </Text>

            <Pressable
              onPress={async () => {
                const auth = useAuthStore.getState();
                await auth.logout();
              }}
              onHoverIn={() => setHoveredBtn("reset")}
              onHoverOut={() => setHoveredBtn(null)}
              style={[
                styles.dangerBtn,
                { backgroundColor: hoveredBtn === "reset" ? colors.error : "transparent", borderColor: colors.error },
              ]}
            >
              <Text style={[styles.dangerBtnText, { color: hoveredBtn === "reset" ? "#FFFFFF" : colors.error }]}>
                Reset Local Database & Restart App
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ─── AUTO BACKUP & CLOUD SYNC TAB ─── */}
      {activeTab === "backup" && (
        <View style={{ gap: 20 }}>
          {/* Card 1: Local Backup Configuration */}
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, gap: 20, padding: 20 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1, paddingRight: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary, fontSize: 17, fontWeight: "700" }]}>1. Automated Local Backup Schedule</Text>
                  {autoBackupEnabled ? (
                    <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, backgroundColor: "rgba(74, 222, 128, 0.15)", borderWidth: 1, borderColor: colors.success }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.success }}>🟢 Active & Working</Text>
                    </View>
                  ) : (
                    <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, backgroundColor: "rgba(255, 255, 255, 0.06)", borderWidth: 1, borderColor: colors.cardBorder }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary }}>⚪ Disabled</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary, fontSize: 13, lineHeight: 18 }]}>
                  Controls periodic backup creation, format selection, and single-file overwrite rules.
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 8 }}>
                <Toggle
                  label="ENABLE AUTO-BACKUP"
                  value={autoBackupEnabled}
                  onValueChange={setAutoBackupEnabled}
                />
                <Button
                  title={testingLocal ? "Testing..." : "⚡ Test Local Backup"}
                  variant="secondary"
                  onPress={handleTestLocalBackup}
                  disabled={testingLocal}
                />
              </View>
            </View>

            {/* Row 1: Backup Frequency */}
            <View style={{ gap: 8 }}>
              <Text style={[styles.label, { color: colors.textSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }]}>BACKUP FREQUENCY</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[
                  { label: "⚡ 5 Mins (Testing)", mins: 5, days: "0.0035" },
                  { label: "Daily (1 Day)", mins: 1440, days: "1" },
                  { label: "Weekly (7 Days)", mins: 10080, days: "7" },
                  { label: "Bi-Weekly (15 Days)", mins: 21600, days: "15" },
                  { label: "Monthly (30 Days)", mins: 43200, days: "30" },
                ].map((opt) => (
                  <Pressable
                    key={opt.mins}
                    onPress={() => {
                      setIntervalMinutes(opt.mins);
                      setIntervalDays(opt.days);
                    }}
                    style={[
                      {
                        flex: 1,
                        paddingVertical: 12,
                        paddingHorizontal: 6,
                        borderWidth: 1,
                        borderColor: colors.inputBorder,
                        borderRadius: 6,
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 46
                      },
                      intervalMinutes === opt.mins && { backgroundColor: colors.accentLight, borderColor: colors.accent }
                    ]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: intervalMinutes === opt.mins ? colors.accent : colors.textPrimary, textAlign: "center" }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Row 2: Target Folder Location */}
            <View style={{ gap: 8 }}>
              <Text style={[styles.label, { color: colors.textSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }]}>LOCAL TARGET FOLDER LOCATION</Text>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      flex: 1,
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                      color: colors.textPrimary,
                      fontFamily: "Consolas",
                      fontSize: 14,
                      fontWeight: "500",
                      height: 44,
                      paddingTop: 11,
                      paddingBottom: 11,
                      paddingHorizontal: 14,
                      lineHeight: 20,
                      textAlignVertical: "center"
                    }
                  ]}
                  value={targetDirectory}
                  onChangeText={setTargetDirectory}
                  placeholder="e.g. Y:\backup test or D:\JKERP_Backups"
                  placeholderTextColor={colors.textSecondary}
                />
                <Button
                  title={browsingFolder ? "Opening..." : "📁 Browse Folder"}
                  variant="secondary"
                  onPress={handleBrowseFolder}
                  disabled={browsingFolder}
                />
              </View>
            </View>

            {/* Last Local Backup Status Info */}
            {backupInfo?.last_backup_timestamp && (
              <View style={{ padding: 14, borderRadius: 8, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.cardBorder, gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.5 }}>LAST LOCAL BACKUP STATUS</Text>
                <Text style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 20 }}>
                  ⏱️ Last Run: <Text style={{ fontWeight: "700", color: colors.accent }}>{formatBackupTimestamp(backupInfo.last_backup_timestamp)}</Text>
                </Text>
                {backupInfo.last_backup_path && (
                  <Text style={{ fontSize: 13, color: colors.textPrimary, fontFamily: "Consolas", fontWeight: "600", marginTop: 2 }}>
                    📁 Saved at: {backupInfo.last_backup_path}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Card 2: Direct Cloud Upload Setup */}
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, gap: 20, padding: 20 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1, paddingRight: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary, fontSize: 17, fontWeight: "700" }]}>
                    2. Direct Cloud Sync & Storage Setup
                  </Text>
                  {!cloudBackupEnabled ? (
                    <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, backgroundColor: "rgba(255, 255, 255, 0.06)", borderWidth: 1, borderColor: colors.cardBorder }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary }}>⚪ Disabled</Text>
                    </View>
                  ) : backupInfo?.cloud_last_sync_status === "SUCCESS" ? (
                    <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, backgroundColor: "rgba(74, 222, 128, 0.15)", borderWidth: 1, borderColor: colors.success }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.success }}>🟢 Active & Synced</Text>
                    </View>
                  ) : backupInfo?.cloud_last_sync_status === "FAILED" ? (
                    <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, backgroundColor: "rgba(248, 113, 113, 0.15)", borderWidth: 1, borderColor: colors.error }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.error }}>🔴 Sync Failed</Text>
                    </View>
                  ) : (
                    <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.accentLight, borderWidth: 1, borderColor: colors.accent }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accent }}>⚡ Ready to Verify</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary, fontSize: 13, lineHeight: 18 }]}>
                  Automatically uploads and syncs single backup files directly to Google Drive, AWS S3, or a Custom Cloud Webhook.
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 8 }}>
                <Toggle
                  label="ENABLE CLOUD UPLOAD"
                  value={cloudBackupEnabled}
                  onValueChange={setCloudBackupEnabled}
                />
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <Button
                    title={showHelpGuide ? "✖ Hide Setup Guide" : "📖 Setup & Help Guide"}
                    variant="secondary"
                    onPress={() => setShowHelpGuide(!showHelpGuide)}
                  />
                  <Button
                    title={testingCloud ? "Testing Sync..." : "☁️ Test Cloud Upload & Sync"}
                    variant="secondary"
                    onPress={handleTestCloudUpload}
                    disabled={testingCloud}
                  />
                </View>
              </View>
            </View>

            {/* Lock Status & Unlock Warning Banner */}
            {isCloudLocked ? (
              showUnlockWarning ? (
                <View style={{ padding: 16, borderRadius: 8, backgroundColor: "rgba(251, 146, 60, 0.12)", borderWidth: 1, borderColor: colors.warning, gap: 12 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.warning }}>
                    ⚠️ Unlock Cloud Storage Credentials?
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 20 }}>
                    Modifying your cloud storage credentials will change where your automated ERP backups are stored. Ensure your new Google Drive Access Token has active write permissions.
                  </Text>
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                    <Pressable
                      onPress={() => {
                        setIsCloudLocked(false);
                        setShowUnlockWarning(false);
                      }}
                      style={{ paddingVertical: 10, paddingHorizontal: 18, borderRadius: 6, backgroundColor: "#C2410C" }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>Unlock & Edit Credentials</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setShowUnlockWarning(false)}
                      style={{ paddingVertical: 10, paddingHorizontal: 18, borderRadius: 6, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.cardBorder }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 8, backgroundColor: "rgba(74, 222, 128, 0.08)", borderWidth: 1, borderColor: "rgba(74, 222, 128, 0.3)" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.success }}>
                    🔒 Credentials Locked for Security (Verified Connection)
                  </Text>
                  <Pressable
                    onPress={() => setShowUnlockWarning(true)}
                    style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.accent }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accent }}>✏️ Unlock & Edit Credentials</Text>
                  </Pressable>
                </View>
              )
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 8, backgroundColor: "rgba(251, 146, 60, 0.1)", borderWidth: 1, borderColor: colors.warning }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.warning }}>
                  🔓 Credentials Unlocked — Click '☁️ Test Cloud Upload & Sync' to verify & re-lock
                </Text>
                <Pressable
                  onPress={() => setIsCloudLocked(true)}
                  style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.cardBorder }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary }}>🔒 Re-Lock</Text>
                </Pressable>
              </View>
            )}

            {/* Cloud Provider Selection & Help Guide */}
            <View style={{ gap: 10 }}>
              <Text style={[styles.label, { color: colors.textSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }]}>CLOUD STORAGE PROVIDER</Text>

              {/* Collapsible Step-by-Step Setup Guide */}
              {showHelpGuide && (
                <View style={{ padding: 16, borderRadius: 8, backgroundColor: "rgba(59, 130, 246, 0.08)", borderWidth: 1, borderColor: colors.accent, gap: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.accent }}>
                    📖 Step-by-Step Setup Guide ({cloudProvider === "gdrive" ? "Google Drive API" : cloudProvider === "s3" ? "AWS S3 / Cloudflare R2" : "Webhook URL"})
                  </Text>

                  {cloudProvider === "gdrive" && (
                    <View style={{ gap: 10 }}>
                      <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 20 }}>
                        <Text style={{ fontWeight: "700" }}>Step 1 — Google Drive Folder ID:</Text> Open drive.google.com in browser, create a folder named 'JKERP Backups', open it, and copy the character code from URL bar (e.g. drive.google.com/drive/folders/<Text style={{ fontWeight: "700", color: colors.accent }}>1A2b3C4d5E6f7G8h9I0j</Text>).
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 20 }}>
                        <Text style={{ fontWeight: "700" }}>Step 2 — OAuth Access Token:</Text> Open developers.google.com/oauthplayground, select <Text style={{ fontWeight: "700" }}>Drive API v3</Text> -&gt; check <Text style={{ fontWeight: "700" }}>https://www.googleapis.com/auth/drive.file</Text>, click Authorize APIs, sign in, then click <Text style={{ fontWeight: "700" }}>Exchange code for tokens</Text> and copy the Access Token.
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 20 }}>
                        <Text style={{ fontWeight: "700" }}>Step 3 — Verify & Lock:</Text> Paste both values into the boxes below and click <Text style={{ fontWeight: "700", color: colors.accent }}>☁️ Test Cloud Upload & Sync</Text>. The system will automatically upload a test verification file and lock your credentials for security!
                      </Text>
                    </View>
                  )}

                  {cloudProvider === "s3" && (
                    <View style={{ gap: 10 }}>
                      <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 20 }}>
                        <Text style={{ fontWeight: "700" }}>Step 1 — Bucket Name:</Text> Enter your exact AWS S3 or Cloudflare R2 bucket name (e.g. <Text style={{ fontWeight: "700" }}>my-company-backups</Text>).
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 20 }}>
                        <Text style={{ fontWeight: "700" }}>Step 2 — Endpoint URL (For R2 / MinIO):</Text> If using Cloudflare R2 or custom MinIO, enter your Endpoint URL (e.g. https://&lt;account-id&gt;.r2.cloudflarestorage.com). Leave empty for standard AWS S3.
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 20 }}>
                        <Text style={{ fontWeight: "700" }}>Step 3 — IAM Credentials:</Text> Enter your Access Key ID and Secret Access Key with write permissions to the bucket.
                      </Text>
                    </View>
                  )}

                  {cloudProvider === "webhook" && (
                    <View style={{ gap: 10 }}>
                      <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 20 }}>
                        <Text style={{ fontWeight: "700" }}>Step 1 — Webhook URL:</Text> Enter your HTTP POST endpoint URL (e.g. https://api.mycloud.com/upload-backup).
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 20 }}>
                        <Text style={{ fontWeight: "700" }}>Step 2 — Secret Header:</Text> Optional authorization key or Bearer token sent in headers.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={{ flexDirection: "row", gap: 10 }}>
                {[
                  { id: "gdrive", label: "☁️  Google Drive API" },
                  { id: "s3", label: "🪣  AWS S3 / Cloudflare R2" },
                  { id: "webhook", label: "🔗  Custom Webhook URL" },
                ].map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      if (!isCloudLocked) setCloudProvider(p.id as any);
                    }}
                    disabled={isCloudLocked}
                    style={[
                      {
                        flex: 1,
                        paddingVertical: 12,
                        paddingHorizontal: 8,
                        borderWidth: 1,
                        borderColor: colors.inputBorder,
                        borderRadius: 6,
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 46,
                        opacity: isCloudLocked ? 0.8 : 1
                      },
                      cloudProvider === p.id && { backgroundColor: colors.accentLight, borderColor: colors.accent }
                    ]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: cloudProvider === p.id ? colors.accent : colors.textPrimary, textAlign: "center" }}>
                      {p.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Provider-Specific Form Fields */}
            <View pointerEvents={isCloudLocked ? "none" : "auto"} style={{ opacity: isCloudLocked ? 0.75 : 1 }}>
              {cloudProvider === "gdrive" && (
                <View style={{ flexDirection: "row", gap: 16 }}>
                  <View style={{ flex: 1, gap: 8 }}>
                    <Text style={[styles.label, { color: colors.textSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }]}>GOOGLE DRIVE FOLDER ID</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { height: 44, fontSize: 14, color: colors.textPrimary, fontFamily: "Consolas", fontWeight: "500" },
                        isCloudLocked
                          ? { backgroundColor: "rgba(255, 255, 255, 0.03)", borderColor: "rgba(255, 255, 255, 0.1)" }
                          : { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }
                      ]}
                      value={gdriveFolderId}
                      onChangeText={(val) => { if (!isCloudLocked) setGdriveFolderId(val); }}
                      editable={!isCloudLocked}
                      readOnly={isCloudLocked}
                      selectTextOnFocus={!isCloudLocked}
                      placeholder="e.g. 1A2b3C4d5E6f7G8h9I0j"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 8 }}>
                    <Text style={[styles.label, { color: colors.textSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }]}>GOOGLE DRIVE ACCESS TOKEN / OAUTH TOKEN</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { height: 44, fontSize: 14, color: colors.textPrimary, fontFamily: "Consolas", fontWeight: "500" },
                        isCloudLocked
                          ? { backgroundColor: "rgba(255, 255, 255, 0.03)", borderColor: "rgba(255, 255, 255, 0.1)" }
                          : { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }
                      ]}
                      value={gdriveAccessToken}
                      onChangeText={(val) => { if (!isCloudLocked) setGdriveAccessToken(val); }}
                      editable={!isCloudLocked}
                      readOnly={isCloudLocked}
                      selectTextOnFocus={!isCloudLocked}
                      secureTextEntry
                      placeholder="ya29.a0Axoo..."
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                </View>
              )}

              {cloudProvider === "s3" && (
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: "row", gap: 16 }}>
                    <View style={{ flex: 1, gap: 8 }}>
                      <Text style={[styles.label, { color: colors.textSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }]}>S3 BUCKET NAME</Text>
                      <TextInput
                        style={[
                          styles.input,
                          { height: 44, fontSize: 14, color: colors.textPrimary, fontFamily: "Consolas", fontWeight: "500" },
                          isCloudLocked
                            ? { backgroundColor: "rgba(255, 255, 255, 0.03)", borderColor: "rgba(255, 255, 255, 0.1)" }
                            : { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }
                        ]}
                        value={s3Bucket}
                        onChangeText={(val) => { if (!isCloudLocked) setS3Bucket(val); }}
                        editable={!isCloudLocked}
                        readOnly={isCloudLocked}
                        selectTextOnFocus={!isCloudLocked}
                        placeholder="my-company-backups"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 8 }}>
                      <Text style={[styles.label, { color: colors.textSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }]}>ENDPOINT URL (FOR R2 / MINIO)</Text>
                      <TextInput
                        style={[
                          styles.input,
                          { height: 44, fontSize: 14, color: colors.textPrimary, fontFamily: "Consolas", fontWeight: "500" },
                          isCloudLocked
                            ? { backgroundColor: "rgba(255, 255, 255, 0.03)", borderColor: "rgba(255, 255, 255, 0.1)" }
                            : { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }
                        ]}
                        value={s3EndpointUrl}
                        onChangeText={(val) => { if (!isCloudLocked) setS3EndpointUrl(val); }}
                        editable={!isCloudLocked}
                        readOnly={isCloudLocked}
                        selectTextOnFocus={!isCloudLocked}
                        placeholder="https://<account-id>.r2.cloudflarestorage.com"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: 16 }}>
                    <View style={{ flex: 1, gap: 8 }}>
                      <Text style={[styles.label, { color: colors.textSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }]}>ACCESS KEY ID</Text>
                      <TextInput
                        style={[
                          styles.input,
                          { height: 44, fontSize: 14, color: colors.textPrimary, fontFamily: "Consolas", fontWeight: "500" },
                          isCloudLocked
                            ? { backgroundColor: "rgba(255, 255, 255, 0.03)", borderColor: "rgba(255, 255, 255, 0.1)" }
                            : { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }
                        ]}
                        value={s3AccessKey}
                        onChangeText={(val) => { if (!isCloudLocked) setS3AccessKey(val); }}
                        editable={!isCloudLocked}
                        readOnly={isCloudLocked}
                        selectTextOnFocus={!isCloudLocked}
                        placeholder="AKIAIOSFODNN7EXAMPLE"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 8 }}>
                      <Text style={[styles.label, { color: colors.textSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }]}>SECRET ACCESS KEY</Text>
                      <TextInput
                        style={[
                          styles.input,
                          { height: 44, fontSize: 14, color: colors.textPrimary, fontFamily: "Consolas", fontWeight: "500" },
                          isCloudLocked
                            ? { backgroundColor: "rgba(255, 255, 255, 0.03)", borderColor: "rgba(255, 255, 255, 0.1)" }
                            : { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }
                        ]}
                        value={s3SecretKey}
                        onChangeText={(val) => { if (!isCloudLocked) setS3SecretKey(val); }}
                        editable={!isCloudLocked}
                        readOnly={isCloudLocked}
                        selectTextOnFocus={!isCloudLocked}
                        secureTextEntry
                        placeholder="wJalrXUtnFEMI/K7MDENG..."
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  </View>
                </View>
              )}

              {cloudProvider === "webhook" && (
                <View style={{ flexDirection: "row", gap: 16 }}>
                  <View style={{ flex: 1, gap: 8 }}>
                    <Text style={[styles.label, { color: colors.textSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }]}>WEBHOOK UPLOAD URL</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { height: 44, fontSize: 14, color: colors.textPrimary, fontFamily: "Consolas", fontWeight: "500" },
                        isCloudLocked
                          ? { backgroundColor: "rgba(255, 255, 255, 0.03)", borderColor: "rgba(255, 255, 255, 0.1)" }
                          : { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }
                      ]}
                      value={webhookUrl}
                      onChangeText={(val) => { if (!isCloudLocked) setWebhookUrl(val); }}
                      editable={!isCloudLocked}
                      readOnly={isCloudLocked}
                      selectTextOnFocus={!isCloudLocked}
                      placeholder="https://api.mycloud.com/upload-backup"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 8 }}>
                    <Text style={[styles.label, { color: colors.textSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }]}>SECRET AUTH HEADER (OPTIONAL)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { height: 44, fontSize: 14, color: colors.textPrimary, fontFamily: "Consolas", fontWeight: "500" },
                        isCloudLocked
                          ? { backgroundColor: "rgba(255, 255, 255, 0.03)", borderColor: "rgba(255, 255, 255, 0.1)" }
                          : { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }
                      ]}
                      value={webhookSecret}
                      onChangeText={(val) => { if (!isCloudLocked) setWebhookSecret(val); }}
                      editable={!isCloudLocked}
                      readOnly={isCloudLocked}
                      selectTextOnFocus={!isCloudLocked}
                      secureTextEntry
                      placeholder="Secret key or Bearer token"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

    </ScrollView>
      </View >

    {/* ─── SEQUENCE CONFIG EDITOR MODAL ─── */}
    <Modal
      isOpen={isSeqModalOpen}
      onClose={() => setIsSeqModalOpen(false)}
      title={`Configure numbering: ${selectedSeq?.document_type || ""}`}
      width={500}
      scrollEnabled={false}
      footerActions={
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => setIsSeqModalOpen(false)}
            style={({ hovered }: any) => [
              { height: 32, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 4, paddingHorizontal: 16, justifyContent: "center" },
              hovered && { backgroundColor: colors.btnBg }
            ]}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSaveSequence}
            disabled={loading}
            style={({ hovered }: any) => [
              { height: 32, borderRadius: 4, backgroundColor: colors.accent, paddingHorizontal: 16, justifyContent: "center" },
              hovered && { opacity: 0.9 }
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {loading && <ActivityIndicator size="small" color="#FFF" style={{ width: 18, height: 18 }} />}
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#FFFFFF" }}>Save Changes</Text>
            </View>
          </Pressable>
        </View>
      }
    >
      <View style={{ gap: 14, minHeight: 280 }}>
        {/* Preview Panel */}
        <View style={{ padding: 12, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 6, backgroundColor: colors.inputBg }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.5, marginBottom: 4 }}>FORMAT PREVIEW</Text>
          <Text style={{ fontFamily: "Consolas", fontWeight: "900", fontSize: 20, color: colors.accent }}>
            {`${seqPrefix}${String(seqNextValue || "1").padStart(parseInt(seqPadding) || 4, "0")}${seqSuffix}`}
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Prefix Code</Text>
            <TextInput
              value={seqPrefix}
              onChangeText={setSeqPrefix}
              placeholder="e.g. INV/"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Suffix Code</Text>
            <TextInput
              value={seqSuffix}
              onChangeText={setSeqSuffix}
              placeholder="e.g. /2026"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
            />
          </View>
        </View>

        <View>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Padding Length *</Text>
          <TextInput
            value={seqPadding}
            onChangeText={setSeqPadding}
            placeholder="4"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
          />
        </View>

        <Toggle
          value={seqIsActive}
          onChange={setSeqIsActive}
          label="Sequence Status"
          onLabel="Enabled / Active"
          offLabel="Disabled / Frozen"
        />
      </View>
    </Modal>

    {/* ─── NEW FINANCIAL YEAR CREATION MODAL ─── */}
    <FullScreenModal
      isOpen={isNewFyModalOpen}
      onClose={() => setIsNewFyModalOpen(false)}
      title="Create New Financial Year"
      subtitle="Define a new financial cycle period for company billing, ledger calculations, and taxation compliance."
      breadcrumb="SYSTEM / CONFIGURATION / SETTINGS"
      scrollEnabled={true}
      footerActions={
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button
            title="Cancel"
            onPress={() => setIsNewFyModalOpen(false)}
            variant="secondary"
            size="large"
            style={{ minWidth: 100 }}
          />
          <Button
            title="Create Year"
            onPress={handleCreateFiscalYear}
            variant="primary"
            size="large"
            loading={loading}
            loadingText="Creating Year..."
            style={{ minWidth: 140 }}
          />
        </View>
      }
    >
      <View style={{ maxWidth: 600, alignSelf: "center", width: "100%", gap: 16, marginTop: 12 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.textSecondary }}>LABEL (e.g. FY 2026-27)</Text>
          <TextInput
            value={newFyLabel}
            onChangeText={setNewFyLabel}
            placeholder="e.g. FY 2026-27"
            placeholderTextColor={colors.textSecondary}
            style={{
              height: 36,
              borderWidth: 1,
              borderColor: colors.inputBorder,
              borderRadius: 4,
              paddingHorizontal: 10,
              backgroundColor: colors.inputBg,
              color: colors.textPrimary,
              fontFamily: "Segoe UI Variable Text",
              fontSize: 14
            }}
          />
        </View>

        <DatePicker
          value={newFyStart}
          onChange={setNewFyStart}
          label="START DATE (Must be April 1st)"
        />

        <DatePicker
          value={newFyEnd}
          onChange={setNewFyEnd}
          label="END DATE (Must be March 31st)"
        />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <View style={{ flex: 1, marginRight: 16 }}>
            <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>Set Active Immediately</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Make this the default active accounting year for all new invoices and payments.</Text>
          </View>
          <Toggle
            value={newFyActive}
            onChange={setNewFyActive}
            label=""
          />
        </View>
      </View>
    </FullScreenModal>

    {/* ─── YEAR-END CLOSING COMPLIANCE WIZARD MODAL ─── */}
    <FullScreenModal
      isOpen={isCloseFyWizardOpen}
      onClose={() => setIsCloseFyWizardOpen(false)}
      title={`Year-End Closing Wizard — ${fyToClose?.label || ""}`}
      subtitle="Lock current books, reconcile balances, and calibrate sequence numbers for the upcoming fiscal cycle."
      breadcrumb="SYSTEM / CONFIGURATION / SETTINGS"
      scrollEnabled={true}
      footerActions={
        <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: "700", fontFamily: "Segoe UI Variable Text", letterSpacing: 0.5 }}>
            STEP {closingStep} OF 4
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              title="Cancel"
              onPress={() => setIsCloseFyWizardOpen(false)}
                variant="secondary"
                size="large"
                style={{ minWidth: 100 }}
              />
              
              {closingStep < 4 ? (
                <Button
                  title="Next Step ➔"
                  onPress={handleNextClosingStep}
                  disabled={closingStep === 1 && !auditCanProceed}
                  variant="primary"
                  size="large"
                  style={{ minWidth: 130 }}
                />
              ) : (
                <Button
                  title="🔒 Lock & Close Year"
                  onPress={executeCloseFiscalYear}
                  loading={loading}
                  loadingText="Locking Year..."
                  variant="danger"
                  size="large"
                  style={{ minWidth: 180 }}
                />
              )}
            </View>
          </View>
        }
      >
  <View style={{ maxWidth: 650, alignSelf: "center", width: "100%", gap: 16, marginTop: 12 }}>
    {closingStep === 1 && (
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>Step 1: Pre-Closing Compliance Audit</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary }}>
          The compliance engine scans database sequences, subsidiary ledgers, and inventory valuations to ensure standard audit alignment before closure.
        </Text>

        {auditLoading ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: 13 }}>Analyzing ledger entries...</Text>
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: 8 }}>
            {auditResults.map((item, idx) => {
              const isSuccess = item.status === "SUCCESS";
              const isWarning = item.status === "WARNING";
              return (
                <View key={idx} style={{ flexDirection: "row", padding: 10, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 6, backgroundColor: colors.inputBg, alignItems: "center" }}>
                  <Text style={{
                    fontFamily: "Segoe MDL2 Assets",
                    fontSize: 16,
                    color: isSuccess ? colors.success : isWarning ? "#F59E0B" : colors.error,
                    marginRight: 12
                  }}>
                    {isSuccess ? "\uE8FB" : isWarning ? "\uE7BA" : "\uE711"}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>{item.label}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{item.description}</Text>
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: isSuccess ? colors.success : isWarning ? "#F59E0B" : colors.error }}>
                    {item.status}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    )}

    {closingStep === 2 && (
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>Step 2: Trial Balance & Income Carryforward</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary }}>
          Verify estimated closing figures. Marking this year as closed will write a Closing Journal Entry transferring net profit/loss to Retained Earnings (Equity) and resetting Revenue/Expense balances to zero.
        </Text>

        {balancesLoading ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : closingBalances ? (
          <View style={{ gap: 12, marginTop: 10 }}>
            <View style={{ padding: 16, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 8, backgroundColor: "rgba(34, 197, 94, 0.05)" }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.success, letterSpacing: 0.5 }}>ESTIMATED NET PROFIT FOR CARRYFORWARD</Text>
              <Text style={{ fontSize: 24, fontWeight: "800", color: colors.success, marginTop: 4 }}>
                ₹ {closingBalances.net_profit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>This balance will credit Retained Earnings (Equity Code 3002) on March 31st.</Text>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1, padding: 12, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 6, backgroundColor: colors.inputBg }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary }}>LIQUID ASSETS</Text>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginTop: 4 }}>
                  ₹ {closingBalances.liquid_assets.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{ flex: 1, padding: 12, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 6, backgroundColor: colors.inputBg }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary }}>ACCOUNTS RECEIVABLE</Text>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginTop: 4 }}>
                  ₹ {closingBalances.accounts_receivable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    )}

    {closingStep === 3 && (
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>Step 3: Document Sequence Calibration</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary }}>
          The wizard proposes resetting sequential counters back to 0001 under new prefixes (incorporating the next financial year) to keep documents legally consecutive.
        </Text>

        {calibLoading ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: 8 }}>
            {seqCalibration.map((item, idx) => (
              <View key={idx} style={{ padding: 10, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 6, backgroundColor: colors.inputBg, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>{item.document_type}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Current: {item.current_pattern}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: colors.accent }}>Proposed Pattern</Text>
                  <Text style={{ fontSize: 12, fontWeight: "700", fontFamily: "Consolas", color: colors.accent }}>{item.proposed_pattern}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    )}

    {closingStep === 4 && (
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>Step 4: Lock Period & Post Closing Entry</Text>

        <View style={{ padding: 12, borderWidth: 1, borderColor: "rgba(239, 68, 68, 0.2)", borderRadius: 6, backgroundColor: "rgba(239, 68, 68, 0.05)", gap: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: colors.error }}>⚠️ CRITICAL AUDIT NOTICE</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            Locking this fiscal year is a permanent action. All vouchers, ledger entries, and invoices posted between {fyToClose?.start_date.split("-").reverse().join("/")} and {fyToClose?.end_date.split("-").reverse().join("/")} will be locked against editing, cancellation, or deletion.
          </Text>
        </View>

        <View style={{ gap: 4, marginTop: 10 }}>
          <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.textSecondary }}>CLOSING MEMO & NOTES</Text>
          <TextInput
            value={closingNotes}
            onChangeText={setClosingNotes}
            placeholder="e.g. Audited by [Auditor Name] - books closed successfully."
            placeholderTextColor={colors.textSecondary}
            multiline
            style={{
              height: 80,
              borderWidth: 1,
              borderColor: colors.inputBorder,
              borderRadius: 4,
              padding: 10,
              backgroundColor: colors.inputBg,
              color: colors.textPrimary,
              fontFamily: "Segoe UI Variable Text",
              fontSize: 13.5,
              textAlignVertical: "top"
            }}
          />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 6, backgroundColor: colors.inputBg, marginTop: 10 }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>Backup Database</Text>
            <Text style={{ fontSize: 11.5, color: colors.textSecondary }}>Create a complete PostgreSQL logical backup (*.bak) before locking.</Text>
          </View>
          <Toggle
            value={backupBeforeClose}
            onValueChange={setBackupBeforeClose}
          />
        </View>
      </View>
    )}
      </View>
    </FullScreenModal>
      <ModuleHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        initialCategory={helpModalCategory}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBlock: {
    padding: 24,
    paddingBottom: 0,
    gap: 4,
  },
  breadcrumb: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    fontFamily: "Segoe UI Variable Text",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Segoe UI Variable Text",
    marginTop: 2,
  },
  alertBar: {
    marginHorizontal: 24,
    marginTop: 12,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  alertText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  contentContainer: {
    flex: 1,
    flexDirection: "row",
    padding: 24,
    gap: 20,
  },
  tabSelector: {
    width: 240,
    borderRightWidth: 1,
    paddingRight: 12,
    gap: 8,
  },
  tabBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  tabBtnText: {
    fontSize: 15.5,
    fontWeight: "500",
    fontFamily: "Segoe UI Variable Text",
  },
  formPanel: {
    flex: 1,
  },
  formScrollContent: {
    paddingRight: 16,
    paddingBottom: 36,
  },
  tabWrapper: {
    gap: 20,
  },
  card: {
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 19.5,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
    marginBottom: 4,
  },
  cardSubTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14.5,
    fontFamily: "Segoe UI Variable Text",
    marginBottom: 16,
  },
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  inputField: {
    flex: 1,
    minWidth: 240,
    gap: 6,
  },
  label: {
    fontSize: 14.5,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 15,
    fontFamily: "Segoe UI Variable Text",
    marginBottom: 20,
  },
  gridRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 14,
  },
  gridCol: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 14.5,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 6,
    height: 44,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    lineHeight: 20,
    textAlignVertical: "center",
    fontSize: 15.5,
    fontFamily: "Segoe UI Variable Text",
  },
  inputWithAction: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  verifyBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  verifyBtnText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  addressInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 15.5,
    fontFamily: "Segoe UI Variable Text",
  },
  saveBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  saveBtnText: {
    fontSize: 15.5,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 16,
  },
  btnText: {
    fontSize: 15.5,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  dangerBtn: {
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 16,
  },
  dangerBtnText: {
    fontSize: 15.5,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  pinForm: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(148, 163, 184, 0.15)",
    paddingTop: 16,
  },
  diagnosticRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.08)",
  },
  diagLabel: {
    fontSize: 15,
    fontWeight: "500",
    fontFamily: "Segoe UI Variable Text",
  },
  diagValue: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
});
