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

import { EmptyState } from "@/components/EmptyState";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TextField } from "@/components/TextField";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, roster, resumeAs } = useAuth();
  const [name, setName] = useState<string>("");
  const [crewId, setCrewId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSignIn = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Indica o teu nome");
      return;
    }
    if (!crewId.trim()) {
      setError("Indica o teu número de tripulante");
      return;
    }
    setSubmitting(true);
    try {
      await signIn(name, crewId);
      router.replace("/");
    } catch (e) {
      setError("Não foi possível iniciar sessão");
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
            <Feather name="truck" size={26} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.brand, { color: colors.foreground }]}>
            Crew Fleet Hub
          </Text>
          <Text
            style={[styles.tagline, { color: colors.mutedForeground }]}
          >
            Gestão de turnos e avarias para a tripulação. Entra com o teu nome
            de serviço para começares.
          </Text>

          <View style={styles.form}>
            <TextField
              label="Nome"
              placeholder="Ex: João Silva"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
              testID="login-name"
            />
            <TextField
              label="Nº Tripulante"
              placeholder="Ex: 4218"
              value={crewId}
              onChangeText={setCrewId}
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
              testID="login-crew-id"
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

          {roster.length > 0 ? (
            <View style={styles.section}>
              <Text
                style={[styles.sectionTitle, { color: colors.mutedForeground }]}
              >
                Tripulantes recentes
              </Text>
              <View style={{ gap: 8 }}>
                {roster.slice(0, 6).map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => resumeAs(m).then(() => router.replace("/"))}
                    style={({ pressed }) => [
                      styles.recent,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderRadius: colors.radius,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: colors.accent },
                      ]}
                    >
                      <Text
                        style={{
                          color: colors.accentForeground,
                          fontFamily: "Inter_700Bold",
                          fontSize: 16,
                        }}
                      >
                        {m.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.recentName,
                          { color: colors.foreground },
                        ]}
                      >
                        {m.name}
                      </Text>
                      <Text
                        style={[
                          styles.recentMeta,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        Tripulante #{m.crewId}
                      </Text>
                    </View>
                    <Feather
                      name="chevron-right"
                      size={20}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <EmptyState
                icon="users"
                title="Primeiro acesso"
                description="Os tripulantes que iniciem sessão aparecem aqui para entrada rápida."
              />
            </View>
          )}
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
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.8,
  },
  tagline: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    marginTop: 4,
    marginBottom: 24,
    maxWidth: 360,
  },
  form: { gap: 14 },
  section: { marginTop: 28, gap: 12 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  recent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  recentName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  recentMeta: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
});
