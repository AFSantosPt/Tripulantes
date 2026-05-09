import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useConfirm } from "@/components/ConfirmModal";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TextField } from "@/components/TextField";
import { ShiftStop, ShiftWithCalc, useShifts } from "@/contexts/ShiftsContext";
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
import {
  ImportResult,
  ParsedShift,
  isValidParsedShift,
  parseShiftImport,
} from "@/utils/shiftImport";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getApiBase(): string {
  if (Platform.OS === "web" && typeof window !== "undefined")
    return window.location.origin;
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}`;
  return "";
}

async function ocrImage(base64: string, mimeType: string) {
  const res = await fetch(`${getApiBase()}/api/ocr/shift`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, mimeType }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ text: string; found: boolean }>;
}

const CATEGORY_VEHICLE_MAP: Record<string, VehicleKind[]> = {
  motorista: ["autocarro"],
  "guarda-freio": ["eletrico"],
  ascensor: ["ascensor"],
  outro: ["autocarro", "eletrico", "ascensor"],
};

const ALL_VEHICLE_OPTIONS = [
  { value: "autocarro", label: "Autocarro" },
  { value: "eletrico", label: "Eléctrico" },
  { value: "ascensor", label: "Ascensor" },
];

function vehicleOptionsForCategories(categories: string[]) {
  if (!categories.length) return ALL_VEHICLE_OPTIONS;
  const set = new Set<VehicleKind>();
  for (const cat of categories)
    for (const k of CATEGORY_VEHICLE_MAP[cat] ?? []) set.add(k);
  if (!set.size) return ALL_VEHICLE_OPTIONS;
  return ALL_VEHICLE_OPTIONS.filter((o) => set.has(o.value as VehicleKind));
}

function defaultVehicleKinds(categories: string[]): string[] {
  const opts = vehicleOptionsForCategories(categories);
  return opts.length === 1 ? [opts[0].value] : [];
}

function splitVehicleCode(vc: string): { carreira: string; chapa: string } {
  if (!vc) return { carreira: "", chapa: "" };
  const idx = vc.lastIndexOf("/");
  if (idx > 0) return { carreira: vc.slice(0, idx), chapa: vc.slice(idx + 1) };
  return { carreira: vc, chapa: "" };
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface DraftStop {
  location: string;
  time: string;
}
const EMPTY_STOP: DraftStop = { location: "", time: "" };

// ─── Main Screen ─────────────────────────────────────────────────────────────

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

  // ── Form state ──────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(
    typeof params.id === "string" && params.id ? params.id : null,
  );
  const [dateIso, setDateIso] = useState(initialDate);
  const [dateInput, setDateInput] = useState(isoToDisplayDate(initialDate));
  const [affectation, setAffectation] = useState<AffectationType>("normal");
  const [code, setCode] = useState("");
  const [carreira, setCarreira] = useState("");
  const [chapa, setChapa] = useState("");
  const [vehicleKinds, setVehicleKinds] = useState<string[]>(() =>
    defaultVehicleKinds(user?.categories ?? []),
  );
  const [fleetNumber, setFleetNumber] = useState("");
  const [start, setStart] = useState<DraftStop>(EMPTY_STOP);
  const [end, setEnd] = useState<DraftStop>(EMPTY_STOP);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
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

  // ── Code suggestion state ────────────────────────────────────────────────
  const [codeFocused, setCodeFocused] = useState(false);
  const codeSuggestHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── OCR state ───────────────────────────────────────────────────────────
  const [ocrExpanded, setOcrExpanded] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<ImportResult | null>(null);

  // ── Load existing shift for editing ─────────────────────────────────────
  useEffect(() => {
    if (!editingId) return;
    const s = byId(editingId);
    if (!s) return;
    setDateIso(s.date);
    setDateInput(isoToDisplayDate(s.date));
    setCode(s.code ?? "");
    const { carreira: c, chapa: ch } = splitVehicleCode(s.vehicleCode ?? "");
    setCarreira(c);
    setChapa(ch);
    setVehicleKinds(s.vehicleKinds ?? []);
    setFleetNumber(s.fleetNumber ?? "");
    setAffectation(s.affectation);
    const first = s.stops[0];
    const last = s.stops[s.stops.length - 1];
    setStart({ location: first?.location ?? "", time: first?.time ?? "" });
    setEnd({ location: last?.location ?? "", time: last?.time ?? "" });
    setNotes(s.notes ?? "");
  }, [editingId, byId]);

  // ── Memos ────────────────────────────────────────────────────────────────
  const isAbsenceType = ABSENCE_TYPES.has(affectation);

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
      .filter(([, n]) => n >= 2)
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

  const codeTemplateShifts = useMemo<ShiftWithCalc[]>(() => {
    const q = code.trim().toUpperCase();
    if (!q || q.length < 2) return [];
    const cutoff = isoAddDays(todayIso(), -30);
    return shifts
      .filter(
        (s) =>
          s.code?.trim().toUpperCase() === q &&
          s.id !== editingId &&
          s.date >= cutoff,
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [code, shifts, editingId]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const resetForm = () => {
    setEditingId(null);
    setCode("");
    setCarreira("");
    setChapa("");
    setVehicleKinds(defaultVehicleKinds(user?.categories ?? []));
    setFleetNumber("");
    setAffectation("normal");
    setStart(EMPTY_STOP);
    setEnd(EMPTY_STOP);
    setNotes("");
    setErrors({});
    setOcrResult(null);
    setOcrText("");
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
    setErrors((prev) => ({ ...prev, [which]: undefined, range: undefined, duplicate: undefined }));
  };

  const applyVehicleCode = (vc: string) => {
    const { carreira: c, chapa: ch } = splitVehicleCode(vc);
    setCarreira(c);
    setChapa(ch);
  };

  const applyTemplate = (s: ShiftWithCalc) => {
    if (codeSuggestHideTimer.current) clearTimeout(codeSuggestHideTimer.current);
    setCodeFocused(false);
    if (s.vehicleCode) applyVehicleCode(s.vehicleCode);
    if (s.vehicleKinds?.length) setVehicleKinds(s.vehicleKinds);
    if (s.fleetNumber) setFleetNumber(s.fleetNumber);
    setAffectation(s.affectation);
    const first = s.stops[0];
    const last = s.stops[s.stops.length - 1];
    if (first?.location) setStart({ location: first.location, time: first.time });
    if (last?.location) setEnd({ location: last.location, time: last.time });
  };

  const applyParsedShift = (s: ParsedShift) => {
    if (s.date) { setDateIso(s.date); setDateInput(isoToDisplayDate(s.date)); }
    if (s.code) setCode(s.code);
    if (s.vehicleCode) applyVehicleCode(s.vehicleCode);
    setAffectation(s.affectation);
    if (s.startLocation) setStart({ location: s.startLocation, time: s.startTime });
    if (s.endLocation) setEnd({ location: s.endLocation, time: s.endTime });
    if (s.notes) setNotes(s.notes);
    setOcrResult(null);
    setOcrText("");
    setOcrExpanded(false);
  };

  const handleAnalyze = () => {
    if (!ocrText.trim()) return;
    setOcrError(null);
    const r = parseShiftImport(ocrText, dateIso || undefined);
    setOcrResult(r);
    if (r.shifts.length === 1 && isValidParsedShift(r.shifts[0])) {
      applyParsedShift(r.shifts[0]);
    }
  };

  const handlePickImage = async () => {
    setOcrError(null);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        setOcrError("Permissão de acesso à galeria negada.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: false,
        quality: 0.85,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!asset.base64) { setOcrError("Não foi possível ler a imagem."); return; }
      setOcrLoading(true);
      const mime = asset.mimeType ?? "image/jpeg";
      const { text: extracted, found } = await ocrImage(asset.base64, mime);
      if (!found || !extracted.trim()) {
        setOcrError("Não foi possível reconhecer serviços. Tenta com uma imagem mais nítida ou cola o texto.");
        return;
      }
      setOcrText(extracted.trim());
      setOcrResult(null);
      const r = parseShiftImport(extracted.trim(), dateIso || undefined);
      setOcrResult(r);
      if (r.shifts.length === 1 && isValidParsedShift(r.shifts[0])) {
        applyParsedShift(r.shifts[0]);
      }
    } catch (e: any) {
      setOcrError(`Erro: ${e?.message ?? "falha desconhecida"}`);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSave = async () => {
    const next: typeof errors = {};
    const iso = displayDateToIso(dateInput);
    if (!iso) next.date = "Data inválida (DD-MM-AAAA)";

    if (!isAbsenceType) {
      const startMin = parseTimeToMinutes(start.time);
      const endMin = parseTimeToMinutes(end.time);
      const startErr: { location?: string; time?: string } = {};
      if (!start.location.trim()) startErr.location = "Local obrigatório";
      if (startMin == null) startErr.time = "HH:MM";
      if (Object.keys(startErr).length) next.start = startErr;
      const endErr: { location?: string; time?: string } = {};
      if (!end.location.trim()) endErr.location = "Local obrigatório";
      if (endMin == null) endErr.time = "HH:MM";
      if (Object.keys(endErr).length) next.end = endErr;
      if (startMin != null && endMin != null && endMin < startMin)
        next.range = "A hora de fim tem de ser igual ou superior à de início";
      if (startMin != null && endMin != null && !next.range) {
        const overlapping = shifts.filter((s) => {
          if (s.date !== iso || s.id === editingId) return false;
          if (!s.stops || s.stops.length < 2) return false;
          if (s.affectation === "folga" || s.affectation === "ferias") return false;
          return startMin < s.endMinutes && s.startMinutes < endMin;
        });
        if (overlapping.length > 0) {
          const ex = overlapping[0];
          next.overlap = `Sobreposição com serviço das ${ex.stops[0].time} às ${ex.stops[ex.stops.length - 1].time}`;
        }
      }
      if (startMin != null && endMin != null && iso && !next.range && !next.overlap) {
        const REST_MIN = 660;
        for (const s of shifts) {
          if (s.id === editingId || s.affectation === "folga" || s.affectation === "ferias") continue;
          if (!s.stops || s.stops.length < 2) continue;
          if (s.date === isoAddDays(iso, -1)) {
            const gap = 1440 + startMin - s.endMinutes;
            if (gap < REST_MIN) {
              const h = Math.floor(gap / 60), m = gap % 60;
              next.rest = `Descanso insuficiente antes deste serviço: ${h}h${m ? String(m).padStart(2, "0") + "min" : ""} (mínimo 11h)`;
              break;
            }
          } else if (s.date === isoAddDays(iso, 1)) {
            const gap = 1440 + s.startMinutes - endMin;
            if (gap < REST_MIN) {
              const h = Math.floor(gap / 60), m = gap % 60;
              next.rest = `Descanso insuficiente após este serviço: ${h}h${m ? String(m).padStart(2, "0") + "min" : ""} (mínimo 11h)`;
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
      const stops: ShiftStop[] = isAbsenceType
        ? []
        : [
            { location: start.location.trim(), time: start.time.trim() },
            { location: end.location.trim(), time: end.time.trim() },
          ];
      const vehicleCode = isAbsenceType
        ? undefined
        : ([carreira.trim(), chapa.trim()].filter(Boolean).join("/") || undefined);
      const payload = {
        date: iso!,
        code: isAbsenceType ? undefined : code.trim() || undefined,
        vehicleCode,
        vehicleKinds: isAbsenceType ? [] : vehicleKinds,
        fleetNumber: isAbsenceType ? undefined : fleetNumber.trim() || undefined,
        affectation,
        stops,
        notes: isAbsenceType ? undefined : notes.trim() || undefined,
      };
      const res = editingId
        ? await updateShift(editingId, payload)
        : await addShift(payload);
      if (!res.ok) { setErrors({ duplicate: res.reason }); return; }
      resetForm();
      const savedFleet = payload.fleetNumber;
      if (savedFleet) {
        const matched = activeBreakdowns.find(
          (b) => b.fleetNumber.trim().toLowerCase() === savedFleet.toLowerCase(),
        );
        if (matched)
          alert("⚠️ Avaria ativa nesta viatura",
            `A viatura ${savedFleet} tem uma avaria ativa registada. Consulte o separador Avarias.`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (s: ShiftWithCalc) => {
    confirm({
      title: "Apagar serviço",
      message: "Esta ação não pode ser revertida.",
      confirmLabel: "Apagar",
      destructive: true,
      onConfirm: async () => {
        await removeShift(s.id);
        if (editingId === s.id) resetForm();
      },
    });
  };

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb ? Math.max(insets.bottom, 34) : insets.bottom + 16;

  // ── Render ───────────────────────────────────────────────────────────────
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
          {/* ── Header ── */}
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.iconBtn,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Feather name="x" size={20} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {editingId ? "Editar serviço" : "Novo serviço"}
            </Text>
            <View style={{ width: 44 }} />
          </View>

          {/* ── OCR Section ── */}
          {!editingId ? (
            <View
              style={[
                styles.ocrCard,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
              ]}
            >
              <Pressable
                onPress={() => setOcrExpanded((v) => !v)}
                style={styles.ocrHeader}
              >
                <View style={styles.ocrHeaderLeft}>
                  <Feather name="camera" size={16} color={colors.primary} />
                  <Text style={[styles.ocrHeaderText, { color: colors.primary }]}>
                    Preencher via digitalização
                  </Text>
                </View>
                <Feather
                  name={ocrExpanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.mutedForeground}
                />
              </Pressable>

              {ocrExpanded ? (
                <View style={{ gap: 10, paddingTop: 4 }}>
                  <Pressable
                    onPress={handlePickImage}
                    disabled={ocrLoading}
                    style={({ pressed }) => [
                      styles.imagePickBtn,
                      {
                        backgroundColor: colors.primary + "12",
                        borderColor: colors.primary,
                        borderRadius: colors.radius,
                        opacity: pressed || ocrLoading ? 0.7 : 1,
                      },
                    ]}
                  >
                    {ocrLoading ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Feather name="image" size={16} color={colors.primary} />
                    )}
                    <Text style={[styles.imagePickBtnText, { color: colors.primary }]}>
                      {ocrLoading ? "A reconhecer imagem…" : "Selecionar screenshot"}
                    </Text>
                  </Pressable>

                  {ocrError ? (
                    <View style={[styles.errorBanner, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive, borderRadius: colors.radius }]}>
                      <Feather name="alert-triangle" size={13} color={colors.destructive} />
                      <Text style={[styles.errorBannerText, { color: colors.destructive }]}>{ocrError}</Text>
                    </View>
                  ) : null}

                  <View style={styles.orRow}>
                    <View style={[styles.orLine, { backgroundColor: colors.border }]} />
                    <Text style={[styles.orText, { color: colors.mutedForeground }]}>ou cola o texto</Text>
                    <View style={[styles.orLine, { backgroundColor: colors.border }]} />
                  </View>

                  <TextInput
                    value={ocrText}
                    onChangeText={(v) => { setOcrText(v); setOcrResult(null); }}
                    placeholder={"Serviço 0115 - 28E/08 - Normal\nSto. Amaro (Est.) 10:00\nSto. Amaro (Est.) 13:00"}
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[
                      styles.textarea,
                      { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius, color: colors.foreground },
                    ]}
                  />

                  <View style={styles.ocrActionRow}>
                    {ocrText.trim() ? (
                      <Pressable
                        onPress={() => { setOcrText(""); setOcrResult(null); setOcrError(null); }}
                        style={({ pressed }) => [
                          styles.secondaryBtn,
                          { backgroundColor: colors.muted, borderRadius: colors.radius, opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <Feather name="trash-2" size={13} color={colors.mutedForeground} />
                        <Text style={[styles.secondaryBtnText, { color: colors.mutedForeground }]}>Limpar</Text>
                      </Pressable>
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        label="Analisar"
                        icon="search"
                        onPress={handleAnalyze}
                        variant="secondary"
                        disabled={!ocrText.trim() || ocrLoading}
                      />
                    </View>
                  </View>

                  {ocrResult && ocrResult.shifts.length > 1 ? (
                    <View style={{ gap: 6 }}>
                      <Text style={[styles.smallHint, { color: colors.mutedForeground }]}>
                        {ocrResult.shifts.length} serviços detectados — toca para preencher:
                      </Text>
                      {ocrResult.shifts.filter(isValidParsedShift).map((s, idx) => (
                        <Pressable
                          key={idx}
                          onPress={() => applyParsedShift(s)}
                          style={({ pressed }) => ({
                            backgroundColor: pressed ? colors.muted : colors.background,
                            borderWidth: 1,
                            borderColor: colors.primary + "55",
                            borderRadius: colors.radius,
                            padding: 10,
                            gap: 2,
                          })}
                        >
                          <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.primary }}>
                            {isoToDisplayDate(s.date)} · {s.code ?? "—"}
                          </Text>
                          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }} numberOfLines={1}>
                            {s.startTime} {s.startLocation} → {s.endTime} {s.endLocation}
                          </Text>
                          {s.vehicleCode ? (
                            <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.foreground }}>
                              {s.vehicleCode}
                            </Text>
                          ) : null}
                        </Pressable>
                      ))}
                      {ocrResult.warnings.length > 0 ? (
                        <Text style={[styles.smallHint, { color: colors.mutedForeground }]}>
                          ⚠ {ocrResult.warnings[0]}
                        </Text>
                      ) : null}
                    </View>
                  ) : ocrResult && ocrResult.shifts.length === 0 ? (
                    <Text style={[styles.smallHint, { color: colors.destructive }]}>
                      Não foi possível reconhecer dados. Verifica o formato do texto.
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* ── Form ── */}
          <View style={styles.form}>

            {/* Dia do Serviço */}
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Dia do Serviço</Text>
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
                <View style={[styles.dateIconBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <Feather name="calendar" size={18} color={colors.mutedForeground} />
                </View>
              </View>
            </View>

            {/* Tipo de Afetação */}
            <View style={{ gap: 6 }}>
              <Text style={[styles.label, { color: colors.foreground }]}>Tipo de Afetação</Text>
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
                {/* N° do Serviço */}
                <View style={{ gap: 6 }}>
                  <TextField
                    label="N° do Serviço"
                    placeholder="Ex: 0115, Ordens"
                    value={code}
                    onChangeText={setCode}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    onFocus={() => {
                      if (codeSuggestHideTimer.current) clearTimeout(codeSuggestHideTimer.current);
                      setCodeFocused(true);
                    }}
                    onBlur={() => {
                      codeSuggestHideTimer.current = setTimeout(() => setCodeFocused(false), 180);
                    }}
                  />
                  {codeSuggestions.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.suggestRow}>
                      {codeSuggestions.map((s) => (
                        <Pressable
                          key={s}
                          onPress={() => {
                            if (codeSuggestHideTimer.current) clearTimeout(codeSuggestHideTimer.current);
                            setCode(s);
                            setCodeFocused(false);
                            const match = shifts
                              .filter((sh) => sh.code?.trim().toUpperCase() === s.toUpperCase())
                              .sort((a, b) => b.date.localeCompare(a.date))[0];
                            if (match) {
                              if (match.vehicleCode) applyVehicleCode(match.vehicleCode);
                              if (match.vehicleKinds?.length) setVehicleKinds(match.vehicleKinds);
                              const first = match.stops[0];
                              const last = match.stops[match.stops.length - 1];
                              if (first?.location) setStart({ location: first.location, time: first.time });
                              if (last?.location) setEnd({ location: last.location, time: last.time });
                            }
                          }}
                          style={({ pressed }) => [
                            styles.suggestChip,
                            { backgroundColor: colors.primary + (pressed ? "30" : "18"), borderColor: colors.primary + "55", borderRadius: colors.radius },
                          ]}
                        >
                          <Feather name="clock" size={11} color={colors.primary} />
                          <Text style={[styles.suggestChipText, { color: colors.primary }]}>{s}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : null}
                  {codeTemplateShifts.length > 0 ? (
                    <View style={{ gap: 5 }}>
                      <Text style={[styles.smallHint, { color: colors.mutedForeground }]}>
                        Serviços anteriores — toca para preencher:
                      </Text>
                      {codeTemplateShifts.map((s) => {
                        const first = s.stops[0];
                        const last = s.stops[s.stops.length - 1];
                        return (
                          <Pressable
                            key={s.id}
                            onPress={() => applyTemplate(s)}
                            style={({ pressed }) => ({
                              backgroundColor: pressed ? colors.muted : colors.card,
                              borderWidth: 1,
                              borderColor: colors.border,
                              borderRadius: colors.radius,
                              padding: 10,
                              gap: 3,
                            })}
                          >
                            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                                {isoToDisplayDate(s.date)}
                              </Text>
                              {s.vehicleCode ? (
                                <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                                  {s.vehicleCode}
                                </Text>
                              ) : null}
                            </View>
                            {first && last ? (
                              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }} numberOfLines={1}>
                                {first.time} {first.location} → {last.time} {last.location}
                              </Text>
                            ) : null}
                            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.primary + "AA" }}>
                              {affectationDisplay(s.affectation)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>

                {/* Local início + hora */}
                <StopCard
                  label="Início"
                  value={start}
                  onChange={(patch) => setStart((s) => ({ ...s, ...patch }))}
                  onClear={() => handleClearStop("start")}
                  errors={errors.start}
                />

                {/* Local fim + hora */}
                <StopCard
                  label="Fim"
                  value={end}
                  onChange={(patch) => setEnd((s) => ({ ...s, ...patch }))}
                  onClear={() => handleClearStop("end")}
                  errors={errors.end}
                />

                <Text style={[styles.smallHint, { color: colors.mutedForeground }]}>
                  Suporta horas {"> "}24h (ex: 25:15)
                </Text>

                {/* Carreira + Chapa */}
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <TextField
                      label="Carreira"
                      placeholder="Ex: 28E"
                      value={carreira}
                      onChangeText={setCarreira}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextField
                      label="Chapa"
                      placeholder="Ex: 08"
                      value={chapa}
                      onChangeText={setChapa}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                    {carreira.startsWith("#") ? (
                      <View style={[styles.warnBanner, { backgroundColor: colors.accent + "18", borderRadius: colors.radius - 4 }]}>
                        <Feather name="alert-triangle" size={12} color={colors.accent} />
                        <Text style={[styles.warnBannerText, { color: colors.accent }]}>Pode dar diferença</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Tipo de veículo */}
                <View style={{ gap: 6 }}>
                  <Text style={[styles.label, { color: colors.foreground }]}>Tipo de Veículo</Text>
                  <View style={styles.chipRow}>
                    {vehicleOptions.map((opt) => {
                      const selected = vehicleKinds.includes(opt.value);
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() =>
                            setVehicleKinds((prev) =>
                              prev.includes(opt.value)
                                ? prev.filter((k) => k !== opt.value)
                                : [...prev, opt.value],
                            )
                          }
                          style={({ pressed }) => [
                            styles.chip,
                            {
                              backgroundColor: selected ? colors.primary : colors.card,
                              borderColor: selected ? colors.primary : colors.border,
                              borderRadius: colors.radius,
                              opacity: pressed ? 0.8 : 1,
                            },
                          ]}
                        >
                          <Text style={[styles.chipLabel, { color: selected ? "#fff" : colors.foreground }]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Nº da Viatura */}
                <TextField
                  label="Nº da Viatura (opcional)"
                  placeholder="Ex: 1234"
                  value={fleetNumber}
                  onChangeText={setFleetNumber}
                  keyboardType="numeric"
                  autoCorrect={false}
                />

                {/* Notas */}
                <TextField
                  label="Notas (opcional)"
                  placeholder="Ex: cobertura noturna"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  style={{ minHeight: 72, textAlignVertical: "top" }}
                />

                {/* Error messages */}
                {errors.range ? (
                  <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.range}</Text>
                ) : null}
                {errors.overlap ? (
                  <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.overlap}</Text>
                ) : null}
                {errors.rest ? (
                  <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.rest}</Text>
                ) : null}
              </>
            ) : null}

            {errors.duplicate ? (
              <View style={[styles.errorBanner, { backgroundColor: colors.destructive + "1A", borderRadius: colors.radius, borderColor: colors.destructive }]}>
                <Feather name="alert-circle" size={16} color={colors.destructive} />
                <Text style={[styles.errorBannerText, { color: colors.destructive }]}>{errors.duplicate}</Text>
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
                style={({ pressed }) => [styles.cancelEdit, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[styles.cancelEditText, { color: colors.mutedForeground }]}>
                  Cancelar edição
                </Text>
              </Pressable>
            ) : null}

            {/* Day shifts */}
            {dayShifts.length > 0 ? (
              <View style={styles.daySection}>
                <Text style={[styles.daySectionTitle, { color: colors.mutedForeground }]}>
                  Serviços neste dia ({dayShifts.length})
                </Text>
                <View style={{ gap: 12 }}>
                  {dayShifts.map((s) => (
                    <DayShiftCard
                      key={s.id}
                      shift={s}
                      isEditing={editingId === s.id}
                      onEdit={() => setEditingId(s.id)}
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

// ─── StopCard ────────────────────────────────────────────────────────────────

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
    <View style={[styles.stopCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <Text style={[styles.stopCardLabel, { color: colors.mutedForeground }]}>{label}</Text>
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
            { backgroundColor: colors.muted, borderRadius: colors.radius, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Feather name="trash-2" size={16} color={colors.destructive} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── DayShiftCard ─────────────────────────────────────────────────────────────

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
          Serviço: <Text style={{ color: colors.foreground }}>{shift.code?.trim() || "—"}</Text>
        </Text>
        {isEditing ? (
          <View style={[styles.editingBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.editingBadgeText}>A editar</Text>
          </View>
        ) : null}
      </View>
      {shift.vehicleCode?.trim() ? (
        <>
          <Text style={[styles.dayCardMeta, { color: colors.mutedForeground }]}>Carreira / Chapa</Text>
          <Text style={[styles.dayCardValue, { color: colors.foreground }]}>{shift.vehicleCode}</Text>
        </>
      ) : null}
      <Text style={[styles.dayCardMeta, { color: colors.mutedForeground, marginTop: 4 }]}>Afetação</Text>
      <Text style={[styles.dayCardValue, { color: colors.foreground }]}>{labelText}</Text>
      <View style={[styles.dayStopsTable, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
        {shift.stops.map((stop, idx) => (
          <View
            key={idx}
            style={[
              styles.dayStopRow,
              idx < shift.stops.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
            ]}
          >
            <Text style={[styles.dayStopLocation, { color: colors.foreground }]} numberOfLines={1}>
              {stop.location || "—"}
            </Text>
            <Text style={[styles.dayStopTime, { color: colors.foreground }]}>{stop.time}</Text>
          </View>
        ))}
      </View>
      <View style={styles.dayCardActions}>
        <Pressable
          onPress={onEdit}
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: colors.muted, borderRadius: colors.radius, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="edit-2" size={14} color={colors.foreground} />
          <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Editar</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: colors.destructive + "14", borderRadius: colors.radius, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="trash-2" size={14} color={colors.destructive} />
          <Text style={[styles.actionBtnText, { color: colors.destructive }]}>Apagar</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  title: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  // OCR
  ocrCard: { borderWidth: 1, padding: 14, gap: 0 },
  ocrHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ocrHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  ocrHeaderText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  imagePickBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderWidth: 1.5, borderStyle: "dashed" },
  imagePickBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  orRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  textarea: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13, fontFamily: "Inter_400Regular", minHeight: 100, textAlignVertical: "top" },
  ocrActionRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  secondaryBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
  secondaryBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  // Form
  form: { gap: 16 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  smallHint: { fontSize: 12, fontFamily: "Inter_500Medium" },
  errorText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  dateRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  dateIconBox: { width: 48, height: 48, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", gap: 12 },
  // Code suggestions
  suggestRow: { flexDirection: "row", gap: 6, paddingBottom: 2 },
  suggestChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  suggestChipText: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  // Vehicle chips
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  chipLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  // Warning banner
  warnBanner: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 5, marginTop: 4 },
  warnBannerText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  // Error banner
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderWidth: 1 },
  errorBannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  // Stop card
  stopCard: { borderWidth: 1, padding: 12, gap: 8 },
  stopCardLabel: { fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.8 },
  stopRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  clearBtn: { width: 44, height: 48, alignItems: "center", justifyContent: "center" },
  // Cancel edit
  cancelEdit: { alignItems: "center", paddingVertical: 6 },
  cancelEditText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  // Day shifts
  daySection: { gap: 10 },
  daySectionTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  dayCard: { borderWidth: 1, padding: 14, gap: 2 },
  dayCardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  dayCardKicker: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  editingBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  editingBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff", textTransform: "uppercase" },
  dayCardMeta: { fontSize: 11, fontFamily: "Inter_500Medium" },
  dayCardValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  dayStopsTable: { marginTop: 8, borderTopWidth: 1, borderBottomWidth: 1 },
  dayStopRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  dayStopLocation: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  dayStopTime: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginLeft: 8 },
  dayCardActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
