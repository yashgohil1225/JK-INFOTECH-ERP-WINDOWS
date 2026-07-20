import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
} from "react-native";
import { useUIStore } from "../../store/uiStore";

interface DatePickerProps {
  value: string; // YYYY-MM-DD or DD-MM-YYYY
  onChange: (value: string) => void;
  label?: string;
  style?: any;
}

interface CalendarPickerProps {
  value: string;
  onChange: (value: string) => void;
}

const MONTHS_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const getMaxDays = (month: number, year: number): number => {
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    return isLeap ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
};

export const isISOFormat = (val: string): boolean => {
  if (!val) return false;
  const clean = val.replace(/[^\d]/g, "-");
  const parts = clean.split("-").filter(Boolean);
  return parts.length > 0 && parts[0].length === 4;
};

export const parseAnyDate = (val: string) => {
  const todayDate = new Date();
  if (!val) {
    return {
      day: todayDate.getDate(),
      month: todayDate.getMonth(),
      year: todayDate.getFullYear(),
    };
  }

  const parts = val.replace(/[^\d]/g, "-").split("-").filter(Boolean);
  if (parts.length < 3) {
    return {
      day: todayDate.getDate(),
      month: todayDate.getMonth(),
      year: todayDate.getFullYear(),
    };
  }

  let day = 1;
  let month = 0;
  let year = todayDate.getFullYear();

  if (parts[0].length === 4) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  } else {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    year = parseInt(parts[2], 10);
  }

  if (month < 0) month = 0;
  if (month > 11) month = 11;

  if (year < 100) {
    year = 2000 + year;
  } else if (year < 1000) {
    year = 2000 + (year % 100);
  }

  const maxDays = getMaxDays(month + 1, year);
  if (day < 1) day = 1;
  if (day > maxDays) {
    day = maxDays;
  }

  return { day, month, year };
};

