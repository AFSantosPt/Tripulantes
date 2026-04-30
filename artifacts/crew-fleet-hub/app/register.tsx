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
import {
  ALL_CREW_CATEGORIES,
  CREW_CATEGORY_LABELS,
  CrewCategory,
  useAuth,
} from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { registerRequest, isFirstSetup } = useAuth();
  const [name, setName] = useState<string>("");
  const [crewId, setCrewId] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirm, setConfirm] = useState<string>("");
  const [categories, setCategories] = useState<CrewCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const toggleCategory = (cat: CrewCategory) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const showInfo = (title: string, message: string, onClose?: () => void) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
      onClose?.();
    } else {
      Alert.alert(title, message, [{ text: "OK", onPress: onClose }]);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (password !== confirm) {
      setError("As passwords não coincidem");
      return;
    }
    if (categories.length === 0) {
      setError("Seleciona pelo menos uma categoria");
      return;
    }
    setSubmitting(true);
    try {
      const result = await registerRequest({ name, crewId, password, categories });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.autoActivated) {
        showInfo(
          "Conta criada",
          "És o primeiro tripulante e ficaste como administrador. Agora podes autorizar os teus colegas.",
          () => router.replace("/"),
        );
      } else {
        showInfo(
          "Pedido enviado",
          "Um tripulante autorizado vai rever o teu pedido. Recebes acesso assim que for aprovado.",
          () => router.replace("/login"),
        );
      }
    } catch {
      setError("Não foi possível submeter o pedido");
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
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            hitSlop={12}
          >
            <Feather
              name="arrow-left"
              size={20}
              color={colors.foreground}
            />
            <Text style={[styles.backText, { color: colors.foreground }]}>
              Voltar
            </Text>
          </Pressable>

          <Text style={[styles.title, { color: colors.foreground }]}>
            {isFirstSetup ? "Criar conta de administrador" : "Pedir acesso"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {isFirstSetup
              ? "És o primeiro tripulante. A tua conta será criada com permissões de administrador para autorizares os colegas."
              : "Preenche os teus dados. A conta fica pendente até ser aprovada por um tripulante autorizado."}
          </Text>

          <View style={styles.form}>
            <TextField
              label="Nome"
              placeholder="Ex: João Silva"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
              testID="register-name"
            />
            <TextField
              label="Nº Tripulante"
              placeholder="Ex: 180123"
              value={crewId}
              onChangeText={setCrewId}
              autoCapitalize="none"
              keyboardType="number-pad"
              returnKeyType="next"
              testID="register-crew-id"
            />

            <View style={styles.categoryBlock}>
              <Text
                style={[styles.categoryLabel, { color: colors.mutedForeground }]}
              >
                Categoria
              </Text>
              <Text
                style={[styles.categoryHint, { color: colors.mutedForeground }]}
              >
                Podes selecionar mais do que uma
              </Text>
              <View style={styles.categoryRow}>
                {ALL_CREW_CATEGORIES.map((cat) => {
                  const selected = categories.includes(cat);
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => toggleCategory(cat)}
                      style={({ pressed }) => [
                        styles.categoryChip,
                        {
                          backgroundColor: selected
                            ? colors.primary
                            : colors.card,
                          borderColor: selected
                            ? colors.primary
                            : colors.border,
                          borderRadius: colors.radius,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      {selected ? (
                        <Feather
                          name="check"
                          size={13}
                          color={colors.primaryForeground}
                        />
                      ) : null}
                      <Text
                        style={[
                          styles.categoryChipText,
                          {
                            color: selected
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
            </View>

            <TextField
              label="Password"
              placeholder="Mínimo 4 caracteres"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="next"
              testID="register-password"
            />
            <TextField
              label="Confirmar password"
              placeholder="Repete a password"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              testID="register-confirm"
              error={error}
            />
            <PrimaryButton
              label={isFirstSetup ? "Criar conta" : "Enviar pedido"}
              icon={isFirstSetup ? "shield" : "send"}
              onPress={handleSubmit}
              loading={submitting}
              testID="register-submit"
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
    gap: 12,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  backText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.6,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 16,
    maxWidth: 360,
  },
  form: { gap: 14 },
  categoryBlock: {
    gap: 6,
  },
  categoryLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  categoryHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
