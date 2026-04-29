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
import { SegmentedControl } from "@/components/SegmentedControl";
import { TextField } from "@/components/TextField";
import { useAuth } from "@/contexts/AuthContext";
import { VehicleKind, useBreakdowns } from "@/contexts/BreakdownsContext";
import { useColors } from "@/hooks/useColors";

export default function NewBreakdownScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { reportBreakdown } = useBreakdowns();
  const { user } = useAuth();

  const [kind, setKind] = useState<VehicleKind>("autocarro");
  const [fleetNumber, setFleetNumber] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<{
    fleetNumber?: string;
    description?: string;
  }>({});

  const handleSubmit = async () => {
    const next: typeof errors = {};
    if (!fleetNumber.trim()) next.fleetNumber = "Indica o nº de frota ou matrícula";
    if (!description.trim() || description.trim().length < 5)
      next.description = "Descreve o problema (min. 5 caracteres)";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSubmitting(true);
    try {
      const created = await reportBreakdown({
        vehicleKind: kind,
        fleetNumber,
        description,
      });
      router.replace(`/breakdown/${created.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb ? Math.max(insets.bottom, 34) : insets.bottom + 16;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: topPad + 12, paddingBottom: bottomPad + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
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
              <Feather name="x" size={20} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Reportar avaria
            </Text>
            <View style={{ width: 44 }} />
          </View>

          <View
            style={[
              styles.userBanner,
              {
                backgroundColor: colors.muted,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="user" size={16} color={colors.mutedForeground} />
            <Text
              style={[styles.userBannerText, { color: colors.foreground }]}
            >
              A reportar como{" "}
              <Text style={{ fontFamily: "Inter_700Bold" }}>{user?.name}</Text>
              {user?.crewId ? `  ·  #${user.crewId}` : ""}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={{ gap: 8 }}>
              <Text
                style={[styles.label, { color: colors.foreground }]}
              >
                Tipo de viatura
              </Text>
              <SegmentedControl<VehicleKind>
                value={kind}
                onChange={setKind}
                options={[
                  { value: "autocarro", label: "Autocarro" },
                  { value: "eletrico", label: "Elétrico" },
                ]}
              />
            </View>

            <TextField
              label="Nº de frota / matrícula"
              placeholder="Ex: 550, 601, 12-AB-34"
              value={fleetNumber}
              onChangeText={setFleetNumber}
              autoCapitalize="characters"
              autoCorrect={false}
              error={errors.fleetNumber}
            />

            <TextField
              label="Descrição do problema"
              placeholder="Ex: Porta dianteira não fecha, ruído no rolamento traseiro..."
              value={description}
              onChangeText={setDescription}
              multiline
              style={{ minHeight: 120, textAlignVertical: "top" }}
              error={errors.description}
            />

            <View
              style={[
                styles.hint,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Feather
                name="users"
                size={16}
                color={colors.primary}
                style={{ marginTop: 2 }}
              />
              <Text style={[styles.hintText, { color: colors.foreground }]}>
                A avaria fica ativa até 3 colegas confirmarem a reparação.
                Todos veem quem reportou e quem já validou.
              </Text>
            </View>

            <PrimaryButton
              label="Reportar avaria"
              icon="alert-triangle"
              onPress={handleSubmit}
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
  scroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  userBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  userBannerText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  form: { gap: 16 },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  hint: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderWidth: 1,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 19,
  },
});
