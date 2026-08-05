// =============================================================
// JK INFOTECH ERP — Reusable PDF Print Preview Modal Component
// File : src/components/ui/PdfPreviewModal.tsx
// Architecture: Tally ERP + Adobe Acrobat pattern
//   Native XAML ScrollViewer (ZoomMode::Enabled) handles ALL
//   zoom/pan/scroll — zero React state involved during gesture.
// =============================================================

import React, { useEffect, useRef, useState } from "react";
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
  Image,
} from "react-native";
import { useUIStore } from "../../store/uiStore";
import apiClient from "../../api/client";
import { storage } from "../../utils/storage";
import { FullScreenModal } from "./FullScreenModal";
import { Button } from "./Button";
import { ShareReportModal } from "./ShareReportModal";
import { PrinterIcon } from "./Icons";
import NativePdfScrollViewer, { PdfScrollViewerHandle } from "./NativePdfScrollViewer";

interface CenteredSearchBarProps {
  value: string;
  onChange: (val: string) => void;
  isSearching: boolean;
  totalMatches: number;
  currentMatchIndex: number;
  handlePrevMatch: () => void;
  handleNextMatch: () => void;
  isDarkMode: boolean;
  C: any;
}

const CenteredSearchBar = React.memo(({
  value,
  onChange,
  isSearching,
  totalMatches,
  currentMatchIndex,
  handlePrevMatch,
  handleNextMatch,
  isDarkMode,
  C
}: CenteredSearchBarProps) => {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      onChange(localVal);
    }, 280);
    return () => clearTimeout(handler);
  }, [localVal]);

  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      width: 360,
      backgroundColor: isDarkMode ? "#1E293B" : "#F1F5F9",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.divider,
      paddingHorizontal: 10,
      height: 38,
      marginRight: 60
    }}>
      {isSearching ? (
        <ActivityIndicator size="small" color={C.accent} style={{ marginRight: 8 }} />
      ) : (
        <Text style={{ fontFamily: "Segoe MDL2 Assets", fontSize: 13, color: C.textSecondary, marginRight: 8 }}>
          {"\uE721"}
        </Text>
      )}
      <TextInput
        style={{
          flex: 1,
          fontSize: 14.5,
          color: C.textPrimary,
          paddingVertical: 4,
          fontFamily: "Segoe UI Variable Text"
        }}
        value={localVal}
        onChangeText={setLocalVal}
        placeholder="Search text in document..."
        placeholderTextColor={C.textSecondary}
      />
      {totalMatches > 0 ? (
        <Text style={{ color: C.textSecondary, fontSize: 13, marginRight: 10, fontFamily: "Segoe UI Variable Text" }}>
          {currentMatchIndex} of {totalMatches}
        </Text>
      ) : (
        localVal && !isSearching ? (
          <Text style={{ color: "#EF4444", fontSize: 13, marginRight: 10, fontFamily: "Segoe UI Variable Text" }}>
            No matches
          </Text>
        ) : null
      )}
      {totalMatches > 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginRight: 6 }}>
          <Pressable
            onPress={handlePrevMatch}
            style={({ hovered }: any) => [
              {
                width: 28,
                height: 28,
                borderRadius: 4,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: hovered ? (isDarkMode ? "#334155" : "#E2E8F0") : "transparent"
              }
            ]}
          >
            <Text style={{ fontFamily: "Segoe MDL2 Assets", fontSize: 11, color: C.textPrimary }}>
              {"\uE70E"}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleNextMatch}
            style={({ hovered }: any) => [
              {
                width: 28,
                height: 28,
                borderRadius: 4,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: hovered ? (isDarkMode ? "#334155" : "#E2E8F0") : "transparent"
              }
            ]}
          >
            <Text style={{ fontFamily: "Segoe MDL2 Assets", fontSize: 11, color: C.textPrimary }}>
              {"\uE70D"}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {localVal ? (
        <Pressable
          onPress={() => setLocalVal("")}
          style={({ hovered }: any) => [
            {
              width: 24,
              height: 24,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: hovered ? (isDarkMode ? "#334155" : "#E2E8F0") : "transparent"
            }
          ]}
        >
          <Text style={{ fontFamily: "Segoe MDL2 Assets", fontSize: 10, color: C.textSecondary, fontWeight: "bold" }}>
            {"\uE711"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
});

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  documentTitle?: string;
  subtitle?: string;
  breadcrumb?: string;
  reportKey?: string;
  layout?: string;
  defaultOrientation?: 'portrait' | 'landscape';
  getPdfUrl?: (orientation: 'portrait' | 'landscape', search: string, theme: string, copyType: string) => string;
  getExcelUrl?: () => string;
  showThemeSelector?: boolean;
  showCopySelector?: boolean;
  pdfBase64?: string;
}

