import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
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

export default function NicknameScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateNickname } = useAuth();

  const [value, setValue] = useState(user?.nickname ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb ? Math.max(insets.bottom, 34) : insets.bottom + 24;

  const handleSave = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await updateNickname(value.trim());
      if (!res.ok) { setError(res.error); return; }
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = () => {
    const proceed = async () => {
      setSubmitting(true);
      try {
        await updateNickname("");
        router.back();
      } finally {
        setSubmitting(false);
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm("Remover alcunha?")) proceed();
      return;
    }
    Alert.alert(
      "Remover alcunha",
      "A tua alcunha será removida.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Remover", style: "destructive", onPress: proceed },
      ],
    );
  };

  const displayName = user?.nickname
    ? `${user.name} (${user.nickname})`
    : user?.name ?? "";

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
              Alcunha
            </Text>
            <View style={{ width: 22 }} />
          </View>

          <View
            style={[
              styles.userCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_700Bold", fontSize: 16 }}>
                {user?.name.charAt(0).toUpperCase() ?? "?"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.userName, { color: colors.foreground }]}>
                {displayName}
              </Text>
              <Text style={[styles.userMeta, { color: colors.mutedForeground }]}>
                Nº {user?.crewId}
              </Text>
            </View>
          </View>

          <Text style={[styles.helper, { color: colors.mutedForeground }]}>
            A alcunha aparece a seguir ao nome em toda a aplicação, por exemplo na lista de equipa e nos registos de avarias.
          </Text>

          <View style={styles.form}>
            <TextField
              label="Alcunha"
              placeholder="Ex: Zeca, Tó, Rui das Obras..."
              value={value}
              onChangeText={setValue}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              error={error ?? undefined}
            />

            <PrimaryButton
              label="Guardar alcunha"
              icon="tag"
              onPress={handleSave}
              loading={submitting}
            />

            {user?.nickname ? (
              <PrimaryButton
                label="Remover alcunha"
                icon="trash-2"
                variant="secondary"
                onPress={handleRemove}
                loading={submitting}
              />
            ) : null}
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
  userCard: {
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
  userName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  userMeta: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 2 },
  helper: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, marginTop: -4 },
  form: { gap: 14, marginTop: 4 },
});
