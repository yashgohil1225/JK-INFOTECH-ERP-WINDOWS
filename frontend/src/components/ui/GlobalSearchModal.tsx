// =============================================================
// JK INFOTECH ERP — Global Universal Search & Command Palette (Ctrl+K)
// File : src/components/ui/GlobalSearchModal.tsx
// =============================================================

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useUIStore } from "../../store/uiStore";
import apiClient from "../../api/client";
import { ModalStackManager } from "../../utils/modalStackManager";

interface SearchResultItem {
  id: string;
  type: string;
  category: string;
  title: string;
  subtitle: string;
  status?: string;
  targetScreen: string;
  targetId?: string;
  icon: string;
}

const STATIC_QUICK_ACTIONS: SearchResultItem[] = [
  { id: "qa-1", type: "action", category: "⚡ QUICK ACTIONS", title: "Create New Sales Invoice", subtitle: "Open invoice creation wizard", targetScreen: "SalesScreen", icon: "➕" },
  { id: "qa-2", type: "action", category: "⚡ QUICK ACTIONS", title: "Create Purchase Bill / Entry", subtitle: "Open vendor bill creation wizard", targetScreen: "PurchasesScreen", icon: "🛍️" },
  { id: "qa-3", type: "action", category: "⚡ QUICK ACTIONS", title: "Add New Product to Inventory", subtitle: "Register product SKU, HSN, and tax rate", targetScreen: "InventoryScreen", icon: "📦" },
  { id: "qa-4", type: "action", category: "⚡ QUICK ACTIONS", title: "Add Customer or Vendor", subtitle: "Create new party ledger profile", targetScreen: "PartiesScreen", icon: "👤" },
  { id: "qa-5", type: "action", category: "⚡ QUICK ACTIONS", title: "Financial Years & Closing Wizard", subtitle: "Manage accounting periods and closing audit", targetScreen: "SettingsScreen", icon: "🗓️" },
  { id: "qa-6", type: "action", category: "⚡ QUICK ACTIONS", title: "GST Tax Summary & Returns", subtitle: "GSTR-1, GSTR-3B & Tax Ledgers", targetScreen: "ReportsScreen", icon: "📊" },
  { id: "qa-7", type: "action", category: "⚡ QUICK ACTIONS", title: "Bank Accounts & Cash Counter", subtitle: "Record payments, deposits & transfers", targetScreen: "BankingScreen", icon: "🏦" },
];

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

import { DeviceEventEmitter } from "react-native";

