import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, isFirstSetup, pendingMembers } = useAuth();
  const [crewId, setCrewId] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn(crewId, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace("/");
    } catch {
      setError("Não foi possível iniciar sessão");
    } finally {
      setSubmitting(false);
    }
  };

  const goRegister = () => router.push("/register");

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
            { paddingTop: topPad + 24, paddingBottom: bottomPad },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.brandMark,
              { backgroundColor: colors.primary },
            ]}
          >
            <Feather name="users" size={26} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.brand, { color: colors.foreground }]}>
            Tripulante
          </Text>
          <Text style={[styles.brandSub, { color: colors.mutedForeground }]}>
            gestão
          </Text>
          <Text
            style={[styles.tagline, { color: colors.mutedForeground }]}
          >
            Inicia sessão com o teu Nº Tripulante e a password que criaste.
          </Text>

          {isFirstSetup ? (
            <View
              style={[
                styles.banner,
                {
                  backgroundColor: colors.accent,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Feather
                name="shield"
                size={18}
                color={colors.accentForeground}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.bannerTitle,
                    { color: colors.accentForeground },
                  ]}
                >
                  Primeira instalação
                </Text>
                <Text
                  style={[
                    styles.bannerText,
                    { color: colors.accentForeground },
                  ]}
                >
                  Ainda não há tripulantes registados. O primeiro a registar-se
                  fica como administrador e poderá autorizar os colegas.
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.form}>
            <TextField
              label="Nº Tripulante"
              placeholder="Ex: 180123"
              value={crewId}
              onChangeText={setCrewId}
              autoCapitalize="none"
              keyboardType="number-pad"
              returnKeyType="next"
              testID="login-crew-id"
            />
            <TextField
              label="Password"
              placeholder="A tua password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
              testID="login-password"
              error={error}
            />
            <PrimaryButton
              label="Entrar"
              icon="log-in"
              onPress={handleSignIn}
              loading={submitting}
              testID="login-submit"
            />
          </View>

          <Pressable
            onPress={goRegister}
            style={({ pressed }) => [
              styles.registerLink,
              {
                borderColor: colors.border,
                borderRadius: colors.radius,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            testID="login-register"
          >
            <View
              style={[
                styles.registerIcon,
                { backgroundColor: colors.primary },
              ]}
            >
              <Feather
                name="user-plus"
                size={18}
                color={colors.primaryForeground}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.registerTitle,
                  { color: colors.foreground },
                ]}
              >
                {isFirstSetup
                  ? "Criar conta de administrador"
                  : "Pedir acesso"}
              </Text>
              <Text
                style={[
                  styles.registerMeta,
                  { color: colors.mutedForeground },
                ]}
              >
                {isFirstSetup
                  ? "Cria a primeira conta para começar"
                  : "Um tripulante autorizado terá de aprovar"}
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={20}
              color={colors.mutedForeground}
            />
          </Pressable>

          {!isFirstSetup && pendingMembers.length > 0 ? (
            <Text
              style={[styles.footnote, { color: colors.mutedForeground }]}
            >
              {pendingMembers.length === 1
                ? "1 pedido de acesso à espera de aprovação."
                : `${pendingMembers.length} pedidos de acesso à espera de aprovação.`}
            </Text>
          ) : null}
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
    gap: 12,
  },
  brandMark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  brand: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.8,
  },
  brandSub: {
    fontSize: 18,
    fontFamily: "Inter_500Medium",
    letterSpacing: -0.2,
    marginTop: -2,
  },
  tagline: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    marginTop: 12,
    marginBottom: 20,
    maxWidth: 360,
  },
  banner: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    marginBottom: 20,
  },
  bannerTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  bannerText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  form: { gap: 14 },
  registerLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    marginTop: 24,
  },
  registerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  registerTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  registerMeta: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  footnote: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 16,
    textAlign: "center",
  },
});
