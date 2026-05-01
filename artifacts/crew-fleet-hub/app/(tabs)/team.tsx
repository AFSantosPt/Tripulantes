import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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

import { EmptyState } from "@/components/EmptyState";
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

type Section =
  | { kind: "header"; key: string; label: string; meta?: string }
  | { kind: "pending"; key: string; member: CrewMember }
  | { kind: "active"; key: string; member: CrewMember }
  | { kind: "inactive"; key: string; member: CrewMember }
  | { kind: "empty"; key: string; label: string };

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
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  };
  const labelStyle = { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginBottom: 4 };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderColor: colors.border }}>
          <Pressable onPress={onClose} style={{ marginRight: 12, padding: 4 }}>
            <Feather name="x" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
            Editar {member ? formatDisplayName(member.name) : ""}
          </Text>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, opacity: saving ? 0.6 : 1 }}
          >
            <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              {saving ? "A guardar…" : "Guardar"}
            </Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          {error ? (
            <View style={{ backgroundColor: colors.destructive + "1A", borderRadius: 8, padding: 12 }}>
              <Text style={{ color: colors.destructive, fontFamily: "Inter_500Medium", fontSize: 13 }}>{error}</Text>
            </View>
          ) : null}

          <View style={{ gap: 4 }}>
            <Text style={labelStyle}>Nome completo *</Text>
            <TextInput style={inputStyle} value={name} onChangeText={setName} placeholder="Nome" placeholderTextColor={colors.mutedForeground} autoCapitalize="words" />
          </View>

          <View style={{ gap: 4 }}>
            <Text style={labelStyle}>Alcunha</Text>
            <TextInput style={inputStyle} value={nickname} onChangeText={setNickname} placeholder="Alcunha (opcional)" placeholderTextColor={colors.mutedForeground} autoCapitalize="words" />
          </View>

          <View style={{ gap: 4 }}>
            <Text style={labelStyle}>Nº Tripulante</Text>
            <TextInput style={inputStyle} value={crewId} onChangeText={setCrewId} placeholder="Nº colaborador" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" keyboardType="numeric" />
          </View>

          <View style={{ gap: 4 }}>
            <Text style={labelStyle}>Grupo de folga</Text>
            <TextInput style={inputStyle} value={folgaGroup} onChangeText={setFolgaGroup} placeholder="Ex: A, B, C…" placeholderTextColor={colors.mutedForeground} autoCapitalize="characters" />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={labelStyle}>Categorias</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ALL_CREW_CATEGORIES.map((cat) => {
                const selected = categories.includes(cat);
                return (
                  <Pressable
                    key={cat}
                    onPress={() => toggleCategory(cat)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      borderWidth: 1.5,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary + "1A" : colors.muted,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: selected ? colors.primary : colors.mutedForeground }}>
                      {CREW_CATEGORY_LABELS[cat]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {categories.includes("outro") ? (
              <TextInput
                style={[inputStyle, { marginTop: 4 }]}
                value={categoryOtherLabel}
                onChangeText={setCategoryOtherLabel}
                placeholder="Descrição da categoria 'Outro'"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="sentences"
              />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

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
  const [editingMember, setEditingMember] = useState<CrewMember | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const { confirm, alert, modal } = useConfirm();

  useEffect(() => {
    if (!user?.isAdmin) return;
    const interval = setInterval(() => {
      refreshMembers();
    }, 30000);
    return () => clearInterval(interval);
  }, [user?.isAdmin, refreshMembers]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshMembers();
    setRefreshing(false);
  };

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
  if (isAdmin && inactiveMembers.length > 0) {
    sections.push({ kind: "header", key: "h-inactive", label: "Inativos", meta: `${inactiveMembers.length}` });
    inactiveMembers.forEach((m) => {
      sections.push({ kind: "inactive", key: `i-${m.id}`, member: m });
    });
  }

  const confirmAction = (
    title: string,
    message: string,
    onConfirm: () => void,
  ) => {
    confirm({ title, message, confirmLabel: "Confirmar", destructive: true, onConfirm });
  };

  const handleEditSave = async (fields: EditMemberFields) => {
    if (!editingMember) return;
    const result = await editMember(editingMember.id, fields);
    if (result.ok) {
      setEditModalVisible(false);
      setEditingMember(null);
    } else {
      alert({ title: "Erro", message: result.error });
    }
  };

  const handleDeactivate = (m: CrewMember) => {
    confirm({
      title: "Desativar conta",
      message: `${formatDisplayName(m.name)} deixa de poder aceder à app. Podes reativar a qualquer momento.`,
      confirmLabel: "Desativar",
      destructive: true,
      onConfirm: async () => {
        const result = await deactivateMember(m.id);
        if (!result.ok) alert({ title: "Erro", message: result.error });
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
        if (!result.ok) alert({ title: "Erro", message: result.error });
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
        if (result.ok) {
          alert({ title: "Password temporária", message: `A nova password de ${formatDisplayName(m.name)} é:\n\n${result.tempPassword}\n\nComunica este código ao tripulante.` });
        } else {
          alert({ title: "Erro", message: result.error });
        }
      },
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {modal}
      <MemberEditModal
        member={editingMember}
        visible={editModalVisible}
        onClose={() => { setEditModalVisible(false); setEditingMember(null); }}
        onSave={handleEditSave}
      />
      <FlatList<Section>
        data={sections}
        keyExtractor={(s) => s.key}
        refreshControl={
          user?.isAdmin ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
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
            <Pressable
              onPress={() => router.push("/edit-name")}
              style={({ pressed }) => [
                styles.passwordRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={[styles.passwordIcon, { backgroundColor: colors.muted }]}>
                <Feather name="user" size={16} color={colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.passwordTitle, { color: colors.foreground }]}>
                  Editar nome
                </Text>
                <Text style={[styles.passwordMeta, { color: colors.mutedForeground }]}>
                  {user?.name ?? ""}
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/change-password")}
              style={({ pressed }) => [
                styles.passwordRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              testID="open-change-password"
            >
              <View
                style={[
                  styles.passwordIcon,
                  { backgroundColor: colors.muted },
                ]}
              >
                <Feather
                  name="lock"
                  size={16}
                  color={colors.mutedForeground}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.passwordTitle, { color: colors.foreground }]}
                >
                  Alterar password
                </Text>
                <Text
                  style={[
                    styles.passwordMeta,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Atualiza a tua palavra-passe quando quiseres
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={20}
                color={colors.mutedForeground}
              />
            </Pressable>
            <Pressable
              onPress={() => router.push("/crew-categories")}
              style={({ pressed }) => [
                styles.passwordRow,
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
                  styles.passwordIcon,
                  { backgroundColor: colors.muted },
                ]}
              >
                <Feather
                  name="tag"
                  size={16}
                  color={colors.mutedForeground}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.passwordTitle, { color: colors.foreground }]}
                >
                  Minhas categorias
                </Text>
                <Text
                  style={[
                    styles.passwordMeta,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {user?.categories?.length
                    ? user.categories.map((c) =>
                        c === "outro" && user.categoryOtherLabel
                          ? user.categoryOtherLabel
                          : CREW_CATEGORY_LABELS[c]
                      ).join(" · ")
                    : "Nenhuma categoria definida"}
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={20}
                color={colors.mutedForeground}
              />
            </Pressable>
            <Pressable
              onPress={() => router.push("/nickname")}
              style={({ pressed }) => [
                styles.passwordRow,
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
                  styles.passwordIcon,
                  { backgroundColor: colors.muted },
                ]}
              >
                <Feather
                  name="smile"
                  size={16}
                  color={colors.mutedForeground}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.passwordTitle, { color: colors.foreground }]}
                >
                  Alcunha
                </Text>
                <Text
                  style={[
                    styles.passwordMeta,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {user?.nickname ? user.nickname : "Sem alcunha definida"}
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={20}
                color={colors.mutedForeground}
              />
            </Pressable>
            <Pressable
              onPress={() => router.push("/folga-group")}
              style={({ pressed }) => [
                styles.passwordRow,
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
                  styles.passwordIcon,
                  { backgroundColor: "#F59E0B20" },
                ]}
              >
                <Feather
                  name="calendar"
                  size={16}
                  color="#F59E0B"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.passwordTitle, { color: colors.foreground }]}
                >
                  Grupo de folga
                </Text>
                <Text
                  style={[
                    styles.passwordMeta,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {user?.folgaGroup ?? "Não definido"}
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={20}
                color={colors.mutedForeground}
              />
            </Pressable>
            <Pressable
              onPress={() => router.push("/phone")}
              style={({ pressed }) => [
                styles.passwordRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={[styles.passwordIcon, { backgroundColor: colors.muted }]}>
                <Feather name="phone" size={16} color={colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.passwordTitle, { color: colors.foreground }]}>
                  Contrato telefónico
                </Text>
                <Text style={[styles.passwordMeta, { color: colors.mutedForeground }]}>
                  {user?.phone
                    ? `••• ••• ${user.phone.replace(/\s/g, "").slice(-3)}`
                    : "Não definido"}
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </Pressable>
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
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      style={[
                        styles.memberName,
                        { color: colors.foreground },
                      ]}
                    >
                      {formatDisplayName(m.name)}{m.nickname ? ` (${m.nickname})` : ""}
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
                    {m.categories && m.categories.length > 0 ? (
                      <CategoryChips
                        categories={m.categories}
                        categoryOtherLabel={m.categoryOtherLabel}
                        colors={colors}
                      />
                    ) : null}
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
          if (item.kind === "inactive") {
            const m = item.member;
            return (
              <View
                style={[
                  styles.memberCard,
                  { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: 0.7 },
                ]}
              >
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
                    <Text style={[styles.memberMeta, { color: colors.mutedForeground }]}>Nº {m.crewId}</Text>
                    <Text style={[styles.memberMeta, { color: colors.mutedForeground }]}>Conta desativada</Text>
                  </View>
                </View>
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => handleReactivate(m)}
                    style={({ pressed }) => [
                      styles.actionBtnGhost,
                      { borderColor: colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Feather name="user-check" size={14} color={colors.primary} />
                    <Text style={[styles.actionLabelSm, { color: colors.primary }]}>Reativar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      confirmAction(
                        "Remover tripulante",
                        `Remover ${formatDisplayName(m.name)} da equipa? Esta ação não pode ser desfeita.`,
                        () => removeMember(m.id),
                      )
                    }
                    style={({ pressed }) => [
                      styles.actionBtnDanger,
                      { borderColor: colors.destructive, borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Feather name="trash-2" size={14} color={colors.destructive} />
                    <Text style={[styles.actionLabelSm, { color: colors.destructive }]}>Remover</Text>
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
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.nameLine}>
                    <Text
                      style={[
                        styles.memberName,
                        { color: colors.foreground },
                      ]}
                    >
                      {formatDisplayName(m.name)}{m.nickname ? ` (${m.nickname})` : ""}{isSelf ? "  (tu)" : ""}
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
                  {isAdmin ? (
                    <View style={styles.lastSeenRow}>
                      <Feather name="clock" size={11} color={colors.mutedForeground} />
                      <Text style={[styles.memberLastSeen, { color: colors.mutedForeground }]}>
                        {m.lastSeenAt ? `Visto ${formatRelative(m.lastSeenAt)}` : "Nunca ligado"}
                      </Text>
                    </View>
                  ) : null}
                  {m.categories && m.categories.length > 0 ? (
                    <CategoryChips
                      categories={m.categories}
                      categoryOtherLabel={m.categoryOtherLabel}
                      colors={colors}
                    />
                  ) : null}
                </View>
              </View>
              {isAdmin && !isSelf ? (
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => { setEditingMember(m); setEditModalVisible(true); }}
                    style={({ pressed }) => [
                      styles.actionBtnGhost,
                      { borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Feather name="edit-2" size={14} color={colors.foreground} />
                    <Text style={[styles.actionLabelSm, { color: colors.foreground }]}>Editar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      confirmAction(
                        m.isAdmin ? "Remover administrador" : "Tornar administrador",
                        m.isAdmin
                          ? `${m.name} deixa de poder aprovar pedidos.`
                          : `${m.name} passa a poder aprovar pedidos e gerir a equipa.`,
                        () => toggleAdmin(m.id),
                      )
                    }
                    style={({ pressed }) => [
                      styles.actionBtnGhost,
                      { borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Feather name={m.isAdmin ? "shield-off" : "shield"} size={14} color={colors.foreground} />
                    <Text style={[styles.actionLabelSm, { color: colors.foreground }]}>
                      {m.isAdmin ? "Rem. admin" : "Admin"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleResetPassword(m)}
                    style={({ pressed }) => [
                      styles.actionBtnGhost,
                      { borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Feather name="key" size={14} color={colors.foreground} />
                    <Text style={[styles.actionLabelSm, { color: colors.foreground }]}>Password</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeactivate(m)}
                    style={({ pressed }) => [
                      styles.actionBtnDanger,
                      { borderColor: colors.destructive, borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Feather name="user-x" size={14} color={colors.destructive} />
                    <Text style={[styles.actionLabelSm, { color: colors.destructive }]}>Desativar</Text>
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

function CategoryChips({
  categories,
  categoryOtherLabel,
  colors,
}: {
  categories: CrewCategory[];
  categoryOtherLabel?: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={chipStyles.row}>
      {categories.map((cat) => (
        <View
          key={cat}
          style={[
            chipStyles.chip,
            { backgroundColor: colors.muted, borderRadius: 999 },
          ]}
        >
          <Text style={[chipStyles.chipText, { color: colors.mutedForeground }]}>
            {cat === "outro" && categoryOtherLabel
              ? categoryOtherLabel
              : CREW_CATEGORY_LABELS[cat]}
          </Text>
        </View>
      ))}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});

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
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
  },
  passwordIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  passwordTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  passwordMeta: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
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
  lastSeenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  memberLastSeen: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
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
