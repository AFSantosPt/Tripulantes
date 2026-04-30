import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CREW_CATEGORY_LABELS,
  CrewCategory,
  useAuth,
} from "@/contexts/AuthContext";
import { ShiftWithCalc, useShifts } from "@/contexts/ShiftsContext";
import { SwapRequest, useSwaps } from "@/contexts/SwapsContext";
import { useColors } from "@/hooks/useColors";
import { formatDateShort, todayIso } from "@/utils/time";

function categoriesCompatible(a: CrewCategory[], b: CrewCategory[]): boolean {
  if (a.length === 0 || b.length === 0) return true;
  return a.some((c) => b.includes(c));
}

function InitialsAvatar({
  name,
  size = 36,
}: {
  name: string;
  size?: number;
}) {
  const colors = useColors();
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.accent,
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
    >
      <Text
        style={{
          color: colors.accentForeground,
          fontFamily: "Inter_700Bold",
          fontSize: size * 0.36,
        }}
      >
        {initials || "?"}
      </Text>
    </View>
  );
}

function CategoryChips({ categories }: { categories: CrewCategory[] }) {
  const colors = useColors();
  if (!categories.length) return null;
  return (
    <View style={styles.chipRow}>
      {categories.map((c) => (
        <View
          key={c}
          style={[
            styles.chip,
            { backgroundColor: colors.muted, borderRadius: 999 },
          ]}
        >
          <Text
            style={[styles.chipText, { color: colors.mutedForeground }]}
          >
            {CREW_CATEGORY_LABELS[c]}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
        {title}
      </Text>
      {count != null && count > 0 ? (
        <View
          style={[
            styles.sectionBadge,
            { backgroundColor: colors.primary },
          ]}
        >
          <Text style={styles.sectionBadgeText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

function EmptySection({ label }: { label: string }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.emptyCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <Feather name="inbox" size={18} color={colors.mutedForeground} />
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

function AvailableShiftCard({
  shift,
  offererName,
  offererCrewId,
  offererCategories,
  onRequest,
}: {
  shift: ShiftWithCalc;
  offererName: string;
  offererCrewId: string;
  offererCategories: CrewCategory[];
  onRequest: () => void;
}) {
  const colors = useColors();
  const start = shift.stops[0]?.time ?? "—";
  const end = shift.stops[shift.stops.length - 1]?.time ?? "—";

  const handlePress = () => {
    const msg = `Pedir troca do serviço${shift.code ? ` ${shift.code}` : ""} de ${offererName} (${formatDateShort(shift.date)})?`;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(msg)) onRequest();
      return;
    }
    Alert.alert(
      "Pedir troca",
      msg,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Pedir troca", onPress: onRequest },
      ],
      { cancelable: true },
    );
  };

  return (
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
      <View style={styles.cardTop}>
        <InitialsAvatar name={offererName} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardName, { color: colors.foreground }]}>
            {offererName}
          </Text>
          <Text
            style={[styles.cardCrewId, { color: colors.mutedForeground }]}
          >
            Nº {offererCrewId}
          </Text>
          <CategoryChips categories={offererCategories} />
        </View>
      </View>
      <View
        style={[styles.cardDivider, { backgroundColor: colors.border }]}
      />
      <View style={styles.shiftRow}>
        <View style={styles.shiftMeta}>
          <Text style={[styles.shiftDate, { color: colors.primary }]}>
            {formatDateShort(shift.date)}
          </Text>
          {shift.code ? (
            <View
              style={[
                styles.codeTag,
                { backgroundColor: colors.muted, borderRadius: 6 },
              ]}
            >
              <Text
                style={[styles.codeTagText, { color: colors.foreground }]}
              >
                {shift.code}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          style={[styles.shiftTime, { color: colors.mutedForeground }]}
        >
          {start} → {end}
        </Text>
      </View>
      {shift.vehicleCode ? (
        <View style={styles.vehicleRow}>
          <Feather name="truck" size={12} color={colors.mutedForeground} />
          <Text
            style={[styles.vehicleText, { color: colors.mutedForeground }]}
          >
            {shift.vehicleCode}
          </Text>
        </View>
      ) : null}
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.requestBtn,
          {
            backgroundColor: colors.primary,
            borderRadius: colors.radius,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Feather name="repeat" size={14} color={colors.primaryForeground} />
        <Text
          style={[styles.requestBtnText, { color: colors.primaryForeground }]}
        >
          Pedir troca
        </Text>
      </Pressable>
    </View>
  );
}

function SentRequestCard({
  req,
  onCancel,
}: {
  req: SwapRequest;
  onCancel: () => void;
}) {
  const colors = useColors();

  const statusColor =
    req.status === "confirmed"
      ? colors.success
      : req.status === "rejected"
        ? colors.destructive
        : colors.primary;
  const statusLabel =
    req.status === "confirmed"
      ? "Confirmado"
      : req.status === "rejected"
        ? "Recusado"
        : "Aguarda confirmação";

  const handleCancel = () => {
    const msg = "Cancelar este pedido de troca?";
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(msg)) onCancel();
      return;
    }
    Alert.alert(
      "Cancelar pedido",
      msg,
      [
        { text: "Não", style: "cancel" },
        { text: "Cancelar pedido", style: "destructive", onPress: onCancel },
      ],
      { cancelable: true },
    );
  };

  return (
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
      <View style={styles.cardTop}>
        <InitialsAvatar name={req.offererName} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardName, { color: colors.foreground }]}>
            {req.offererName}
          </Text>
          <Text
            style={[styles.cardCrewId, { color: colors.mutedForeground }]}
          >
            Nº {req.offererCrewId}
          </Text>
          <CategoryChips categories={req.offererCategories} />
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusColor + "1A", borderColor: statusColor },
          ]}
        >
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>
            {statusLabel}
          </Text>
        </View>
      </View>
      <View
        style={[styles.cardDivider, { backgroundColor: colors.border }]}
      />
      <View style={styles.shiftRow}>
        <View style={styles.shiftMeta}>
          <Text style={[styles.shiftDate, { color: colors.primary }]}>
            {formatDateShort(req.offerShiftDate)}
          </Text>
          {req.offerShiftCode ? (
            <View
              style={[
                styles.codeTag,
                { backgroundColor: colors.muted, borderRadius: 6 },
              ]}
            >
              <Text
                style={[styles.codeTagText, { color: colors.foreground }]}
              >
                {req.offerShiftCode}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          style={[styles.shiftTime, { color: colors.mutedForeground }]}
        >
          {req.offerShiftStart} → {req.offerShiftEnd}
        </Text>
      </View>
      {req.status === "pending" ? (
        <Pressable
          onPress={handleCancel}
          style={({ pressed }) => [
            styles.cancelBtn,
            {
              borderColor: colors.border,
              borderRadius: colors.radius,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Text
            style={[styles.cancelBtnText, { color: colors.mutedForeground }]}
          >
            Cancelar pedido
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ReceivedRequestCard({
  req,
  onConfirm,
  onReject,
}: {
  req: SwapRequest;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const colors = useColors();

  const handleConfirm = () => {
    const msg = `Confirmar troca com ${req.requesterName}?`;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(msg)) onConfirm();
      return;
    }
    Alert.alert(
      "Confirmar troca",
      msg,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Confirmar", onPress: onConfirm },
      ],
      { cancelable: true },
    );
  };

  const handleReject = () => {
    const msg = `Recusar o pedido de ${req.requesterName}?`;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(msg)) onReject();
      return;
    }
    Alert.alert(
      "Recusar pedido",
      msg,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Recusar", style: "destructive", onPress: onReject },
      ],
      { cancelable: true },
    );
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.primary,
          borderRadius: colors.radius,
          borderWidth: 1.5,
        },
      ]}
    >
      <View
        style={[
          styles.receivedBanner,
          { backgroundColor: colors.primary + "12" },
        ]}
      >
        <Feather name="bell" size={13} color={colors.primary} />
        <Text style={[styles.receivedBannerText, { color: colors.primary }]}>
          Pedido de troca do teu serviço{" "}
          {req.offerShiftCode ? `${req.offerShiftCode} ` : ""}(
          {formatDateShort(req.offerShiftDate)})
        </Text>
      </View>
      <View style={[styles.cardTopPadded]}>
        <InitialsAvatar name={req.requesterName} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardName, { color: colors.foreground }]}>
            {req.requesterName}
          </Text>
          <Text
            style={[styles.cardCrewId, { color: colors.mutedForeground }]}
          >
            Nº {req.requesterCrewId}
          </Text>
          <CategoryChips categories={req.requesterCategories} />
        </View>
      </View>
      <View style={styles.actionRow}>
        <Pressable
          onPress={handleReject}
          style={({ pressed }) => [
            styles.rejectBtn,
            {
              borderColor: colors.destructive,
              borderRadius: colors.radius,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Feather name="x" size={14} color={colors.destructive} />
          <Text
            style={[styles.rejectBtnText, { color: colors.destructive }]}
          >
            Recusar
          </Text>
        </Pressable>
        <Pressable
          onPress={handleConfirm}
          style={({ pressed }) => [
            styles.confirmBtn,
            {
              backgroundColor: colors.success,
              borderRadius: colors.radius,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="check" size={14} color="#FFFFFF" />
          <Text style={styles.confirmBtnText}>Confirmar</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function SwapsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb
    ? Math.max(insets.bottom, 34) + 84
    : insets.bottom + 84;

  const { user, members } = useAuth();
  const { allShifts } = useShifts();
  const { swapRequests, requestSwap, confirmSwap, rejectSwap, cancelSwap } =
    useSwaps();

  const today = todayIso();

  const availableShifts = useMemo(() => {
    if (!user) return [];
    return allShifts.filter((s) => {
      if (!s.availableForSwap) return false;
      if (s.date < today) return false;
      if (s.crewMemberId === user.id) return false;
      const offerer = members.find((m) => m.id === s.crewMemberId);
      if (!offerer) return false;
      if (!categoriesCompatible(user.categories ?? [], offerer.categories ?? []))
        return false;
      const alreadyRequested = swapRequests.some(
        (r) =>
          r.offerShiftId === s.id &&
          r.requesterId === user.id &&
          r.status !== "rejected",
      );
      return !alreadyRequested;
    });
  }, [allShifts, user, members, swapRequests, today]);

  const sentRequests = useMemo(
    () =>
      user
        ? swapRequests
            .filter((r) => r.requesterId === user.id)
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )
        : [],
    [swapRequests, user],
  );

  const receivedRequests = useMemo(
    () =>
      user
        ? swapRequests.filter(
            (r) => r.offererId === user.id && r.status === "pending",
          )
        : [],
    [swapRequests, user],
  );

  const handleRequest = async (shift: ShiftWithCalc) => {
    const offerer = members.find((m) => m.id === shift.crewMemberId);
    if (!offerer) return;
    await requestSwap({
      shift,
      offererName: offerer.name,
      offererCrewId: offerer.crewId,
      offererCategories: offerer.categories ?? [],
    });
  };

  if (!user) return null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 12, paddingBottom: bottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>
          Trocas
        </Text>
        <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
          Serviços disponíveis para troca entre tripulantes da mesma categoria.
          Entradas expiram automaticamente após o dia do serviço.
        </Text>

        <SectionHeader
          title="Pedidos recebidos"
          count={receivedRequests.length}
        />
        {receivedRequests.length === 0 ? (
          <EmptySection label="Nenhum pedido de troca recebido." />
        ) : (
          <View style={{ gap: 12 }}>
            {receivedRequests.map((r) => (
              <ReceivedRequestCard
                key={r.id}
                req={r}
                onConfirm={() => confirmSwap(r.id)}
                onReject={() => rejectSwap(r.id)}
              />
            ))}
          </View>
        )}

        <SectionHeader title="Disponíveis para mim" />
        {availableShifts.length === 0 ? (
          <EmptySection label="Nenhum serviço disponível para troca com a tua categoria." />
        ) : (
          <View style={{ gap: 12 }}>
            {availableShifts.map((s) => {
              const offerer = members.find((m) => m.id === s.crewMemberId);
              if (!offerer) return null;
              return (
                <AvailableShiftCard
                  key={s.id}
                  shift={s}
                  offererName={offerer.name}
                  offererCrewId={offerer.crewId}
                  offererCategories={offerer.categories ?? []}
                  onRequest={() => handleRequest(s)}
                />
              );
            })}
          </View>
        )}

        <SectionHeader title="Os meus pedidos" />
        {sentRequests.length === 0 ? (
          <EmptySection label="Ainda não enviaste nenhum pedido de troca." />
        ) : (
          <View style={{ gap: 12 }}>
            {sentRequests.map((r) => (
              <SentRequestCard
                key={r.id}
                req={r}
                onCancel={() => cancelSwap(r.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 16,
    gap: 0,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  sectionBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  card: {
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    paddingBottom: 10,
  },
  cardTopPadded: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  cardName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  cardCrewId: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  cardDivider: {
    height: 1,
    marginHorizontal: 14,
  },
  shiftRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  shiftMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  shiftDate: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  codeTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  codeTagText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  shiftTime: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    fontVariant: ["tabular-nums"],
  },
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  vehicleText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  requestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    margin: 14,
    marginTop: 4,
    paddingVertical: 11,
  },
  requestBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  cancelBtn: {
    alignItems: "center",
    margin: 14,
    marginTop: 4,
    paddingVertical: 10,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  receivedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    padding: 10,
    paddingHorizontal: 14,
  },
  receivedBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    paddingTop: 6,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
  },
  rejectBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  confirmBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