const searchCache = new Map<string, SearchResultItem[]>();

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const { isDarkMode, setActiveScreen } = useUIStore();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<TextInput>(null);

  const modalIdRef = useRef(`globalsearch_modal_${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    if (isOpen) {
      ModalStackManager.register(modalIdRef.current, onClose);
    } else {
      ModalStackManager.unregister(modalIdRef.current);
    }
    return () => {
      ModalStackManager.unregister(modalIdRef.current);
    };
  }, [isOpen, onClose]);

  const colors = isDarkMode
    ? {
        overlayBg: "rgba(15, 23, 42, 0.75)",
        modalBg: "#1E293B",
        borderColor: "#334155",
        inputBg: "#0F172A",
        textPrimary: "#F8FAFC",
        textSecondary: "#94A3B8",
        itemHoverBg: "#334155",
        badgeBg: "#0284C7",
        badgeText: "#FFFFFF",
      }
    : {
        overlayBg: "rgba(0, 0, 0, 0.45)",
        modalBg: "#FFFFFF",
        borderColor: "#E2E8F0",
        inputBg: "#F8FAFC",
        textPrimary: "#0F172A",
        textSecondary: "#64748B",
        itemHoverBg: "#F1F5F9",
        badgeBg: "#0078D4",
        badgeText: "#FFFFFF",
      };

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults(STATIC_QUICK_ACTIONS);
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const qTrim = query.trim().toLowerCase();
    if (!qTrim) {
      setResults(STATIC_QUICK_ACTIONS);
      setLoading(false);
      setSelectedIndex(0);
      return;
    }

    // Instant local static action filter
    const filteredStatic = STATIC_QUICK_ACTIONS.filter(
      (item) =>
        item.title.toLowerCase().includes(qTrim) ||
        item.subtitle.toLowerCase().includes(qTrim)
    );

    // Instant cache lookup for sub-millisecond response
    if (searchCache.has(qTrim)) {
      const cachedServerResults = searchCache.get(qTrim) || [];
      setResults([...filteredStatic, ...cachedServerResults]);
      setLoading(false);
      setSelectedIndex(0);
      return;
    }

    // Fast 15ms network debounce
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await apiClient.get("/api/v1/search/global", {
          params: { q: qTrim },
        });
        const serverResults: SearchResultItem[] = response.data?.results || [];
        searchCache.set(qTrim, serverResults);
        
        // Keep cache light (max 100 entries)
        if (searchCache.size > 100) {
          const firstKey = searchCache.keys().next().value;
          if (firstKey) searchCache.delete(firstKey);
        }

        const combined = [...filteredStatic, ...serverResults];
        setResults(combined);
        setSelectedIndex(0);
      } catch (err) {
        console.warn("Global search error:", err);
      } finally {
        setLoading(false);
      }
    }, 15);

    return () => clearTimeout(timer);
  }, [query]);

  const SCREEN_MAP: Record<string, string> = {
    SalesScreen: "SALES",
    PurchasesScreen: "PURCHASE",
    PartiesScreen: "CUSTOMERS",
    InventoryScreen: "INVENTORY",
    SettingsScreen: "SETTINGS",
    ReportsScreen: "REPORTS",
    BankingScreen: "BANK_CASH",
    SalesOrdersScreen: "SALES_ORDERS",
    ReturnsScreen: "RETURNS",
    CompanySelectScreen: "COMPANY_SELECT",
    SALES: "SALES",
    PURCHASES: "PURCHASE",
    PURCHASE: "PURCHASE",
    PARTIES: "CUSTOMERS",
    CUSTOMERS: "CUSTOMERS",
    VENDORS: "VENDORS",
    INVENTORY: "INVENTORY",
    SETTINGS: "SETTINGS",
    REPORTS: "REPORTS",
    BANKING: "BANK_CASH",
    BANK_CASH: "BANK_CASH",
    ORDERS: "SALES_ORDERS",
    SALES_ORDERS: "SALES_ORDERS",
    RETURNS: "RETURNS",
  };

  const handleSelectItem = (item: SearchResultItem) => {
    onClose();
    if (item.targetScreen) {
      const target = SCREEN_MAP[item.targetScreen] || item.targetScreen.toUpperCase();
      setActiveScreen(target as any);
      
      // Notify active target screen to immediately highlight/open the selected item
      setTimeout(() => {
        DeviceEventEmitter.emit("openSearchResult", {
          targetScreen: target,
          targetId: item.targetId || item.id,
          type: item.type,
          title: item.title,
          item
        });
      }, 60);
    }
  };

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (scrollRef.current && selectedIndex >= 0) {
      scrollRef.current.scrollTo({ y: selectedIndex * 52, animated: false });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: any) => {
    const k = e.nativeEvent?.key || e.key || "";
    const isDown = k === "ArrowDown" || k === "Down";
    const isUp = k === "ArrowUp" || k === "Up";
    const isEnter = k === "Enter" || k === "Accept";
    const isEsc = k === "Escape" || k === "Esc";

    if (isDown || isUp || isEnter || isEsc) {
      if (typeof e.preventDefault === "function") e.preventDefault();
      if (typeof e.stopPropagation === "function") e.stopPropagation();
      if (typeof e.nativeEvent?.preventDefault === "function") e.nativeEvent.preventDefault();
    }

    if (isEsc) {
      onClose();
    } else if (isDown) {
      setSelectedIndex((prev) => (prev + 1 < results.length ? prev + 1 : 0));
    } else if (isUp) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : Math.max(0, results.length - 1)));
    } else if (isEnter) {
      if (results[selectedIndex]) {
        handleSelectItem(results[selectedIndex]);
      }
    }
  };

  const categories = Array.from(new Set(results.map((r) => r.category)));

  if (!isOpen) return null;

  let flatCounter = 0;

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        elevation: 999999,
      }}
    >
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlayBg }]} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: colors.modalBg, borderColor: colors.borderColor }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header Search Input */}
          <View style={[styles.searchHeader, { borderBottomColor: colors.borderColor }]}>
            <Text style={{ fontSize: 18, color: colors.textSecondary, marginRight: 10 }}>🔍</Text>
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder="Search invoices, customers, vendors, products, reports, actions... (↑↓ Navigate · Enter Select · Esc Exit)"
              placeholderTextColor={colors.textSecondary}
              style={[styles.searchInput, { color: colors.textPrimary }]}
              autoFocus={true}
              {...({
                onKeyDown: handleKeyDown,
              } as any)}
            />
            {loading ? (
              <ActivityIndicator size="small" color={colors.badgeBg} />
            ) : query.length > 0 ? (
              <Pressable onPress={() => setQuery("")}>
                <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: "700" }}>✕</Text>
              </Pressable>
            ) : (
              <View style={[styles.hotkeyBadge, { backgroundColor: colors.inputBg, borderColor: colors.borderColor }]}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary }}>Ctrl + K</Text>
              </View>
            )}
          </View>

          {/* Results List */}
          <ScrollView ref={scrollRef} style={styles.resultsContainer} keyboardShouldPersistTaps="handled">
            {results.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 28, marginBottom: 8 }}>🔎</Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>No results found for "{query}"</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>Try searching for an invoice number, customer name, SKU, or report name.</Text>
              </View>
            ) : (
              categories.map((catGroup) => {
                const groupItems = results.filter((r) => r.category === catGroup);
                return (
                  <View key={catGroup} style={{ marginBottom: 12 }}>
                    <Text style={[styles.categoryHeader, { color: colors.textSecondary }]}>
                      {catGroup}
                    </Text>
                    {groupItems.map((item) => {
                      const currentIndex = flatCounter++;
                      const isSelected = currentIndex === selectedIndex;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => handleSelectItem(item)}
                          onHoverIn={() => setSelectedIndex(currentIndex)}
                          style={({ pressed }) => [
                            styles.resultRow,
                            { borderBottomColor: colors.borderColor },
                            isSelected && {
                              backgroundColor: isDarkMode ? "#334155" : "#F1F5F9",
                            },
                            pressed && { backgroundColor: colors.itemHoverBg },
                          ]}
                        >
                          <Text style={styles.itemIcon}>{item.icon}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.itemTitle, { color: isSelected ? colors.badgeBg : colors.textPrimary, fontWeight: isSelected ? "700" : "600" }]} numberOfLines={1}>
                              {item.title}
                            </Text>
                            <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                              {item.subtitle}
                            </Text>
                          </View>
                          {item.status && (
                            <View style={[styles.statusBadge, { backgroundColor: colors.badgeBg }]}>
                              <Text style={[styles.statusText, { color: colors.badgeText }]}>{item.status}</Text>
                            </View>
                          )}
                          <Text style={{ fontSize: 14, color: isSelected ? colors.badgeBg : colors.textSecondary, marginLeft: 8 }}>➔</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Footer Shortcuts */}
          <View style={[styles.modalFooter, { borderTopColor: colors.borderColor, backgroundColor: colors.inputBg }]}>
            <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: "Segoe UI Variable Text" }}>
              💡 <Text style={{ fontWeight: "700" }}>Tip:</Text> Click any search result to open directly in workspace.
            </Text>
            <Pressable onPress={onClose} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.badgeBg }}>Close (Esc)</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 80,
  },
  modalCard: {
    width: "90%",
    maxWidth: 720,
    maxHeight: 560,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    overflow: "hidden",
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Segoe UI Variable Text",
    fontWeight: "600",
    paddingVertical: 0,
  },
  hotkeyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  resultsContainer: {
    maxHeight: 440,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  categoryHeader: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    fontFamily: "Segoe UI Variable Text",
    marginBottom: 6,
    marginTop: 6,
    paddingHorizontal: 6,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 12,
  },
  itemIcon: {
    fontSize: 18,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
  },
  itemSubtitle: {
    fontSize: 12,
    fontFamily: "Segoe UI Variable Text",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
    fontFamily: "Segoe UI Variable Text",
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
});
