import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
import { useShifts } from "@/contexts/ShiftsContext";
import { useColors } from "@/hooks/useColors";
import {
  AffectationType,
  calcShiftMinutes,
  formatHoursDecimal,
  formatMinutesToTime,
  parseTimeToMinutes,
  todayIso,
} from "@/utils/time";

export default function NewShiftScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addShift } = useShifts();

  const [date, setDate] = useState<string>(todayIso());
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [affectation, setAffectation] = useState<AffectationType>("normal");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<{
    date?: string;
    start?: string;
    end?: string;
  }>({});

  const startMinutes = useMemo(() => parseTimeToMinutes(start), [start]);
  const endMinutes = useMemo(() => parseTimeToMinutes(end), [end]);
  const preview = useMemo(() => {
    if (startMinutes == null || endMinutes == null) return null;
    if (endMinutes <= startMinutes) return null;
    return calcShiftMinutes(startMinutes, endMinutes);
  }, [startMinutes, endMinutes]);

  const handleSave = async () => {
    const next: typeof errors = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      next.date = "Formato AAAA-MM-DD";
    }
    if (startMinutes == null) next.start = "Formato HH:MM (suporta 25:15)";
    if (endMinutes == null) next.end = "Formato HH:MM (suporta 28:00)";
    if (
      startMinutes != null &&
      endMinutes != null &&
      endMinutes <= startMinutes
    ) {
      next.end = "Hora fim tem de ser maior";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      await addShift({
        date,
        startMinutes: startMinutes!,
        endMinutes: endMinutes!,
        affectation,
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

            <View style={styles.timesRow}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Hora início"
                  placeholder="08:00"
                  value={start}
                  onChangeText={setStart}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={errors.start}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Hora fim"
                  placeholder="25:15"
                  value={end}
                  onChangeText={setEnd}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={errors.end}
                  hint={!errors.end ? "Suporta turnos > 24h" : undefined}
                />
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text
                style={[styles.label, { color: colors.foreground }]}
              >
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
                  Preenche as horas para ver o cálculo
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
  timesRow: { flexDirection: "row", gap: 12 },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
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
