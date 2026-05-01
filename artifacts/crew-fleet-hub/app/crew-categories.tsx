import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import {
  ALL_CREW_CATEGORIES,
  CREW_CATEGORY_LABELS,
  CrewCategory,
  useAuth,
} from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const CATEGORY_DESCRIPTIONS: Record<CrewCategory, string> = {
  motorista: "Conduz autocarros · pode reportar avarias de autocarro",
  "guarda-freio": "Opera elétricos · pode reportar avarias de elétrico",
  outro: "Outra função operacional",
};

export default function CrewCategoriesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user, members, updateCategories } = useAuth();

  const targetId = id ?? user?.id ?? "";
  const targetMember = members.find((m) => m.id === targetId) ?? (targetId === user?.id ? user : undefined);
  const isSelf = targetId === user?.id;
  const canEdit = isSelf || user?.isAdmin;

  const [selected, setSelected] = useState<CrewCategory[]>(
    targetMember?.categories ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSelected(targetMember?.categories ?? []);
  }, [targetMember?.id]);

  const toggle = (cat: CrewCategory) => {
    setSaved(false);
    setSelected((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const handleSave = async () => {
    if (selected.length === 0 || !canEdit) return;
    setSaving(true);
    try {
      await updateCategories(targetId, selected);
      setSaved(true);
      setTimeout(() => router.back(), 700);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb ? Math.max(insets.bottom, 34) : insets.bottom + 24;

  if (!canEdit) {
    return (
      <View
        style={[
          styles.root,
          {
            backgroundColor: colors.background,
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          },
        ]}
      >
        <Text style={[styles.missing, { color: colors.foreground }]}>
          Acesso não permitido
        </Text>
        <PrimaryButton label="Voltar" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

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
            Categorias
          </Text>
          <View style={{ width: 22 }} />
        </View>

        <View
          style={[
            styles.memberCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <View
            style={[
              styles.avatar,
              { backgroundColor: isSelf ? colors.primary : colors.accent },
            ]}
          >
            <Text
              style={{
                color: isSelf ? colors.primaryForeground : colors.accentForeground,
                fontFamily: "Inter_700Bold",
                fontSize: 16,
              }}
            >
              {(targetMember?.name ?? "?").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.memberName, { color: colors.foreground }]}>
              {targetMember?.name ?? "—"}
              {isSelf ? "  (tu)" : ""}
            </Text>
            <Text style={[styles.memberMeta, { color: colors.mutedForeground }]}>
              Nº {targetMember?.crewId}
            </Text>
          </View>
        </View>

        <Text style={[styles.helper, { color: colors.mutedForeground }]}>
          As categorias definem que tipo de avarias o tripulante pode reportar.
          Seleciona pelo menos uma.
        </Text>

        <View style={styles.options}>
          {ALL_CREW_CATEGORIES.map((cat) => {
            const active = selected.includes(cat);
            return (
              <Pressable
                key={cat}
                onPress={() => toggle(cat)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: active ? colors.primaryForeground : "transparent",
                      borderColor: active ? colors.primaryForeground : colors.border,
                    },
                  ]}
                >
                  {active ? (
                    <Feather name="check" size={12} color={colors.primary} />
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: active ? colors.primaryForeground : colors.foreground },
                    ]}
                  >
                    {CREW_CATEGORY_LABELS[cat]}
                  </Text>
                  <Text
                    style={[
                      styles.optionDesc,
                      {
                        color: active ? colors.primaryForeground : colors.mutedForeground,
                        opacity: active ? 0.8 : 1,
                      },
                    ]}
                  >
                    {CATEGORY_DESCRIPTIONS[cat]}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {selected.length === 0 ? (
          <Text style={[styles.warning, { color: colors.destructive }]}>
            Seleciona pelo menos uma categoria.
          </Text>
        ) : null}

        <PrimaryButton
          label={saved ? "Guardado!" : "Guardar categorias"}
          icon={saved ? "check" : "tag"}
          onPress={handleSave}
          loading={saving}
          disabled={selected.length === 0 || saved}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, gap: 16 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  memberName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  memberMeta: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 2 },
  helper: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  options: { gap: 10 },
  option: {
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  optionDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    marginTop: 2,
  },
  warning: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  missing: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 16,
  },
});
