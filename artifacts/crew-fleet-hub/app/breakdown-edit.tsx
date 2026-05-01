import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
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

const VEHICLE_OPTIONS: { value: VehicleKind; label: string }[] = [
  { value: "autocarro", label: "Autocarros" },
  { value: "eletrico", label: "Eléctricos" },
];

export default function EditBreakdownScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { byId, editBreakdown } = useBreakdowns();
  const { user } = useAuth();

  const breakdown = id ? byId(id) : undefined;

  const [kind, setKind] = useState<VehicleKind>(
    breakdown?.vehicleKind ?? "autocarro",
  );
  const [fleetNumber, setFleetNumber] = useState(breakdown?.fleetNumber ?? "");
  const [description, setDescription] = useState(breakdown?.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    fleetNumber?: string;
    description?: string;
    general?: string;
  }>({});

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb ? Math.max(insets.bottom, 34) : insets.bottom + 16;

  const isReporter = breakdown?.reportedById === user?.id;
  const canEdit = isReporter || user?.isAdmin;

  if (!breakdown || !canEdit) {
    return (
      <View
        style={[
          styles.root,
          {
            backgroundColor: colors.background,
            justifyContent: "center",
            alignItems: "center",
            paddingTop: topPad,
            paddingBottom: bottomPad,
            paddingHorizontal: 20,
            gap: 16,
          },
        ]}
      >
        <Feather name="alert-circle" size={48} color={colors.mutedForeground} />
        <Text style={[styles.missing, { color: colors.foreground }]}>
          Sem permissão para editar esta avaria
        </Text>
        <PrimaryButton
          label="Voltar"
          variant="secondary"
          onPress={() => router.back()}
        />
      </View>
    );
  }

  const handleSubmit = async () => {
    const next: typeof errors = {};
    if (!fleetNumber.trim()) next.fleetNumber = "Indica o nº de frota ou matrícula";
    if (!description.trim() || description.trim().length < 5)
      next.description = "Descreve o problema (min. 5 caracteres)";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSubmitting(true);
    try {
      const res = await editBreakdown(breakdown.id, {
        vehicleKind: kind,
        fleetNumber,
        description,
      });
      if (!res.ok) {
        setErrors({ general: res.reason ?? "Erro ao guardar" });
        return;
      }
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

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
              Editar avaria
            </Text>
            <View style={{ width: 44 }} />
          </View>

          <View
            style={[
              styles.adminBanner,
              {
                backgroundColor: colors.muted,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather
              name={user?.isAdmin && !isReporter ? "shield" : "edit-2"}
              size={16}
              color={colors.mutedForeground}
            />
            <Text
              style={[styles.adminBannerText, { color: colors.foreground }]}
            >
              {user?.isAdmin && !isReporter
                ? "A editar como administrador"
                : "A editar a tua avaria"}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={{ gap: 8 }}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                Tipo de viatura
              </Text>
              <SegmentedControl<VehicleKind>
                value={kind}
                onChange={setKind}
                options={VEHICLE_OPTIONS}
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

            {errors.general ? (
              <View
                style={[
                  styles.errorBox,
                  {
                    backgroundColor: colors.muted,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <Feather name="alert-circle" size={14} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  {errors.general}
                </Text>
              </View>
            ) : null}

            <PrimaryButton
              label="Guardar alterações"
              icon="check"
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
  missing: { fontSize: 16, fontFamily: "Inter_500Medium", textAlign: "center" },
  scroll: { paddingHorizontal: 20, gap: 16 },
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
  title: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  adminBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  adminBannerText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  form: { gap: 16 },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
});
