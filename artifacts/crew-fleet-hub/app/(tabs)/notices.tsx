import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useConfirm } from "@/components/ConfirmModal";
import { useAuth } from "@/contexts/AuthContext";
import { Notice, useNotices } from "@/contexts/NoticesContext";
import { useColors } from "@/hooks/useColors";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora mesmo";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function NoticeCard({
  notice,
  isAdmin,
  currentUserId,
  onRead,
  onDelete,
}: {
  notice: Notice;
  isAdmin: boolean;
  currentUserId: string;
  onRead: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const { confirm, modal } = useConfirm();
  const isRead = notice.readByIds.includes(currentUserId);
  const isPersonal = notice.targetMemberId !== null;
  const [expanded, setExpanded] = useState(false);
  const bodyLines = notice.body.split("\n");
  const isLong = notice.body.length > 180 || bodyLines.length > 4;
  const displayBody = isLong && !expanded
    ? notice.body.slice(0, 180).trimEnd() + "…"
    : notice.body;

  const handlePress = () => {
    if (!isRead) onRead();
    if (isLong) setExpanded((e) => !e);
  };

  const handleDelete = () =>
    confirm({
      title: "Eliminar aviso",
      message: `Eliminar "${notice.title}"?`,
      confirmLabel: "Eliminar",
      destructive: true,
      onConfirm: onDelete,
    });

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isRead ? colors.border : colors.primary,
          borderRadius: colors.radius,
          borderWidth: isRead ? 1 : 1.5,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {modal}
      {!isRead && (
        <View
          style={[styles.unreadDot, { backgroundColor: colors.primary }]}
        />
      )}
      <View style={styles.cardInner}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
            {isPersonal && (
              <View style={[styles.badge, { backgroundColor: colors.accent + "22", borderColor: colors.accent }]}>
                <Text style={[styles.badgeText, { color: colors.accent }]}>Pessoal</Text>
              </View>
            )}
            <Text
              style={[styles.cardTitle, { color: colors.foreground, flex: 1 }]}
              numberOfLines={2}
            >
              {notice.title}
            </Text>
          </View>
          {isAdmin && (
            <Pressable
              onPress={handleDelete}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
            >
              <Feather name="trash-2" size={15} color={colors.destructive} />
            </Pressable>
          )}
        </View>
        <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
          {displayBody}
        </Text>
        {isLong && (
          <Text style={[styles.expandToggle, { color: colors.primary }]}>
            {expanded ? "Ver menos" : "Ver mais"}
          </Text>
        )}
        <View style={styles.cardFooter}>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
            {notice.authorName}
          </Text>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
            {timeAgo(notice.createdAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function MemberPicker({
  members,
  selectedId,
  onSelect,
  colors,
}: {
  members: { id: string; name: string; crewId: string }[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="always">
      <Pressable
        onPress={() => onSelect(null)}
        style={[
          styles.memberRow,
          {
            backgroundColor: selectedId === null ? colors.primary + "15" : "transparent",
            borderRadius: colors.radius / 2,
          },
        ]}
      >
        <Feather
          name={selectedId === null ? "check-circle" : "circle"}
          size={16}
          color={selectedId === null ? colors.primary : colors.border}
        />
        <Text style={[styles.memberRowText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          Toda a equipa
        </Text>
      </Pressable>
      {members.map((m) => (
        <Pressable
          key={m.id}
          onPress={() => onSelect(m.id)}
          style={[
            styles.memberRow,
            {
              backgroundColor: selectedId === m.id ? colors.primary + "15" : "transparent",
              borderRadius: colors.radius / 2,
            },
          ]}
        >
          <Feather
            name={selectedId === m.id ? "check-circle" : "circle"}
            size={16}
            color={selectedId === m.id ? colors.primary : colors.border}
          />
          <Text style={[styles.memberRowText, { color: colors.foreground }]}>
            {m.name}
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
              {"  "}Nº {m.crewId}
            </Text>
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ComposeModal({
  visible,
  onClose,
  onSend,
}: {
  visible: boolean;
  onClose: () => void;
  onSend: (title: string, body: string, targetMemberId: string | null) => Promise<void>;
}) {
  const colors = useColors();
  const { members } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetMemberId, setTargetMemberId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeMembers = useMemo(
    () =>
      (members ?? [])
        .filter((m) => m.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [members],
  );

  const targetLabel = useMemo(() => {
    if (!targetMemberId) return "Toda a equipa";
    const m = activeMembers.find((m) => m.id === targetMemberId);
    return m ? `${m.name} (Nº ${m.crewId})` : "Toda a equipa";
  }, [targetMemberId, activeMembers]);

  const reset = () => {
    setTitle("");
    setBody("");
    setTargetMemberId(null);
    setShowPicker(false);
    setError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSend = async () => {
    if (!title.trim()) { setError("Escreve um título"); return; }
    if (!body.trim()) { setError("Escreve uma mensagem"); return; }
    setSending(true);
    setError(null);
    await onSend(title.trim(), body.trim(), targetMemberId);
    setSending(false);
    reset();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Pressable onPress={handleClose} style={styles.modalHeaderBtn}>
            <Text style={[styles.modalHeaderBtnText, { color: colors.mutedForeground }]}>
              Cancelar
            </Text>
          </Pressable>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Novo aviso</Text>
          <Pressable
            onPress={handleSend}
            disabled={sending}
            style={styles.modalHeaderBtn}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.modalHeaderBtnText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                Enviar
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.modalBody}
          keyboardShouldPersistTaps="always"
        >
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DESTINATÁRIO</Text>
          <Pressable
            onPress={() => setShowPicker((s) => !s)}
            style={[
              styles.pickerBtn,
              { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
            ]}
          >
            <Text style={[styles.pickerBtnText, { color: colors.foreground }]}>{targetLabel}</Text>
            <Feather
              name={showPicker ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.mutedForeground}
            />
          </Pressable>
          {showPicker && (
            <View
              style={[
                styles.pickerDropdown,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
              ]}
            >
              <MemberPicker
                members={activeMembers}
                selectedId={targetMemberId}
                onSelect={(id) => { setTargetMemberId(id); setShowPicker(false); }}
                colors={colors}
              />
            </View>
          )}

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 16 }]}>TÍTULO</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Título do aviso"
            placeholderTextColor={colors.mutedForeground}
            maxLength={120}
            style={[
              styles.textInput,
              { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, color: colors.foreground },
            ]}
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 16 }]}>MENSAGEM</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Escreve a tua mensagem…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            style={[
              styles.textInput,
              styles.textArea,
              { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, color: colors.foreground },
            ]}
          />

          {error ? (
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function NoticesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;

  const { user } = useAuth();
  const { notices, fetchNotices, sendNotice, markRead, markAllRead, deleteNotice } = useNotices();
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    fetchNotices().then(() => markAllRead());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async (title: string, body: string, targetMemberId: string | null) => {
    await sendNotice(title, body, targetMemberId);
  };

  const isEmpty = notices.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: topPad + 20,
            paddingBottom: insets.bottom + (isWeb ? 20 : 100),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeaderRow}>
          <View>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>Avisos</Text>
            <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
              {isEmpty
                ? "Nenhum aviso ainda"
                : `${notices.length} aviso${notices.length !== 1 ? "s" : ""}`}
            </Text>
          </View>
          {user?.isAdmin && (
            <Pressable
              onPress={() => setComposeOpen(true)}
              style={({ pressed }) => [
                styles.composeBtn,
                {
                  backgroundColor: colors.primary,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather name="edit-2" size={14} color={colors.primaryForeground} />
              <Text style={[styles.composeBtnText, { color: colors.primaryForeground }]}>
                Novo aviso
              </Text>
            </Pressable>
          )}
        </View>

        {isEmpty ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
            ]}
          >
            <Feather name="bell" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Sem avisos de momento
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {notices.map((n) => (
              <NoticeCard
                key={n.id}
                notice={n}
                isAdmin={!!user?.isAdmin}
                currentUserId={user?.id ?? ""}
                onRead={() => markRead(n.id)}
                onDelete={() => deleteNotice(n.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {user?.isAdmin && (
        <ComposeModal
          visible={composeOpen}
          onClose={() => setComposeOpen(false)}
          onSend={handleSend}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16 },
  pageHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 12,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  pageSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  composeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  composeBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  emptyCard: {
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 32,
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
  },
  card: {
    borderWidth: 1,
    overflow: "hidden",
  },
  cardInner: {
    padding: 14,
    paddingLeft: 20,
  },
  unreadDot: {
    position: "absolute",
    left: 7,
    top: 18,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    lineHeight: 20,
  },
  cardBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 4,
  },
  expandToggle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    marginBottom: 6,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  cardMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 11.5,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  modalHeaderBtn: { minWidth: 64, alignItems: "center" },
  modalHeaderBtnText: { fontFamily: "Inter_500Medium", fontSize: 15 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  modalBody: { padding: 20, gap: 4 },
  fieldLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerBtnText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  pickerDropdown: {
    borderWidth: 1,
    marginTop: 4,
    padding: 8,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  memberRowText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13.5,
    flex: 1,
  },
  textInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 8,
  },
});
