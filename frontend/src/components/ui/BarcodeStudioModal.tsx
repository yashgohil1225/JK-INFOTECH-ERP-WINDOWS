// =============================================================
// JK INFOTECH ERP — Industrial Barcode & Label Print Studio (FullScreen)
// File : src/components/ui/BarcodeStudioModal.tsx
// =============================================================

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Image
} from "react-native";
import { FullScreenModal } from "./FullScreenModal";
import { Button } from "./Button";
import { PdfPreviewModal } from "./PdfPreviewModal";
import { useUIStore } from "../../store/uiStore";
import apiClient from "../../api/client";
import { Buffer } from "buffer";

export interface BarcodePrintProduct {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  sale_price?: number;
  quantity?: number;
}

interface BarcodeStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProducts?: BarcodePrintProduct[];
}

export function BarcodeStudioModal({ isOpen, onClose, initialProducts = [] }: BarcodeStudioModalProps) {
  const { isDarkMode } = useUIStore();
  const [items, setItems] = useState<BarcodePrintProduct[]>([]);
  const [layout, setLayout] = useState<"a4_24" | "a4_40" | "a4_65" | "thermal_50x25" | "thermal_50x25_2up" | "thermal_38x25">("a4_24");
  const [showCompany, setShowCompany] = useState(true);
  const [showName, setShowName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [startPosition, setStartPosition] = useState(1);
  const [marginOffsetX, setMarginOffsetX] = useState(0.0);
  const [marginOffsetY, setMarginOffsetY] = useState(0.0);

  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfData, setPdfData] = useState<{ base64: string; title: string } | null>(null);

  useEffect(() => {
    if (isOpen && initialProducts.length > 0) {
      setItems(
        initialProducts.map((p) => ({
          ...p,
          quantity: p.quantity !== undefined && p.quantity !== null ? p.quantity : 0,
        }))
      );
    }
  }, [isOpen, initialProducts]);

  const updateQuantity = (id: string, qty: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: Math.max(0, qty) } : item))
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const totalStickers = items.reduce((acc, curr) => acc + (curr.quantity || 0), 0);

  const isThermal = layout.startsWith("thermal_");

  const handleGeneratePdf = async () => {
    const validItems = items.filter((i) => (i.quantity || 0) > 0);
    if (validItems.length === 0) {
      Alert.alert("No Stickers Queued", "Please enter copies count (> 0) for at least one product.");
      return;
    }

    setIsGenerating(true);
    try {
      const payload = {
        items: validItems.map((i) => ({ product_id: i.id, quantity: i.quantity || 1 })),
        layout,
        orientation: isThermal ? "landscape" : "portrait",
        start_position: isThermal ? 1 : Math.max(1, startPosition),
        margin_offset_x: isThermal ? 0 : marginOffsetX,
        margin_offset_y: isThermal ? 0 : marginOffsetY,
        show_company: showCompany,
        show_name: showName,
        show_price: showPrice,
      };

      const res = await apiClient.post("/api/v1/barcode/pdf-labels", payload, {
        responseType: "arraybuffer",
      });

      const base64 = Buffer.from(res.data, "binary").toString("base64");
      setPdfData({
        base64,
        title: `Barcode Labels - ${layout.toUpperCase()} (${totalStickers} stickers)`,
      });
    } catch (e: any) {
      const errDetail = e?.response?.data
        ? String.fromCharCode.apply(null, Array.from(new Uint8Array(e.response.data)))
        : e.message;
      Alert.alert("Generation Failed", `Failed to generate barcode PDF: ${errDetail}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const colors = isDarkMode
    ? {
        bg: "#0F172A",
        cardBg: "#1E293B",
        cardBorder: "#334155",
        textPrimary: "#F8FAFC",
        textSecondary: "#94A3B8",
        accent: "#38BDF8",
        activeBg: "#0C4A6E",
        inputBg: "#0F172A",
        inputBorder: "#334155",
        badgeBg: "#1E3A5F",
      }
    : {
        bg: "#F8FAFC",
        cardBg: "#FFFFFF",
        cardBorder: "#E2E8F0",
        textPrimary: "#0F172A",
        textSecondary: "#64748B",
        accent: "#0284C7",
        activeBg: "#E0F2FE",
        inputBg: "#FFFFFF",
        inputBorder: "#CBD5E1",
        badgeBg: "#F1F5F9",
      };

  return (
    <>
      <FullScreenModal
        isOpen={isOpen}
        onClose={onClose}
        title="Industrial Barcode & Sticker Label Studio"
        subtitle="Configure sticker dimensions, toggle item detail flags, set batch copy counts, and generate sharp 300 DPI vector PDFs"
        breadcrumb="inventory / barcode studio"
        scrollEnabled={true}
        footerActions={
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, flex: 1, alignItems: "center" }}>
            <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.textSecondary, marginRight: 16, fontFamily: "Segoe UI Variable Text" }}>
              TOTAL QUEUED STICKERS: <Text style={{ color: colors.accent, fontSize: 16, fontWeight: "800" }}>{totalStickers}</Text>
            </Text>
            <Button variant="secondary" title="Cancel" onPress={onClose} size="large" style={{ minWidth: 120 }} />
            <Button
              variant="primary"
              icon={
                <Image
                  source={require("../print_icon_for_print_preview.png")}
                  style={{ width: 20, height: 20 }}
                  resizeMode="contain"
                />
              }
              title={isGenerating ? "Generating Vector PDF..." : `Print ${totalStickers} Barcode Stickers`}
              onPress={handleGeneratePdf}
              disabled={isGenerating || items.length === 0}
              size="large"
              style={{ minWidth: 240 }}
            />
          </View>
        }
      >
        <View style={styles.fullscreenContent}>
          {/* Left Column: Preset Selector & Flags */}
          <View style={styles.leftColumn}>
            {/* Preset Layout Selector */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SELECT STICKER LAYOUT PRESET</Text>
              <View style={styles.layoutRow}>
                <Pressable
                  onPress={() => setLayout("a4_24")}
                  style={[
                    styles.layoutCard,
                    {
                      backgroundColor: layout === "a4_24" ? colors.activeBg : colors.cardBg,
                      borderColor: layout === "a4_24" ? colors.accent : colors.cardBorder,
                    },
                  ]}
                >
                  <Text style={styles.layoutIcon}>📄</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.layoutTitle, { color: colors.textPrimary }]}>A4 Sheet — 24 Labels/Page</Text>
                    <Text style={[styles.layoutDesc, { color: colors.textSecondary }]}>
                      3 Columns × 8 Rows (63.5 × 33.9mm per label) · Standard Avery L7159 Grid
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setLayout("a4_40")}
                  style={[
                    styles.layoutCard,
                    {
                      backgroundColor: layout === "a4_40" ? colors.activeBg : colors.cardBg,
                      borderColor: layout === "a4_40" ? colors.accent : colors.cardBorder,
                    },
                  ]}
                >
                  <Text style={styles.layoutIcon}>📄</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.layoutTitle, { color: colors.textPrimary }]}>A4 Sheet — 40 Labels/Page</Text>
                    <Text style={[styles.layoutDesc, { color: colors.textSecondary }]}>
                      4 Columns × 10 Rows (48.5 × 25.4mm per label) · High-Density Retail Grid
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setLayout("a4_65")}
                  style={[
                    styles.layoutCard,
                    {
                      backgroundColor: layout === "a4_65" ? colors.activeBg : colors.cardBg,
                      borderColor: layout === "a4_65" ? colors.accent : colors.cardBorder,
                    },
                  ]}
                >
                  <Text style={styles.layoutIcon}>📄</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.layoutTitle, { color: colors.textPrimary }]}>A4 Sheet — 65 Mini Labels/Page</Text>
                    <Text style={[styles.layoutDesc, { color: colors.textSecondary }]}>
                      5 Columns × 13 Rows (38.1 × 21.2mm per label) · Mini Hardware / Jewelry Tags
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setLayout("thermal_50x25")}
                  style={[
                    styles.layoutCard,
                    {
                      backgroundColor: layout === "thermal_50x25" ? colors.activeBg : colors.cardBg,
                      borderColor: layout === "thermal_50x25" ? colors.accent : colors.cardBorder,
                    },
                  ]}
                >
                  <Text style={styles.layoutIcon}>🏷️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.layoutTitle, { color: colors.textPrimary }]}>Thermal Printer Roll — 50×25mm (1-Up)</Text>
                    <Text style={[styles.layoutDesc, { color: colors.textSecondary }]}>
                      Single Continuous Roll · Zebra / TSC / TVS / Citizen Thermal Label Printer
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setLayout("thermal_50x25_2up")}
                  style={[
                    styles.layoutCard,
                    {
                      backgroundColor: layout === "thermal_50x25_2up" ? colors.activeBg : colors.cardBg,
                      borderColor: layout === "thermal_50x25_2up" ? colors.accent : colors.cardBorder,
                    },
                  ]}
                >
                  <Text style={styles.layoutIcon}>🏷️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.layoutTitle, { color: colors.textPrimary }]}>Thermal Printer Roll — 50×25mm Dual (2-Up)</Text>
                    <Text style={[styles.layoutDesc, { color: colors.textSecondary }]}>
                      Dual-Lane Roll Format (2 Stickers Side-by-Side on 100mm Roll)
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setLayout("thermal_38x25")}
                  style={[
                    styles.layoutCard,
                    {
                      backgroundColor: layout === "thermal_38x25" ? colors.activeBg : colors.cardBg,
                      borderColor: layout === "thermal_38x25" ? colors.accent : colors.cardBorder,
                    },
                  ]}
                >
                  <Text style={styles.layoutIcon}>🏷️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.layoutTitle, { color: colors.textPrimary }]}>Thermal Compact Roll — 38×25mm</Text>
                    <Text style={[styles.layoutDesc, { color: colors.textSecondary }]}>
                      Compact Thermal Tag Format · Portable & Desktop Thermal Roll Printer
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>

            {/* A4 Sheet Calibration & Partial Sheet Reuse Controls */}
            {!isThermal && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>A4 SHEET CALIBRATION & PARTIAL SHEET REUSE</Text>
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Start Position on Sheet:</Text>
                    <TextInput
                      style={[styles.qtyInput, { width: "100%", backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                      keyboardType="numeric"
                      value={String(startPosition)}
                      onChangeText={(val) => setStartPosition(Math.max(1, parseInt(val.replace(/[^0-9]/g, "") || "1", 10)))}
                      placeholder="1"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Left Margin Shift (mm):</Text>
                    <TextInput
                      style={[styles.qtyInput, { width: "100%", backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                      keyboardType="numeric"
                      value={String(marginOffsetX)}
                      onChangeText={(val) => setMarginOffsetX(parseFloat(val) || 0.0)}
                      placeholder="0.0"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Top Margin Shift (mm):</Text>
                    <TextInput
                      style={[styles.qtyInput, { width: "100%", backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                      keyboardType="numeric"
                      value={String(marginOffsetY)}
                      onChangeText={(val) => setMarginOffsetY(parseFloat(val) || 0.0)}
                      placeholder="0.0"
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Sticker Content Flags */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>STICKER CONTENT DISPLAY FLAGS</Text>
              <View style={styles.flagsRow}>
                <Pressable
                  onPress={() => setShowCompany(!showCompany)}
                  style={[
                    styles.flagChip,
                    {
                      backgroundColor: showCompany ? colors.activeBg : colors.cardBg,
                      borderColor: showCompany ? colors.accent : colors.cardBorder,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 13.5, fontWeight: "600", color: showCompany ? colors.accent : colors.textPrimary }}>
                    {showCompany ? "☑️ Company Name Header" : "☐ Company Name Header"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowName(!showName)}
                  style={[
                    styles.flagChip,
                    {
                      backgroundColor: showName ? colors.activeBg : colors.cardBg,
                      borderColor: showName ? colors.accent : colors.cardBorder,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 13.5, fontWeight: "600", color: showName ? colors.accent : colors.textPrimary }}>
                    {showName ? "☑️ Product Title / Description" : "☐ Product Title / Description"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowPrice(!showPrice)}
                  style={[
                    styles.flagChip,
                    {
                      backgroundColor: showPrice ? colors.activeBg : colors.cardBg,
                      borderColor: showPrice ? colors.accent : colors.cardBorder,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 13.5, fontWeight: "600", color: showPrice ? colors.accent : colors.textPrimary }}>
                    {showPrice ? "☑️ MRP / Price Tag" : "☐ MRP / Price Tag"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Right Column: Product Batch Print Queue */}
          <View style={styles.rightColumn}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                ITEMS IN PRINT QUEUE ({items.length})
              </Text>
            </View>

            <View style={[styles.itemsTable, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
              <ScrollView style={{ maxHeight: 440 }}>
                {items.length === 0 ? (
                  <View style={{ padding: 30, alignItems: "center" }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 14 }}>No products in queue. Add items from inventory to print barcodes.</Text>
                  </View>
                ) : (
                  items.map((item, idx) => (
                    <View
                      key={item.id}
                      style={[
                        styles.itemRow,
                        { borderBottomColor: idx < items.length - 1 ? colors.cardBorder : "transparent" },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemName, { color: colors.textPrimary }]}>{item.name}</Text>
                        <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
                          SKU: {item.sku || "—"} · Barcode: {item.barcode || "Auto EAN13"} · ₹{item.sale_price || 0}
                        </Text>
                      </View>

                      <View style={styles.qtyGroup}>
                        <Text style={[styles.qtyLabel, { color: colors.textSecondary }]}>Copies:</Text>
                        <TextInput
                          style={[
                            styles.qtyInput,
                            {
                              backgroundColor: colors.inputBg,
                              borderColor: colors.inputBorder,
                              color: colors.textPrimary,
                            },
                          ]}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={colors.textSecondary}
                          value={item.quantity && item.quantity > 0 ? String(item.quantity) : ""}
                          onChangeText={(val) => {
                            const parsed = parseInt(val.replace(/[^0-9]/g, ""), 10);
                            updateQuantity(item.id, isNaN(parsed) ? 0 : parsed);
                          }}
                        />
                        <Pressable onPress={() => removeItem(item.id)} style={styles.removeBtn}>
                          <Text style={{ color: "#EF4444", fontSize: 16, fontWeight: "bold" }}>✕</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </FullScreenModal>

      {/* PDF Native Preview & Direct Print Modal */}
      {pdfData && (
        <PdfPreviewModal
          isOpen={true}
          onClose={() => setPdfData(null)}
          title={pdfData.title}
          reportKey="barcode_labels"
          layout={layout}
          defaultOrientation={isThermal ? "landscape" : "portrait"}
          getPdfUrl={(orientation) => {
            const validItems = items.filter((i) => (i.quantity || 0) > 0);
            const itemParams = validItems.map((i) => `${i.id}:${i.quantity || 1}`).join(",");
            const baseUrl = apiClient.defaults.baseURL || "http://127.0.0.1:8000";
            return `${baseUrl}/api/v1/barcode/pdf-labels?items=${encodeURIComponent(itemParams)}&layout=${layout}&orientation=${orientation}&start_position=${isThermal ? 1 : Math.max(1, startPosition)}&margin_offset_x=${isThermal ? 0 : marginOffsetX}&margin_offset_y=${isThermal ? 0 : marginOffsetY}&show_company=${showCompany}&show_name=${showName}&show_price=${showPrice}`;
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fullscreenContent: {
    flexDirection: "row",
    gap: 24,
    paddingVertical: 10,
  },
  leftColumn: {
    flex: 1.1,
    gap: 20,
  },
  rightColumn: {
    flex: 1.3,
    gap: 12,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    fontFamily: "Segoe UI Variable Display",
  },
  layoutRow: {
    gap: 12,
  },
  layoutCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 14,
  },
  layoutIcon: {
    fontSize: 26,
  },
  layoutTitle: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
  },
  layoutDesc: {
    fontSize: 12.5,
    fontFamily: "Segoe UI Variable Text",
    marginTop: 2,
  },
  flagsRow: {
    flexDirection: "column",
    gap: 10,
  },
  flagChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  itemsTable: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  itemName: {
    fontSize: 14.5,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
  },
  itemSub: {
    fontSize: 12.5,
    fontFamily: "Segoe UI Variable Text",
    marginTop: 3,
  },
  qtyGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  qtyLabel: {
    fontSize: 13.5,
    fontFamily: "Segoe UI Variable Text",
  },
  qtyInput: {
    width: 65,
    height: 36,
    borderWidth: 1,
    borderRadius: 6,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
  },
  removeBtn: {
    padding: 6,
  },
});
