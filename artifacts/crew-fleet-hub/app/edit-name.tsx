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
import { TextField } from "@/components/TextField";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

function splitName(full: string): [string, string, string] {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return [parts[0], "", ""];
  if (parts.length === 2) return [parts[0], "", parts[1]];
  return [parts[0], parts.slice(1, -1).join(" "), parts[parts.length - 1]];
}

export default function EditNameScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, activeMembers, updateName, adminUpdateName } = useAuth();
  const { memberId } = useLocalSearchParams<{ memberId?: string }>();

  const isAdmin = user?.isAdmin ?? false;
  const isOwnEdit = !memberId || memberId === user?.id;

  const target = useMemo(() => {
    if (isOwnEdit) return user;
    return activeMembers.find((m) => m.id === memberId) ?? null;
  }, [isOwnEdit, memberId, user, activeMembers]);

  const [first, middle, last] = useMemo(
    () => splitName(target?.name ?? ""),
    [target?.name],
  );

  const [firstName, setFirstName] = useState(first);
  const [middleName, setMiddleName] = useState(middle);
  const [lastName, setLastName] = useState(last);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb ? Math.max(insets.bottom, 34) : insets.bottom + 24;

  const handleSave = async () => {
    setError(null);
    const f = firstName.trim();
    const m = middleName.trim();
    const l = lastName.trim();
    if (!f) { setError("Primeiro nome é obrigatório"); return; }
    if (!l) { setError("Apelido é obrigatório"); return; }
    const fullName = [f, m, l].filter(Boolean).join(" ");
    setSubmitting(true);
    try {
      const res = isOwnEdit
        ? await updateName(fullName)
        : await adminUpdateName(memberId!, fullName);
      if (!res.ok) { setError(res.error); return; }
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  const canEdit = isOwnEdit || isAdmin;

  if (!canEdit) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>Sem permissão</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: topPad + 16, paddingBottom: bottomPad },
          ]}
          keyboardShouldPersistTaps="handled"
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
              {isOwnEdit ? "Editar nome" : `Nome de ${target?.name ?? "tripulante"}`}
            </Text>
            <View style={{ width: 22 }} />
          </View>

          {!isOwnEdit && (
            <View
              style={[
                styles.adminBanner,
                { backgroundColor: colors.muted, borderRadius: colors.radius },
              ]}
            >
              <Feather name="shield" size={14} color={colors.mutedForeground} />
              <Text style={[styles.adminBannerText, { color: colors.mutedForeground }]}>
                A editar em nome de {target?.name}
              </Text>
            </View>
          )}

          <View style={styles.form}>
            <TextField
              label="Primeiro nome"
              placeholder="Ex: João"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <TextField
              label="Nome do meio (opcional)"
              placeholder="Ex: Manuel"
              value={middleName}
              onChangeText={setMiddleName}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <TextField
              label="Apelido"
              placeholder="Ex: Silva"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleSave}
              error={error ?? undefined}
            />
            <PrimaryButton
              label="Guardar nome"
              icon="user"
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
  scroll: { paddingHorizontal: 24, gap: 16 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  adminBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    marginTop: -4,
  },
  adminBannerText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  form: { gap: 14, marginTop: 4 },
});