export function DatePicker({ value, onChange, label, style }: DatePickerProps) {
  const { isDarkMode, setActiveDatePicker } = useUIStore();
  const [inputVal, setInputVal] = useState("");

  useEffect(() => {
    if (!value) {
      setInputVal("");
      return;
    }
    const { day, month, year } = parseAnyDate(value);
    const dStr = String(day).padStart(2, "0");
    const mStr = String(month + 1).padStart(2, "0");
    const yStr = String(year).padStart(4, "0");
    setInputVal(`${dStr}/${mStr}/${yStr}`);
  }, [value]);

  const colors = isDarkMode
    ? {
        inputBg: "#1E293B",
        inputBorder: "#334155",
        textPrimary: "#F8FAFC",
        textSecondary: "#94A3B8",
      }
    : {
        inputBg: "#FFFFFF",
        inputBorder: "#CBD5E1",
        textPrimary: "#0F172A",
        textSecondary: "#64748B",
      };

  const handleTextChange = (text: string) => {
    const cleaned = text.replace(/[^\d]/g, "");
    let formatted = cleaned;

    if (cleaned.length > 2) {
      formatted = cleaned.slice(0, 2) + "/" + cleaned.slice(2);
    }
    if (cleaned.length > 4) {
      formatted = formatted.slice(0, 5) + "/" + cleaned.slice(4, 8);
    }

    setInputVal(formatted);

    if (cleaned.length === 8) {
      const parsed = parseAnyDate(formatted);

      const yStr = String(parsed.year).padStart(4, "0");
      const mStr = String(parsed.month + 1).padStart(2, "0");
      const dStr = String(parsed.day).padStart(2, "0");

      onChange(`${yStr}-${mStr}-${dStr}`);
    }
  };

  const handleBlur = () => {
    if (!inputVal) {
      onChange("");
      return;
    }
    const parsed = parseAnyDate(inputVal);

    const yStr = String(parsed.year).padStart(4, "0");
    const mStr = String(parsed.month + 1).padStart(2, "0");
    const dStr = String(parsed.day).padStart(2, "0");

    onChange(`${yStr}-${mStr}-${dStr}`);
    setInputVal(`${dStr}/${mStr}/${yStr}`);
  };

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.inputBg,
            borderColor: colors.inputBorder,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: colors.textPrimary }]}
          value={inputVal}
          onChangeText={handleTextChange}
          onBlur={handleBlur}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={colors.textSecondary}
          keyboardType="numeric"
          maxLength={10}
        />
        <Pressable
          onPress={() => setActiveDatePicker({ value, onChange, title: label || "Select Date" })}
          style={({ hovered }: any) => [
            styles.calendarBtn,
            hovered && { backgroundColor: isDarkMode ? "#334155" : "#E2E8F0" },
          ]}
        >
          <Text style={{ fontFamily: "Segoe MDL2 Assets", fontSize: 16, color: colors.textPrimary }}>
            {"\uE787"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function CalendarPicker({ value, onChange }: CalendarPickerProps) {
  const { isDarkMode } = useUIStore();
  const [calState, setCalState] = useState(() => {
    const { month, year } = parseAnyDate(value);
    return { month, year };
  });

  const colors = isDarkMode
    ? {
        textPrimary: "#F8FAFC",
        textSecondary: "#94A3B8",
        accent: "#38BDF8",
        divider: "#334155",
        cardBg: "#1E293B",
        cellHover: "#334155",
        cellSelected: "#0284C7",
        btnText: "#FFFFFF",
      }
    : {
        textPrimary: "#0F172A",
        textSecondary: "#64748B",
        accent: "#0078D4",
        divider: "#E2E8F0",
        cardBg: "#FFFFFF",
        cellHover: "#E2E8F0",
        cellSelected: "#0078D4",
        btnText: "#FFFFFF",
      };

  const prevMonth = () => {
    setCalState((prev) => {
      if (prev.month === 0) {
        return { month: 11, year: prev.year - 1 };
      }
      return { ...prev, month: prev.month - 1 };
    });
  };

  const nextMonth = () => {
    setCalState((prev) => {
      if (prev.month === 11) {
        return { month: 0, year: prev.year + 1 };
      }
      return { ...prev, month: prev.month + 1 };
    });
  };

  const prevYear = () => {
    setCalState((prev) => ({ ...prev, year: prev.year - 1 }));
  };

  const nextYear = () => {
    setCalState((prev) => ({ ...prev, year: prev.year + 1 }));
  };

  const buildCalendarGrid = () => {
    const { month, year } = calState;
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const grid = [];

    // Prior month days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      grid.push({
        day: daysInPrevMonth - i,
        month: month === 0 ? 11 : month - 1,
        year: month === 0 ? year - 1 : year,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      grid.push({
        day: i,
        month: month,
        year: year,
        isCurrentMonth: true,
      });
    }

    // Next month days
    const remaining = 42 - grid.length;
    for (let i = 1; i <= remaining; i++) {
      grid.push({
        day: i,
        month: month === 11 ? 0 : month + 1,
        year: month === 11 ? year + 1 : year,
        isCurrentMonth: false,
      });
    }

    return grid;
  };

  const handleSelectDay = (day: number, m: number, y: number) => {
    const yStr = String(y).padStart(4, "0");
    const mStr = String(m + 1).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");

    onChange(`${yStr}-${mStr}-${dStr}`);
  };

  const grid = buildCalendarGrid();

  const isSelectedDay = (day: number, m: number, y: number) => {
    if (!value) return false;
    const parsed = parseAnyDate(value);
    return (
      parsed.day === day &&
      parsed.month === m &&
      parsed.year === y
    );
  };

  const rows = [];
  for (let i = 0; i < 6; i++) {
    rows.push(grid.slice(i * 7, (i + 1) * 7));
  }

  return (
    <View style={{ gap: 10, width: "100%" }}>
      {/* Header Month/Year Selector Controls */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        {/* Year navigation */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Pressable onPress={prevYear} style={styles.navBtn}>
            <Text style={{ fontSize: 11, color: colors.textPrimary, fontFamily: "Segoe MDL2 Assets" }}>
              {"\uE892"}
            </Text>
          </Pressable>
          <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary, width: 42, textAlign: "center", fontFamily: "Segoe UI Variable Text" }}>
            {calState.year}
          </Text>
          <Pressable onPress={nextYear} style={styles.navBtn}>
            <Text style={{ fontSize: 11, color: colors.textPrimary, fontFamily: "Segoe MDL2 Assets" }}>
              {"\uE893"}
            </Text>
          </Pressable>
        </View>

        {/* Month navigation */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Pressable onPress={prevMonth} style={styles.navBtn}>
            <Text style={{ fontSize: 11, color: colors.textPrimary, fontFamily: "Segoe MDL2 Assets" }}>
              {"\uE76B"}
            </Text>
          </Pressable>
          <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary, width: 85, textAlign: "center", fontFamily: "Segoe UI Variable Text" }}>
            {MONTHS_NAMES[calState.month]}
          </Text>
          <Pressable onPress={nextMonth} style={styles.navBtn}>
            <Text style={{ fontSize: 11, color: colors.textPrimary, fontFamily: "Segoe MDL2 Assets" }}>
              {"\uE76C"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Weekdays header row */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {WEEKDAYS.map((w, idx) => (
          <View key={idx} style={styles.gridCellHeader}>
            <Text style={{ fontSize: 11.5, fontWeight: "700", color: colors.textSecondary, fontFamily: "Segoe UI Variable Text" }}>
              {w}
            </Text>
          </View>
        ))}
      </View>

      {/* 6 rows of 7 days calendar grid */}
      <View style={{ gap: 4 }}>
        {rows.map((row, rowIdx) => (
          <View key={rowIdx} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {row.map((cell, cellIdx) => {
              const isSel = isSelectedDay(cell.day, cell.month, cell.year);
              return (
                <Pressable
                  key={cellIdx}
                  onPress={() => handleSelectDay(cell.day, cell.month, cell.year)}
                  style={({ hovered }: any) => [
                    styles.gridCell,
                    isSel && { backgroundColor: colors.cellSelected },
                    !isSel && hovered && { backgroundColor: colors.cellHover },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: cell.isCurrentMonth || isSel ? "600" : "400",
                      color: isSel
                        ? colors.btnText
                        : cell.isCurrentMonth
                        ? colors.textPrimary
                        : colors.textSecondary,
                      fontFamily: "Segoe UI Variable Text",
                    }}
                  >
                    {cell.day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 14.5,
    fontWeight: "700",
    letterSpacing: 0.5,
    fontFamily: "Segoe UI Variable Text",
  },
  inputContainer: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 6,
    height: 38,
    alignItems: "center",
    overflow: "hidden",
  },
  input: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 13.5,
    fontFamily: "Segoe UI Variable Text",
    paddingVertical: 0,
  },
  calendarBtn: {
    width: 38,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderLeftWidth: 1,
    borderLeftColor: "transparent",
  },
  navBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  gridCellHeader: {
    width: 38,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  gridCell: {
    width: 38,
    height: 32,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
});
