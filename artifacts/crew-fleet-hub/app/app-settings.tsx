import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { TextField } from "@/components/TextField";
import { useConfirm } from "@/components/ConfirmModal";
import { useSettings } from "@/contexts/SettingsContext";
import { useColors } from "@/hooks/useColors";

export default function AppSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings, updateSettings } = useSettings();
  const { alert: showAlert, modal } = useConfirm();

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb ? Math.max(insets.bottom, 34) : insets.bottom + 24;

  const [nightStart, setNightStart] = useState(settings.nightStart);
  const [nightEnd, setNightEnd] = useState(settings.nightEnd);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeRe = /^\d{2}:\d{2}$/;

  const handleSave = async () => {
    setError(null);
    if (!timeRe.test(nightStart.trim())) {
      setError("Hora de início inválida. Usa o formato HH:MM (ex: 22:00)");
      return;
    }
    if (!timeRe.test(nightEnd.trim())) {
      setError("Hora de fim inválida. Usa o formato HH:MM (ex: 06:00)");
      return;
    }
    setSubmitting(true);
    try {
      await updateSettings({ nightStart: nightStart.trim(), nightEnd: nightEnd.trim() });
      router.back();
    } catch {
      setError("Erro ao guardar. Tenta novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {modal}
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 16,
          paddingBottom: bottomPad,
          paddingHorizontal: 20,
          gap: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Configurações
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="moon" size={16} color={colors.mutedForeground} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Horas Noturnas
            </Text>
          </View>
          <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
            Define o intervalo considerado noturno para o cálculo das horas no
            resumo. A janela atravessa a meia-noite (ex: das 22:00 às 06:00).
          </Text>

          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Início (HH:MM)"
                placeholder="22:00"
                value={nightStart}
                onChangeText={setNightStart}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                returnKeyType="next"
              />
            </View>
            <Feather
              name="arrow-right"
              size={14}
              color={colors.mutedForeground}
              style={{ marginTop: 28 }}
            />
            <View style={{ flex: 1 }}>
              <TextField
                label="Fim (HH:MM)"
                placeholder="06:00"
                value={nightEnd}
                onChangeText={setNightEnd}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                returnKeyType="done"
                onSubmitEditing={handleSave}
                error={error ?? undefined}
              />
            </View>
          </View>
        </View>

        <PrimaryButton
          label="Guardar"
          icon="check"
          onPress={handleSave}
          loading={submitting}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  section: {
    padding: 18,
    borderWidth: 1,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  sectionDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
});
