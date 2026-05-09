import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { useConfirm } from "@/components/ConfirmModal";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TextField } from "@/components/TextField";
import {
  ShiftStop,
  ShiftWithCalc,
  useShifts,
} from "@/contexts/ShiftsContext";
import { useBreakdowns, VehicleKind } from "@/contexts/BreakdownsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  ABSENCE_TYPES,
  AffectationType,
  affectationDisplay,
  displayDateToIso,
  isoAddDays,
  isoToDisplayDate,
  parseTimeToMinutes,
  todayIso,
} from "@/utils/time";

const CATEGORY_VEHICLE_MAP: Record<string, VehicleKind[]> = {
  motorista: ["autocarro"],
  "guarda-freio": ["eletrico"],
  ascensor: ["ascensor"],
  outro: ["autocarro", "eletrico", "ascensor"],
};

const ALL_VEHICLE_OPTIONS: { value: string; label: string }[] = [
  { value: "autocarro", label: "Autocarro" },
  { value: "eletrico", label: "Eléctrico" },
  { value: "ascensor", label: "Ascensor" },
];

function vehicleOptionsForCategories(
  categories: string[],
): { value: string; label: string }[] {
  if (!categories.length) return ALL_VEHICLE_OPTIONS;
  const kindSet = new Set<VehicleKind>();
  for (const cat of categories) {
    for (const kind of CATEGORY_VEHICLE_MAP[cat] ?? []) kindSet.add(kind);
  }
  if (!kindSet.size) return ALL_VEHICLE_OPTIONS;
  return ALL_VEHICLE_OPTIONS.filter((o) => kindSet.has(o.value as VehicleKind));
}

function defaultVehicleKinds(categories: string[]): string[] {
  const opts = vehicleOptionsForCategories(categories);
  return opts.length === 1 ? [opts[0].value] : [];
}

interface DraftStop {
  location: string;
  time: string;
}

const EMPTY_STOP: DraftStop = { location: "", time: "" };

