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

export default function ChangePasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, changePassword } = useAuth();
  const [current, setCurrent] = useState<string>("");
  const [next, setNext] = useState<string>("");
  const [confirm, setConfirm] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const showSuccess = (onClose: () => void) => {
    if (Platform.OS === "web") {
      window.alert("Password atualizada\n\nA tua password foi alterada com sucesso.");
      onClose();
    } else {
      Alert.alert(
        "Password atualizada",
        "A tua password foi alterada com sucesso.",
        [{ text: "OK", onPress: onClose }],
      );
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (next !== confirm) {
      setError("As novas passwords não coincidem");
      return;
    }
    setSubmitting(true);
    try {
      const result = await changePassword({ current, next });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      showSuccess(() => router.back());
    } catch {
      setError("Não foi possível alterar a password");
    } finally {
      setSubmitting(false);
    }
  };

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb ? Math.max(insets.bottom, 34) : insets.bottom + 24;

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
              style={({ pressed }) => [
                styles.backBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather
                name="arrow-left"
                size={22}
                color={colors.foreground}
              />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              Alterar password
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
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text
                style={{
                  color: colors.primaryForeground,
                  fontFamily: "Inter_700Bold",
                  fontSize: 16,
                }}
              >
                {user?.name.charAt(0).toUpperCase() ?? "?"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.userName, { color: colors.foreground }]}>
                {user?.name}
              </Text>
              <Text
                style={[styles.userMeta, { color: colors.mutedForeground }]}
              >
                Nº {user?.crewId}
              </Text>
            </View>
          </View>

          <Text style={[styles.helper, { color: colors.mutedForeground }]}>
            Por segurança, indica a tua password atual antes de definires uma nova.
          </Text>

          <View style={styles.form}>
            <TextField
              label="Password atual"
              placeholder="A tua password de agora"
              value={current}
              onChangeText={setCurrent}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="next"
              testID="cp-current"
            />
            <TextField
              label="Nova password"
              placeholder="Mínimo 4 caracteres"
              value={next}
              onChangeText={setNext}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="next"
              testID="cp-next"
            />
            <TextField
              label="Confirmar nova password"
              placeholder="Repete a nova password"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              testID="cp-confirm"
              error={error}
            />
            <PrimaryButton
              label="Guardar nova password"
              icon="lock"
              onPress={handleSubmit}
              loading={submitting}
              testID="cp-submit"
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
  scroll: {
    paddingHorizontal: 24,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
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
  userName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  userMeta: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  helper: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    marginTop: -4,
  },
  form: { gap: 14, marginTop: 4 },
});
