import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  hideCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  hideCancel = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const colors = useColors();
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius + 4 }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text>
          ) : null}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.buttons}>
            {!hideCancel && (
              <>
                <Pressable
                  style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={onCancel}
                >
                  <Text style={[styles.btnLabel, { color: colors.mutedForeground }]}>
                    {cancelLabel}
                  </Text>
                </Pressable>
                <View style={[styles.btnDivider, { backgroundColor: colors.border }]} />
              </>
            )}
            <Pressable
              style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.7 : 1 }]}
              onPress={onConfirm}
            >
              <Text
                style={[
                  styles.btnLabel,
                  styles.confirmLabel,
                  { color: destructive ? colors.destructive : colors.primary },
                ]}
              >
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export interface ConfirmState {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  hideCancel?: boolean;
  onConfirm: () => void;
}

const HIDDEN: ConfirmState = {
  visible: false,
  title: "",
  onConfirm: () => {},
};

export function useConfirm() {
  const [state, setState] = React.useState<ConfirmState>(HIDDEN);

  const confirm = React.useCallback(
    (opts: Omit<ConfirmState, "visible">) => {
      setState({ ...opts, visible: true });
    },
    [],
  );

  const alert = React.useCallback(
    (title: string, message?: string, onClose?: () => void) => {
      setState({
        visible: true,
        title,
        message,
        confirmLabel: "OK",
        hideCancel: true,
        onConfirm: onClose ?? (() => {}),
      });
    },
    [],
  );

  const hide = React.useCallback(() => setState(HIDDEN), []);

  const modal = (
    <ConfirmModal
      visible={state.visible}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      destructive={state.destructive}
      hideCancel={state.hideCancel}
      onConfirm={() => { hide(); state.onConfirm(); }}
      onCancel={hide}
    />
  );

  return { confirm, alert, modal };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    borderWidth: 1,
    overflow: "hidden",
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 6,
  },
  message: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    lineHeight: 19,
  },
  divider: { height: 1 },
  buttons: { flexDirection: "row" },
  btn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnDivider: { width: 1 },
  btnLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  confirmLabel: {
    fontFamily: "Inter_700Bold",
  },
});
