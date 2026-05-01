import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useAuth } from "@/contexts/AuthContext";
import {
  Breakdown,
  REQUIRED_CONFIRMATIONS_COUNT,
  VEHICLE_ICON,
  VEHICLE_LABELS,
  useBreakdowns,
} from "@/contexts/BreakdownsContext";
import { useColors } from "@/hooks/useColors";
import { formatRelative } from "@/utils/time";

type Tab = "active" | "history";

export default function BreakdownsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { active, resolved } = useBreakdowns();
  const [tab, setTab] = useState<Tab>("active");
  const [search, setSearch] = useState("");

  const base = tab === "active" ? active : resolved;
  const query = search.trim().toLowerCase();
  const data = query
    ? base.filter((b) => b.fleetNumber.toLowerCase().includes(query))
    : base;

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomTab = isWeb ? 84 : 70 + insets.bottom;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: topPad + 8,
          paddingBottom: bottomTab + 24,
          paddingHorizontal: 20,
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: 18 }}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.kicker, { color: colors.mutedForeground }]}
                >
                  Frota
                </Text>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  Avarias
                </Text>
              </View>
              <Pressable
                onPress={() => router.push("/breakdown-new")}
                style={({ pressed }) => [
                  styles.cta,
                  {
                    backgroundColor: colors.primary,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <Feather
                  name="plus"
                  size={18}
                  color={colors.primaryForeground}
                />
                <Text
                  style={[
                    styles.ctaLabel,
                    { color: colors.primaryForeground },
                  ]}
                >
                  Reportar
                </Text>
              </Pressable>
            </View>

            <View style={{ marginTop: 14 }}>
              <SegmentedControl<Tab>
                value={tab}
                onChange={(t) => { setTab(t); setSearch(""); }}
                options={[
                  { value: "active", label: `Ativas · ${active.length}` },
                  {
                    value: "history",
                    label: `Histórico · ${resolved.length}`,
                  },
                ]}
              />
            </View>

            <View
              style={[
                styles.searchRow,
                {
                  backgroundColor: colors.card,
                  borderColor: search ? colors.primary : colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder="Filtrar por nº de viatura..."
                placeholderTextColor={colors.mutedForeground}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="search"
              />
              {search.length > 0 ? (
                <Pressable onPress={() => setSearch("")} hitSlop={8}>
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <BreakdownCard
            breakdown={item}
            currentUserId={user?.id ?? ""}
            onPress={() => router.push(`/breakdown/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          query ? (
            <EmptyState
              icon="search"
              title={`Sem resultados para "${search}"`}
              description="Nenhuma avaria com esse número de viatura."
            />
          ) : tab === "active" ? (
            <EmptyState
              icon="check-circle"
              title="Sem avarias ativas"
              description="Tudo a rolar. Reporta uma avaria para que outros tripulantes possam validar a reparação."
            />
          ) : (
            <EmptyState
              icon="archive"
              title="Sem histórico ainda"
              description="As avarias com 2 confirmações de tripulantes diferentes vão aparecer aqui."
            />
          )
        }
        scrollEnabled={data.length > 0}
      />
    </View>
  );
}

function BreakdownCard({
  breakdown,
  currentUserId,
  onPress,
}: {
  breakdown: Breakdown;
  currentUserId: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const count = breakdown.confirmations.length;
  const required = REQUIRED_CONFIRMATIONS_COUNT;
  const resolved = count >= required;
  const userConfirmed = breakdown.confirmations.some(
    (c) => c.crewMemberId === currentUserId,
  );
  const isReporter = breakdown.reportedById === currentUserId;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.cardHead}>
        <View
          style={[
            styles.kindBadge,
            {
              backgroundColor:
                breakdown.vehicleKind === "eletrico"
                  ? "#1F4F7A"
                  : breakdown.vehicleKind === "ascensor"
                    ? "#7B5A2D"
                    : colors.secondary,
              borderRadius: 999,
            },
          ]}
        >
          <Feather
            name={VEHICLE_ICON[breakdown.vehicleKind] as any}
            size={12}
            color={
              breakdown.vehicleKind === "autocarro"
                ? colors.foreground
                : "#FFFFFF"
            }
          />
          <Text
            style={[
              styles.kindLabel,
              {
                color:
                  breakdown.vehicleKind === "autocarro"
                    ? colors.foreground
                    : "#FFFFFF",
              },
            ]}
          >
            {VEHICLE_LABELS[breakdown.vehicleKind]} · {breakdown.fleetNumber}
          </Text>
        </View>

        <Text style={[styles.timeAgo, { color: colors.mutedForeground }]}>
          {formatRelative(breakdown.reportedAt)}
        </Text>
      </View>

      <Text
        style={[styles.description, { color: colors.foreground }]}
        numberOfLines={3}
      >
        {breakdown.description}
      </Text>

      <View style={styles.cardFoot}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>
            Reportado por
          </Text>
          <Text style={[styles.metaValue, { color: colors.foreground }]}>
            {breakdown.reportedByName}
          </Text>
          {breakdown.photos.length > 0 ? (
            <View style={styles.photoBadge}>
              <Feather name="camera" size={11} color={colors.mutedForeground} />
              <Text
                style={[styles.photoBadgeText, { color: colors.mutedForeground }]}
              >
                {breakdown.photos.length} foto
                {breakdown.photos.length === 1 ? "" : "s"}
              </Text>
            </View>
          ) : null}
        </View>

        <ConsensusBar
          count={count}
          required={required}
          resolved={resolved}
          highlight={userConfirmed}
          isReporter={isReporter}
        />
      </View>
    </Pressable>
  );
}

function ConsensusBar({
  count,
  required,
  resolved,
  highlight,
  isReporter,
}: {
  count: number;
  required: number;
  resolved: boolean;
  highlight: boolean;
  isReporter: boolean;
}) {
  const colors = useColors();
  const items = Array.from({ length: required }, (_, i) => i < count);

  return (
    <View style={{ alignItems: "flex-end", gap: 6 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {items.map((filled, i) => (
          <View
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              backgroundColor: filled
                ? resolved
                  ? colors.success
                  : colors.accent
                : colors.muted,
              borderWidth: 1,
              borderColor: filled
                ? resolved
                  ? colors.success
                  : colors.accent
                : colors.border,
            }}
          />
        ))}
      </View>
      <Text
        style={[
          styles.consensusLabel,
          {
            color: resolved
              ? colors.success
              : highlight
                ? colors.accent
                : isReporter
                  ? colors.mutedForeground
                  : colors.primary,
          },
        ]}
      >
        {resolved
          ? "Resolvida"
          : `${count}/${required} validações`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  kicker: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.8,
    marginTop: 2,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    minHeight: 44,
    gap: 6,
  },
  ctaLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    paddingVertical: 0,
  },
  card: {
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kindBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  kindLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  timeAgo: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  description: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    lineHeight: 21,
  },
  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  metaValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  consensusLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  photoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  photoBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
});
