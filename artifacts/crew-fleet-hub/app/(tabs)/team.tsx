import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { CrewMember, useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

type Section =
  | { kind: "header"; key: string; label: string; meta?: string }
  | { kind: "pending"; key: string; member: CrewMember }
  | { kind: "active"; key: string; member: CrewMember }
  | { kind: "empty"; key: string; label: string };

export default function TeamScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    user,
    pendingMembers,
    activeMembers,
    approveMember,
    rejectMember,
    toggleAdmin,
    removeMember,
    signOut,
  } = useAuth();

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomTab = isWeb ? 84 : 70 + insets.bottom;

  const isAdmin = !!user?.isAdmin;

  const sections: Section[] = [];
  if (isAdmin) {
    sections.push({
      kind: "header",
      key: "h-pending",
      label: "Pedidos pendentes",
      meta: pendingMembers.length
        ? `${pendingMembers.length}`
        : undefined,
    });
    if (pendingMembers.length === 0) {
      sections.push({
        kind: "empty",
        key: "empty-pending",
        label: "Sem pedidos por aprovar",
      });
    } else {
      pendingMembers.forEach((m) => {
        sections.push({ kind: "pending", key: `p-${m.id}`, member: m });
      });
    }
  }
  sections.push({
    kind: "header",
    key: "h-active",
    label: "Tripulantes ativos",
    meta: `${activeMembers.length}`,
  });
  activeMembers.forEach((m) => {
    sections.push({ kind: "active", key: `a-${m.id}`, member: m });
  });

  const confirmAction = (
    title: string,
    message: string,
    onConfirm: () => void,
  ) => {
    if (Platform.OS === "web") {
      if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    } else {
      Alert.alert(title, message, [
        { text: "Cancelar", style: "cancel" },
        { text: "Confirmar", style: "destructive", onPress: onConfirm },
      ]);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList<Section>
        data={sections}
        keyExtractor={(s) => s.key}
        contentContainerStyle={{
          paddingTop: topPad + 8,
          paddingBottom: bottomTab + 24,
          paddingHorizontal: 20,
          gap: 8,
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: 16, gap: 16 }}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.kicker, { color: colors.mutedForeground }]}
                >
                  A tua conta
                </Text>
                <Text style={[styles.name, { color: colors.foreground }]}>
                  {user?.name ?? "Tripulante"}
                </Text>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                  Nº {user?.crewId}
                  {isAdmin ? " · Administrador" : ""}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  confirmAction(
                    "Terminar sessão",
                    "Tens a certeza que queres sair?",
                    () => {
                      signOut().then(() => router.replace("/login"));
                    },
                  )
                }
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
                <Feather
                  name="log-out"
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>
            {!isAdmin ? (
              <View
                style={[
                  styles.infoCard,
                  {
                    backgroundColor: colors.muted,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <Feather
                  name="info"
                  size={16}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[styles.infoText, { color: colors.mutedForeground }]}
                >
                  Só tripulantes administradores podem aprovar pedidos de acesso
                  ou gerir a equipa.
                </Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          if (item.kind === "header") {
            return (
              <View style={styles.sectionHeader}>
                <Text
                  style={[
                    styles.sectionLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {item.label}
                </Text>
                {item.meta ? (
                  <View
                    style={[
                      styles.countBadge,
                      { backgroundColor: colors.muted },
                    ]}
                  >
                    <Text
                      style={[
                        styles.countText,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {item.meta}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          }
          if (item.kind === "empty") {
            return (
              <Text
                style={[styles.emptyLine, { color: colors.mutedForeground }]}
              >
                {item.label}
              </Text>
            );
          }
          if (item.kind === "pending") {
            const m = item.member;
            return (
              <View
                style={[
                  styles.memberCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <View style={styles.memberRow}>
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
                        styles.memberName,
                        { color: colors.foreground },
                      ]}
                    >
                      {m.name}
                    </Text>
                    <Text
                      style={[
                        styles.memberMeta,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Nº {m.crewId} · pedido em{" "}
                      {new Date(m.createdAt).toLocaleDateString("pt-PT")}
                    </Text>
                  </View>
                </View>
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => approveMember(m.id)}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      {
                        backgroundColor: colors.primary,
                        borderRadius: colors.radius,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <Feather
                      name="check"
                      size={16}
                      color={colors.primaryForeground}
                    />
                    <Text
                      style={[
                        styles.actionLabel,
                        { color: colors.primaryForeground },
                      ]}
                    >
                      Aprovar
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      confirmAction(
                        "Rejeitar pedido",
                        `Rejeitar o pedido de ${m.name}? Esta ação não pode ser desfeita.`,
                        () => rejectMember(m.id),
                      )
                    }
                    style={({ pressed }) => [
                      styles.actionBtnGhost,
                      {
                        borderColor: colors.border,
                        borderRadius: colors.radius,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Feather
                      name="x"
                      size={16}
                      color={colors.foreground}
                    />
                    <Text
                      style={[
                        styles.actionLabel,
                        { color: colors.foreground },
                      ]}
                    >
                      Rejeitar
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          }
          const m = item.member;
          const isSelf = m.id === user?.id;
          return (
            <View
              style={[
                styles.memberCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <View style={styles.memberRow}>
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: m.isAdmin
                        ? colors.primary
                        : colors.muted,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: m.isAdmin
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                      fontFamily: "Inter_700Bold",
                      fontSize: 16,
                    }}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameLine}>
                    <Text
                      style={[
                        styles.memberName,
                        { color: colors.foreground },
                      ]}
                    >
                      {m.name}
                      {isSelf ? "  (tu)" : ""}
                    </Text>
                    {m.isAdmin ? (
                      <View
                        style={[
                          styles.adminBadge,
                          { backgroundColor: colors.primary },
                        ]}
                      >
                        <Feather
                          name="shield"
                          size={11}
                          color={colors.primaryForeground}
                        />
                        <Text
                          style={[
                            styles.adminBadgeText,
                            { color: colors.primaryForeground },
                          ]}
                        >
                          Admin
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.memberMeta,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Nº {m.crewId}
                  </Text>
                </View>
              </View>
              {isAdmin && !isSelf ? (
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() =>
                      confirmAction(
                        m.isAdmin
                          ? "Remover administrador"
                          : "Tornar administrador",
                        m.isAdmin
                          ? `${m.name} deixa de poder aprovar pedidos.`
                          : `${m.name} passa a poder aprovar pedidos e gerir a equipa.`,
                        () => toggleAdmin(m.id),
                      )
                    }
                    style={({ pressed }) => [
                      styles.actionBtnGhost,
                      {
                        borderColor: colors.border,
                        borderRadius: colors.radius,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Feather
                      name={m.isAdmin ? "shield-off" : "shield"}
                      size={14}
                      color={colors.foreground}
                    />
                    <Text
                      style={[
                        styles.actionLabelSm,
                        { color: colors.foreground },
                      ]}
                    >
                      {m.isAdmin ? "Remover admin" : "Tornar admin"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      confirmAction(
                        "Remover tripulante",
                        `Remover ${m.name} da equipa? Esta ação não pode ser desfeita.`,
                        () => removeMember(m.id),
                      )
                    }
                    style={({ pressed }) => [
                      styles.actionBtnDanger,
                      {
                        borderColor: colors.destructive,
                        borderRadius: colors.radius,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Feather
                      name="trash-2"
                      size={14}
                      color={colors.destructive}
                    />
                    <Text
                      style={[
                        styles.actionLabelSm,
                        { color: colors.destructive },
                      ]}
                    >
                      Remover
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="users"
            title="Sem tripulantes"
            description="Ainda não há tripulantes ativos."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  kicker: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  name: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginTop: 2,
  },
  meta: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  infoCard: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    lineHeight: 17,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  emptyLine: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    paddingVertical: 8,
  },
  memberCard: {
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  memberRow: {
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
  nameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  memberName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  memberMeta: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  adminBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  actionBtnGhost: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  actionBtnDanger: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  actionLabelSm: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
