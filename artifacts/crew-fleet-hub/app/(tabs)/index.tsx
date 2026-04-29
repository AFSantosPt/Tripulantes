import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { StatPill } from "@/components/StatPill";
import { useAuth } from "@/contexts/AuthContext";
import { useShifts, ShiftWithCalc } from "@/contexts/ShiftsContext";
import { useColors } from "@/hooks/useColors";
import {
  AFFECTATION_LABELS,
  formatDateLong,
  formatHoursDecimal,
  formatMinutesToTime,
  isoMonthKey,
  monthLabel,
  todayIso,
} from "@/utils/time";

export default function ShiftsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { shifts } = useShifts();

  const currentMonthKey = isoMonthKey(todayIso());
  const monthShifts = useMemo(
    () => shifts.filter((s) => isoMonthKey(s.date) === currentMonthKey),
    [shifts, currentMonthKey],
  );

  const monthTotals = useMemo(() => {
    return monthShifts.reduce(
      (acc, s) => {
        acc.total += s.totalMinutes;
        acc.normal += s.normalMinutes;
        acc.extra += s.extraMinutes;
        return acc;
      },
      { total: 0, normal: 0, extra: 0 },
    );
  }, [monthShifts]);

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomTab = isWeb ? 84 : 70 + insets.bottom;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={shifts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: topPad + 8,
          paddingBottom: bottomTab + 24,
          paddingHorizontal: 20,
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: 18 }}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.greeting, { color: colors.mutedForeground }]}
                >
                  {greetingFor()}
                </Text>
                <Text style={[styles.name, { color: colors.foreground }]}>
                  {user?.name ?? "Tripulante"}
                </Text>
              </View>
              <Pressable
                onPress={signOut}
                style={({ pressed }) => [
                  styles.iconBtn,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Feather
                  name="log-out"
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>

            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: colors.primary,
                  borderRadius: colors.radius + 4,
                },
              ]}
            >
              <Text
                style={[
                  styles.summaryLabel,
                  { color: colors.primaryForeground, opacity: 0.7 },
                ]}
              >
                {monthLabel(currentMonthKey).toUpperCase()}
              </Text>
              <Text
                style={[
                  styles.summaryHours,
                  { color: colors.primaryForeground },
                ]}
              >
                {formatMinutesToTime(monthTotals.total)}
              </Text>
              <Text
                style={[
                  styles.summarySub,
                  { color: colors.primaryForeground, opacity: 0.7 },
                ]}
              >
                {formatHoursDecimal(monthTotals.total)} h ·{" "}
                {monthShifts.length} serviço
                {monthShifts.length === 1 ? "" : "s"}
              </Text>
              <View style={styles.summaryStats}>
                <View style={styles.summaryStat}>
                  <Text
                    style={[
                      styles.summaryStatLabel,
                      { color: colors.primaryForeground, opacity: 0.6 },
                    ]}
                  >
                    Normais
                  </Text>
                  <Text
                    style={[
                      styles.summaryStatValue,
                      { color: colors.primaryForeground },
                    ]}
                  >
                    {formatMinutesToTime(monthTotals.normal)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.summaryDivider,
                    { backgroundColor: colors.primaryForeground, opacity: 0.15 },
                  ]}
                />
                <View style={styles.summaryStat}>
                  <Text
                    style={[
                      styles.summaryStatLabel,
                      { color: colors.accent, opacity: 0.95 },
                    ]}
                  >
                    Extras
                  </Text>
                  <Text
                    style={[
                      styles.summaryStatValue,
                      { color: colors.accent },
                    ]}
                  >
                    {formatMinutesToTime(monthTotals.extra)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <StatPill
                label="Total registado"
                value={formatMinutesToTime(
                  shifts.reduce((acc, s) => acc + s.totalMinutes, 0),
                )}
              />
              <Pressable
                onPress={() => router.push("/shift-new")}
                style={({ pressed }) => [
                  styles.addBtn,
                  {
                    backgroundColor: colors.accent,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <Feather
                  name="plus"
                  size={18}
                  color={colors.accentForeground}
                />
                <Text
                  style={[
                    styles.addBtnLabel,
                    { color: colors.accentForeground },
                  ]}
                >
                  Novo serviço
                </Text>
              </Pressable>
            </View>

            <Text
              style={[
                styles.listTitle,
                { color: colors.mutedForeground, marginTop: 24 },
              ]}
            >
              Histórico
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => <ShiftRow shift={item} />}
        ListEmptyComponent={
          <EmptyState
            icon="calendar"
            title="Sem serviços registados"
            description="Adiciona o teu primeiro serviço para começar a contabilizar horas normais e extras."
          />
        }
        scrollEnabled={shifts.length > 0}
      />
    </View>
  );
}

function greetingFor(): string {
  const h = new Date().getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 13) return "Bom dia";
  if (h < 20) return "Boa tarde";
  return "Boa noite";
}

