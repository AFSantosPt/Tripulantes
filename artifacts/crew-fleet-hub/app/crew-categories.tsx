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

export default function CrewCategoriesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { members, updateCategories, user } = useAuth();

  const member = id ? members.find((m) => m.id === id) : undefined;
  const [selected, setSelected] = useState<CrewCategory[]>(
    member?.categories ?? [],
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (member) setSelected(member.categories ?? []);
  }, [member?.id]);

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb ? Math.max(insets.bottom, 34) : insets.bottom + 24;

  if (!member || !user?.isAdmin) {
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
        <PrimaryButton
          label="Voltar"
          variant="secondary"
          onPress={() => router.back()}
        />
      </View>
    );
  }

  const toggle = (cat: CrewCategory) => {
    setSelected((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const handleSave = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    try {
      await updateCategories(member.id, selected);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 12,
          paddingBottom: bottomPad + 24,
          paddingHorizontal: 20,
          gap: 20,
        }}
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
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </Pressable>
          <View style={{ width: 44 }} />
        </View>

        <View style={{ gap: 4 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Categorias
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {member.name} · Nº {member.crewId}
          </Text>
        </View>

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
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            Seleciona uma ou mais categorias
          </Text>
          <View style={styles.chipGrid}>
            {ALL_CREW_CATEGORIES.map((cat) => {
              const isSelected = selected.includes(cat);
              return (
                <Pressable
                  key={cat}
                  onPress={() => toggle(cat)}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: isSelected
                        ? colors.primary
                        : colors.muted,
                      borderRadius: colors.radius,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Feather
                    name={isSelected ? "check-square" : "square"}
                    size={16}
                    color={
                      isSelected ? colors.primaryForeground : colors.mutedForeground
                    }
                  />
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: isSelected
                          ? colors.primaryForeground
                          : colors.foreground,
                      },
                    ]}
                  >
                    {CREW_CATEGORY_LABELS[cat]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {selected.length === 0 ? (
            <Text style={[styles.hint, { color: colors.destructive }]}>
              Seleciona pelo menos uma categoria
            </Text>
          ) : null}
        </View>

        <PrimaryButton
          label="Guardar categorias"
          icon="save"
          onPress={handleSave}
          loading={saving}
          disabled={selected.length === 0}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  missing: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  card: {
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  chipGrid: {
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  chipText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
