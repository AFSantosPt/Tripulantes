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
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { TextField } from "@/components/TextField";
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

export default function ShiftImportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addShift, shifts } = useShifts();
  const params = useLocalSearchParams<{ date?: string }>();
  const fallbackDate =
    typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : todayIso();

  const [text, setText] = useState<string>("");
  const [analyzed, setAnalyzed] = useState<ImportResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

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
    r.shifts.forEach((s, idx) => {
      const key = `${s.date}|${s.startTime}|${s.endTime}`;
      initialSel[idx] = isValidParsedShift(s) && !existingKeySet.has(key);
    });
    setSelectedIds(initialSel);
  };

  const handleClear = () => {
    setText("");
    setAnalyzed(null);
    setSelectedIds({});
    setResultMsg(null);
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
              Cola dados do portal da Carris (JSON, tabela ou texto). A app
              tenta reconhecer o formato e mostra uma pré-visualização.
            </Text>
          </View>

          <Text style={[styles.label, { color: colors.foreground }]}>
            Dados a importar
          </Text>
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
}: {
  result: ImportResult;
  selected: Record<number, boolean>;
  onToggle: (idx: number) => void;
  existingKeySet: Set<string>;
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
}: {
  shift: ParsedShift;
  checked: boolean;
  onToggle: () => void;
  isDuplicate: boolean;
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
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  textarea: {
    borderWidth: 1,
    minHeight: 200,
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
});
