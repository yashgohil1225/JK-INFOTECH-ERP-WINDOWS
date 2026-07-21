// =============================================================
// JK INFOTECH ERP — Reusable PDF Print Preview Modal Component
// File : src/components/ui/PdfPreviewModal.tsx
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
  DeviceEventEmitter
} from "react-native";
import { useUIStore } from "../../store/uiStore";
import apiClient from "../../api/client";
import { storage } from "../../utils/storage";
import { FullScreenModal } from "./FullScreenModal";
import { Button } from "./Button";

const WindowsView = View as any;
const WindowsScrollView = ScrollView as any;

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
  title: string;
  subtitle?: string;
  breadcrumb?: string;
  reportKey: string;
  getPdfUrl: (orientation: 'portrait' | 'landscape', search: string, theme: string, copyType: string) => string;
  getExcelUrl?: () => string;
  showThemeSelector?: boolean;
  showCopySelector?: boolean;
}

export function PdfPreviewModal({
  isOpen,
  onClose,
  title,
  subtitle,
  breadcrumb,
  reportKey,
  getPdfUrl,
  getExcelUrl,
  showThemeSelector = false,
  showCopySelector = false
}: PdfPreviewModalProps) {
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

  // Print layout settings & search state
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [printTheme, setPrintTheme] = useState("modern");
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

  const baseWidth = printOrientation === 'landscape' ? 820 : 580;
  const baseHeight = printOrientation === 'landscape' ? 580 : 820;

  const scrollToPage = (pageIdx: number) => {
    const offsetY = 20 + pageIdx * (baseHeight * zoomScale + 16);
    scrollViewRef.current?.scrollTo({
      x: 0,
      y: offsetY,
      animated: true
    });
  };

  const totalMatches = searchMatches.reduce((a, b) => a + b, 0);

  const handleNextMatch = () => {
    if (totalMatches === 0) return;
    const nextIdx = currentMatchIndex >= totalMatches ? 1 : currentMatchIndex + 1;
    setCurrentMatchIndex(nextIdx);
    const targetPage = findPageForMatchIndex(nextIdx, searchMatches);
    scrollToPage(targetPage);
  };

  const handlePrevMatch = () => {
    if (totalMatches === 0) return;
    const prevIdx = currentMatchIndex <= 1 ? totalMatches : currentMatchIndex - 1;
    setCurrentMatchIndex(prevIdx);
    const targetPage = findPageForMatchIndex(prevIdx, searchMatches);
    scrollToPage(targetPage);
  };

  const workspaceRef = useRef<any>(null);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [panX, setPanX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startPanXRef = useRef(0);

  const handleKeyDown = (e: any) => {
    if (!e || !e.nativeEvent) return;
    const key = e.nativeEvent.key;

    if (key === "Control" || e.nativeEvent.ctrlKey) {
      setIsCtrlPressed(true);
    }
    if (key === "Shift" || e.nativeEvent.shiftKey) {
      setIsShiftPressed(true);
    }

    // Keyboard Arrow Keys for Left/Right Panning when zoomed
    if (zoomScale > 1.0) {
      if (key === "ArrowLeft") {
        setPanX((prev) => Math.min(2000, prev + 80));
      } else if (key === "ArrowRight") {
        setPanX((prev) => Math.max(-2000, prev - 80));
      }
    }
  };

  const handleKeyUp = (e: any) => {
    if (!e || !e.nativeEvent) return;
    const key = e.nativeEvent.key;
    if (key === "Control" || !e.nativeEvent.ctrlKey) {
      setIsCtrlPressed(false);
    }
    if (key === "Shift" || !e.nativeEvent.shiftKey) {
      setIsShiftPressed(false);
    }
  };

  // Drag-to-Pan (Hand Tool) handlers
  const handlePointerDown = (e: any) => {
    if (zoomScale <= 1.0) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    startXRef.current = e.nativeEvent.pageX || e.nativeEvent.clientX || 0;
    startPanXRef.current = panX;
  };

  const handlePointerMove = (e: any) => {
    if (!isDraggingRef.current || zoomScale <= 1.0) return;
    const currentX = e.nativeEvent.pageX || e.nativeEvent.clientX || 0;
    const deltaX = currentX - startXRef.current;
    setPanX(startPanXRef.current + deltaX);
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  // Reset panX horizontal scroll when zoom changes to <= 1.0 or preview resets
  useEffect(() => {
    if (zoomScale <= 1.0) {
      setPanX(0);
    }
  }, [zoomScale]);

  // Native C++ CoreWindow PointerWheelChanged listener for instant, smooth Ctrl+wheel, trackpad pinch zoom, and horizontal trackpad swipe
  useEffect(() => {
    if (!isOpen) return;
    const zoomSub = DeviceEventEmitter.addListener("OnPdfZoomWheel", (evt: { delta: number }) => {
      if (!evt || typeof evt.delta !== "number") return;
      const rawDelta = evt.delta;
      if (rawDelta !== 0) {
        const absDelta = Math.abs(rawDelta);
        const zoomStep = absDelta >= 100
          ? (rawDelta > 0 ? 0.08 : -0.08)
          : (rawDelta * 0.0012);
        setZoomScale((z) => Math.min(3.0, Math.max(0.4, z + zoomStep)));
      }
    });

    const scrollSub = DeviceEventEmitter.addListener("OnPdfHorizontalScroll", (evt: { delta: number }) => {
      if (!evt || typeof evt.delta !== "number") return;
      const delta = evt.delta;
      setPanX((prev) => {
        const next = prev + delta * 1.5;
        return Math.min(2000, Math.max(-2000, next));
      });
    });

    return () => {
      zoomSub.remove();
      scrollSub.remove();
    };
  }, [isOpen]);

  const handleZoomWheel = (e: any) => {
    if (!e || !e.nativeEvent) return;

    // Detect Ctrl key: state, event property (Windows trackpad pinch emits ctrlKey=true natively), or modifierKeys bitmask (Control = bit 2)
    const isCtrl = isCtrlPressed ||
      e.nativeEvent.ctrlKey ||
      (e.nativeEvent.modifierKeys !== undefined && (e.nativeEvent.modifierKeys & 2) !== 0);

    if (!isCtrl) return; // Normal scroll mode — let ScrollView handle vertical scrolling

    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();

    let rawDelta = 0;
    if (e.nativeEvent.deltaY !== undefined) {
      rawDelta = -e.nativeEvent.deltaY;
    } else if (e.nativeEvent.wheelDeltaY !== undefined) {
      rawDelta = e.nativeEvent.wheelDeltaY;
    } else if (e.nativeEvent.wheelDelta !== undefined) {
      rawDelta = e.nativeEvent.wheelDelta;
    }

    if (rawDelta !== 0) {
      // Calculate smooth zoom step (supports both physical mouse wheel detents and continuous trackpad pinch gestures)
      const absDelta = Math.abs(rawDelta);
      const zoomStep = absDelta >= 100
        ? (rawDelta > 0 ? 0.08 : -0.08)
        : (rawDelta * 0.0012);

      setZoomScale((z) => {
        const next = z + zoomStep;
        return Math.min(3.0, Math.max(0.4, next));
      });
    }
  };

  const regeneratePreview = async (
    orientation: string = printOrientation,
    searchQuery: string = pdfSearchQuery,
    isSilent: boolean = false,
    theme: string = printTheme,
    copyType: string = printCopyType
  ) => {
    if (!isOpen) return;
    if (!isSilent) {
      setIsPdfLoading(true);
    } else {
      setIsSearching(true);
    }
    try {
      const { PdfRenderer: pdfModule } = NativeModules;
      if (!pdfModule || !pdfModule.RenderPdfWithToken) {
        throw new Error("Native PdfRenderer.RenderPdfWithToken module not registered in Windows project");
      }

      const url = getPdfUrl(orientation as any, searchQuery, theme, copyType);
      const token = storage.getItemSync("access_token") || "";

      // Parallel fetch to extract match counts header in JS
      if (searchQuery) {
        fetch(url, {
          method: "HEAD",
          headers: {
            "Authorization": `Bearer ${token}`
          }
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
      } else {
        setSearchMatches([]);
        setCurrentMatchIndex(0);
        setIsSearching(false);
      }

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
      setPrintOrientation("portrait");
      setPrintCopies(1);
      setPageSelection("all");
      setPageRange("1");
      setPdfSearchQuery("");
      setSearchMatches([]);
      setCurrentMatchIndex(0);
      setZoomScale(1.0);
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
        regeneratePreview("portrait", "", false, defaultTheme, defaultCopy);
      };
      initLoad();
    } else {
      setPreviewPages([]);
    }
  }, [isOpen, reportKey, showThemeSelector, showCopySelector]);

  // Trigger preview regeneration when settings update
  useEffect(() => {
    if (!isOpen) return;
    // Silent loading for search query (less distracting), full indicator for other settings changes
    const isSearchOnly = (pdfSearchQuery !== "");
    regeneratePreview(printOrientation, pdfSearchQuery, isSearchOnly, printTheme, printCopyType);
  }, [printOrientation, pdfSearchQuery, printTheme, printCopyType]);

  return (
    <FullScreenModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      breadcrumb={breadcrumb}
      scrollEnabled={false}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
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
          {/* Zoom Controls */}
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Button
              onPress={() => setZoomScale(z => Math.max(0.5, z - 0.1))}
              variant="secondary"
              style={{ minWidth: 42, paddingHorizontal: 0, height: 42, borderColor: colors.divider }}
            >
              <Text style={{ fontSize: 18, color: colors.textPrimary }}>-</Text>
            </Button>
            <Text style={{ fontSize: 14.5, color: colors.textSecondary, fontFamily: "Segoe UI Variable Text", width: 50, textAlign: "center" }}>
              {Math.round(zoomScale * 100)}%
            </Text>
            <Button
              onPress={() => setZoomScale(z => Math.min(2.0, z + 0.1))}
              variant="secondary"
              style={{ minWidth: 42, paddingHorizontal: 0, height: 42, borderColor: colors.divider }}
            >
              <Text style={{ fontSize: 18, color: colors.textPrimary }}>+</Text>
            </Button>

            <View style={{ width: 1, height: 24, backgroundColor: colors.divider, marginLeft: 8, marginRight: 8 }} />

            <Button
              title="Fit Width"
              onPress={() => setZoomScale(1.35)}
              variant="secondary"
              style={{ height: 42, borderColor: colors.divider, paddingHorizontal: 12 }}
            />
            <Button
              title="Fit Page"
              onPress={() => setZoomScale(0.75)}
              variant="secondary"
              style={{ height: 42, borderColor: colors.divider, paddingHorizontal: 12 }}
            />
            <Button
              title="Reset"
              onPress={() => setZoomScale(1.0)}
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
                    const excelUrl = getExcelUrl();
                    const suggestedName = `${title.replace(/[\/\s]/g, "_")}`;
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
                  const downloadUrl = getPdfUrl(printOrientation, pdfSearchQuery, printTheme, printCopyType);
                  const suggestedName = `${title.replace(/[\/\s]/g, "_")}`;
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
                  if (!pdfModule || !pdfModule.PrintPdfUrlWithToken) {
                    throw new Error("PrintPdfUrlWithToken method not found in native PdfRenderer module");
                  }
                  const printUrl = getPdfUrl(printOrientation, pdfSearchQuery, printTheme, printCopyType);
                  const token = storage.getItemSync("access_token") || "";
                  await pdfModule.PrintPdfUrlWithToken(printUrl, token);
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
                        setPrintOrientation(o.value as any);
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

        {/* Right Scrollable Preview Workspace */}
        <WindowsView
          ref={workspaceRef}
          focusable={true}
          onMouseEnter={() => {
            try { workspaceRef.current?.focus(); } catch (e) { }
          }}
          onPointerDown={() => {
            try { workspaceRef.current?.focus(); } catch (e) { }
          }}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onBlur={() => { setIsCtrlPressed(false); }}
          style={{ flex: 1, backgroundColor: isDarkMode ? "#0B0F19" : "#F3F4F6" }}
        >
          {isPdfLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={{ fontSize: 15, color: colors.textSecondary, fontFamily: "Segoe UI Variable Text", marginTop: 8 }}>Loading print preview...</Text>
            </View>
          ) : (
            <WindowsScrollView
              ref={scrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={{
                padding: 20,
                alignItems: "center",
                minWidth: "100%",
                minHeight: "100%"
              }}
              nestedScrollEnabled={true}
              scrollEnabled={true}
              showsVerticalScrollIndicator={true}
              showsHorizontalScrollIndicator={true}
              pinchGestureEnabled={true}
              minimumZoomScale={0.4}
              maximumZoomScale={3.0}
              zoomScale={zoomScale}
            >
              <View
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                style={{
                  gap: 16,
                  alignItems: "center",
                  width: Math.max(baseWidth * zoomScale, 100),
                  transform: [{ translateX: panX }]
                }}
              >
                {previewPages.map((pagePath, index) => {
                  const w = baseWidth * zoomScale;
                  const h = baseHeight * zoomScale;
                  return (
                    <WindowsView
                      key={index}
                      style={{
                        width: w,
                        height: h,
                        backgroundColor: "#FFFFFF",
                        borderWidth: 1,
                        borderColor: colors.divider,
                        borderRadius: 4,
                        elevation: 4,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.15,
                        shadowRadius: 6,
                        overflow: "hidden"
                      }}
                    >
                      <Image
                        source={{ uri: pagePath }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="contain"
                      />
                    </WindowsView>
                  );
                })}
              </View>
            </WindowsScrollView>
          )}
        </WindowsView>
      </View>
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
