import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import {
  VEHICLE_LABELS,
  VehicleKind,
} from "@/contexts/BreakdownsContext";
import { useShifts } from "@/contexts/ShiftsContext";
import { useColors } from "@/hooks/useColors";
import {
  affectationDisplay,
  isoToDisplayDate,
  todayIso,
} from "@/utils/time";
import {
  ImportResult,
  ParsedShift,
  isValidParsedShift,
  parseShiftImport,
} from "@/utils/shiftImport";

const SAMPLE_TEXT = `Cola aqui os serviços do portal da Carris.

Aceita 3 formatos:

1) JSON (ex: copiado das ferramentas do browser)
[
  {"date":"2026-05-01","code":"0115","vehicle":"15E/06","tipo":"Normal",
   "inicio":{"local":"Martim Moniz","hora":"15:15"},
   "fim":{"local":"Calvário","hora":"17:30"}}
]

2) Tabela (separada por tab, | ou ponto-e-vírgula)
Data | Serviço | Viatura | Tipo | Hora Início | Local Início | Hora Fim | Local Fim
2026-05-01 | 0115 | 15E/06 | Normal | 15:15 | Martim Moniz | 17:30 | Calvário

3) Texto livre (cada serviço separado por linha em branco)
2026-05-01
Serviço 0115 - 15E/06 - Normal
Martim Moniz 15:15
Calvário 17:30
`;

