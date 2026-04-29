import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

interface MonthCalendarProps {
  selectedDate: string;
  onSelectDate: (iso: string) => void;
  markedDates?: string[];
  todayIso: string;
}

const WEEKDAYS_PT = ["D", "S", "T", "Q", "Q", "S", "S"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function makeIso(year: number, monthZeroBased: number, day: number): string {
  return `${year}-${pad(monthZeroBased + 1)}-${pad(day)}`;
}

function monthName(year: number, monthZeroBased: number): string {
  const d = new Date(year, monthZeroBased, 1);
  const s = d.toLocaleDateString("pt-PT", {
    month: "long",
    year: "numeric",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface Cell {
  iso: string;
  day: number;
  inMonth: boolean;
}

function buildCells(year: number, month: number): Cell[] {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Cell[] = [];

  const prevMonthDate = new Date(year, month, 0);
  const prevMonthDays = prevMonthDate.getDate();
  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const d = new Date(year, month - 1, day);
    cells.push({
      iso: makeIso(d.getFullYear(), d.getMonth(), day),
      day,
      inMonth: false,
    });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      iso: makeIso(year, month, day),
      day,
      inMonth: true,
    });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const lastDate = new Date(last.iso + "T00:00:00");
    const next = new Date(
      lastDate.getFullYear(),
      lastDate.getMonth(),
      lastDate.getDate() + 1,
    );
    cells.push({
      iso: makeIso(next.getFullYear(), next.getMonth(), next.getDate()),
      day: next.getDate(),
      inMonth: false,
    });
  }
  if (cells.length < 42) {
    while (cells.length < 42) {
      const last = cells[cells.length - 1];
      const lastDate = new Date(last.iso + "T00:00:00");
      const next = new Date(
        lastDate.getFullYear(),
        lastDate.getMonth(),
        lastDate.getDate() + 1,
      );
      cells.push({
        iso: makeIso(next.getFullYear(), next.getMonth(), next.getDate()),
        day: next.getDate(),
        inMonth: false,
      });
    }
  }
  return cells;
}

export function MonthCalendar({
  selectedDate,
  onSelectDate,
  markedDates = [],
  todayIso,
}: MonthCalendarProps) {
  const colors = useColors();
  const initial = new Date(selectedDate + "T00:00:00");
  const [view, setView] = useState<{ year: number; month: number }>({
    year: initial.getFullYear(),
    month: initial.getMonth(),
  });

  useEffect(() => {
    const d = new Date(selectedDate + "T00:00:00");
    setView({ year: d.getFullYear(), month: d.getMonth() });
  }, [selectedDate]);

  const cells = useMemo(
    () => buildCells(view.year, view.month),
    [view.year, view.month],
  );

  const markedSet = useMemo(() => new Set(markedDates), [markedDates]);

  const goPrev = () => {
    setView((v) => {
      const m = v.month - 1;
      if (m < 0) return { year: v.year - 1, month: 11 };
      return { year: v.year, month: m };
    });
  };
  const goNext = () => {
    setView((v) => {
      const m = v.month + 1;
      if (m > 11) return { year: v.year + 1, month: 0 };
      return { year: v.year, month: m };
    });
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Pressable
          onPress={goPrev}
          hitSlop={10}
          style={({ pressed }) => [
            styles.navBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Feather name="chevron-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {monthName(view.year, view.month)}
        </Text>
        <Pressable
          onPress={goNext}
          hitSlop={10}
          style={({ pressed }) => [
            styles.navBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Feather name="chevron-right" size={20} color={colors.foreground} />
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {WEEKDAYS_PT.map((w, i) => (
          <Text
            key={i}
            style={[styles.weekLabel, { color: colors.mutedForeground }]}
          >
            {w}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((c) => {
          const isSelected = c.iso === selectedDate;
          const isToday = c.iso === todayIso;
          const hasMark = markedSet.has(c.iso);
          const dim = !c.inMonth;
          return (
            <Pressable
              key={c.iso + (c.inMonth ? "" : "-out")}
              onPress={() => onSelectDate(c.iso)}
              style={({ pressed }) => [
                styles.cell,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View
                style={[
                  styles.cellInner,
                  isSelected && {
                    backgroundColor: colors.accent,
                  },
                  !isSelected && isToday && {
                    borderWidth: 1.5,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.cellText,
                    {
                      color: isSelected
                        ? colors.accentForeground
                        : dim
                          ? colors.mutedForeground
                          : colors.foreground,
                      opacity: dim ? 0.4 : 1,
                      fontFamily: isSelected
                        ? "Inter_700Bold"
                        : isToday
                          ? "Inter_700Bold"
                          : "Inter_500Medium",
                    },
                  ]}
                >
                  {c.day}
                </Text>
                {hasMark ? (
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: isSelected
                          ? colors.accentForeground
                          : colors.primary,
                      },
                    ]}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  navBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  weekRow: {
    flexDirection: "row",
    paddingVertical: 6,
  },
  weekLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
  },
  cellInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    position: "relative",
  },
  cellText: {
    fontSize: 14,
  },
  dot: {
    position: "absolute",
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 999,
  },
});
