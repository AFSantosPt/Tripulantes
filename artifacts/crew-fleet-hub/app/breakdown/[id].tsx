import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
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
import { useConfirm } from "@/components/ConfirmModal";
import { useAuth } from "@/contexts/AuthContext";
import {
  BREAKDOWN_MAX_PHOTOS,
  BREAKDOWN_PHOTO_LIFETIME_DAYS,
  BreakdownPhoto,
  Confirmation,
  REQUIRED_CONFIRMATIONS_COUNT,
  VEHICLE_ICON,
  VEHICLE_LABELS,
  useBreakdowns,
} from "@/contexts/BreakdownsContext";
import { useColors } from "@/hooks/useColors";
import { daysUntilExpiry, pickImageAsDataUri } from "@/utils/imagePicker";
import { formatRelative } from "@/utils/time";

export default function BreakdownDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    byId,
    confirmRepair,
    removeBreakdown,
    addPhoto,
    removePhoto,
  } = useBreakdowns();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { confirm, modal } = useConfirm();
  const [photoFeedback, setPhotoFeedback] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  const breakdown = id ? byId(id) : undefined;

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb ? Math.max(insets.bottom, 34) : insets.bottom + 16;

  if (!breakdown) {
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
        <Feather
          name="alert-circle"
          size={48}
          color={colors.mutedForeground}
        />
        <Text style={[styles.missing, { color: colors.foreground }]}>
          Avaria não encontrada
        </Text>
        <PrimaryButton
          label="Voltar"
          variant="secondary"
          onPress={() => router.back()}
        />
      </View>
    );
  }

  const count = breakdown.confirmations.length;
  const required = REQUIRED_CONFIRMATIONS_COUNT;
  const resolved = count >= required;
  const isReporter = breakdown.reportedById === user?.id;
  const userConfirmed =
    user != null &&
    breakdown.confirmations.some((c) => c.crewMemberId === user.id);

  const canConfirm = !resolved && !isReporter && !userConfirmed;

  const handleConfirm = async () => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await confirmRepair(breakdown.id);
      if (!res.ok && res.reason) {
        setFeedback(res.reason);
      } else if (res.ok && Platform.OS !== "web") {
        try {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
        } catch {}
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPhoto = async () => {
    setPhotoFeedback(null);
    setUploading(true);
    try {
      const picked = await pickImageAsDataUri();
      if (!picked.ok) {
        if (picked.reason) setPhotoFeedback(picked.reason);
        return;
      }
      const res = await addPhoto(breakdown.id, picked.image!.dataUri);
      if (!res.ok) {
        setPhotoFeedback(res.reason ?? "Não foi possível adicionar a foto");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = (photo: BreakdownPhoto) => {
    confirm({
      title: "Remover fotografia",
      message: "Esta ação não pode ser revertida.",
      confirmLabel: "Remover",
      destructive: true,
      onConfirm: () => removePhoto(breakdown.id, photo.id),
    });
  };

  const handleDelete = () => {
    confirm({
      title: "Eliminar avaria",
      message: "Esta ação não pode ser revertida.",
      confirmLabel: "Eliminar",
      destructive: true,
      onConfirm: async () => {
        await removeBreakdown(breakdown.id);
        router.back();
      },
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {modal}
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 12,
          paddingBottom: bottomPad + 24,
          paddingHorizontal: 20,
          gap: 16,
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
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(isReporter || user?.isAdmin) ? (
              <Pressable
                onPress={() => router.push(`/breakdown-edit?id=${breakdown.id}`)}
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
                <Feather name="edit-2" size={18} color={colors.foreground} />
              </Pressable>
            ) : null}
            {isReporter ? (
              <Pressable
                onPress={handleDelete}
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
                <Feather name="trash-2" size={18} color={colors.destructive} />
              </Pressable>
            ) : null}
            {!user?.isAdmin && !isReporter ? (
              <View style={{ width: 44 }} />
            ) : null}
          </View>
        </View>

        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: resolved ? colors.success : colors.primary,
              borderRadius: colors.radius + 4,
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View
              style={[
                styles.kindBadge,
                {
                  backgroundColor: "rgba(255,255,255,0.18)",
                  borderRadius: 999,
                },
              ]}
            >
              <Feather
                name={VEHICLE_ICON[breakdown.vehicleKind] as any}
                size={12}
                color="#FFFFFF"
              />
              <Text style={styles.kindBadgeText}>
                {VEHICLE_LABELS[breakdown.vehicleKind]}
              </Text>
            </View>
            <Text style={styles.heroTime}>
              {formatRelative(breakdown.reportedAt)}
            </Text>
          </View>
          <Text style={styles.heroFleet}>#{breakdown.fleetNumber}</Text>
          <Text style={styles.heroDescription}>{breakdown.description}</Text>

          <View style={styles.consensusBlock}>
            <Text style={styles.consensusKicker}>
              {resolved ? "Reparação confirmada" : "Consenso"}
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              {Array.from({ length: required }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.consensusDot,
                    {
                      backgroundColor:
                        i < count ? "#FFFFFF" : "rgba(255,255,255,0.18)",
                    },
                  ]}
                >
                  {i < count ? (
                    <Feather
                      name="check"
                      size={14}
                      color={resolved ? colors.success : colors.primary}
                    />
                  ) : null}
                </View>
              ))}
            </View>
            <Text style={styles.consensusCount}>
              {count}/{required} validações
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.metaCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>
            Reportado por
          </Text>
          <View style={styles.personRow}>
            <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
              <Text
                style={[styles.avatarText, { color: colors.accentForeground }]}
              >
                {breakdown.reportedByName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.personName, { color: colors.foreground }]}>
                {breakdown.reportedByName}
              </Text>
              <Text
                style={[styles.personMeta, { color: colors.mutedForeground }]}
              >
                Tripulante #{breakdown.reportedByCrewId} ·{" "}
                {formatRelative(breakdown.reportedAt)}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <View style={styles.photosHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text
                  style={[styles.sectionTitle, { color: colors.mutedForeground }]}
                >
                  Fotografias
                </Text>
                <View
                  style={[
                    styles.photoCountBadge,
                    {
                      backgroundColor:
                        breakdown.photos.length >= BREAKDOWN_MAX_PHOTOS
                          ? colors.muted
                          : colors.accent,
                      borderRadius: 999,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.photoCountText,
                      {
                        color:
                          breakdown.photos.length >= BREAKDOWN_MAX_PHOTOS
                            ? colors.mutedForeground
                            : colors.accentForeground,
                      },
                    ]}
                  >
                    {breakdown.photos.length}/{BREAKDOWN_MAX_PHOTOS}
                  </Text>
                </View>
              </View>
              <Text
                style={[styles.photosHint, { color: colors.mutedForeground }]}
              >
                Máx. {BREAKDOWN_MAX_PHOTOS} fotos · expiram após{" "}
                {BREAKDOWN_PHOTO_LIFETIME_DAYS} dias
              </Text>
            </View>
            <Pressable
              onPress={handleAddPhoto}
              disabled={uploading || breakdown.photos.length >= BREAKDOWN_MAX_PHOTOS}
              style={({ pressed }) => [
                styles.photoAddBtn,
                {
                  backgroundColor:
                    breakdown.photos.length >= BREAKDOWN_MAX_PHOTOS
                      ? colors.muted
                      : colors.accent,
                  borderRadius: colors.radius,
                  opacity:
                    pressed ||
                    uploading ||
                    breakdown.photos.length >= BREAKDOWN_MAX_PHOTOS
                      ? 0.6
                      : 1,
                },
              ]}
            >
              <Feather
                name={uploading ? "loader" : "camera"}
                size={16}
                color={
                  breakdown.photos.length >= BREAKDOWN_MAX_PHOTOS
                    ? colors.mutedForeground
                    : colors.accentForeground
                }
              />
              <Text
                style={[
                  styles.photoAddLabel,
                  {
                    color:
                      breakdown.photos.length >= BREAKDOWN_MAX_PHOTOS
                        ? colors.mutedForeground
                        : colors.accentForeground,
                  },
                ]}
              >
                {uploading
                  ? "A carregar..."
                  : breakdown.photos.length >= BREAKDOWN_MAX_PHOTOS
                    ? "Limite atingido"
                    : "Adicionar"}
              </Text>
            </Pressable>
          </View>

          {photoFeedback ? (
            <View
              style={[
                styles.feedback,
                {
                  backgroundColor: colors.muted,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Feather
                name="info"
                size={14}
                color={colors.mutedForeground}
              />
              <Text
                style={[styles.feedbackText, { color: colors.foreground }]}
              >
                {photoFeedback}
              </Text>
            </View>
          ) : null}

          {breakdown.photos.length === 0 ? (
            <View
              style={[
                styles.emptyPhotos,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Feather
                name="image"
                size={20}
                color={colors.mutedForeground}
              />
              <Text
                style={[
                  styles.emptyPhotosText,
                  { color: colors.mutedForeground },
                ]}
              >
                Sem fotos. Adiciona uma para mostrar a avaria.
              </Text>
            </View>
          ) : (
            <View style={styles.photoGrid}>
              {breakdown.photos.map((p) => {
                const remaining = daysUntilExpiry(
                  p.addedAt,
                  BREAKDOWN_PHOTO_LIFETIME_DAYS,
                );
                const canRemove =
                  user?.id === p.addedById || isReporter;
                return (
                  <View
                    key={p.id}
                    style={[
                      styles.photoTile,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderRadius: colors.radius,
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: p.uri }}
                      style={styles.photoImage}
                      contentFit="cover"
                    />
                    <View style={styles.photoFoot}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.photoBy,
                            { color: colors.foreground },
                          ]}
                          numberOfLines={1}
                        >
                          {p.addedByName}
                        </Text>
                        <Text
                          style={[
                            styles.photoExpiry,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          Expira em {remaining} dia
                          {remaining === 1 ? "" : "s"}
                        </Text>
                      </View>
                      {canRemove ? (
                        <Pressable
                          onPress={() => handleRemovePhoto(p)}
                          hitSlop={8}
                          style={({ pressed }) => ({
                            opacity: pressed ? 0.6 : 1,
                            padding: 4,
                          })}
                        >
                          <Feather
                            name="trash-2"
                            size={14}
                            color={colors.destructive}
                          />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ gap: 10 }}>
          <Text
            style={[styles.sectionTitle, { color: colors.mutedForeground }]}
          >
            Validações da reparação
          </Text>
          {breakdown.confirmations.length === 0 ? (
            <View
              style={[
                styles.emptyConfirm,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Feather
                name="users"
                size={20}
                color={colors.mutedForeground}
              />
              <Text
                style={[
                  styles.emptyConfirmText,
                  { color: colors.mutedForeground },
                ]}
              >
                Ainda sem validações. São precisas {required} confirmações de
                tripulantes diferentes.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {breakdown.confirmations.map((c, idx) => (
                <ConfirmationRow
                  key={c.crewMemberId}
                  confirmation={c}
                  index={idx + 1}
                />
              ))}
            </View>
          )}
        </View>

        {feedback ? (
          <View
            style={[
              styles.feedback,
              {
                backgroundColor: colors.muted,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="info" size={16} color={colors.mutedForeground} />
            <Text
              style={[styles.feedbackText, { color: colors.foreground }]}
            >
              {feedback}
            </Text>
          </View>
        ) : null}

        {canConfirm ? (
          <PrimaryButton
            label={`Confirmar reparação (${count + 1}/${required})`}
            icon="check-circle"
            onPress={handleConfirm}
            loading={submitting}
          />
        ) : isReporter && !resolved ? (
          <View
            style={[
              styles.notice,
              {
                backgroundColor: colors.muted,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather
              name="user-check"
              size={16}
              color={colors.mutedForeground}
            />
            <Text style={[styles.noticeText, { color: colors.foreground }]}>
              Reportaste esta avaria. A validação tem de vir de outros
              tripulantes.
            </Text>
          </View>
        ) : userConfirmed && !resolved ? (
          <View
            style={[
              styles.notice,
              {
                backgroundColor: colors.muted,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="check" size={16} color={colors.success} />
            <Text style={[styles.noticeText, { color: colors.foreground }]}>
              Já validaste esta reparação. Faltam {required - count}{" "}
              validações.
            </Text>
          </View>
        ) : resolved ? (
          <View
            style={[
              styles.notice,
              {
                backgroundColor: colors.muted,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="check-circle" size={16} color={colors.success} />
            <Text style={[styles.noticeText, { color: colors.foreground }]}>
              Avaria resolvida por consenso da tripulação.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ConfirmationRow({
  confirmation,
  index,
}: {
  confirmation: Confirmation;
  index: number;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.confirmRow,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={[styles.indexBadge, { backgroundColor: colors.success }]}>
        <Text style={styles.indexBadgeText}>{index}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.personName, { color: colors.foreground }]}>
          {confirmation.crewMemberName}
        </Text>
        <Text style={[styles.personMeta, { color: colors.mutedForeground }]}>
          Tripulante #{confirmation.crewIdLabel} ·{" "}
          {formatRelative(confirmation.at)}
        </Text>
      </View>
      <Feather name="check" size={18} color={colors.success} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  missing: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
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
  heroCard: {
    padding: 22,
    gap: 6,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  kindBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  kindBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  heroTime: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  heroFleet: {
    color: "#FFFFFF",
    fontSize: 38,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1.2,
    marginTop: 4,
  },
  heroDescription: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    lineHeight: 22,
    marginTop: 4,
  },
  consensusBlock: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  consensusKicker: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  consensusDot: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  consensusCount: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginTop: 10,
  },
  metaCard: {
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  metaLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  personName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  personMeta: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  photosHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  photoCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  photoCountText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  photosHint: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  photoAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  photoAddLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  emptyPhotos: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  emptyPhotosText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoTile: {
    width: "48%",
    borderWidth: 1,
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#0001",
  },
  photoFoot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  photoBy: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  photoExpiry: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 1,
  },
  emptyConfirm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  emptyConfirmText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 19,
  },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  indexBadgeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  feedback: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  feedbackText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 19,
  },
});
