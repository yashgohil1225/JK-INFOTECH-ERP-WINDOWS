// =============================================================
// JK INFOTECH ERP — Searchable Dropdown Selector
// File : src/components/ui/Dropdown.tsx
// =============================================================

import React, { useState, useRef, useMemo, useEffect, useImperativeHandle } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from "react-native";
import { useUIStore } from "../../store/uiStore";

export interface DropdownOption {
  value: string | number;
  label: string;
  sublabel?: string;
}

export interface DropdownRef {
  open: () => void;
  close: () => void;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string | number | null | undefined;
  onChange: (value: any) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  inputRefProp?: React.RefObject<any> | any;
  onSubmitEditing?: () => void;
  onAddNew?: (searchQuery: string) => void;
  addNewLabel?: string;
  direction?: "up" | "down" | "auto";
}

export const Dropdown = React.forwardRef<DropdownRef, DropdownProps>(function Dropdown({
  options,
  value,
  onChange,
  placeholder = "Select option...",
  disabled = false,
  autoFocus = false,
  inputRefProp,
  onSubmitEditing,
  onAddNew,
  addNewLabel,
  direction = "down"
}, forwardedRef) {
  const { isDarkMode } = useUIStore();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredItemId, setHoveredItemId] = useState<string | number | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const listScrollRef = useRef<any>(null);

  const localTriggerRef = useRef<View>(null);
  const triggerRef = inputRefProp || localTriggerRef;
  const searchInputRef = useRef<TextInput>(null);

  const selectedOption = useMemo(() => {
    return options.find(opt => opt.value === value);
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return options;
    return options.filter(
      opt =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q))
    );
  }, [options, search]);

  // Reset highlight to first item whenever search changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search, isOpen]);

  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
    }
  }, [disabled]);

  useImperativeHandle(forwardedRef, () => ({
    open: () => { setSearch(""); setIsOpen(true); },
    close: () => setIsOpen(false),
    focus: () => { setSearch(""); setIsOpen(true); },
  }));

  const handleSelect = (opt: DropdownOption) => {
    onChange(opt.value);
    setIsOpen(false);
    if (onSubmitEditing) {
      setTimeout(() => onSubmitEditing(), 50);
    }
  };

  const colors = isDarkMode
    ? {
        bg: "#1E293B",
        border: "#334155",
        inputBg: "#1E293B",
        textPrimary: "#F8FAFC",
        textSecondary: "#94A3B8",
        divider: "#334155",
        hoverBg: "rgba(255, 255, 255, 0.08)",
        activeBg: "rgba(56, 189, 248, 0.15)",
        accent: "#38BDF8",
      }
    : {
        bg: "#FFFFFF",
        border: "#CBD5E1",
        inputBg: "#FFFFFF",
        textPrimary: "#0F172A",
        textSecondary: "#64748B",
        divider: "#E2E8F0",
        hoverBg: "rgba(0, 0, 0, 0.04)",
        activeBg: "rgba(2, 132, 199, 0.08)",
        accent: "#0284C7",
      };

  return (
    <View
      ref={(el) => {
        (localTriggerRef as any).current = el;
        if (inputRefProp) {
          if (typeof inputRefProp === "function") {
            inputRefProp(el);
          } else if (Object.prototype.hasOwnProperty.call(inputRefProp, "current")) {
            inputRefProp.current = el;
          }
        }
      }}
      collapsable={false}
      style={[styles.container, { zIndex: isOpen ? 99999 : 1 }]}
    >
      {/* Absolute Backdrop to detect click outside */}
      {isOpen && (
        <Pressable
          style={styles.backdrop}
          onPress={() => setIsOpen(false)}
          importantForAccessibility="no"
        />
      )}

      {/* Trigger Button - Looks like a text input */}
      <Pressable
        focusable={!disabled}
        disabled={disabled}
        onPress={() => {
          if (!disabled) {
            setSearch("");
            setIsOpen(!isOpen);
          }
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onHoverIn={() => setIsHovered(true)}
        onHoverOut={() => setIsHovered(false)}
        style={[
          styles.trigger,
          {
            backgroundColor: colors.inputBg,
            borderColor: isFocused ? colors.accent : colors.border,
            opacity: disabled ? 0.7 : 1,
          },
          isHovered && !disabled && { opacity: 0.95 }
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.triggerText,
            { color: selectedOption ? colors.textPrimary : colors.textSecondary }
          ]}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Text style={[styles.chevronIcon, { fontFamily: "Segoe MDL2 Assets", color: colors.textSecondary }]}>
          {isOpen ? "\uE70E" : "\uE70D"}
        </Text>
      </Pressable>

      {/* Dropdown Options Box */}
      {isOpen && !disabled && (
        <View
          style={[
            styles.dropdown,
            direction === "up" ? { bottom: 52, top: undefined } : { top: 52 },
            {
              backgroundColor: colors.bg,
              borderColor: colors.border,
            }
          ]}
        >
          {/* Search Box */}
          <View style={[styles.searchContainer, { backgroundColor: colors.bg, borderBottomColor: colors.divider }]}>
            <Text style={[styles.searchIcon, { fontFamily: "Segoe MDL2 Assets", color: colors.textSecondary }]}>
              {"\uE721"}
            </Text>
            <TextInput
              ref={searchInputRef}
              autoFocus={true}
              style={[styles.searchInput, { color: colors.textPrimary }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search..."
              placeholderTextColor={colors.textSecondary}
              onKeyPress={(e: any) => {
                const k = e.nativeEvent?.key || e.key || "";
                const isDown = k === "ArrowDown" || k === "Down";
                const isUp = k === "ArrowUp" || k === "Up";
                const isEnter = k === "Enter" || k === "Accept";
                const isEsc = k === "Escape" || k === "Esc";

                if (isDown || isUp || isEnter || isEsc) {
                  if (typeof e.preventDefault === "function") e.preventDefault();
                  if (typeof e.stopPropagation === "function") e.stopPropagation();
                  if (typeof e.nativeEvent?.preventDefault === "function") e.nativeEvent.preventDefault();
                  if (typeof e.nativeEvent?.stopPropagation === "function") e.nativeEvent.stopPropagation();
                }

                if (isEsc) {
                  setIsOpen(false);
                } else if (isDown) {
                  setHighlightedIndex(i => {
                    const next = Math.min(i + 1, Math.max(0, filteredOptions.length - 1));
                    if (listScrollRef.current && next >= 0) {
                      listScrollRef.current.scrollTo({ y: next * 42, animated: false });
                    }
                    return next;
                  });
                } else if (isUp) {
                  setHighlightedIndex(i => {
                    const prev = Math.max(i - 1, 0);
                    if (listScrollRef.current && prev >= 0) {
                      listScrollRef.current.scrollTo({ y: prev * 42, animated: false });
                    }
                    return prev;
                  });
                } else if (isEnter) {
                  if (filteredOptions.length > 0) {
                    const targetIdx = Math.max(0, Math.min(highlightedIndex, filteredOptions.length - 1));
                    handleSelect(filteredOptions[targetIdx]);
                  } else if (onAddNew && search.trim().length > 0) {
                    const q = search.trim();
                    setIsOpen(false);
                    onAddNew(q);
                  }
                }
              }}
              {...({
                onKeyDown: (e: any) => {
                  const k = e.nativeEvent?.key || e.key || "";
                  const isDown = k === "ArrowDown" || k === "Down";
                  const isUp = k === "ArrowUp" || k === "Up";
                  const isEnter = k === "Enter" || k === "Accept";
                  const isEsc = k === "Escape" || k === "Esc";

                  if (isDown || isUp || isEnter || isEsc) {
                    if (typeof e.preventDefault === "function") e.preventDefault();
                    if (typeof e.stopPropagation === "function") e.stopPropagation();
                    if (typeof e.nativeEvent?.preventDefault === "function") e.nativeEvent.preventDefault();
                    if (typeof e.nativeEvent?.stopPropagation === "function") e.nativeEvent.stopPropagation();
                  }

                  if (isEsc) {
                    setIsOpen(false);
                  } else if (isDown) {
                    setHighlightedIndex(i => {
                      const next = Math.min(i + 1, Math.max(0, filteredOptions.length - 1));
                      if (listScrollRef.current && next >= 0) {
                        listScrollRef.current.scrollTo({ y: next * 42, animated: false });
                      }
                      return next;
                    });
                  } else if (isUp) {
                    setHighlightedIndex(i => {
                      const prev = Math.max(i - 1, 0);
                      if (listScrollRef.current && prev >= 0) {
                        listScrollRef.current.scrollTo({ y: prev * 42, animated: false });
                      }
                      return prev;
                    });
                  } else if (isEnter) {
                    if (filteredOptions.length > 0) {
                      const targetIdx = Math.max(0, Math.min(highlightedIndex, filteredOptions.length - 1));
                      handleSelect(filteredOptions[targetIdx]);
                    } else if (onAddNew && search.trim().length > 0) {
                      const q = search.trim();
                      setIsOpen(false);
                      onAddNew(q);
                    }
                  }
                }
              } as any)}
              onSubmitEditing={() => {
                if (filteredOptions.length > 0) {
                  const targetIdx = Math.max(0, Math.min(highlightedIndex, filteredOptions.length - 1));
                  handleSelect(filteredOptions[targetIdx]);
                } else if (onAddNew && search.trim().length > 0) {
                  const q = search.trim();
                  setIsOpen(false);
                  onAddNew(q);
                }
              }}
            />
          </View>

          {/* List Options */}
          <ScrollView
            ref={listScrollRef}
            style={styles.list}
            contentContainerStyle={{ paddingBottom: 16 }}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
            indicatorStyle={isDarkMode ? "white" : "black"}
            keyboardShouldPersistTaps="handled"
          >
            {filteredOptions.length === 0 ? (
              <View style={styles.emptyItem}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No matching options
                </Text>
                {onAddNew && (
                  <Pressable
                    onPress={() => {
                      const q = search.trim();
                      setIsOpen(false);
                      onAddNew(q);
                    }}
                    style={({ hovered }: any) => [
                      styles.addNewBtn,
                      { backgroundColor: colors.activeBg, borderColor: colors.accent },
                      hovered && { opacity: 0.85 }
                    ]}
                  >
                    <Text style={[styles.addNewText, { color: colors.accent }]}>
                      + {addNewLabel || "Quick Add"} {search.trim() ? `"${search.trim()}"` : ""}
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <>
                {filteredOptions.map((opt, optIdx) => {
                  const isSelected = opt.value === value;
                  const isHighlighted = optIdx === highlightedIndex;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => handleSelect(opt)}
                      onHoverIn={() => { setHoveredItemId(opt.value); setHighlightedIndex(optIdx); }}
                      onHoverOut={() => setHoveredItemId(null)}
                      style={[
                        styles.listItem,
                        { borderBottomColor: colors.divider },
                        isSelected && { backgroundColor: colors.activeBg },
                        isHighlighted && !isSelected && { backgroundColor: colors.hoverBg },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.itemLabel,
                            {
                              color: isSelected ? colors.accent : isHighlighted ? colors.accent : colors.textPrimary,
                              fontWeight: isSelected || isHighlighted ? "700" : "400"
                            }
                          ]}
                        >
                          {opt.label}
                        </Text>
                        {opt.sublabel && (
                          <Text style={[styles.itemSublabel, { color: colors.textSecondary }]}>
                            {opt.sublabel}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
                {onAddNew && (
                  <Pressable
                    onPress={() => {
                      const q = search.trim();
                      setIsOpen(false);
                      onAddNew(q);
                    }}
                    style={({ hovered }: any) => [
                      styles.addNewBtn,
                      { backgroundColor: colors.activeBg, borderColor: colors.accent },
                      hovered && { opacity: 0.85 }
                    ]}
                  >
                    <Text style={[styles.addNewText, { color: colors.accent }]}>
                      + {addNewLabel || "Quick Add"} {search.trim() ? `"${search.trim()}"` : ""}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: "100%",
    position: "relative",
    zIndex: 9999,
  },
  backdrop: {
    position: "absolute",
    top: -2000,
    left: -2000,
    right: -2000,
    bottom: -2000,
    zIndex: 9998,
  },
  trigger: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 2,
    borderRadius: 6,
    paddingHorizontal: 12,
  },
  triggerText: {
    fontSize: 18,
    fontFamily: "Segoe UI Variable Text",
    flex: 1,
  },
  chevronIcon: {
    fontSize: 10,
    marginLeft: 8,
  },
  dropdown: {
    position: "absolute",
    top: 52,
    left: 0,
    right: 0,
    maxHeight: 280,
    borderWidth: 1,
    borderRadius: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10000,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    fontFamily: "Segoe UI Variable Text",
  },
  list: {
    flex: 1,
  },
  listItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  itemLabel: {
    fontSize: 16.5,
    fontFamily: "Segoe UI Variable Text",
  },
  itemSublabel: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: "Segoe UI Variable Text",
  },
  emptyItem: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Segoe UI Variable Text",
  },
  addNewBtn: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  addNewText: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
  },
});
