// =============================================================
// JK INFOTECH ERP — Reusable DataTable (Windows Fluent Style)
// File : src/components/ui/DataTable.tsx
// =============================================================

import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useUIStore } from "../../store/uiStore";

export interface ColumnDefinition<T> {
  header: string;
  accessorKey?: keyof T | string;
  accessorFn?: (row: T) => any;
  render?: (row: T, index: number) => React.ReactNode;
  align?: "left" | "right" | "center";
  flex?: number;
  width?: number;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDefinition<T>[];
  isLoading?: boolean;
  onRowPress?: (row: T) => void;
  selectedId?: string | number | null;
  virtualized?: boolean;
  emptyMessage?: string;
  loaderMessage?: string;
}

function naturalCompare(aStr: string, bStr: string): number {
  const ax: (string | number)[] = [];
  const bx: (string | number)[] = [];

  aStr.replace(/(\d+)|(\D+)/g, (_, $1, $2) => {
    ax.push($1 ? parseInt($1, 10) : $2.toLowerCase());
    return "";
  });

  bStr.replace(/(\d+)|(\D+)/g, (_, $1, $2) => {
    bx.push($1 ? parseInt($1, 10) : $2.toLowerCase());
    return "";
  });

  const maxLen = Math.max(ax.length, bx.length);
  for (let i = 0; i < maxLen; i++) {
    if (ax[i] === undefined) return -1;
    if (bx[i] === undefined) return 1;

    const valA = ax[i];
    const valB = bx[i];

    if (typeof valA === "number" && typeof valB === "number") {
      if (valA !== valB) return valA - valB;
    } else if (typeof valA === "string" && typeof valB === "string") {
      if (valA !== valB) return valA < valB ? -1 : 1;
    } else {
      return typeof valA === "number" ? -1 : 1;
    }
  }

  return 0;
}