export default function NewShiftScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { shifts, addShift, updateShift, removeShift, byId } = useShifts();
  const params = useLocalSearchParams<{ date?: string; id?: string }>();
  const { confirm, alert, modal } = useConfirm();
  const { active: activeBreakdowns } = useBreakdowns();

  const vehicleOptions = vehicleOptionsForCategories(user?.categories ?? []);

  const initialDate =
    typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : todayIso();

  const [editingId, setEditingId] = useState<string | null>(
    typeof params.id === "string" && params.id ? params.id : null,
  );
  const [dateIso, setDateIso] = useState<string>(initialDate);
  const [dateInput, setDateInput] = useState<string>(
    isoToDisplayDate(initialDate),
  );
  const [code, setCode] = useState<string>("");
  const [vehicleCode, setVehicleCode] = useState<string>("");
  const [vehicleKinds, setVehicleKinds] = useState<string[]>(() =>
    defaultVehicleKinds(user?.categories ?? []),
  );
  const [fleetNumber, setFleetNumber] = useState<string>("");
  const [affectation, setAffectation] = useState<AffectationType>("normal");
  const [start, setStart] = useState<DraftStop>(EMPTY_STOP);
  const [end, setEnd] = useState<DraftStop>(EMPTY_STOP);
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [codeFocused, setCodeFocused] = useState<boolean>(false);
  const codeSuggestHideTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [errors, setErrors] = useState<{
    date?: string;
    vehicleKinds?: string;
    start?: { location?: string; time?: string };
    end?: { location?: string; time?: string };
    range?: string;
    overlap?: string;
    rest?: string;
    duplicate?: string;
  }>({});

  useEffect(() => {
    if (!editingId) return;
    const existing = byId(editingId);
    if (!existing) return;
    setDateIso(existing.date);
    setDateInput(isoToDisplayDate(existing.date));
    setCode(existing.code ?? "");
    setVehicleCode(existing.vehicleCode ?? "");
    setVehicleKinds(existing.vehicleKinds ?? []);
    setFleetNumber(existing.fleetNumber ?? "");
    setAffectation(existing.affectation);
    const first = existing.stops[0];
    const last = existing.stops[existing.stops.length - 1];
    setStart({ location: first?.location ?? "", time: first?.time ?? "" });
    setEnd({ location: last?.location ?? "", time: last?.time ?? "" });
    setNotes(existing.notes ?? "");
  }, [editingId, byId]);

  const dayShifts = useMemo<ShiftWithCalc[]>(
    () =>
      shifts
        .filter((s) => s.date === dateIso)
        .sort((a, b) => a.startMinutes - b.startMinutes),
    [shifts, dateIso],
  );

  const frequentCodes = useMemo<string[]>(() => {
    const freq: Record<string, number> = {};
    for (const s of shifts) {
      const c = s.code?.trim();
      if (c) freq[c] = (freq[c] ?? 0) + 1;
    }
    return Object.entries(freq)
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);
  }, [shifts]);

  const codeSuggestions = useMemo<string[]>(() => {
    if (!codeFocused) return [];
    const q = code.trim().toUpperCase();
    if (!q) return frequentCodes.slice(0, 6);
    return frequentCodes
      .filter((c) => c.toUpperCase().startsWith(q) && c.toUpperCase() !== q)
      .slice(0, 6);
  }, [codeFocused, code, frequentCodes]);

  const resetForm = () => {
    setEditingId(null);
    setCode("");
    setVehicleCode("");
    setVehicleKinds(defaultVehicleKinds(user?.categories ?? []));
    setFleetNumber("");
    setAffectation("normal");
    setStart(EMPTY_STOP);
    setEnd(EMPTY_STOP);
    setNotes("");
    setErrors({});
  };

  const handleDateChange = (text: string) => {
    setDateInput(text);
    setErrors((e) => ({ ...e, date: undefined }));
    const iso = displayDateToIso(text);
    if (iso) setDateIso(iso);
  };

  const handleClearStop = (which: "start" | "end") => {
    if (which === "start") setStart(EMPTY_STOP);
    else setEnd(EMPTY_STOP);
    setErrors((prev) => ({
      ...prev,
      [which]: undefined,
      range: undefined,
      duplicate: undefined,
    }));
  };

  const isAbsenceType = ABSENCE_TYPES.has(affectation);

  const handleSave = async () => {
    const next: typeof errors = {};
    const iso = displayDateToIso(dateInput);
    if (!iso) {
      next.date = "Data inválida (DD-MM-AAAA)";
    }

    if (!isAbsenceType) {
      const startTimeMin = parseTimeToMinutes(start.time);
      const endTimeMin = parseTimeToMinutes(end.time);
      const startErr: { location?: string; time?: string } = {};
      if (!start.location.trim()) startErr.location = "Local obrigatório";
      if (startTimeMin == null) startErr.time = "HH:MM";
      if (Object.keys(startErr).length) next.start = startErr;

      const endErr: { location?: string; time?: string } = {};
      if (!end.location.trim()) endErr.location = "Local obrigatório";
      if (endTimeMin == null) endErr.time = "HH:MM";
      if (Object.keys(endErr).length) next.end = endErr;

      if (
        startTimeMin != null &&
        endTimeMin != null &&
        endTimeMin < startTimeMin
      ) {
        next.range = "A hora de fim tem de ser igual ou superior à de início";
      }

      if (startTimeMin != null && endTimeMin != null && !next.range) {
        const targetDate = iso ?? displayDateToIso(dateInput);
        const overlapping = shifts.filter((s) => {
          if (s.date !== targetDate) return false;
          if (s.id === editingId) return false;
          if (!s.stops || s.stops.length < 2) return false;
          if (s.affectation === "folga" || s.affectation === "ferias") return false;
          return startTimeMin < s.endMinutes && s.startMinutes < endTimeMin;
        });
        if (overlapping.length > 0) {
          const ex = overlapping[0];
          next.overlap = `Sobreposição com serviço existente das ${ex.stops[0].time} às ${ex.stops[ex.stops.length - 1].time}`;
        }
      }

      if (startTimeMin != null && endTimeMin != null && iso && !next.range && !next.overlap) {
        const REST_MIN = 660;
        const prevDate = isoAddDays(iso, -1);
        const nextDate = isoAddDays(iso, 1);
        for (const s of shifts) {
          if (s.id === editingId) continue;
          if (s.affectation === "folga" || s.affectation === "ferias") continue;
          if (!s.stops || s.stops.length < 2) continue;
          if (s.date === prevDate) {
            const gap = 1440 + startTimeMin - s.endMinutes;
            if (gap < REST_MIN) {
              const h = Math.floor(gap / 60);
              const m = gap % 60;
              next.rest = `Descanso insuficiente antes deste serviço: ${h}h${m ? String(m).padStart(2, "0") + "min" : ""} (mínimo 11h obrigatórias)`;
              break;
            }
          } else if (s.date === nextDate) {
            const gap = 1440 + s.startMinutes - endTimeMin;
            if (gap < REST_MIN) {
              const h = Math.floor(gap / 60);
              const m = gap % 60;
              next.rest = `Descanso insuficiente após este serviço: ${h}h${m ? String(m).padStart(2, "0") + "min" : ""} (mínimo 11h obrigatórias)`;
              break;
            }
          }
        }
      }
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const cleanedStops: ShiftStop[] = isAbsenceType
        ? []
        : [
            { location: start.location.trim(), time: start.time.trim() },
            { location: end.location.trim(), time: end.time.trim() },
          ];
      const savedFleetNumber = isAbsenceType ? undefined : fleetNumber.trim() || undefined;
      const payload = {
        date: iso!,
        code: isAbsenceType ? undefined : code.trim() || undefined,
        vehicleCode: isAbsenceType ? undefined : vehicleCode.trim() || undefined,
        vehicleKinds: isAbsenceType ? [] : vehicleKinds,
        fleetNumber: savedFleetNumber,
        affectation,
        stops: cleanedStops,
        notes: isAbsenceType ? undefined : notes.trim() || undefined,
      };
      const res = editingId
        ? await updateShift(editingId, payload)
        : await addShift(payload);
      if (!res.ok) {
        setErrors({ duplicate: res.reason });
        return;
      }
      resetForm();
      if (savedFleetNumber) {
        const matched = activeBreakdowns.find(
          (b) => b.fleetNumber.trim().toLowerCase() === savedFleetNumber.toLowerCase(),
        );
        if (matched) {
          alert(
            "⚠️ Avaria ativa nesta viatura",
            `A viatura ${savedFleetNumber} tem uma avaria ativa registada. Consulte o separador Avarias para mais detalhes.`,
          );
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (s: ShiftWithCalc) => {
    setEditingId(s.id);
  };

  const handleDelete = (s: ShiftWithCalc) => {
    const proceed = async () => {
      await removeShift(s.id);
      if (editingId === s.id) resetForm();
    };
    confirm({
      title: "Apagar serviço",
      message: "Esta ação não pode ser revertida.",
      confirmLabel: "Apagar",
      destructive: true,
      onConfirm: proceed,
    });
  };

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb ? Math.max(insets.bottom, 34) : insets.bottom + 16;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {modal}
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
              {editingId ? "Editar serviço" : "Novo serviço"}
            </Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.form}>
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>
                Data
              </Text>
              <View style={styles.dateRow}>
                <View style={{ flex: 1 }}>
                  <TextField
                    placeholder="DD-MM-AAAA"
                    value={dateInput}
                    onChangeText={handleDateChange}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="numbers-and-punctuation"
                    error={errors.date}
                  />
                </View>
                <View
                  style={[
                    styles.dateIconBox,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <Feather
                    name="calendar"
                    size={18}
                    color={colors.mutedForeground}
                  />
                </View>
              </View>
            </View>

            <View style={{ gap: 6 }}>
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
                  { value: "normalFO", label: "Normal FO" },
                ]}
              />
              <SegmentedControl<AffectationType>
                value={affectation}
                onChange={setAffectation}
                options={[
                  { value: "folga", label: "Folga" },
                  { value: "ferias", label: "Férias" },
                  { value: "formacao", label: "Formação" },
                ]}
              />
            </View>

            {!isAbsenceType ? (
              <>
                <View style={styles.row}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <TextField
                      label="Serviço"
                      placeholder="Ex: 0115, Ordens"
                      value={code}
                      onChangeText={setCode}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      onFocus={() => {
                        if (codeSuggestHideTimer.current)
                          clearTimeout(codeSuggestHideTimer.current);
                        setCodeFocused(true);
                      }}
                      onBlur={() => {
                        codeSuggestHideTimer.current = setTimeout(
                          () => setCodeFocused(false),
                          180,
                        );
                      }}
                    />
                    {codeSuggestions.length > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="always"
                        contentContainerStyle={styles.suggestRow}
                      >
                        {codeSuggestions.map((suggestion) => (
                          <Pressable
                            key={suggestion}
                            onPress={() => {
                              if (codeSuggestHideTimer.current)
                                clearTimeout(codeSuggestHideTimer.current);
                              setCode(suggestion);
                              setCodeFocused(false);
                              const match = shifts
                                .filter((s) => s.code?.trim().toUpperCase() === suggestion.toUpperCase())
                                .sort((a, b) => b.date.localeCompare(a.date))[0];
                              if (match) {
                                if (match.vehicleCode) setVehicleCode(match.vehicleCode);
                                if (match.vehicleKinds?.length) setVehicleKinds(match.vehicleKinds);
                                const first = match.stops[0];
                                const last = match.stops[match.stops.length - 1];
                                if (first?.location) setStart({ location: first.location, time: first.time });
                                if (last?.location) setEnd({ location: last.location, time: last.time });
                              }
                            }}
                            style={({ pressed }) => [
                              styles.suggestChip,
                              {
                                backgroundColor:
                                  colors.primary + (pressed ? "30" : "18"),
                                borderColor: colors.primary + "55",
                                borderRadius: colors.radius,
                              },
                            ]}
                          >
                            <Feather
                              name="clock"
                              size={11}
                              color={colors.primary}
                            />
                            <Text
                              style={[
                                styles.suggestChipText,
                                { color: colors.primary },
                              ]}
                            >
                              {suggestion}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    ) : null}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <TextField
                      label="Serviço de Viatura"
                      placeholder="Ex: #28E/08"
                      value={vehicleCode}
                      onChangeText={setVehicleCode}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                    <Text style={[styles.smallHint, { color: colors.mutedForeground }]}>
                      # no início = pode dar diferença (ao fim do anterior ou ao início deste)
                    </Text>
                    {vehicleCode.startsWith("#") ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 5,
                          backgroundColor: colors.accent + "18",
                          borderRadius: colors.radius - 4,
                          paddingHorizontal: 8,
                          paddingVertical: 5,
                        }}
                      >
                        <Feather name="alert-triangle" size={12} color={colors.accent} />
                        <Text
                          style={{
                            fontSize: 12,
                            fontFamily: "Inter_500Medium",
                            color: colors.accent,
                            flex: 1,
                          }}
                        >
                          Pode dar diferença
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={{ gap: 6 }}>
                    <Text style={[styles.label, { color: colors.foreground }]}>
                      Tipo de veículo
                    </Text>
                    <View style={styles.chipRow}>
                      {vehicleOptions.map((opt) => {
                        const selected = vehicleKinds.includes(opt.value);
                        return (
                          <Pressable
                            key={opt.value}
                            onPress={() => {
                              setVehicleKinds((prev) =>
                                prev.includes(opt.value)
                                  ? prev.filter((k) => k !== opt.value)
                                  : [...prev, opt.value],
                              );
                            }}
                            style={({ pressed }) => [
                              styles.chip,
                              {
                                backgroundColor: selected
                                  ? colors.primary
                                  : colors.card,
                                borderColor: selected
                                  ? colors.primary
                                  : colors.border,
                                borderRadius: colors.radius,
                                opacity: pressed ? 0.8 : 1,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipLabel,
                                { color: selected ? "#fff" : colors.foreground },
                              ]}
                            >
                              {opt.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                <StopCard
                  label="Início"
                  value={start}
                  onChange={(patch) => setStart((s) => ({ ...s, ...patch }))}
                  onClear={() => handleClearStop("start")}
                  errors={errors.start}
                />

                <TextField
                  label="Nº da Viatura (opcional)"
                  placeholder="Ex: 1234"
                  value={fleetNumber}
                  onChangeText={setFleetNumber}
                  keyboardType="numeric"
                  autoCorrect={false}
                />

                <StopCard
                  label="Fim"
                  value={end}
                  onChange={(patch) => setEnd((s) => ({ ...s, ...patch }))}
                  onClear={() => handleClearStop("end")}
                  errors={errors.end}
                />

                <Text
                  style={[styles.smallHint, { color: colors.mutedForeground }]}
                >
                  Suporta horas {">"} 24h (ex: 25:15)
                </Text>

                {errors.range ? (
                  <Text
                    style={[styles.errorText, { color: colors.destructive }]}
                  >
                    {errors.range}
                  </Text>
                ) : null}
                {errors.overlap ? (
                  <Text
                    style={[styles.errorText, { color: colors.destructive }]}
                  >
                    {errors.overlap}
                  </Text>
                ) : null}
                {errors.rest ? (
                  <Text
                    style={[styles.errorText, { color: colors.destructive }]}
                  >
                    {errors.rest}
                  </Text>
                ) : null}
              </>
            ) : null}

            {!isAbsenceType ? (
              <>
                <TextField
                  label="Notas (opcional)"
                  placeholder="Ex: linha 28, cobertura noturna"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  style={{ minHeight: 80, textAlignVertical: "top" }}
                />
                <View
                  style={[
                    styles.infoBanner,
                    {
                      backgroundColor: colors.muted,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <Feather name="info" size={16} color={colors.primary} />
                  <Text
                    style={[
                      styles.infoBannerText,
                      { color: colors.foreground },
                    ]}
                  >
                    Pode ter vários serviços no mesmo dia, desde que os
                    horários não se sobreponham.
                  </Text>
                </View>
              </>
            ) : null}

            {errors.duplicate ? (
              <View
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor: colors.destructive + "1A",
                    borderRadius: colors.radius,
                    borderColor: colors.destructive,
                  },
                ]}
              >
                <Feather
                  name="alert-circle"
                  size={16}
                  color={colors.destructive}
                />
                <Text
                  style={[
                    styles.errorBannerText,
                    { color: colors.destructive },
                  ]}
                >
                  {errors.duplicate}
                </Text>
              </View>
            ) : null}

            <PrimaryButton
              label={editingId ? "Atualizar serviço" : "Guardar serviço"}
              icon="save"
              onPress={handleSave}
              loading={submitting}
            />

            {editingId ? (
              <Pressable
                onPress={resetForm}
                style={({ pressed }) => [
                  styles.cancelEdit,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text
                  style={[
                    styles.cancelEditText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Cancelar edição
                </Text>
              </Pressable>
            ) : null}

            {dayShifts.length > 0 ? (
              <View style={styles.daySection}>
                <Text
                  style={[
                    styles.daySectionTitle,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Serviços neste dia ({dayShifts.length})
                </Text>
                <View style={{ gap: 12 }}>
                  {dayShifts.map((s) => (
                    <DayShiftCard
                      key={s.id}
                      shift={s}
                      isEditing={editingId === s.id}
                      onEdit={() => handleEdit(s)}
                      onDelete={() => handleDelete(s)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function StopCard({
  label,
  value,
  onChange,
  onClear,
  errors,
}: {
  label: string;
  value: DraftStop;
  onChange: (patch: Partial<DraftStop>) => void;
  onClear: () => void;
  errors?: { location?: string; time?: string };
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.stopCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <Text style={[styles.stopCardLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <View style={styles.stopRow}>
        <View style={{ flex: 1.4 }}>
          <TextField
            label="Local"
            placeholder="Ex: Martim Moniz"
            value={value.location}
            onChangeText={(v) => onChange({ location: v })}
            autoCorrect={false}
            error={errors?.location}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="Hora"
            placeholder="15:15"
            value={value.time}
            onChangeText={(v) => onChange({ time: v })}
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
            autoCapitalize="none"
            error={errors?.time}
          />
        </View>
        <Pressable
          onPress={onClear}
          hitSlop={8}
          style={({ pressed }) => [
            styles.clearBtn,
            {
              backgroundColor: colors.muted,
              borderRadius: colors.radius,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Feather name="trash-2" size={16} color={colors.destructive} />
        </Pressable>
      </View>
    </View>
  );
}

function DayShiftCard({
  shift,
  isEditing,
  onEdit,
  onDelete,
}: {
  shift: ShiftWithCalc;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const labelText = affectationDisplay(shift.affectation, shift.affectationLabel);
  return (
    <View
      style={[
        styles.dayCard,
        {
          backgroundColor: colors.card,
          borderColor: isEditing ? colors.primary : colors.border,
          borderRadius: colors.radius,
          borderWidth: isEditing ? 2 : 1,
        },
      ]}
    >
      <View style={styles.dayCardRow}>
        <Text style={[styles.dayCardKicker, { color: colors.primary }]}>
          Serviço:{" "}
          <Text style={{ color: colors.foreground }}>
            {shift.code?.trim() ? shift.code : "—"}
          </Text>
        </Text>
        {isEditing ? (
          <View
            style={[styles.editingBadge, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.editingBadgeText}>A editar</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.dayCardMeta, { color: colors.mutedForeground }]}>
        Serviço de Viatura
      </Text>
      <Text style={[styles.dayCardValue, { color: colors.foreground }]}>
        {shift.vehicleCode?.trim() ? shift.vehicleCode : "/"}
      </Text>
      {shift.fleetNumber?.trim() ? (
        <>
          <Text
            style={[styles.dayCardMeta, { color: colors.mutedForeground, marginTop: 6 }]}
          >
            Nº da Viatura
          </Text>
          <Text style={[styles.dayCardValue, { color: colors.foreground }]}>
            {shift.fleetNumber}
          </Text>
        </>
      ) : null}
      <Text
        style={[styles.dayCardMeta, { color: colors.mutedForeground, marginTop: 6 }]}
      >
        Tipo Afetação
      </Text>
      <Text style={[styles.dayCardValue, { color: colors.foreground }]}>
        {labelText}
      </Text>

      <View
        style={[
          styles.dayStopsTable,
          { borderTopColor: colors.border, borderBottomColor: colors.border },
        ]}
      >
        {shift.stops.map((stop, idx) => (
          <View
            key={idx}
            style={[
              styles.dayStopRow,
              idx < shift.stops.length - 1 && {
                borderBottomColor: colors.border,
                borderBottomWidth: 1,
              },
            ]}
          >
            <Text
              style={[styles.dayStopLocation, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {stop.location || "—"}
            </Text>
            <Text style={[styles.dayStopTime, { color: colors.foreground }]}>
              {stop.time}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.dayCardActions}>
        <Pressable
          onPress={onEdit}
          style={({ pressed }) => [
            styles.actionBtn,
            {
              backgroundColor: colors.muted,
              borderRadius: colors.radius,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="edit-2" size={14} color={colors.foreground} />
          <Text style={[styles.actionBtnText, { color: colors.foreground }]}>
            Editar
          </Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [
            styles.actionBtn,
            {
              backgroundColor: colors.destructive + "14",
              borderRadius: colors.radius,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="trash-2" size={14} color={colors.destructive} />
          <Text style={[styles.actionBtnText, { color: colors.destructive }]}>
            Apagar
          </Text>
        </Pressable>
      </View>
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
    marginBottom: 6,
  },
  smallHint: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  dateIconBox: {
    width: 48,
    height: 48,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 0,
  },
  suggestRow: {
    flexDirection: "row",
    gap: 6,
    paddingBottom: 2,
  },
  suggestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  suggestChipText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  stopCard: {
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  stopCardLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  stopRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-end",
  },
  clearBtn: {
    width: 44,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 0,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 18,
  },
  cancelEdit: {
    alignItems: "center",
    paddingVertical: 6,
  },
  cancelEditText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  daySection: {
    marginTop: 8,
    gap: 10,
  },
  daySectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  dayCard: {
    padding: 14,
    gap: 4,
  },
  dayCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  dayCardKicker: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  editingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  editingBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  dayCardMeta: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  dayCardValue: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  dayStopsTable: {
    marginTop: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  dayStopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    gap: 12,
  },
  dayStopLocation: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  dayStopTime: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  dayCardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  actionBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
