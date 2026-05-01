import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MonthCalendar } from "@/components/MonthCalendar";
import { useConfirm } from "@/components/ConfirmModal";
import { useAuth } from "@/contexts/AuthContext";
import { useNotices } from "@/contexts/NoticesContext";
import { useShifts, ShiftWithCalc } from "@/contexts/ShiftsContext";
import { VEHICLE_LABELS, VehicleKind } from "@/contexts/BreakdownsContext";
import { FOLGA_GROUPS, FolgaGroup, getFolgaDaysForYear } from "@/utils/folgaSchedule";
import { useColors } from "@/hooks/useColors";
import {
  affectationDisplay,
  dateYear,
  displayDateToIso,
  formatDayHeadline,
  formatHoursDecimal,
  formatMinutesToTime,
  isoMonthKey,
  isoToDisplayDate,
  monthLabel,
  todayIso,
} from "@/utils/time";

export default function ShiftsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { unreadCount: noticesUnread } = useNotices();
  const { shifts, setMultipleSwapAvailable } = useShifts();

  const today = todayIso();
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const currentMonthKey = isoMonthKey(selectedDate);

  const defaultRangeStart = today.substring(0, 7) + "-01";
  const defaultRangeEnd = (() => {
    const y = parseInt(today.substring(0, 4), 10);
    const m = parseInt(today.substring(5, 7), 10);
    const lastDay = new Date(y, m, 0);
    const dd = String(lastDay.getDate()).padStart(2, "0");
    const mm = String(lastDay.getMonth() + 1).padStart(2, "0");
    return `${lastDay.getFullYear()}-${mm}-${dd}`;
  })();

  const [rangeStart, setRangeStart] = useState<string>(defaultRangeStart);
  const [rangeEnd, setRangeEnd] = useState<string>(defaultRangeEnd);
  const [rangeStartText, setRangeStartText] = useState<string>(
    isoToDisplayDate(defaultRangeStart),
  );
  const [rangeEndText, setRangeEndText] = useState<string>(
    isoToDisplayDate(defaultRangeEnd),
  );

  const handleRangeStartChange = (text: string) => {
    setRangeStartText(text);
    const iso = displayDateToIso(text);
    if (iso) setRangeStart(iso);
  };
  const handleRangeEndChange = (text: string) => {
    setRangeEndText(text);
    const iso = displayDateToIso(text);
    if (iso) setRangeEnd(iso);
  };

  const rangeShifts = useMemo(
    () =>
      shifts.filter(
        (s) => s.date >= rangeStart && s.date <= rangeEnd,
      ),
    [shifts, rangeStart, rangeEnd],
  );
  const monthTotals = useMemo(() => {
    return rangeShifts.reduce(
      (acc, s) => {
        acc.total += s.totalMinutes;
        acc.normal += s.normalMinutes;
        acc.extra += s.extraMinutes;
        acc.holidayDays += s.holidayMinutes > 0 ? 1 : 0;
        return acc;
      },
      { total: 0, normal: 0, extra: 0, holidayDays: 0 },
    );
  }, [rangeShifts]);

  const markedDates = useMemo(
    () => Array.from(new Set(shifts.map((s) => s.date))),
    [shifts],
  );

  const folgaDates = useMemo(() => {
    const group = user?.folgaGroup;
    if (!group || !FOLGA_GROUPS.includes(group as FolgaGroup)) return [];
    return [
      ...getFolgaDaysForYear(group as FolgaGroup, 2026),
      ...getFolgaDaysForYear(group as FolgaGroup, 2027),
    ];
  }, [user?.folgaGroup]);

  const dayShifts = useMemo(
    () =>
      shifts
        .filter((s) => s.date === selectedDate)
        .sort((a, b) => a.startMinutes - b.startMinutes),
    [shifts, selectedDate],
  );

  const isSwapDay = dayShifts.length > 0 && dayShifts.every((s) => s.availableForSwap);

  const handleToggleDaySwap = () => {
    const ids = dayShifts.map((s) => s.id);
    setMultipleSwapAvailable(ids, !isSwapDay);
  };

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomTab = isWeb ? 84 : 70 + insets.bottom;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 8,
          paddingBottom: bottomTab + 24,
          paddingHorizontal: 20,
          gap: 16,
        }}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
              {greetingFor()}
            </Text>
            <Text style={[styles.name, { color: colors.foreground }]}>
              {user?.name ?? "Tripulante"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => router.push("/(tabs)/notices")}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: colors.card,
                  borderColor: noticesUnread > 0 ? colors.destructive : colors.border,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Feather
                name="bell"
                size={18}
                color={noticesUnread > 0 ? colors.destructive : colors.mutedForeground}
              />
              {noticesUnread > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    backgroundColor: colors.destructive,
                    borderRadius: 8,
                    minWidth: 16,
                    height: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 3,
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 9,
                      fontFamily: "Inter_700Bold",
                      lineHeight: 12,
                    }}
                  >
                    {noticesUnread > 9 ? "9+" : String(noticesUnread)}
                  </Text>
                </View>
              )}
            </Pressable>
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
          <View style={styles.rangeRow}>
            <View style={styles.rangeField}>
              <Text style={styles.rangeFieldLabel}>De</Text>
              <TextInput
                style={[
                  styles.rangeInput,
                  { color: colors.primaryForeground },
                ]}
                value={rangeStartText}
                onChangeText={handleRangeStartChange}
                placeholder="DD-MM-AAAA"
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="numeric"
                maxLength={10}
                returnKeyType="done"
              />
            </View>
            <Feather
              name="arrow-right"
              size={14}
              color="rgba(255,255,255,0.5)"
              style={{ marginTop: 18 }}
            />
            <View style={styles.rangeField}>
              <Text style={styles.rangeFieldLabel}>Até</Text>
              <TextInput
                style={[
                  styles.rangeInput,
                  { color: colors.primaryForeground },
                ]}
                value={rangeEndText}
                onChangeText={handleRangeEndChange}
                placeholder="DD-MM-AAAA"
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="numeric"
                maxLength={10}
                returnKeyType="done"
              />
            </View>
          </View>
          <Text
            style={[styles.summaryHours, { color: colors.primaryForeground }]}
          >
            {formatMinutesToTime(monthTotals.total)}
          </Text>
          <Text
            style={[
              styles.summarySub,
              { color: colors.primaryForeground, opacity: 0.7 },
            ]}
          >
            {formatHoursDecimal(monthTotals.total)} h · {rangeShifts.length}{" "}
            serviço{rangeShifts.length === 1 ? "" : "s"}
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
                {
                  backgroundColor: colors.primaryForeground,
                  opacity: 0.15,
                },
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
            <View
              style={[
                styles.summaryDivider,
                {
                  backgroundColor: colors.primaryForeground,
                  opacity: 0.15,
                },
              ]}
            />
            <View style={styles.summaryStat}>
              <Text
                style={[
                  styles.summaryStatLabel,
                  { color: colors.success, opacity: 0.95 },
                ]}
              >
                Feriados
              </Text>
              <Text
                style={[
                  styles.summaryStatValue,
                  { color: colors.success },
                ]}
              >
                {monthTotals.holidayDays}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.dateBanner,
            {
              backgroundColor: colors.accent,
              borderRadius: colors.radius + 4,
            },
          ]}
        >
          <Text
            style={[
              styles.dateBannerYear,
              { color: colors.accentForeground, opacity: 0.7 },
            ]}
          >
            {dateYear(selectedDate)}
          </Text>
          <Text
            style={[styles.dateBannerHeadline, { color: colors.accentForeground }]}
          >
            {formatDayHeadline(selectedDate)}
          </Text>
        </View>

        <MonthCalendar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          markedDates={markedDates}
          folgaDates={folgaDates}
          todayIso={today}
        />

        <View style={styles.dayHeader}>
          <Text style={[styles.dayTitle, { color: colors.foreground }]}>
            Serviços do dia
          </Text>
          <View style={styles.dayHeaderActions}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/shift-import",
                  params: { date: selectedDate },
                })
              }
              style={({ pressed }) => [
                styles.importBtn,
                {
                  backgroundColor: colors.muted,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Feather
                name="download"
                size={16}
                color={colors.foreground}
              />
              <Text
                style={[styles.addBtnLabel, { color: colors.foreground }]}
              >
                Importar
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/shift-new",
                  params: { date: selectedDate },
                })
              }
              style={({ pressed }) => [
                styles.addBtn,
                {
                  backgroundColor: colors.accent,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Feather name="plus" size={16} color={colors.accentForeground} />
              <Text
                style={[styles.addBtnLabel, { color: colors.accentForeground }]}
              >
                Novo
              </Text>
            </Pressable>
          </View>
        </View>

        {dayShifts.length === 0 ? (
          <View
            style={[
              styles.emptyDay,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="calendar" size={22} color={colors.mutedForeground} />
            <Text
              style={[styles.emptyDayText, { color: colors.mutedForeground }]}
            >
              Sem serviços neste dia.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {dayShifts.map((s) => (
              <ServiceCard key={s.id} shift={s} today={today} />
            ))}
            {selectedDate >= today ? (
              <Pressable
                onPress={handleToggleDaySwap}
                style={({ pressed }) => [
                  styles.daySwapToggle,
                  {
                    backgroundColor: isSwapDay
                      ? colors.primary + "12"
                      : colors.card,
                    borderColor: isSwapDay ? colors.primary : colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Feather
                  name={isSwapDay ? "check-square" : "square"}
                  size={18}
                  color={isSwapDay ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.daySwapToggleText,
                    {
                      color: isSwapDay
                        ? colors.primary
                        : colors.mutedForeground,
                    },
                  ]}
                >
                  Disponível para troca
                </Text>
                {isSwapDay ? (
                  <Text
                    style={[
                      styles.daySwapToggleHint,
                      { color: colors.primary },
                    ]}
                  >
                    · {dayShifts.length}{" "}
                    {dayShifts.length === 1 ? "serviço" : "serviços"}
                  </Text>
                ) : null}
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
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

function affectationBadgeColors(
  affectation: string,
  colors: ReturnType<typeof useColors>,
): { bg: string; text: string } {
  switch (affectation) {
    case "normalFO":
      return { bg: colors.success + "22", text: colors.success };
    case "extra1":
    case "extra2":
      return { bg: colors.accent, text: colors.accentForeground };
    case "folga":
      return { bg: colors.muted, text: colors.mutedForeground };
    case "ferias":
      return { bg: colors.primary + "18", text: colors.primary };
    default:
      return { bg: colors.muted, text: colors.mutedForeground };
  }
}

function ServiceCard({ shift, today }: { shift: ShiftWithCalc; today: string }) {
  const colors = useColors();
  const router = useRouter();
  const { removeShift } = useShifts();
  const { confirm, modal } = useConfirm();
  const codeLabel = shift.code?.trim() || "Sem código";
  const vehicleLabel = shift.vehicleCode?.trim();
  const kindLabel = shift.vehicleKind
    ? VEHICLE_LABELS[shift.vehicleKind as VehicleKind]
    : null;
  const affLabel =
    affectationDisplay(shift.affectation, shift.affectationLabel);
  const isPast = shift.date < today;
  const isAbsence = shift.affectation === "folga" || shift.affectation === "ferias";
  const badge = affectationBadgeColors(shift.affectation, colors);

  const handleDelete = () => {
    confirm({
      title: "Apagar serviço",
      message: "Esta ação não pode ser revertida.",
      confirmLabel: "Apagar",
      destructive: true,
      onConfirm: () => removeShift(shift.id),
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
      {modal}
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.cardKicker, { color: colors.mutedForeground }]}
          >
            {isAbsence ? "Ausência" : "Serviço"}
          </Text>
          <Text style={[styles.cardCode, { color: isAbsence ? badge.text : colors.primary }]}>
            {isAbsence ? affLabel : codeLabel}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {shift.availableForSwap && !isPast ? (
            <View
              style={[
                styles.tag,
                {
                  backgroundColor: colors.primary + "18",
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.primary,
                },
              ]}
            >
              <Text style={[styles.tagLabel, { color: colors.primary }]}>
                Troca
              </Text>
            </View>
          ) : null}
          {!isAbsence && kindLabel ? (
            <View
              style={[
                styles.tag,
                {
                  backgroundColor: colors.muted,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.tagLabel, { color: colors.mutedForeground }]}>
                {kindLabel}
              </Text>
            </View>
          ) : null}
          {!isAbsence ? (
            <View
              style={[styles.tag, { backgroundColor: badge.bg, borderRadius: 999 }]}
            >
              <Text style={[styles.tagLabel, { color: badge.text }]}>
                {affLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {!isAbsence && vehicleLabel ? (
        <View style={styles.vehicleRow}>
          <Feather name="truck" size={13} color={colors.mutedForeground} />
          <Text
            style={[styles.vehicleText, { color: colors.mutedForeground }]}
          >
            Serviço de Viatura:{" "}
            <Text style={{ color: colors.foreground }}>{vehicleLabel}</Text>
          </Text>
        </View>
      ) : null}

      {!isAbsence && shift.stops.length > 0 ? (
        <View style={[styles.stopsBox, { borderTopColor: colors.border }]}>
          {shift.stops.map((stop, idx) => (
            <View key={idx} style={styles.stopRow}>
              <Text
                style={[styles.stopLocation, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {stop.location?.trim() || "—"}
              </Text>
              <Text style={[styles.stopTime, { color: colors.foreground }]}>
                {stop.time}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {!isAbsence && shift.notes ? (
        <Text style={[styles.notes, { color: colors.mutedForeground }]}>
          {shift.notes}
        </Text>
      ) : null}

      {!isAbsence ? (
        <View style={[styles.cardFoot, { borderTopColor: colors.border }]}>
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
      ) : null}

      <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/shift-new",
              params: { id: shift.id, date: shift.date },
            })
          }
          style={({ pressed }) => [
            styles.cardActionBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="edit-2" size={15} color={colors.mutedForeground} />
          <Text style={[styles.cardActionLabel, { color: colors.mutedForeground }]}>
            Editar
          </Text>
        </Pressable>
        <View style={[styles.cardActionDivider, { backgroundColor: colors.border }]} />
        <Pressable
          onPress={handleDelete}
          style={({ pressed }) => [
            styles.cardActionBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="trash-2" size={15} color={colors.destructive} />
          <Text style={[styles.cardActionLabel, { color: colors.destructive }]}>
            Apagar
          </Text>
        </Pressable>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
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
  rangeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginBottom: 4,
  },
  rangeField: {
    flex: 1,
    gap: 2,
  },
  rangeFieldLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  rangeInput: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.25)",
    paddingBottom: 4,
    paddingTop: 2,
  },
  summaryHours: {
    fontSize: 44,
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
    marginTop: 14,
  },
  summaryStat: { flex: 1 },
  summaryDivider: { width: 1, height: 32 },
  summaryStatLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryStatValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
  },
  dateBanner: {
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  dateBannerYear: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  dateBannerHeadline: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.6,
    marginTop: 2,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  dayTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  dayHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addBtnLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  emptyDay: {
    borderWidth: 1,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyDayText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  card: {
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardKicker: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  cardCode: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
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
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vehicleText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  stopsBox: {
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 6,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 4,
  },
  stopLocation: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  stopTime: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums"],
  },
  notes: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    fontStyle: "italic",
  },
  cardFoot: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 10,
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
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
  },
  cardActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 8,
    gap: 0,
  },
  cardActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  cardActionLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  cardActionDivider: {
    width: 1,
    marginVertical: 4,
  },
  daySwapToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  daySwapToggleText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  daySwapToggleHint: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