export function DataTable<T extends { id?: string | number }>({
  data,
  columns,
  isLoading = false,
  onRowPress,
  selectedId = null,
  virtualized = true,
  emptyMessage = "No matching records found.",
  loaderMessage = "Retrieving registry records..."
}: DataTableProps<T>) {
  const { isDarkMode } = useUIStore();
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | "recent" | null>(null);

  const sortedData = React.useMemo(() => {
    if (!sortColumn || !sortDirection) return data;
    const sorted = [...data];
    sorted.sort((a, b) => {
      if (sortDirection === "recent") {
        const timeA = (a as any).updated_at || (a as any).created_at || (a as any).id || "";
        const timeB = (b as any).updated_at || (b as any).created_at || (b as any).id || "";
        if (timeA < timeB) return 1;
        if (timeA > timeB) return -1;
        return 0;
      }

      if (sortColumn === "#") {
        const idxA = data.indexOf(a);
        const idxB = data.indexOf(b);
        return sortDirection === "asc" ? idxA - idxB : idxB - idxA;
      }

      const col = columns.find(c => (c.accessorKey ?? c.header) === sortColumn);
      if (!col) return 0;

      let valA = col.accessorFn ? col.accessorFn(a) : (col.accessorKey ? (a as any)[col.accessorKey] : "");
      let valB = col.accessorFn ? col.accessorFn(b) : (col.accessorKey ? (b as any)[col.accessorKey] : "");

      if (valA === undefined || valA === null || valA === "") return sortDirection === "asc" ? 1 : -1;
      if (valB === undefined || valB === null || valB === "") return sortDirection === "asc" ? -1 : 1;

      let result = 0;
      if (typeof valA === "number" && typeof valB === "number") {
        result = valA - valB;
      } else {
        result = naturalCompare(String(valA), String(valB));
      }

      return sortDirection === "asc" ? result : -result;
    });
    return sorted;
  }, [data, sortColumn, sortDirection, columns]);

  const handleHeaderPress = (col: ColumnDefinition<T>) => {
    const colKey = (col.accessorKey ?? col.header) as string;
    if (sortColumn === colKey) {
      if (colKey === "#") {
        if (sortDirection === "recent") setSortDirection("asc");
        else if (sortDirection === "asc") setSortDirection("desc");
        else setSortDirection("recent");
      } else {
        if (sortDirection === "asc") setSortDirection("desc");
        else if (sortDirection === "desc") setSortDirection("recent");
        else setSortDirection("asc");
      }
    } else {
      setSortColumn(colKey);
      setSortDirection(colKey === "#" ? "recent" : "asc");
    }
  };

  const colors = isDarkMode
    ? {
        background: "#0F172A",
        cardBg: "#1E293B",
        cardBorder: "#334155",
        textPrimary: "#F8FAFC",
        textSecondary: "#94A3B8",
        accent: "#38BDF8",
        divider: "#334155",
        tableHeaderBg: "#1E293B",
        activeRowBg: "#0C4A6E",
        hoverRowBg: "#334155",
      }
    : {
        background: "#F8FAFC",
        cardBg: "#FFFFFF",
        cardBorder: "#E2E8F0",
        textPrimary: "#0F172A",
        textSecondary: "#64748B",
        accent: "#0284C7",
        divider: "#E2E8F0",
        tableHeaderBg: "#F1F5F9",
        activeRowBg: "#E0F2FE",
        hoverRowBg: "#F1F5F9",
      };

  const getCellValue = (row: T, col: ColumnDefinition<T>) => {
    if (col.accessorFn) return col.accessorFn(row);
    if (col.accessorKey) return (row as any)[col.accessorKey];
    return "";
  };

  const renderHeader = () => (
    <View style={[styles.headerRow, { backgroundColor: colors.tableHeaderBg, borderBottomColor: colors.divider, paddingLeft: 16, paddingRight: 32 }]}>
      {columns.map((col, idx) => {
        const isSortable = col.accessorKey || col.accessorFn || col.header === "#";
        const isCurrentSortCol = sortColumn === (col.accessorKey ?? col.header);
        
        return (
          <Pressable
            key={idx}
            disabled={!isSortable}
            onPress={() => handleHeaderPress(col)}
            style={[
              styles.cell,
              {
                flex: col.flex ?? 1,
                alignItems: col.align === "right" ? "flex-end" : col.align === "center" ? "center" : "flex-start"
              }
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={[styles.headerText, { color: isCurrentSortCol ? colors.accent : colors.textSecondary }]}>
                {col.header}
              </Text>
              {isSortable && (
                <Text style={{ fontSize: 11, color: isCurrentSortCol ? colors.accent : colors.textSecondary + "55" }}>
                  {isCurrentSortCol ? (sortDirection === "asc" ? " ▲" : sortDirection === "desc" ? " ▼" : " ⟲") : " ↕"}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  const renderRow = ({ item, index }: { item: T; index: number }) => {
    const rowId = item.id !== undefined ? item.id : index;
    const isSelected = selectedId !== null && selectedId === rowId;

    const actionCols = columns.filter(col => col.header === "ACTION");
    const contentCols = columns.filter(col => col.header !== "ACTION");

    return (
      <Pressable
        key={rowId.toString()}
        style={[
          styles.row,
          { borderBottomColor: colors.divider, paddingHorizontal: 0 },
          isSelected && { backgroundColor: colors.activeRowBg }
        ]}
      >
        {/* Clickable content area */}
        <Pressable
          onPress={() => onRowPress?.(item)}
          style={{
            flexDirection: "row",
            flex: contentCols.reduce((acc, col) => acc + (col.flex ?? 1), 0),
            paddingLeft: 16,
            paddingRight: actionCols.length > 0 ? 8 : 24,
            paddingVertical: 8,
            alignItems: "center"
          }}
        >
          {contentCols.map((col, idx) => (
            <View
              key={idx}
              style={[
                styles.cell,
                {
                  flex: col.flex ?? 1,
                  alignItems: col.align === "right" ? "flex-end" : col.align === "center" ? "center" : "flex-start"
                }
              ]}
            >
              {col.render ? (
                col.render(item, index)
              ) : (
                <Text style={[styles.cellText, { color: colors.textPrimary }]} numberOfLines={1}>
                  {String(getCellValue(item, col))}
                </Text>
              )}
            </View>
          ))}
        </Pressable>

        {/* Action columns (Not clickable for row details) */}
        {actionCols.map((col, idx) => (
          <View
            key={idx}
            style={[
              styles.cell,
              {
                flex: col.flex ?? 1,
                alignItems: col.align === "right" ? "flex-end" : col.align === "center" ? "center" : "flex-start",
                paddingRight: 24,
                paddingVertical: 8,
                justifyContent: "center"
              }
            ]}
          >
            {col.render?.(item, index)}
          </View>
        ))}
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { borderColor: colors.cardBorder }]}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{loaderMessage}</Text>
      </View>
    );
  }

  const renderContent = () => {
    if (!virtualized) {
      return (
        <View style={[styles.tableContainer, { borderColor: colors.cardBorder }]}>
          {renderHeader()}
          {sortedData.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{emptyMessage}</Text>
            </View>
          ) : (
            sortedData.map((item, index) => renderRow({ item, index }))
          )}
        </View>
      );
    }

    return (
      <View style={[styles.tableContainer, { borderColor: colors.cardBorder }]}>
        {renderHeader()}
        <FlatList
          data={sortedData}
          renderItem={renderRow}
          keyExtractor={(item, index) => (item.id !== undefined ? item.id.toString() : index.toString())}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={{ paddingRight: 12 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{emptyMessage}</Text>
            </View>
          }
        />
      </View>
    );
  };

  return renderContent();
}

const styles = StyleSheet.create({
  tableContainer: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    height: 40,
    alignItems: "center",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  headerText: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Segoe UI Variable Text",
  },
  row: {
    flexDirection: "row",
    minHeight: 48,
    height: "auto",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  cell: {
    paddingRight: 12,
    justifyContent: "center",
  },
  cellText: {
    fontSize: 15,
    fontFamily: "Segoe UI Variable Text",
  },
  loadingContainer: {
    height: 250,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Segoe UI Variable Text",
  },
  emptyContainer: {
    height: 180,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Segoe UI Variable Text",
  }
});