function getApiBase(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}`;
  return "";
}

const CATEGORY_VEHICLE_MAP: Record<string, VehicleKind[]> = {
  motorista: ["autocarro"],
  "guarda-freio": ["eletrico"],
  ascensor: ["ascensor"],
  outro: ["autocarro", "eletrico", "ascensor"],
};

const ALL_VEHICLE_KINDS: VehicleKind[] = ["autocarro", "eletrico", "ascensor"];

function vehicleOptionsForCategories(categories: string[]): VehicleKind[] {
  const kindSet = new Set<VehicleKind>();
  for (const cat of categories) {
    for (const kind of (CATEGORY_VEHICLE_MAP[cat] ?? [])) kindSet.add(kind);
  }
  if (kindSet.size === 0) return ALL_VEHICLE_KINDS;
  return ALL_VEHICLE_KINDS.filter((k) => kindSet.has(k));
}

async function ocrImage(
  base64: string,
  mimeType: string,
): Promise<{ text: string; found: boolean }> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/ocr/shift`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, mimeType }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export default function ShiftImportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addShift, shifts } = useShifts();
  const { user } = useAuth();
  const vehicleOptions = useMemo(
    () => vehicleOptionsForCategories(user?.categories ?? []),
    [user?.categories],
  );
  const params = useLocalSearchParams<{ date?: string }>();
  const fallbackDate =
    typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : todayIso();

  const [text, setText] = useState<string>("");
  const [analyzed, setAnalyzed] = useState<ImportResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<number, boolean>>({});
  const [vehicleKinds, setVehicleKinds] = useState<Record<number, VehicleKind>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb ? Math.max(insets.bottom, 34) : insets.bottom + 16;

  const existingKeySet = useMemo(() => {
    const set = new Set<string>();
    for (const s of shifts) {
      const start = s.stops[0]?.time ?? "";
      const end = s.stops[s.stops.length - 1]?.time ?? "";
      set.add(`${s.date}|${start}|${end}`);
    }
    return set;
  }, [shifts]);

  const handleAnalyze = () => {
    setResultMsg(null);
    const r = parseShiftImport(text, fallbackDate);
    setAnalyzed(r);
    const initialSel: Record<number, boolean> = {};
    const initialKinds: Record<number, VehicleKind> = {};
    r.shifts.forEach((s, idx) => {
      const key = `${s.date}|${s.startTime}|${s.endTime}`;
      initialSel[idx] = isValidParsedShift(s) && !existingKeySet.has(key);
      if (vehicleOptions.length === 1) initialKinds[idx] = vehicleOptions[0];
    });
    setSelectedIds(initialSel);
    setVehicleKinds(initialKinds);
  };

  const handleClear = () => {
    setText("");
    setAnalyzed(null);
    setSelectedIds({});
    setVehicleKinds({});
    setResultMsg(null);
    setOcrError(null);
  };

  const handlePickImage = async () => {
    setOcrError(null);
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
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
      if (!asset.base64) {
        setOcrError("Não foi possível ler a imagem.");
        return;
      }
      setOcrLoading(true);
      const mime = asset.mimeType ?? "image/jpeg";
      const { text: extracted, found } = await ocrImage(asset.base64, mime);
      if (!found || !extracted.trim()) {
        setOcrError(
          "Não foi possível reconhecer serviços na imagem. Tenta com uma imagem mais nítida ou cola o texto manualmente.",
        );
        return;
      }
      setText(extracted.trim());
      setAnalyzed(null);
      setSelectedIds({});
    } catch (e: any) {
      setOcrError(`Erro: ${e?.message ?? "falha desconhecida"}`);
    } finally {
      setOcrLoading(false);
    }
  };

  const toggle = (idx: number) => {
    setSelectedIds((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const selectedCount = useMemo(
    () => Object.values(selectedIds).filter(Boolean).length,
    [selectedIds],
  );

  const handleImport = async () => {
    if (!analyzed) return;
    setSubmitting(true);
    let saved = 0;
    let skipped = 0;
    try {
      for (let i = 0; i < analyzed.shifts.length; i++) {
        if (!selectedIds[i]) continue;
        const s = analyzed.shifts[i];
        if (!isValidParsedShift(s)) {
          skipped++;
          continue;
        }
        const res = await addShift({
          date: s.date,
          code: s.code,
          vehicleCode: s.vehicleCode,
          vehicleKinds: vehicleKinds[i] ? [vehicleKinds[i]] : [],
          affectation: s.affectation,
          affectationLabel: s.affectationLabel,
          stops: [
            { location: s.startLocation, time: s.startTime },
            { location: s.endLocation, time: s.endTime },
          ],
          notes: s.notes,
        });
        if (res.ok) saved++;
        else skipped++;
      }
      setResultMsg(
        `Guardados ${saved} serviço${saved === 1 ? "" : "s"}` +
          (skipped > 0 ? ` (${skipped} ignorado${skipped === 1 ? "" : "s"})` : ""),
      );
      if (saved > 0) {
        setTimeout(() => router.back(), 1200);
      }
    } finally {
      setSubmitting(false);
    }
  };

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
              Importar serviços
            </Text>
            <View style={{ width: 44 }} />
          </View>

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
              style={[styles.infoBannerText, { color: colors.foreground }]}
            >
              Seleciona uma imagem do portal para reconhecimento automático, ou
              cola o texto diretamente (JSON, tabela ou texto livre).
            </Text>
          </View>

          <Pressable
            onPress={handlePickImage}
            disabled={ocrLoading}
            style={({ pressed }) => [
              styles.imagePickBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.primary,
                borderRadius: colors.radius,
                opacity: pressed || ocrLoading ? 0.75 : 1,
              },
            ]}
          >
            {ocrLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="image" size={18} color={colors.primary} />
            )}
            <Text style={[styles.imagePickBtnText, { color: colors.primary }]}>
              {ocrLoading
                ? "A reconhecer imagem…"
                : "Selecionar imagem / screenshot"}
            </Text>
          </Pressable>

          {ocrError ? (
            <View
              style={[
                styles.errorBanner,
                {
                  backgroundColor: colors.destructive + "15",
                  borderColor: colors.destructive,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Feather
                name="alert-triangle"
                size={14}
                color={colors.destructive}
              />
              <Text
                style={[styles.errorText, { color: colors.destructive }]}
              >
                {ocrError}
              </Text>
            </View>
          ) : null}

          <View style={styles.orRow}>
            <View
              style={[styles.orLine, { backgroundColor: colors.border }]}
            />
            <Text style={[styles.orText, { color: colors.mutedForeground }]}>
              ou cola o texto
            </Text>
            <View
              style={[styles.orLine, { backgroundColor: colors.border }]}
            />
          </View>

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={SAMPLE_TEXT}
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[
              styles.textarea,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
                color: colors.foreground,
              },
            ]}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.smallHint, { color: colors.mutedForeground }]}>
            Se algum serviço não tiver data, é usada{" "}
            <Text style={{ fontFamily: "Inter_700Bold" }}>
              {isoToDisplayDate(fallbackDate)}
            </Text>{" "}
            como data padrão.
          </Text>

          <View style={styles.actionRow}>
            <Pressable
              onPress={handleClear}
              disabled={!text.length && !analyzed}
              style={({ pressed }) => [
                styles.secondaryBtn,
                {
                  backgroundColor: colors.muted,
                  borderRadius: colors.radius,
                  opacity:
                    pressed || (!text.length && !analyzed) ? 0.6 : 1,
                },
              ]}
            >
              <Feather name="trash-2" size={14} color={colors.foreground} />
              <Text
                style={[styles.secondaryBtnText, { color: colors.foreground }]}
              >
                Limpar
              </Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Analisar"
                icon="search"
                onPress={handleAnalyze}
                variant="secondary"
              />
            </View>
          </View>

          {analyzed ? (
            <AnalyzedSection
              result={analyzed}
              selected={selectedIds}
              onToggle={toggle}
              existingKeySet={existingKeySet}
              vehicleKinds={vehicleKinds}
              vehicleOptions={vehicleOptions}
              onVehicleKindChange={(idx, kind) =>
                setVehicleKinds((prev) => ({ ...prev, [idx]: kind }))
              }
            />
          ) : null}

          {resultMsg ? (
            <View
              style={[
                styles.successBanner,
                {
                  backgroundColor: colors.success + "1A",
                  borderColor: colors.success,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Feather
                name="check-circle"
                size={16}
                color={colors.success}
              />
              <Text
                style={[styles.successText, { color: colors.success }]}
              >
                {resultMsg}
              </Text>
            </View>
          ) : null}

          {analyzed && analyzed.shifts.length > 0 ? (
            <PrimaryButton
              label={`Importar ${selectedCount} serviço${selectedCount === 1 ? "" : "s"}`}
              icon="download"
              onPress={handleImport}
              loading={submitting}
              disabled={selectedCount === 0}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function AnalyzedSection({
  result,
  selected,
  onToggle,
  existingKeySet,
  vehicleKinds,
  vehicleOptions,
  onVehicleKindChange,
}: {
  result: ImportResult;
  selected: Record<number, boolean>;
  onToggle: (idx: number) => void;
  existingKeySet: Set<string>;
  vehicleKinds: Record<number, VehicleKind>;
  vehicleOptions: VehicleKind[];
  onVehicleKindChange: (idx: number, kind: VehicleKind) => void;
}) {
  const colors = useColors();
  if (result.shifts.length === 0) {
    return (
      <View
        style={[
          styles.emptyResult,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <Feather
          name="alert-triangle"
          size={20}
          color={colors.destructive}
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={[styles.emptyResultTitle, { color: colors.foreground }]}
          >
            Não foi possível reconhecer dados
          </Text>
          {result.warnings.slice(0, 3).map((w, i) => (
            <Text
              key={i}
              style={[styles.warningText, { color: colors.mutedForeground }]}
            >
              • {w}
            </Text>
          ))}
          <Text
            style={[styles.warningText, { color: colors.mutedForeground }]}
          >
            Tenta colar uma única secção ou partilha uma amostra para te
            ajudar a melhorar.
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
        Detetados {result.shifts.length} serviço
        {result.shifts.length === 1 ? "" : "s"} (formato:{" "}
        {result.format === "json"
          ? "JSON"
          : result.format === "tabular"
            ? "tabela"
            : "texto"}
        )
      </Text>
      {result.shifts.map((s, idx) => (
        <ParsedShiftRow
          key={idx}
          shift={s}
          checked={!!selected[idx]}
          onToggle={() => onToggle(idx)}
          isDuplicate={existingKeySet.has(
            `${s.date}|${s.startTime}|${s.endTime}`,
          )}
          vehicleKind={vehicleKinds[idx]}
          vehicleOptions={vehicleOptions}
          onVehicleKindChange={(kind) => onVehicleKindChange(idx, kind)}
        />
      ))}
      {result.warnings.length > 0 ? (
        <View
          style={[
            styles.warningBox,
            {
              backgroundColor: colors.muted,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Text
            style={[
              styles.warningHeader,
              { color: colors.mutedForeground },
            ]}
          >
            {result.warnings.length} aviso
            {result.warnings.length === 1 ? "" : "s"}:
          </Text>
          {result.warnings.slice(0, 5).map((w, i) => (
            <Text
              key={i}
              style={[styles.warningText, { color: colors.mutedForeground }]}
            >
              • {w}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ParsedShiftRow({
  shift,
  checked,
  onToggle,
  isDuplicate,
  vehicleKind,
  vehicleOptions,
  onVehicleKindChange,
}: {
  shift: ParsedShift;
  checked: boolean;
  onToggle: () => void;
  isDuplicate: boolean;
  vehicleKind?: VehicleKind;
  vehicleOptions: VehicleKind[];
  onVehicleKindChange: (kind: VehicleKind) => void;
}) {
  const colors = useColors();
  const valid = isValidParsedShift(shift);
  return (
    <Pressable
      onPress={onToggle}
      disabled={!valid}
      style={({ pressed }) => [
        styles.parsedCard,
        {
          backgroundColor: colors.card,
          borderColor: checked ? colors.primary : colors.border,
          borderRadius: colors.radius,
          borderWidth: checked ? 2 : 1,
          opacity: pressed ? 0.85 : valid ? 1 : 0.6,
        },
      ]}
    >
      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: checked ? colors.primary : "transparent",
            borderColor: checked ? colors.primary : colors.border,
          },
        ]}
      >
        {checked ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.parsedHeadRow}>
          <Text style={[styles.parsedDate, { color: colors.foreground }]}>
            {isoToDisplayDate(shift.date)}
          </Text>
          {!valid ? (
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: colors.destructive },
              ]}
            >
              <Text style={styles.statusBadgeText}>Inválido</Text>
            </View>
          ) : isDuplicate ? (
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: colors.mutedForeground },
              ]}
            >
              <Text style={styles.statusBadgeText}>Já existe</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.parsedCode, { color: colors.primary }]}>
          {shift.code?.trim() || "Sem código"}
          {shift.vehicleCode ? `  ·  ${shift.vehicleCode}` : ""}
        </Text>
        <Text
          style={[styles.parsedAff, { color: colors.mutedForeground }]}
          numberOfLines={1}
        >
          {affectationDisplay(shift.affectation, shift.affectationLabel)}
        </Text>
        <View style={styles.stopsRow}>
          <Text
            style={[styles.stopText, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {shift.startLocation}
          </Text>
          <Text style={[styles.stopTime, { color: colors.foreground }]}>
            {shift.startTime}
          </Text>
        </View>
        <View style={styles.stopsRow}>
          <Text
            style={[styles.stopText, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {shift.endLocation}
          </Text>
          <Text style={[styles.stopTime, { color: colors.foreground }]}>
            {shift.endTime}
          </Text>
        </View>
        {vehicleOptions.length > 1 ? (
          <View style={styles.vehicleChipRow}>
            {vehicleOptions.map((k) => {
              const active = vehicleKind === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => onVehicleKindChange(k)}
                  style={[
                    styles.vehicleChip,
                    {
                      backgroundColor: active ? colors.primary : colors.muted,
                      borderRadius: colors.radius / 1.5,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.vehicleChipText,
                      { color: active ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    {VEHICLE_LABELS[k]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: 20,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
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
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  imagePickBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  imagePickBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  textarea: {
    borderWidth: 1,
    minHeight: 160,
    padding: 14,
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    textAlignVertical: "top",
  },
  smallHint: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  emptyResult: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  emptyResultTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  warningText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    lineHeight: 17,
  },
  warningBox: {
    padding: 12,
    gap: 4,
  },
  warningHeader: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  parsedCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  parsedHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  parsedDate: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  parsedCode: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  parsedAff: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  stopsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
  },
  stopText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  stopTime: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums"],
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
  },
  successText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  vehicleChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  vehicleChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  vehicleChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