export function PdfPreviewModal({
  isOpen,
  onClose,
  title,
  documentTitle,
  subtitle,
  breadcrumb,
  reportKey = "document",
  layout,
  defaultOrientation,
  getPdfUrl,
  getExcelUrl,
  showThemeSelector = false,
  showCopySelector = false
}: PdfPreviewModalProps) {
  const displayTitle = title || documentTitle || "Document Preview";
  const { isDarkMode } = useUIStore();

  const colors = isDarkMode
    ? {
      bg: "#0F172A",
      card: "#1E293B",
      border: "#334155",
      textPrimary: "#F8FAFC",
      textSecondary: "#94A3B8",
      accent: "#38BDF8",
      divider: "#334155",
    }
    : {
      bg: "#F8FAFC",
      card: "#FFFFFF",
      border: "#E2E8F0",
      textPrimary: "#0F172A",
      textSecondary: "#64748B",
      accent: "#0284C7",
      divider: "#E2E8F0",
    };

  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [zoomScale, setZoomScale] = useState(1.0);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const isLandscapeReportDef = [
    "gstr1", "gstr2", "gstr3b", "gstr1_summary", "gstr2_summary",
    "daybook", "trial_balance", "cdn_register", "stock_valuation",
    "sales_by_customer", "sales_by_item", "account_ledger", "ledger",
    "party_ledger", "audit_trail", "item_movement", "outstanding",
    "outstanding_summary", "low_stock", "gst_summary"
  ].includes(reportKey);
  const initialDefaultOrient = defaultOrientation || (isLandscapeReportDef ? 'landscape' : 'portrait');
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>(initialDefaultOrient);
  const [printTheme, setPrintTheme] = useState("classic");
  const [printCopyType, setPrintCopyType] = useState("original");
  const [printCopies, setPrintCopies] = useState(1);
  const [pageSelection, setPageSelection] = useState<'all' | 'range'>('all');
  const [pageRange, setPageRange] = useState('1');
  const [pdfSearchQuery, setPdfSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const scrollViewRef = useRef<ScrollView>(null);

  const findPageForMatchIndex = (matchIdx: number, matches: number[]) => {
    let acc = 0;
    for (let i = 0; i < matches.length; i++) {
      acc += matches[i];
      if (matchIdx <= acc) {
        return i;
      }
    }
    return 0;
  };

  const isThermalSticker = reportKey === "barcode_labels" && layout?.startsWith("thermal_");
  let baseWidth = printOrientation === 'landscape' ? 1018 : 720;
  let baseHeight = printOrientation === 'landscape' ? 720 : 1018;

  if (isThermalSticker) {
    if (layout === "thermal_50x25_2up") {
      baseWidth = printOrientation === 'landscape' ? 700 : 175;
      baseHeight = printOrientation === 'landscape' ? 175 : 700;
    } else if (layout === "thermal_38x25") {
      baseWidth = printOrientation === 'landscape' ? 426 : 280;
      baseHeight = printOrientation === 'landscape' ? 280 : 426;
    } else {
      baseWidth = printOrientation === 'landscape' ? 560 : 280;
      baseHeight = printOrientation === 'landscape' ? 280 : 560;
    }
  }

  const totalMatches = searchMatches.reduce((a, b) => a + b, 0);

  const handleNextMatch = () => {
    if (totalMatches === 0) return;
    const nextIdx = currentMatchIndex >= totalMatches ? 1 : currentMatchIndex + 1;
    setCurrentMatchIndex(nextIdx);
  };
  const handlePrevMatch = () => {
    if (totalMatches === 0) return;
    const prevIdx = currentMatchIndex <= 1 ? totalMatches : currentMatchIndex - 1;
    setCurrentMatchIndex(prevIdx);
  };

  // ── Native PDF Viewer ref (for imperative zoom commands) ────────────────
  const pdfViewerRef = useRef<PdfScrollViewerHandle>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);

  const regeneratePreview = async (
    orientation: string = printOrientation,
    theme: string = printTheme,
    copyType: string = printCopyType
  ) => {
    if (!isOpen) return;
    setIsPdfLoading(true);
    try {
      const { PdfRenderer: pdfModule } = NativeModules;
      if (!pdfModule || !pdfModule.RenderPdfWithToken) {
        throw new Error("Native PdfRenderer.RenderPdfWithToken module not registered in Windows project");
      }

      if (!getPdfUrl) {
        setIsPdfLoading(false);
        return;
      }

      let url = getPdfUrl(orientation as any, "", theme, copyType);
      if (url.includes("/api/") && !url.includes("/api/v1/")) {
        url = url.replace("/api/", "/api/v1/");
      }
      const token = storage.getItemSync("access_token") || "";

      const pages = await pdfModule.RenderPdfWithToken(url, reportKey + "_" + orientation, token);
      setPreviewPages(pages);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to regenerate PDF preview.");
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Reset states and trigger first preview load when opening
  useEffect(() => {
    if (isOpen) {
      const isLandscapeReport = [
        "gstr1", "gstr2", "gstr3b", "gstr1_summary", "gstr2_summary",
        "daybook", "trial_balance", "cdn_register", "stock_valuation",
        "sales_by_customer", "sales_by_item", "account_ledger", "ledger",
        "party_ledger", "audit_trail", "item_movement", "outstanding",
        "outstanding_summary", "low_stock", "gst_summary"
      ].includes(reportKey);
      const initialOrientation = defaultOrientation || (isLandscapeReport ? "landscape" : "portrait");
      setPrintOrientation(initialOrientation);
      setPrintCopies(1);
      setPageSelection("all");
      setPageRange("1");
      setPdfSearchQuery("");
      setSearchMatches([]);
      setCurrentMatchIndex(0);
      // Read saved preferences and load
      const initLoad = async () => {
        let defaultTheme = "modern";
        let defaultCopy = "original";
        try {
          if (showThemeSelector) {
            const savedTheme = await storage.getItem("jk_print_theme_pref");
            if (savedTheme !== null) {
              setPrintTheme(savedTheme);
              defaultTheme = savedTheme;
            }
          }
          if (showCopySelector) {
            const savedCopy = await storage.getItem("jk_print_copy_pref");
            if (savedCopy !== null) {
              setPrintCopyType(savedCopy);
              defaultCopy = savedCopy;
            }
          }
        } catch (e) {
          console.warn("Error reading print preferences:", e);
        }
        regeneratePreview(initialOrientation, defaultTheme, defaultCopy);
      };
      initLoad();
    } else {
      setPreviewPages([]);
    }
  }, [isOpen, reportKey, showThemeSelector, showCopySelector]);

  // Lightweight search matching without reloading base PDF page bitmaps (Adobe Acrobat pattern)
  useEffect(() => {
    if (!isOpen || !getPdfUrl) return;
    if (!pdfSearchQuery.trim()) {
      setSearchMatches([]);
      setCurrentMatchIndex(0);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const url = getPdfUrl(printOrientation as any, pdfSearchQuery, printTheme, printCopyType);
    const token = storage.getItemSync("access_token") || "";

    const timer = setTimeout(() => {
      fetch(url, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
      })
        .then((res) => {
          const matchHeader = res.headers.get("x-pdf-search-matches");
          if (matchHeader) {
            const counts: number[] = JSON.parse(matchHeader);
            setSearchMatches(counts);
            const total = counts.reduce((a, b) => a + b, 0);
            setCurrentMatchIndex(total > 0 ? 1 : 0);
          } else {
            setSearchMatches([]);
            setCurrentMatchIndex(0);
          }
        })
        .catch((err) => console.warn("Failed to fetch search match headers:", err))
        .finally(() => setIsSearching(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [isOpen, pdfSearchQuery, printOrientation, printTheme, printCopyType]);

  // Trigger preview regeneration ONLY when document structure updates (Orientation, Theme, Copy Type)
  useEffect(() => {
    if (!isOpen) return;
    regeneratePreview(printOrientation, printTheme, printCopyType);
  }, [printOrientation, printTheme, printCopyType]);

  return (
    <FullScreenModal
      isOpen={isOpen}
      onClose={onClose}
      title={displayTitle}
      subtitle={subtitle}
      breadcrumb={breadcrumb}
      scrollEnabled={false}
      headerActions={
        <CenteredSearchBar
          value={pdfSearchQuery}
          onChange={setPdfSearchQuery}
          isSearching={isSearching}
          totalMatches={totalMatches}
          currentMatchIndex={currentMatchIndex}
          handlePrevMatch={handlePrevMatch}
          handleNextMatch={handleNextMatch}
          isDarkMode={isDarkMode}
          C={colors}
        />
      }
      footerActions={
        <View style={{ flexDirection: "row", gap: 10, flex: 1, justifyContent: "space-between", alignItems: "center" }}>
          {/* Zoom Controls — dispatch to native XAML ScrollViewer (Tally pattern) */}
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Button
              onPress={() => pdfViewerRef.current?.zoomOut()}
              variant="secondary"
              style={{ minWidth: 42, paddingHorizontal: 0, height: 42, borderColor: colors.divider }}
            >
              <Text style={{ fontSize: 18, color: colors.textPrimary }}>-</Text>
            </Button>
            <Text style={{ fontSize: 14.5, color: colors.textSecondary, fontFamily: "Segoe UI Variable Text", width: 50, textAlign: "center" }}>
              {zoomPercent}%
            </Text>
            <Button
              onPress={() => pdfViewerRef.current?.zoomIn()}
              variant="secondary"
              style={{ minWidth: 42, paddingHorizontal: 0, height: 42, borderColor: colors.divider }}
            >
              <Text style={{ fontSize: 18, color: colors.textPrimary }}>+</Text>
            </Button>

            <View style={{ width: 1, height: 24, backgroundColor: colors.divider, marginLeft: 8, marginRight: 8 }} />

            <Button
              title="Fit Width"
              onPress={() => pdfViewerRef.current?.setZoom(1.35)}
              variant="secondary"
              style={{ height: 42, borderColor: colors.divider, paddingHorizontal: 12 }}
            />
            <Button
              title="Fit Page"
              onPress={() => pdfViewerRef.current?.setZoom(0.75)}
              variant="secondary"
              style={{ height: 42, borderColor: colors.divider, paddingHorizontal: 12 }}
            />
            <Button
              title="Reset"
              onPress={() => pdfViewerRef.current?.resetZoom()}
              variant="secondary"
              style={{ height: 42, borderColor: colors.divider, paddingHorizontal: 12 }}
            />
          </View>

          {/* Actions */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              title="Close"
              onPress={onClose}
              variant="secondary"
              style={{ minWidth: 110 }}
            />

            {getExcelUrl && (
              <Button
                title="Save Excel"
                icon={
                  <Image
                    source={require("../excel_icon_for_print_preview.png")}
                    style={{ width: 18, height: 18 }}
                    resizeMode="contain"
                  />
                }
                onPress={async () => {
                  try {
                    const { PdfRenderer: pdfModule } = NativeModules;
                    if (!pdfModule || !pdfModule.SaveFileWithToken) {
                      throw new Error("SaveFileWithToken method not found in native PdfRenderer module");
                    }
                    const excelUrl = getExcelUrl ? getExcelUrl() : "";
                    const safeTitle = title || documentTitle || "document";
                    const suggestedName = `${safeTitle.replace(/[\/\s]/g, "_")}`;
                    const token = storage.getItemSync("access_token") || "";
                    await pdfModule.SaveFileWithToken(excelUrl, suggestedName, "Excel Spreadsheet", ".xlsx", token);
                    Alert.alert("Success", "Excel file has been saved.");
                  } catch (e: any) {
                    Alert.alert("Error", `Could not save Excel: ${e?.message || e}`);
                  }
                }}
                variant="secondary"
                style={{ borderColor: "#166534", minWidth: 130 }}
                textStyle={{ color: "#166534" }}
              />
            )}

            <Button
              title="Save PDF"
              icon={
                <Image
                  source={require("../save_pdf_for_print_preview.png")}
                  style={{ width: 18, height: 18 }}
                  resizeMode="contain"
                />
              }
              onPress={async () => {
                try {
                  const { PdfRenderer: pdfModule } = NativeModules;
                  if (!pdfModule || !pdfModule.SavePdfFileWithToken) {
                    throw new Error("SavePdfFileWithToken method not found in native PdfRenderer module");
                  }
                  if (!getPdfUrl) return;
                  const downloadUrl = getPdfUrl(printOrientation, pdfSearchQuery, printTheme, printCopyType);
                  const safeTitle = title || documentTitle || "document";
                  const suggestedName = `${safeTitle.replace(/[\/\s]/g, "_")}`;
                  const token = storage.getItemSync("access_token") || "";
                  await pdfModule.SavePdfFileWithToken(downloadUrl, suggestedName, token);
                } catch (e: any) {
                  Alert.alert("Error", `Could not save PDF: ${e?.message || e}`);
                }
              }}
              variant="secondary"
              style={{ borderColor: colors.accent, minWidth: 130 }}
              textStyle={{ color: colors.accent }}
            />

            <Button
              title="Send to CA / Share"
              onPress={() => setIsShareModalOpen(true)}
              variant="secondary"
              textStyle={{ color: colors.accent }}
            />

            <Button
              title="Print"
              icon={
                <Image
                  source={require("../print_icon_for_print_preview.png")}
                  style={{ width: 18, height: 18 }}
                  resizeMode="contain"
                />
              }
              onPress={async () => {
                try {
                  const { PdfRenderer: pdfModule } = NativeModules;
                  if (!pdfModule) {
                    throw new Error("Native PdfRenderer module not registered");
                  }
                  if (!getPdfUrl) return;
                  const printUrl = getPdfUrl(printOrientation, pdfSearchQuery, printTheme, printCopyType);
                  const token = storage.getItemSync("access_token") || "";
                  if (pdfModule.DirectPrintPdfWithToken) {
                    await pdfModule.DirectPrintPdfWithToken(printUrl, token);
                  } else if (pdfModule.PrintPdfUrlWithToken) {
                    await pdfModule.PrintPdfUrlWithToken(printUrl, token);
                  }
                } catch (e: any) {
                  Alert.alert("Error", `Could not print: ${e?.message || e}`);
                }
              }}
              variant="primary"
              style={{ minWidth: 120 }}
            />
          </View>
        </View>
      }
    >
      <View style={{ flexDirection: "row", flex: 1, padding: 20 }}>
        {/* Left Settings Sidebar */}
        <View style={{ width: 295, borderRightWidth: 1, borderRightColor: colors.divider, paddingRight: 10 }}>
          <ScrollView showsVerticalScrollIndicator={true} style={{ flex: 1 }} contentContainerStyle={{ gap: 16, paddingRight: 18 }}>

            {/* Theme Selector */}
            {showThemeSelector && (
              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: 8 }]}>PRINT THEME</Text>
                <View style={{ gap: 6 }}>
                  {[
                    { label: "Theme 1 (Modern)", value: "modern" },
                    { label: "Theme 2 (Classic)", value: "classic" }
                  ].map((t) => {
                    const isSelected = printTheme === t.value;
                    return (
                      <Pressable
                        key={t.value}
                        onPress={() => {
                          setPrintTheme(t.value);
                          storage.setItem("jk_print_theme_pref", t.value);
                        }}
                        style={({ hovered }: any) => [
                          {
                            padding: 10,
                            borderWidth: 1,
                            borderRadius: 6,
                            borderColor: isSelected ? colors.accent : colors.divider,
                            backgroundColor: isSelected
                              ? (isDarkMode ? "#0F2E4A" : "#E0F2FE")
                              : (hovered ? colors.divider : "transparent"),
                          }
                        ]}
                      >
                        <Text style={{ fontSize: 14.5, fontWeight: "600", color: isSelected ? colors.accent : colors.textPrimary, fontFamily: "Segoe UI Variable Text" }}>
                          {t.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Copy Selector */}
            {showCopySelector && (
              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: 8 }]}>COPY OPTION</Text>
                <View style={{ gap: 6 }}>
                  {[
                    { label: "Original Copy", value: "original" },
                    { label: "Duplicate Copy", value: "duplicate" },
                    { label: "Original & Duplicate Both", value: "both" }
                  ].map((c) => {
                    const isSelected = printCopyType === c.value;
                    return (
                      <Pressable
                        key={c.value}
                        onPress={() => {
                          setPrintCopyType(c.value);
                          storage.setItem("jk_print_copy_pref", c.value);
                        }}
                        style={({ hovered }: any) => [
                          {
                            padding: 10,
                            borderWidth: 1,
                            borderRadius: 6,
                            borderColor: isSelected ? colors.accent : colors.divider,
                            backgroundColor: isSelected
                              ? (isDarkMode ? "#0F2E4A" : "#E0F2FE")
                              : (hovered ? colors.divider : "transparent"),
                          }
                        ]}
                      >
                        <Text style={{ fontSize: 14.5, fontWeight: "600", color: isSelected ? colors.accent : colors.textPrimary, fontFamily: "Segoe UI Variable Text" }}>
                          {c.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Page Orientation */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: 8 }]}>ORIENTATION</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[
                  { label: "Portrait", value: "portrait" },
                  { label: "Landscape", value: "landscape" }
                ].map((o) => {
                  const isSelected = printOrientation === o.value;
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => {
                        const newOrient = o.value as 'portrait' | 'landscape';
                        setPrintOrientation(newOrient);
                        regeneratePreview(newOrient, printTheme, printCopyType);
                      }}
                      style={({ hovered }: any) => [
                        {
                          flex: 1,
                          padding: 8,
                          borderWidth: 1,
                          borderRadius: 6,
                          alignItems: "center",
                          borderColor: isSelected ? colors.accent : colors.divider,
                          backgroundColor: isSelected
                            ? (isDarkMode ? "#0F2E4A" : "#E0F2FE")
                            : (hovered ? colors.divider : "transparent"),
                        }
                      ]}
                    >
                      <Text style={{ fontSize: 13.5, fontWeight: "600", color: isSelected ? colors.accent : colors.textPrimary, fontFamily: "Segoe UI Variable Text" }}>
                        {o.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Pages Selection */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: 8 }]}>PAGES TO PRINT</Text>
              <View style={{ gap: 6 }}>
                {[
                  { label: "All Pages", value: "all" },
                  { label: "Custom Range", value: "range" }
                ].map((p) => {
                  const isSelected = pageSelection === p.value;
                  return (
                    <Pressable
                      key={p.value}
                      onPress={() => setPageSelection(p.value as any)}
                      style={({ hovered }: any) => [
                        {
                          padding: 8,
                          borderWidth: 1,
                          borderRadius: 6,
                          borderColor: isSelected ? colors.accent : colors.divider,
                          backgroundColor: isSelected
                            ? (isDarkMode ? "#0F2E4A" : "#E0F2FE")
                            : (hovered ? colors.divider : "transparent"),
                        }
                      ]}
                    >
                      <Text style={{ fontSize: 13.5, fontWeight: "600", color: isSelected ? colors.accent : colors.textPrimary, fontFamily: "Segoe UI Variable Text" }}>
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {pageSelection === "range" && (
                <TextInput
                  style={[styles.textInputUWP, { backgroundColor: colors.divider, borderColor: colors.divider, color: colors.textPrimary, marginTop: 6, paddingVertical: 4, height: 32 }]}
                  value={pageRange}
                  onChangeText={setPageRange}
                  placeholder="e.g. 1-2, 4"
                  placeholderTextColor={colors.textSecondary}
                />
              )}
            </View>

            {/* Copy Count (Copies) */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: 8 }]}>COPIES</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Button
                  onPress={() => setPrintCopies(c => Math.max(1, c - 1))}
                  variant="secondary"
                  style={{ minWidth: 36, height: 36, paddingHorizontal: 0, borderColor: colors.divider }}
                >
                  <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.textPrimary }}>-</Text>
                </Button>
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textPrimary, width: 30, textAlign: "center", fontFamily: "Segoe UI Variable Text" }}>
                  {printCopies}
                </Text>
                <Button
                  onPress={() => setPrintCopies(c => Math.min(99, c + 1))}
                  variant="secondary"
                  style={{ minWidth: 36, height: 36, paddingHorizontal: 0, borderColor: colors.divider }}
                >
                  <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.textPrimary }}>+</Text>
                </Button>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Right Preview Workspace — Native XAML ScrollViewer (Tally + Acrobat pattern) */}
        <View style={{ flex: 1, backgroundColor: isDarkMode ? "#0B0F19" : "#F3F4F6" }}>
          {isPdfLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={{ fontSize: 15, color: colors.textSecondary, fontFamily: "Segoe UI Variable Text", marginTop: 8 }}>Loading print preview...</Text>
            </View>
          ) : (
            <NativePdfScrollViewer
              ref={pdfViewerRef}
              pages={previewPages}
              pageWidth={baseWidth}
              pageHeight={baseHeight}
              style={{ flex: 1 }}
              onZoomChanged={(e) => {
                const zoom = e?.nativeEvent?.zoom;
                if (typeof zoom === "number" && isFinite(zoom)) {
                  setZoomPercent(Math.round(zoom * 100));
                }
              }}
            />
          )}
        </View>
      </View>

      <ShareReportModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        reportTitle={title || documentTitle || "Report"}
        pdfUrl={getPdfUrl ? getPdfUrl(printOrientation, pdfSearchQuery, printTheme, printCopyType) : ""}
        defaultFilename={`${(title || documentTitle || "document").replace(/[\/\s]/g, "_")}.pdf`}
      />
    </FullScreenModal>
  );
}

const styles = StyleSheet.create({
  formGroup: { gap: 8 },
  inputLabel: {
    fontSize: 14.5,
    fontWeight: "700",
    letterSpacing: 0.5,
    fontFamily: "Segoe UI Variable Text",
  },
  textInputUWP: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    fontFamily: "Segoe UI Variable Text",
  },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center" }
});
