import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { FOLGA_GROUPS } from "@/utils/folgaSchedule";

export default function FolgaGroupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateFolgaGroup } = useAuth();

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb ? Math.max(insets.bottom, 34) : insets.bottom + 24;

  const [selected, setSelected] = useState<string | null>(user?.folgaGroup ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await updateFolgaGroup(selected ?? "");
      if (!res.ok) { setError(res.error); return; }
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    const proceed = async () => {
      setSubmitting(true);
      try {
        await updateFolgaGroup("");
        router.back();
      } finally {
        setSubmitting(false);
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm("Remover o grupo de folga?")) proceed();
      return;
    }
    Alert.alert(
      "Remover grupo",
      "Os dias de folga deixarão de ser destacados no calendário.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Remover", style: "destructive", onPress: proceed },
      ],
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 16, paddingBottom: bottomPad },
        ]}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Grupo de folga
          </Text>
          <View style={{ width: 22 }} />
        </View>

        <Text style={[styles.helper, { color: colors.mutedForeground }]}>
          Seleciona o teu grupo de folga rotativa. Os dias correspondentes ficarão destacados a laranja no calendário.
        </Text>

        <View style={styles.grid}>
          {FOLGA_GROUPS.map((g) => {
            const isSelected = selected === g;
            return (
              <Pressable
                key={g}
                onPress={() => setSelected(isSelected ? null : g)}
                style={({ pressed }) => [
                  styles.groupChip,
                  {
                    backgroundColor: isSelected ? "#F59E0B" : colors.card,
                    borderColor: isSelected ? "#F59E0B" : colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.groupChipText,
                    { color: isSelected ? "#fff" : colors.foreground },
                  ]}
                >
                  {g}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {error}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <PrimaryButton
            label={selected ? `Guardar ${selected}` : "Guardar"}
            icon="check"
            onPress={handleSave}
            loading={submitting}
          />
          {user?.folgaGroup ? (
            <PrimaryButton
              label="Remover grupo"
              icon="x"
              variant="secondary"
              onPress={handleClear}
              loading={submitting}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, gap: 20 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  helper: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  groupChip: {
    width: "22%",
    aspectRatio: 1.3,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  groupChipText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  actions: { gap: 12 },
});
