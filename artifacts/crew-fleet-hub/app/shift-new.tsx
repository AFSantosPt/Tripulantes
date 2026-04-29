import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TextField } from "@/components/TextField";
import { useShifts, ShiftStop } from "@/contexts/ShiftsContext";
import { useColors } from "@/hooks/useColors";
import {
  AffectationType,
  calcShiftMinutes,
  formatHoursDecimal,
  formatMinutesToTime,
  parseTimeToMinutes,
  todayIso,
} from "@/utils/time";

interface DraftStop {
  location: string;
  time: string;
}

export default function NewShiftScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addShift } = useShifts();
  const params = useLocalSearchParams<{ date?: string }>();
  const initialDate =
    typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : todayIso();

  const [date, setDate] = useState<string>(initialDate);
  const [code, setCode] = useState<string>("");
  const [vehicleCode, setVehicleCode] = useState<string>("");
  const [affectation, setAffectation] = useState<AffectationType>("normal");
  const [affectationLabel, setAffectationLabel] = useState<string>("");
  const [stops, setStops] = useState<DraftStop[]>([
    { location: "", time: "" },
    { location: "", time: "" },
  ]);
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<{
    date?: string;
    stops?: string;
    stopsByIndex?: Record<number, { location?: string; time?: string }>;
  }>({});

  const stopMinutes = useMemo(
    () => stops.map((s) => parseTimeToMinutes(s.time)),
    [stops],
  );

  const preview = useMemo(() => {
    const valid = stopMinutes.filter((n): n is number => n != null);
    if (valid.length < 2) return null;
    const start = valid[0];
    const end = valid[valid.length - 1];
    if (end < start) return null;
    return calcShiftMinutes(start, end);
  }, [stopMinutes]);

  const updateStop = (idx: number, patch: Partial<DraftStop>) => {
    setStops((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );
  };

  const addStop = () => {
    setStops((prev) => [...prev, { location: "", time: "" }]);
  };

  const removeStop = (idx: number) => {
    if (stops.length <= 2) return;
    setStops((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    const next: typeof errors = { stopsByIndex: {} };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      next.date = "Formato AAAA-MM-DD";
    }
    let invalidStops = 0;
    stops.forEach((s, i) => {
      const fieldErrs: { location?: string; time?: string } = {};
      if (!s.location.trim()) fieldErrs.location = "Local obrigatório";
      const parsed = parseTimeToMinutes(s.time);
      if (parsed == null) fieldErrs.time = "HH:MM";
      if (Object.keys(fieldErrs).length > 0) {
        next.stopsByIndex![i] = fieldErrs;
        invalidStops++;
      }
    });
    if (invalidStops === 0) {
      const minutes = stops.map((s) => parseTimeToMinutes(s.time) ?? 0);
      const first = minutes[0];
      const last = minutes[minutes.length - 1];
      if (last < first) {
        next.stops = "A última hora tem de ser igual ou maior que a primeira";
      }
    }
    setErrors(next);
    if (
      next.date ||
      next.stops ||
      Object.keys(next.stopsByIndex ?? {}).length > 0
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const cleanedStops: ShiftStop[] = stops.map((s) => ({
        location: s.location.trim(),
        time: s.time.trim(),
      }));
      await addShift({
        date,
        code: code.trim() || undefined,
        vehicleCode: vehicleCode.trim() || undefined,
        affectation,
        affectationLabel: affectationLabel.trim() || undefined,
        stops: cleanedStops,
        notes: notes.trim() || undefined,
      });
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb ? Math.max(insets.bottom, 34) : insets.bottom + 16;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: topPad + 12, paddingBottom: bottomPad + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
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
              <Feather name="x" size={20} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Novo serviço
            </Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.form}>
            <TextField
              label="Data"
              placeholder="AAAA-MM-DD"
              value={date}
              onChangeText={setDate}
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.date}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Serviço"
                  placeholder="Ex: 0115, Ordens"
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Serviço de Viatura"
                  placeholder="Ex: 15E/06"
                  value={vehicleCode}
                  onChangeText={setVehicleCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                Tipo de afetação
              </Text>
              <SegmentedControl<AffectationType>
                value={affectation}
                onChange={setAffectation}
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "extra1", label: "Extra 1" },
                  { value: "extra2", label: "Extra 2" },
                ]}
              />
            </View>

            <TextField
              label="Detalhe da afetação (opcional)"
              placeholder="Ex: Normal FO, Extra Normal - Tipo2"
              value={affectationLabel}
              onChangeText={setAffectationLabel}
              autoCorrect={false}
              hint="Se vazio, usa o tipo selecionado acima"
            />

            <View style={{ gap: 10 }}>
              <View style={styles.stopsHeader}>
                <Text style={[styles.label, { color: colors.foreground }]}>
                  Paragens (local + hora)
                </Text>
                <Pressable
                  onPress={addStop}
                  style={({ pressed }) => [
                    styles.addStopBtn,
                    {
                      backgroundColor: colors.muted,
                      borderRadius: 999,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Feather
                    name="plus"
                    size={14}
                    color={colors.foreground}
                  />
                  <Text
                    style={[
                      styles.addStopLabel,
                      { color: colors.foreground },
                    ]}
                  >
                    Adicionar
                  </Text>
                </Pressable>
              </View>

              {stops.map((stop, idx) => {
                const errs = errors.stopsByIndex?.[idx];
                const isFirst = idx === 0;
                const isLast = idx === stops.length - 1;
                const stopLabel = isFirst
                  ? "Início"
                  : isLast
                    ? "Fim"
                    : `Paragem ${idx}`;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.stopCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderRadius: colors.radius,
                      },
                    ]}
                  >
                    <View style={styles.stopCardHead}>
                      <Text
                        style={[
                          styles.stopCardLabel,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {stopLabel}
                      </Text>
                      {stops.length > 2 ? (
                        <Pressable
                          onPress={() => removeStop(idx)}
                          hitSlop={8}
                          style={({ pressed }) => [
                            { opacity: pressed ? 0.6 : 1 },
                          ]}
                        >
                          <Feather
                            name="trash-2"
                            size={16}
                            color={colors.destructive}
                          />
                        </Pressable>
                      ) : null}
                    </View>
                    <View style={styles.row}>
                      <View style={{ flex: 1.4 }}>
                        <TextField
                          label="Local"
                          placeholder="Ex: Calvário"
                          value={stop.location}
                          onChangeText={(v) =>
                            updateStop(idx, { location: v })
                          }
                          autoCorrect={false}
                          error={errs?.location}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <TextField
                          label="Hora"
                          placeholder="14:04"
                          value={stop.time}
                          onChangeText={(v) => updateStop(idx, { time: v })}
                          keyboardType="numbers-and-punctuation"
                          autoCorrect={false}
                          autoCapitalize="none"
                          error={errs?.time}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
              {errors.stops ? (
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  {errors.stops}
                </Text>
              ) : null}
              <Text
                style={[styles.hintText, { color: colors.mutedForeground }]}
              >
                Suporta horas {">"} 24h (ex: 25:15)
              </Text>
            </View>

            <TextField
              label="Notas (opcional)"
              placeholder="Ex: linha 28, cobertura noturna"
              value={notes}
              onChangeText={setNotes}
              multiline
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />

            {preview ? (
              <View
                style={[
                  styles.preview,
                  {
                    backgroundColor: colors.primary,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.previewLabel,
                      { color: colors.primaryForeground, opacity: 0.7 },
                    ]}
                  >
                    Total
                  </Text>
                  <Text
                    style={[
                      styles.previewBig,
                      { color: colors.primaryForeground },
                    ]}
                  >
                    {formatMinutesToTime(preview.totalMinutes)}
                  </Text>
                  <Text
                    style={[
                      styles.previewSub,
                      { color: colors.primaryForeground, opacity: 0.7 },
                    ]}
                  >
                    {formatHoursDecimal(preview.totalMinutes)} h
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text
                    style={[
                      styles.previewLabel,
                      { color: colors.primaryForeground, opacity: 0.7 },
                    ]}
                  >
                    Normais
                  </Text>
                  <Text
                    style={[
                      styles.previewMid,
                      { color: colors.primaryForeground },
                    ]}
                  >
                    {formatMinutesToTime(preview.normalMinutes)}
                  </Text>
                  <Text
                    style={[
                      styles.previewLabel,
                      { color: colors.accent, marginTop: 6 },
                    ]}
                  >
                    Extras
                  </Text>
                  <Text
                    style={[styles.previewMid, { color: colors.accent }]}
                  >
                    {formatMinutesToTime(preview.extraMinutes)}
                  </Text>
                </View>
              </View>
            ) : (
              <View
                style={[
                  styles.previewEmpty,
                  {
                    backgroundColor: colors.muted,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <Feather
                  name="clock"
                  size={18}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.previewEmptyText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Preenche as paragens para ver o cálculo
                </Text>
              </View>
            )}

            <PrimaryButton
              label="Guardar serviço"
              icon="check"
              onPress={handleSave}
              loading={submitting}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  form: { gap: 16 },
  row: { flexDirection: "row", gap: 12 },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  stopsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addStopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addStopLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  stopCard: {
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  stopCardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stopCardLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  hintText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    gap: 16,
  },
  previewLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  previewBig: {
    fontSize: 38,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1.2,
    marginTop: 4,
  },
  previewMid: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  previewSub: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  previewEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  previewEmptyText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
