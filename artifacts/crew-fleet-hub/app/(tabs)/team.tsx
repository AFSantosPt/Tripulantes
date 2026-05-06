import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useConfirm } from "@/components/ConfirmModal";
import {
  ALL_CREW_CATEGORIES,
  CREW_CATEGORY_LABELS,
  CrewCategory,
  CrewMember,
  EditMemberFields,
  useAuth,
} from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { formatDisplayName } from "@/utils/nameFormat";
import { formatRelative } from "@/utils/time";

/* ─── Types ─────────────────────────────────────────────── */

type Section =
  | { kind: "header"; key: string; label: string; count?: number; accent?: boolean }
  | { kind: "pending"; key: string; member: CrewMember }
  | { kind: "active"; key: string; member: CrewMember }
  | { kind: "inactive"; key: string; member: CrewMember }
  | { kind: "empty"; key: string; label: string };

/* ─── Member Edit Modal ──────────────────────────────────── */

function MemberEditModal({
  member,
  visible,
  onClose,
  onSave,
}: {
  member: CrewMember | null;
  visible: boolean;
  onClose: () => void;
  onSave: (fields: EditMemberFields) => Promise<void>;
}) {
  const colors = useColors();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [crewId, setCrewId] = useState("");
  const [folgaGroup, setFolgaGroup] = useState("");
  const [categories, setCategories] = useState<CrewCategory[]>([]);
  const [categoryOtherLabel, setCategoryOtherLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setName(member.name);
      setNickname(member.nickname ?? "");
      setCrewId(member.crewId);
      setFolgaGroup(member.folgaGroup ?? "");
      setCategories(member.categories ?? []);
      setCategoryOtherLabel(member.categoryOtherLabel ?? "");
      setError(null);
    }
  }, [member]);

  const toggleCategory = (cat: CrewCategory) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("O nome não pode ser vazio"); return; }
    setSaving(true);
    setError(null);
    await onSave({ name, nickname, crewId, folgaGroup, categories, categoryOtherLabel });
    setSaving(false);
  };

  const inputStyle = {
    backgroundColor: colors.muted,
    borderColor: colors.border,
    color: colors.foreground,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular" as const,
  };
  const labelStyle = {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold" as const,
    color: colors.mutedForeground,
    marginBottom: 6,
    letterSpacing: 0.4,
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1, borderColor: colors.border }}>
          <Pressable onPress={onClose} style={{ marginRight: 12, padding: 4 }}>
            <Feather name="x" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground }}>
            Editar {member ? formatDisplayName(member.name) : ""}
          </Text>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, opacity: saving ? 0.6 : 1 }}
          >
            <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              {saving ? "A guardar…" : "Guardar"}
            </Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          {error ? (
            <View style={{ backgroundColor: colors.destructive + "1A", borderRadius: 10, padding: 12 }}>
              <Text style={{ color: colors.destructive, fontFamily: "Inter_500Medium", fontSize: 13 }}>{error}</Text>
            </View>
          ) : null}
          <View style={{ gap: 4 }}>
            <Text style={labelStyle}>NOME COMPLETO *</Text>
            <TextInput style={inputStyle} value={name} onChangeText={setName} placeholder="Nome" placeholderTextColor={colors.mutedForeground} autoCapitalize="words" />
          </View>
          <View style={{ gap: 4 }}>
            <Text style={labelStyle}>ALCUNHA</Text>
            <TextInput style={inputStyle} value={nickname} onChangeText={setNickname} placeholder="Alcunha (opcional)" placeholderTextColor={colors.mutedForeground} autoCapitalize="words" />
          </View>
          <View style={{ gap: 4 }}>
            <Text style={labelStyle}>Nº TRIPULANTE</Text>
            <TextInput style={inputStyle} value={crewId} onChangeText={setCrewId} placeholder="Nº colaborador" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
          </View>
          <View style={{ gap: 4 }}>
            <Text style={labelStyle}>GRUPO DE FOLGA</Text>
            <TextInput style={inputStyle} value={folgaGroup} onChangeText={setFolgaGroup} placeholder="Ex: A, B, C…" placeholderTextColor={colors.mutedForeground} autoCapitalize="characters" />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={labelStyle}>CATEGORIAS</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ALL_CREW_CATEGORIES.map((cat) => {
                const selected = categories.includes(cat);
                return (
                  <Pressable
                    key={cat}
                    onPress={() => toggleCategory(cat)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + "1A" : colors.muted }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: selected ? colors.primary : colors.mutedForeground }}>
                      {CREW_CATEGORY_LABELS[cat]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {categories.includes("outro") ? (
              <TextInput style={[inputStyle, { marginTop: 4 }]} value={categoryOtherLabel} onChangeText={setCategoryOtherLabel} placeholder="Descrição da categoria 'Outro'" placeholderTextColor={colors.mutedForeground} autoCapitalize="sentences" />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ─── Member Action Menu ─────────────────────────────────── */

function MemberActionMenu({
  member,
  visible,
  onClose,
  onEdit,
  onToggleAdmin,
  onResetPassword,
  onDeactivate,
  onRemove,
}: {
  member: CrewMember | null;
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onToggleAdmin: () => void;
  onResetPassword: () => void;
  onDeactivate: () => void;
  onRemove: () => void;
}) {
  const colors = useColors();
  if (!member) return null;

  const actions = [
    { icon: "edit-2" as const, label: "Editar dados", onPress: onEdit },
    {
      icon: (member.isAdmin ? "shield-off" : "shield") as "shield-off" | "shield",
      label: member.isAdmin ? "Remover administrador" : "Tornar administrador",
      onPress: onToggleAdmin,
    },
    { icon: "key" as const, label: "Redefinir password", onPress: onResetPassword },
    { icon: "user-x" as const, label: "Desativar conta", onPress: onDeactivate, danger: true },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.menuOverlay} onPress={onClose} />
      <View style={[styles.menuSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.menuHandle, { backgroundColor: colors.border }]} />
        <View style={[styles.menuMemberRow, { borderBottomColor: colors.border }]}>
          <View style={[styles.menuAvatar, { backgroundColor: member.isAdmin ? colors.primary : colors.muted }]}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 17, color: member.isAdmin ? colors.primaryForeground : colors.mutedForeground }}>
              {member.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuName, { color: colors.foreground }]}>
              {formatDisplayName(member.name)}{member.nickname ? ` (${member.nickname})` : ""}
            </Text>
            <Text style={[styles.menuMeta, { color: colors.mutedForeground }]}>Nº {member.crewId}</Text>
          </View>
          <Pressable onPress={onClose} style={{ padding: 6 }}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 4 }}>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => { onClose(); setTimeout(a.onPress, 100); }}
              style={({ pressed }) => [
                styles.menuAction,
                { borderRadius: colors.radius, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name={a.icon} size={17} color={a.danger ? colors.destructive : colors.foreground} />
              <Text style={[styles.menuActionText, { color: a.danger ? colors.destructive : colors.foreground }]}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

/* ─── Category chips ─────────────────────────────────────── */

function CategoryChips({ categories, categoryOtherLabel, colors }: {
  categories: CrewCategory[];
  categoryOtherLabel?: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
      {categories.map((cat) => (
        <View key={cat} style={{ backgroundColor: colors.muted, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>
            {cat === "outro" && categoryOtherLabel ? categoryOtherLabel : CREW_CATEGORY_LABELS[cat]}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ─── Main Screen ────────────────────────────────────────── */

export default function TeamScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    user,
    pendingMembers,
    activeMembers,
    inactiveMembers,
    approveMember,
    rejectMember,
    toggleAdmin,
    removeMember,
    editMember,
    deactivateMember,
    reactivateMember,
    resetMemberPassword,
    signOut,
    refreshMembers,
  } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [editingMember, setEditingMember] = useState<CrewMember | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [menuMember, setMenuMember] = useState<CrewMember | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const { confirm, alert, modal } = useConfirm();

  const isAdmin = !!user?.isAdmin;
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomTab = isWeb ? 84 : 70 + insets.bottom;

  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(() => refreshMembers(), 30000);
    return () => clearInterval(interval);
  }, [isAdmin, refreshMembers]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshMembers();
    setRefreshing(false);
  };

  /* ── Search filter ── */
  const filteredActive = useMemo(() => {
    if (!search.trim()) return activeMembers;
    const q = search.toLowerCase();
    return activeMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.crewId.includes(q) ||
        (m.nickname ?? "").toLowerCase().includes(q),
    );
  }, [activeMembers, search]);

  /* ── Build sections ── */
  const sections: Section[] = useMemo(() => {
    const s: Section[] = [];
    if (isAdmin && !search.trim()) {
      s.push({ kind: "header", key: "h-pending", label: "Pedidos pendentes", count: pendingMembers.length, accent: true });
      if (pendingMembers.length === 0) {
        s.push({ kind: "empty", key: "empty-pending", label: "Sem pedidos pendentes" });
      } else {
        pendingMembers.forEach((m) => s.push({ kind: "pending", key: `p-${m.id}`, member: m }));
      }
    }
    s.push({ kind: "header", key: "h-active", label: "Equipa ativa", count: filteredActive.length });
    if (filteredActive.length === 0) {
      s.push({ kind: "empty", key: "empty-active", label: search.trim() ? "Sem resultados para a pesquisa" : "Sem tripulantes ativos" });
    } else {
      filteredActive.forEach((m) => s.push({ kind: "active", key: `a-${m.id}`, member: m }));
    }
    if (isAdmin && inactiveMembers.length > 0 && !search.trim()) {
      s.push({ kind: "header", key: "h-inactive", label: "Inativos", count: inactiveMembers.length });
      inactiveMembers.forEach((m) => s.push({ kind: "inactive", key: `i-${m.id}`, member: m }));
    }
    return s;
  }, [isAdmin, search, pendingMembers, filteredActive, inactiveMembers]);

  /* ── Action helpers ── */
  const openMenu = (m: CrewMember) => { setMenuMember(m); setMenuVisible(true); };

  const handleEditSave = async (fields: EditMemberFields) => {
    if (!editingMember) return;
    const result = await editMember(editingMember.id, fields);
    if (result.ok) { setEditModalVisible(false); setEditingMember(null); }
    else alert("Erro", result.error);
  };

  const handleToggleAdmin = (m: CrewMember) => {
    confirm({
      title: m.isAdmin ? "Remover administrador" : "Tornar administrador",
      message: m.isAdmin
        ? `${formatDisplayName(m.name)} deixa de poder aprovar pedidos.`
        : `${formatDisplayName(m.name)} passa a poder aprovar pedidos e gerir a equipa.`,
      confirmLabel: "Confirmar",
      destructive: false,
      onConfirm: () => toggleAdmin(m.id),
    });
  };

  const handleDeactivate = (m: CrewMember) => {
    confirm({
      title: "Desativar conta",
      message: `${formatDisplayName(m.name)} deixa de poder aceder à app. Podes reativar a qualquer momento.`,
      confirmLabel: "Desativar",
      destructive: true,
      onConfirm: async () => {
        const result = await deactivateMember(m.id);
        if (!result.ok) alert("Erro", result.error);
      },
    });
  };

  const handleReactivate = (m: CrewMember) => {
    confirm({
      title: "Reativar conta",
      message: `${formatDisplayName(m.name)} volta a ter acesso à app.`,
      confirmLabel: "Reativar",
      destructive: false,
      onConfirm: async () => {
        const result = await reactivateMember(m.id);
        if (!result.ok) alert("Erro", result.error);
      },
    });
  };

  const handleResetPassword = (m: CrewMember) => {
    confirm({
      title: "Redefinir password",
      message: `Gerar uma password temporária para ${formatDisplayName(m.name)}? O tripulante terá de alterar na próxima sessão.`,
      confirmLabel: "Redefinir",
      destructive: true,
      onConfirm: async () => {
        const result = await resetMemberPassword(m.id);
        if (result.ok) alert("Password temporária", `A nova password de ${formatDisplayName(m.name)} é:\n\n${result.tempPassword}\n\nComunica este código ao tripulante.`);
        else alert("Erro", result.error);
      },
    });
  };

  const handleRemove = (m: CrewMember) => {
    confirm({
      title: "Remover tripulante",
      message: `Remover ${formatDisplayName(m.name)} da equipa? Esta ação não pode ser desfeita.`,
      confirmLabel: "Remover",
      destructive: true,
      onConfirm: () => removeMember(m.id),
    });
  };

  /* ── Profile card header ── */
  const profileCategories =
    user?.categories && user.categories.length > 0
      ? user.categories
          .map((c) =>
            c === "outro" && user.categoryOtherLabel ? user.categoryOtherLabel : CREW_CATEGORY_LABELS[c],
          )
          .join(" · ")
      : null;

  const quickSettings = [
    { icon: "lock" as const, label: "Password", route: "/change-password" as const },
    { icon: "tag" as const, label: "Categorias", route: "/crew-categories" as const },
    { icon: "smile" as const, label: "Alcunha", route: "/nickname" as const },
    { icon: "sun" as const, label: "Folga", route: "/folga-group" as const },
    { icon: "phone" as const, label: "Telefone", route: "/phone" as const },
  ];

  const ListHeader = (
    <View style={{ gap: 12, marginBottom: 4 }}>
      {/* Profile card */}
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        {/* Top row: avatar + info + logout */}
        <View style={styles.profileTop}>
          <View style={[styles.profileAvatar, { backgroundColor: colors.primary }]}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 24, color: colors.primaryForeground }}>
              {(user?.name ?? "T").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Text style={[styles.profileName, { color: colors.foreground }]}>
                {formatDisplayName(user?.name ?? "Tripulante")}
              </Text>
              {isAdmin && (
                <View style={[styles.adminPill, { backgroundColor: colors.primary }]}>
                  <Feather name="shield" size={10} color={colors.primaryForeground} />
                  <Text style={[styles.adminPillText, { color: colors.primaryForeground }]}>Admin</Text>
                </View>
              )}
            </View>
            <Text style={[styles.profileMeta, { color: colors.mutedForeground }]}>
              Nº {user?.crewId}
              {user?.folgaGroup ? `  ·  Folga ${user.folgaGroup}` : ""}
            </Text>
            {user?.categories && user.categories.length > 0 ? (
              <CategoryChips categories={user.categories} categoryOtherLabel={user.categoryOtherLabel} colors={colors} />
            ) : null}
          </View>
          <Pressable
            onPress={() =>
              confirm({
                title: "Terminar sessão",
                message: "Tens a certeza que queres sair?",
                confirmLabel: "Sair",
                destructive: false,
                onConfirm: () => signOut().then(() => router.replace("/login")),
              })
            }
            style={({ pressed }) => [styles.logoutBtn, { backgroundColor: colors.muted, borderRadius: 10, opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="log-out" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* Quick settings grid */}
        <View style={styles.quickGrid}>
          {quickSettings.map((s) => (
            <Pressable
              key={s.route}
              onPress={() => router.push(s.route)}
              style={({ pressed }) => [
                styles.quickBtn,
                { backgroundColor: colors.muted, borderRadius: 12, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Feather name={s.icon} size={17} color={colors.mutedForeground} />
              <Text style={[styles.quickLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Pesquisar por nome ou número…"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && Platform.OS !== "ios" && (
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x" size={15} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {modal}

      <MemberEditModal
        member={editingMember}
        visible={editModalVisible}
        onClose={() => { setEditModalVisible(false); setEditingMember(null); }}
        onSave={handleEditSave}
      />

      <MemberActionMenu
        member={menuMember}
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onEdit={() => { setEditingMember(menuMember); setEditModalVisible(true); }}
        onToggleAdmin={() => menuMember && handleToggleAdmin(menuMember)}
        onResetPassword={() => menuMember && handleResetPassword(menuMember)}
        onDeactivate={() => menuMember && handleDeactivate(menuMember)}
        onRemove={() => menuMember && handleRemove(menuMember)}
      />

      <FlatList<Section>
        data={sections}
        keyExtractor={(s) => s.key}
        refreshControl={
          isAdmin ? (
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          ) : undefined
        }
        contentContainerStyle={{
          paddingTop: topPad + 12,
          paddingBottom: bottomTab + 24,
          paddingHorizontal: 16,
          gap: 8,
        }}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => {
          /* ── Section header ── */
          if (item.kind === "header") {
            return (
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{item.label.toUpperCase()}</Text>
                {item.count !== undefined && (
                  <View style={[styles.countBadge, { backgroundColor: item.accent ? colors.accent + "33" : colors.muted }]}>
                    <Text style={[styles.countText, { color: item.accent ? colors.accent : colors.mutedForeground }]}>
                      {item.count}
                    </Text>
                  </View>
                )}
              </View>
            );
          }

          /* ── Empty placeholder ── */
          if (item.kind === "empty") {
            return (
              <Text style={[styles.emptyLine, { color: colors.mutedForeground }]}>{item.label}</Text>
            );
          }

          /* ── Pending card ── */
          if (item.kind === "pending") {
            const m = item.member;
            return (
              <View style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.accent + "55", borderRadius: colors.radius }]}>
                <View style={styles.memberRow}>
                  <View style={[styles.avatar, { backgroundColor: colors.accent + "33" }]}>
                    <Text style={{ color: colors.accent, fontFamily: "Inter_700Bold", fontSize: 16 }}>
                      {m.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.memberName, { color: colors.foreground }]}>
                      {formatDisplayName(m.name)}{m.nickname ? ` (${m.nickname})` : ""}
                    </Text>
                    <Text style={[styles.memberMeta, { color: colors.mutedForeground }]}>
                      Nº {m.crewId} · pedido em {new Date(m.createdAt).toLocaleDateString("pt-PT")}
                    </Text>
                    {m.categories?.length ? (
                      <CategoryChips categories={m.categories} categoryOtherLabel={m.categoryOtherLabel} colors={colors} />
                    ) : null}
                  </View>
                </View>
                <View style={styles.pendingActions}>
                  <Pressable
                    onPress={() => approveMember(m.id)}
                    style={({ pressed }) => [styles.approveBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Feather name="check" size={15} color={colors.primaryForeground} />
                    <Text style={[styles.pendingBtnText, { color: colors.primaryForeground }]}>Aprovar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      confirm({
                        title: "Rejeitar pedido",
                        message: `Rejeitar o pedido de ${m.name}? Esta ação não pode ser desfeita.`,
                        confirmLabel: "Rejeitar",
                        destructive: true,
                        onConfirm: () => rejectMember(m.id),
                      })
                    }
                    style={({ pressed }) => [styles.rejectBtn, { borderColor: colors.border, backgroundColor: colors.muted, borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Feather name="x" size={15} color={colors.mutedForeground} />
                    <Text style={[styles.pendingBtnText, { color: colors.mutedForeground }]}>Rejeitar</Text>
                  </Pressable>
                </View>
              </View>
            );
          }

          /* ── Inactive card ── */
          if (item.kind === "inactive") {
            const m = item.member;
            return (
              <View style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: 0.7 }]}>
                <View style={styles.memberRow}>
                  <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_700Bold", fontSize: 16 }}>
                      {m.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.memberName, { color: colors.mutedForeground }]}>
                      {formatDisplayName(m.name)}{m.nickname ? ` (${m.nickname})` : ""}
                    </Text>
                    <Text style={[styles.memberMeta, { color: colors.mutedForeground }]}>Nº {m.crewId} · Desativado</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Pressable
                      onPress={() => handleReactivate(m)}
                      style={({ pressed }) => [styles.inactiveBtn, { borderColor: colors.primary, borderRadius: 8, opacity: pressed ? 0.8 : 1 }]}
                    >
                      <Feather name="user-check" size={13} color={colors.primary} />
                      <Text style={[styles.inactiveBtnText, { color: colors.primary }]}>Reativar</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleRemove(m)}
                      style={({ pressed }) => [styles.inactiveBtn, { borderColor: colors.destructive, borderRadius: 8, opacity: pressed ? 0.8 : 1 }]}
                    >
                      <Feather name="trash-2" size={13} color={colors.destructive} />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }

          /* ── Active member card ── */
          const m = item.member;
          const isSelf = m.id === user?.id;
          return (
            <View style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <View style={styles.memberRow}>
                <View style={[styles.avatar, { backgroundColor: m.isAdmin ? colors.primary : colors.muted }]}>
                  <Text style={{ color: m.isAdmin ? colors.primaryForeground : colors.mutedForeground, fontFamily: "Inter_700Bold", fontSize: 16 }}>
                    {m.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.nameLine}>
                    <Text style={[styles.memberName, { color: colors.foreground }]} numberOfLines={1}>
                      {formatDisplayName(m.name)}{m.nickname ? ` (${m.nickname})` : ""}
                    </Text>
                    {m.isAdmin && (
                      <View style={[styles.adminBadge, { backgroundColor: colors.primary }]}>
                        <Feather name="shield" size={9} color={colors.primaryForeground} />
                        <Text style={[styles.adminBadgeText, { color: colors.primaryForeground }]}>Admin</Text>
                      </View>
                    )}
                    {isSelf && (
                      <Text style={[styles.selfLabel, { color: colors.mutedForeground }]}>tu</Text>
                    )}
                  </View>
                  <Text style={[styles.memberMeta, { color: colors.mutedForeground }]}>Nº {m.crewId}</Text>
                  {isAdmin && (
                    <Text style={[styles.lastSeen, { color: colors.mutedForeground }]}>
                      {m.lastSeenAt ? `Visto ${formatRelative(m.lastSeenAt)}` : "Nunca ligado"}
                    </Text>
                  )}
                  {m.categories?.length ? (
                    <CategoryChips categories={m.categories} categoryOtherLabel={m.categoryOtherLabel} colors={colors} />
                  ) : null}
                </View>
                {isAdmin && !isSelf && (
                  <Pressable
                    onPress={() => openMenu(m)}
                    style={({ pressed }) => [styles.moreBtn, { backgroundColor: colors.muted, borderRadius: 8, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Feather name="more-horizontal" size={18} color={colors.mutedForeground} />
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1 },

  /* Profile card */
  profileCard: { borderWidth: 1, padding: 16, gap: 14 },
  profileTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  profileAvatar: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  profileName: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  profileMeta: { fontSize: 12.5, fontFamily: "Inter_500Medium" },
  adminPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99,
  },
  adminPillText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  logoutBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  /* Quick settings */
  quickGrid: { flexDirection: "row", gap: 8 },
  quickBtn: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 10 },
  quickLabel: { fontSize: 9.5, fontFamily: "Inter_600SemiBold", textAlign: "center" },

  /* Search */
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },

  /* Section header */
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 6, marginBottom: 2,
  },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.7 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  countText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  emptyLine: { fontSize: 13, fontFamily: "Inter_400Regular", paddingVertical: 6 },

  /* Member card */
  memberCard: { borderWidth: 1, padding: 13, gap: 10 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  memberName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  memberMeta: { fontSize: 12, fontFamily: "Inter_500Medium" },
  lastSeen: { fontSize: 11, fontFamily: "Inter_400Regular" },
  selfLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  adminBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
  },
  adminBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  moreBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  /* Pending actions */
  pendingActions: { flexDirection: "row", gap: 8 },
  approveBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 9,
  },
  rejectBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 9, borderWidth: 1,
  },
  pendingBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  /* Inactive actions */
  inactiveBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1,
  },
  inactiveBtnText: { fontSize: 11.5, fontFamily: "Inter_600SemiBold" },

  /* Action menu */
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  menuSheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingBottom: 8,
  },
  menuHandle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: "center", marginTop: 10, marginBottom: 4,
  },
  menuMemberRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  menuAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  menuName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  menuMeta: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 1 },
  menuAction: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  menuActionText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
