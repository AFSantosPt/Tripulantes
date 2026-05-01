import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo } from "react";
import {
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
import { ShiftStop, ShiftWithCalc, useShifts } from "@/contexts/ShiftsContext";
import { SwapRequest, useSwaps } from "@/contexts/SwapsContext";
import { useColors } from "@/hooks/useColors";
import { useConfirm } from "@/components/ConfirmModal";
import { formatDateShort, isoAddDays, todayIso } from "@/utils/time";
import { formatDisplayName } from "@/utils/nameFormat";

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

function StopsList({ stops }: { stops: ShiftStop[] }) {
  const colors = useColors();
  if (!stops.length) return null;
  return (
    <View style={styles.stopsList}>
      {stops.map((stop, i) => {
        const isFirst = i === 0;
        const isLast = i === stops.length - 1;
        return (
          <View key={i} style={styles.stopRow}>
            <View style={styles.stopIndicator}>
              <View
                style={[
                  styles.stopDot,
                  {
                    backgroundColor:
                      isFirst || isLast ? colors.primary : colors.border,
                    borderColor: colors.primary,
                  },
                ]}
              />
              {!isLast && (
                <View
                  style={[styles.stopLine, { backgroundColor: colors.border }]}
                />
              )}
            </View>
            <View style={styles.stopContent}>
              <Text
                style={[
                  styles.stopLocation,
                  {
                    color:
                      isFirst || isLast
                        ? colors.foreground
                        : colors.mutedForeground,
                    fontFamily:
                      isFirst || isLast
                        ? "Inter_600SemiBold"
                        : "Inter_400Regular",
                  },
                ]}
                numberOfLines={1}
              >
                {stop.location || "—"}
              </Text>
            </View>
            <Text
              style={[
                styles.stopTime,
                {
                  color:
                    isFirst || isLast ? colors.primary : colors.mutedForeground,
                  fontFamily:
                    isFirst || isLast ? "Inter_600SemiBold" : "Inter_400Regular",
                },
              ]}
            >
              {stop.time}
            </Text>
          </View>
        );
      })}
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

function AvailableDayCard({
  shifts,
  offererName,
  offererCrewId,
  offererCategories,
  onRequest,
}: {
  shifts: ShiftWithCalc[];
  offererName: string;
  offererCrewId: string;
  offererCategories: CrewCategory[];
  onRequest: () => void;
}) {
  const colors = useColors();
  const { confirm, modal } = useConfirm();
  const date = shifts[0]?.date ?? "";
  const codesLabel = shifts
    .map((s) => s.code)
    .filter(Boolean)
    .join(", ");

  const handlePress = () => {
    const msg = `Pedir troca do dia ${formatDateShort(date)}${codesLabel ? ` (${codesLabel})` : ""} de ${offererName}?`;
    confirm({
      title: "Pedir troca",
      message: msg,
      confirmLabel: "Pedir troca",
      onConfirm: onRequest,
    });
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
      {modal}
      <View style={styles.cardTop}>
        <InitialsAvatar name={offererName} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardName, { color: colors.foreground }]}>
            {offererName}
          </Text>
          <Text style={[styles.cardCrewId, { color: colors.mutedForeground }]}>
            Nº {offererCrewId}
          </Text>
          <CategoryChips categories={offererCategories} />
        </View>
      </View>
      <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />
      <View style={styles.shiftHeaderRow}>
        <Text style={[styles.shiftDate, { color: colors.primary }]}>
          {formatDateShort(date)}
        </Text>
      </View>
      {shifts.map((shift, idx) => (
        <View key={shift.id}>
          {idx > 0 && (
            <View
              style={[styles.servicesDivider, { backgroundColor: colors.border }]}
            />
          )}
          <View style={styles.serviceCodeRow}>
            {shift.code ? (
              <View
                style={[
                  styles.codeTag,
                  { backgroundColor: colors.muted, borderRadius: 6 },
                ]}
              >
                <Text style={[styles.codeTagText, { color: colors.foreground }]}>
                  {shift.code}
                </Text>
              </View>
            ) : null}
            {shift.vehicleCode ? (
              <View style={styles.vehicleInline}>
                <Feather name="truck" size={11} color={colors.mutedForeground} />
                <Text style={[styles.vehicleText, { color: colors.mutedForeground }]}>
                  {shift.vehicleCode}
                </Text>
              </View>
            ) : null}
          </View>
          <StopsList stops={shift.stops} />
        </View>
      ))}
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
        <Text style={[styles.requestBtnText, { color: colors.primaryForeground }]}>
          Pedir troca
        </Text>
      </Pressable>
    </View>
  );
}

function SentRequestCard({
  req,
  onCancel,
  offererPhone,
  isAdmin,
}: {
  req: SwapRequest;
  onCancel: () => void;
  offererPhone?: string;
  isAdmin?: boolean;
}) {
  const colors = useColors();
  const { confirm, modal } = useConfirm();

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
    confirm({
      title: "Cancelar pedido",
      message: "Cancelar este pedido de troca?",
      confirmLabel: "Cancelar pedido",
      destructive: true,
      onConfirm: onCancel,
    });
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
      {modal}
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
      <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />
      <View style={styles.shiftHeaderRow}>
        <Text style={[styles.shiftDate, { color: colors.primary }]}>
          {formatDateShort(req.offerShiftDate)}
        </Text>
      </View>
      {req.offerShifts && req.offerShifts.length > 0 ? (
        req.offerShifts.map((s, idx) => (
          <View key={s.id || idx}>
            {idx > 0 && (
              <View
                style={[styles.servicesDivider, { backgroundColor: colors.border }]}
              />
            )}
            <View style={styles.serviceCodeRow}>
              {s.code ? (
                <View
                  style={[
                    styles.codeTag,
                    { backgroundColor: colors.muted, borderRadius: 6 },
                  ]}
                >
                  <Text style={[styles.codeTagText, { color: colors.foreground }]}>
                    {s.code}
                  </Text>
                </View>
              ) : null}
              {s.vehicleCode ? (
                <View style={styles.vehicleInline}>
                  <Feather name="truck" size={11} color={colors.mutedForeground} />
                  <Text style={[styles.vehicleText, { color: colors.mutedForeground }]}>
                    {s.vehicleCode}
                  </Text>
                </View>
              ) : null}
            </View>
            <StopsList stops={s.stops} />
          </View>
        ))
      ) : req.offerShiftStops && req.offerShiftStops.length > 0 ? (
        <StopsList stops={req.offerShiftStops} />
      ) : (
        <View style={styles.shiftRow}>
          <Text style={[styles.shiftTime, { color: colors.mutedForeground }]}>
            {req.offerShiftStart} → {req.offerShiftEnd}
          </Text>
        </View>
      )}
      {req.status === "confirmed" && offererPhone ? (
        <View
          style={[
            styles.phoneRow,
            { backgroundColor: colors.muted, borderRadius: colors.radius },
          ]}
        >
          <Feather name="phone" size={13} color={colors.mutedForeground} />
          <Text style={[styles.phoneText, { color: colors.foreground }]}>
            {offererPhone}
          </Text>
          <Text style={[styles.phoneLabel, { color: colors.mutedForeground }]}>
            contrato telefónico
          </Text>
        </View>
      ) : null}
      {(req.status === "pending" || isAdmin) ? (
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
            {isAdmin && req.status !== "pending" ? "Eliminar (admin)" : "Cancelar pedido"}
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
  const { confirm, modal } = useConfirm();

  const handleConfirm = () => {
    confirm({
      title: "Confirmar troca",
      message: `Confirmar troca com ${req.requesterName}?`,
      confirmLabel: "Confirmar",
      onConfirm,
    });
  };

  const handleReject = () => {
    confirm({
      title: "Recusar pedido",
      message: `Recusar o pedido de ${req.requesterName}?`,
      confirmLabel: "Recusar",
      destructive: true,
      onConfirm: onReject,
    });
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
      {modal}
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

function AdminHistoryCard({
  req,
  onDelete,
}: {
  req: SwapRequest;
  onDelete: () => void;
}) {
  const colors = useColors();
  const { confirm, modal } = useConfirm();

  const statusColor =
    req.status === "confirmed"
      ? colors.success
      : req.status === "rejected"
        ? colors.destructive
        : colors.primary;
  const statusLabel =
    req.status === "confirmed" ? "Confirmada" : req.status === "rejected" ? "Recusada" : "Pendente";

  const handleDelete = () =>
    confirm({
      title: "Eliminar troca",
      message: `Eliminar a troca de ${formatDateShort(req.offerShiftDate)} entre ${req.offererName} e ${req.requesterName}?`,
      confirmLabel: "Eliminar",
      destructive: true,
      onConfirm: onDelete,
    });

  return (
    <View
      style={[
        styles.pastCard,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
      ]}
    >
      {modal}
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pastCardDate, { color: colors.primary }]}>
            {formatDateShort(req.offerShiftDate)}{req.offerShiftCode ? `  ·  ${req.offerShiftCode}` : ""}
          </Text>
          <Text style={[styles.pastCardName, { color: colors.foreground }]}>
            {req.offererName}
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}> Nº {req.offererCrewId}</Text>
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginVertical: 2 }}>
            <Feather name="arrow-right" size={11} color={colors.mutedForeground} />
            <Text style={[styles.pastCardName, { color: colors.foreground }]}>
              {req.requesterName}
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}> Nº {req.requesterCrewId}</Text>
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColor + "1A", borderColor: statusColor },
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
          >
            <Feather name="trash-2" size={16} color={colors.destructive} />
          </Pressable>
        </View>
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
  const { confirm, modal } = useConfirm();
  const { allShifts } = useShifts();
  const { swapRequests, adminHistory, requestSwap, confirmSwap, rejectSwap, cancelSwap, fetchAdminHistory } =
    useSwaps();

  useEffect(() => {
    if (user?.isAdmin) fetchAdminHistory();
  }, [user?.isAdmin, fetchAdminHistory]);

  const today = todayIso();

  const availableDayGroups = useMemo(() => {
    if (!user) return [];

    const myWorkDates = new Set(
      allShifts
        .filter(
          (s) =>
            s.crewMemberId === user.id &&
            s.stops != null &&
            s.stops.length >= 2,
        )
        .map((s) => s.date),
    );

    const myShiftsByDate = new Map<string, ShiftWithCalc[]>();
    for (const s of allShifts) {
      if (s.crewMemberId !== user.id) continue;
      if (!s.stops || s.stops.length < 2) continue;
      if (s.affectation === "folga" || s.affectation === "ferias") continue;
      if (!myShiftsByDate.has(s.date)) myShiftsByDate.set(s.date, []);
      myShiftsByDate.get(s.date)!.push(s);
    }

    const filtered = allShifts.filter((s) => {
      if (!s.availableForSwap) return false;
      if (s.date <= today) return false;
      if (s.crewMemberId === user.id) return false;
      if (!myWorkDates.has(s.date)) return false;
      const offerer = members.find((m) => m.id === s.crewMemberId);
      if (!offerer) return false;
      if (!categoriesCompatible(user.categories ?? [], offerer.categories ?? []))
        return false;
      return true;
    });
    const groups = new Map<string, ShiftWithCalc[]>();
    for (const s of filtered) {
      const key = `${s.crewMemberId}::${s.date}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    const REST_MIN = 660;
    return Array.from(groups.values())
      .map((g) => g.sort((a, b) => a.startMinutes - b.startMinutes))
      .filter((g) => {
        const ids = g.map((s) => s.id);
        return !swapRequests.some(
          (r) =>
            r.offerShiftIds.some((id) => ids.includes(id)) &&
            r.requesterId === user.id &&
            r.status !== "rejected",
        );
      })
      .filter((g) => {
        const date = g[0].date;
        const groupStart = g[0].startMinutes;
        const groupEnd = Math.max(...g.map((s) => s.endMinutes));
        const prevDate = isoAddDays(date, -1);
        const nextDate = isoAddDays(date, 1);
        for (const ps of myShiftsByDate.get(prevDate) ?? []) {
          if (1440 + groupStart - ps.endMinutes < REST_MIN) return false;
        }
        for (const ns of myShiftsByDate.get(nextDate) ?? []) {
          if (1440 + ns.startMinutes - groupEnd < REST_MIN) return false;
        }
        return true;
      })
      .sort((a, b) => a[0].date.localeCompare(b[0].date));
  }, [allShifts, user, members, swapRequests, today]);

  const sentRequests = useMemo(
    () =>
      user
        ? swapRequests
            .filter((r) => r.requesterId === user.id && r.offerShiftDate > today)
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )
        : [],
    [swapRequests, user, today],
  );

  const receivedRequests = useMemo(
    () =>
      user
        ? swapRequests.filter(
            (r) => r.offererId === user.id && r.status === "pending" && r.offerShiftDate > today,
          )
        : [],
    [swapRequests, user, today],
  );

  const pastSwaps = useMemo(
    () =>
      user
        ? swapRequests
            .filter(
              (r) =>
                r.offerShiftDate <= today &&
                (r.requesterId === user.id || r.offererId === user.id),
            )
            .sort((a, b) => b.offerShiftDate.localeCompare(a.offerShiftDate))
        : [],
    [swapRequests, user, today],
  );

  const handleRequest = (shifts: ShiftWithCalc[]) => {
    if (!shifts.length) return;
    const offerer = members.find((m) => m.id === shifts[0].crewMemberId);
    if (!offerer) return;
    confirm({
      title: "Pedir troca de serviço",
      message: `Antes de enviar o pedido, fala diretamente com ${formatDisplayName(offerer.name)} e com a Expedição para combinarem a troca.\n\nEnviar o pedido não garante a aprovação.`,
      confirmLabel: "Enviar pedido",
      onConfirm: async () => {
        await requestSwap({
          shifts,
          offererName: formatDisplayName(offerer.name),
          offererCrewId: offerer.crewId,
          offererCategories: offerer.categories ?? [],
        });
      },
    });
  };

  if (!user) return null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {modal}
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
          Só aparecem trocas em dias em que ambos têm serviço. Entradas expiram automaticamente após o dia do serviço.
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
        {availableDayGroups.length === 0 ? (
          <EmptySection label="Nenhum serviço disponível. Só aparecem dias em que tens e o colega também tem serviço." />
        ) : (
          <View style={{ gap: 12 }}>
            {availableDayGroups.map((group) => {
              const offerer = members.find((m) => m.id === group[0].crewMemberId);
              if (!offerer) return null;
              const key = `${group[0].crewMemberId}::${group[0].date}`;
              return (
                <AvailableDayCard
                  key={key}
                  shifts={group}
                  offererName={formatDisplayName(offerer.name)}
                  offererCrewId={offerer.crewId}
                  offererCategories={offerer.categories ?? []}
                  onRequest={() => handleRequest(group)}
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
                offererPhone={members.find((m) => m.id === r.offererId)?.phone}
                isAdmin={!!user?.isAdmin}
              />
            ))}
          </View>
        )}

        {pastSwaps.length > 0 ? (
          <>
            <SectionHeader title="Trocas passadas" />
            <View style={{ gap: 8 }}>
              {pastSwaps.map((r) => {
                const isRequester = r.requesterId === user!.id;
                const otherName = isRequester ? r.offererName : r.requesterName;
                const otherCrewId = isRequester ? r.offererCrewId : r.requesterCrewId;
                const statusColor =
                  r.status === "confirmed"
                    ? colors.success
                    : r.status === "rejected"
                      ? colors.destructive
                      : colors.mutedForeground;
                const statusLabel =
                  r.status === "confirmed"
                    ? "Confirmada"
                    : r.status === "rejected"
                      ? "Recusada"
                      : "Pendente";
                return (
                  <View
                    key={r.id}
                    style={[
                      styles.pastCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderRadius: colors.radius,
                      },
                    ]}
                  >
                    <View style={styles.pastCardRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pastCardDate, { color: colors.primary }]}>
                          {formatDateShort(r.offerShiftDate)}
                          {r.offerShiftCode ? `  ·  ${r.offerShiftCode}` : ""}
                        </Text>
                        <Text style={[styles.pastCardName, { color: colors.foreground }]}>
                          {isRequester ? "Pedido a " : "Pedido de "}{otherName}
                        </Text>
                        <Text style={[styles.pastCardMeta, { color: colors.mutedForeground }]}>
                          Nº {otherCrewId}
                        </Text>
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
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {user?.isAdmin && adminHistory.length > 0 ? (
          <>
            <SectionHeader title="Histórico completo" />
            <View style={{ gap: 8 }}>
              {adminHistory.map((r) => (
                <AdminHistoryCard
                  key={r.id}
                  req={r}
                  onDelete={() => cancelSwap(r.id)}
                />
              ))}
            </View>
          </>
        ) : user?.isAdmin && adminHistory.length === 0 ? (
          <>
            <SectionHeader title="Histórico completo" />
            <EmptySection label="Sem trocas registadas." />
          </>
        ) : null}
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
  vehicleInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  vehicleText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  shiftHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },
  serviceCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  servicesDivider: {
    height: 1,
    marginHorizontal: 14,
    marginBottom: 10,
  },
  stopsList: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 24,
  },
  stopIndicator: {
    width: 16,
    alignItems: "center",
    marginRight: 10,
    paddingTop: 4,
  },
  stopDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  stopLine: {
    width: 1.5,
    flex: 1,
    minHeight: 14,
    marginTop: 2,
  },
  stopContent: {
    flex: 1,
    paddingBottom: 12,
  },
  stopLocation: {
    fontSize: 13,
    lineHeight: 17,
  },
  stopTime: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    lineHeight: 17,
    paddingBottom: 12,
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
  pastCard: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 0,
  },
  pastCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pastCardDate: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  pastCardName: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  pastCardMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginHorizontal: 14,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  phoneText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  phoneLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