function ShiftRow({ shift }: { shift: ShiftWithCalc }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={styles.rowHead}>
        <Text style={[styles.rowDate, { color: colors.foreground }]}>
          {formatDateLong(shift.date)}
        </Text>
        <View
          style={[
            styles.tag,
            {
              backgroundColor:
                shift.affectation === "normal"
                  ? colors.muted
                  : colors.accent,
              borderRadius: 999,
            },
          ]}
        >
          <Text
            style={[
              styles.tagLabel,
              {
                color:
                  shift.affectation === "normal"
                    ? colors.mutedForeground
                    : colors.accentForeground,
              },
            ]}
          >
            {AFFECTATION_LABELS[shift.affectation]}
          </Text>
        </View>
      </View>

      <View style={styles.rowTimes}>
        <View style={styles.timeBlock}>
          <Text style={[styles.timeLabel, { color: colors.mutedForeground }]}>
            Início
          </Text>
          <Text style={[styles.timeValue, { color: colors.foreground }]}>
            {formatMinutesToTime(shift.startMinutes)}
          </Text>
        </View>
        <Feather name="arrow-right" size={16} color={colors.mutedForeground} />
        <View style={styles.timeBlock}>
          <Text style={[styles.timeLabel, { color: colors.mutedForeground }]}>
            Fim
          </Text>
          <Text style={[styles.timeValue, { color: colors.foreground }]}>
            {formatMinutesToTime(shift.endMinutes)}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.rowFoot,
          { borderTopColor: colors.border },
        ]}
      >
        <View style={styles.footStat}>
          <Text style={[styles.footLabel, { color: colors.mutedForeground }]}>
            Total
          </Text>
          <Text style={[styles.footValue, { color: colors.foreground }]}>
            {formatMinutesToTime(shift.totalMinutes)}
          </Text>
        </View>
        <View style={styles.footStat}>
          <Text style={[styles.footLabel, { color: colors.mutedForeground }]}>
            Normais
          </Text>
          <Text style={[styles.footValue, { color: colors.foreground }]}>
            {formatMinutesToTime(shift.normalMinutes)}
          </Text>
        </View>
        <View style={styles.footStat}>
          <Text style={[styles.footLabel, { color: colors.mutedForeground }]}>
            Extras
          </Text>
          <Text
            style={[
              styles.footValue,
              {
                color:
                  shift.extraMinutes > 0 ? colors.primary : colors.foreground,
              },
            ]}
          >
            {formatMinutesToTime(shift.extraMinutes)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  greeting: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  name: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.6,
    marginTop: 2,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  summaryCard: {
    padding: 22,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  summaryHours: {
    fontSize: 52,
    fontFamily: "Inter_700Bold",
    letterSpacing: -2,
    marginTop: 4,
  },
  summarySub: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  summaryStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    gap: 0,
  },
  summaryStat: { flex: 1 },
  summaryDivider: { width: 1, height: 36 },
  summaryStatLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryStatValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  addBtn: {
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 50,
  },
  addBtnLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  listTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  row: {
    borderWidth: 1,
    padding: 16,
  },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  rowDate: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize",
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
  },
  rowTimes: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  timeBlock: { gap: 2 },
  timeLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  timeValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  rowFoot: {
    flexDirection: "row",
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
    gap: 12,
  },
  footStat: { flex: 1 },
  footLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  footValue: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
});
