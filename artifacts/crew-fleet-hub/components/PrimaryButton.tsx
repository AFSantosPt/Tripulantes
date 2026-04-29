import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { useColors } from "@/hooks/useColors";

type Variant = "primary" | "secondary" | "destructive" | "ghost";

interface Props {
  label: string;
  onPress: () => void | Promise<void>;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  style?: ViewStyle;
  testID?: string;
}

export function PrimaryButton({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
  style,
  testID,
}: Props) {
  const colors = useColors();

  const palette = (() => {
    switch (variant) {
      case "secondary":
        return {
          bg: colors.secondary,
          fg: colors.secondaryForeground,
          border: colors.border,
        };
      case "destructive":
        return {
          bg: colors.destructive,
          fg: colors.destructiveForeground,
          border: colors.destructive,
        };
      case "ghost":
        return {
          bg: "transparent",
          fg: colors.primary,
          border: "transparent",
        };
      default:
        return {
          bg: colors.primary,
          fg: colors.primaryForeground,
          border: colors.primary,
        };
    }
  })();

  const handlePress = async () => {
    if (disabled || loading) return;
    if (Platform.OS !== "web") {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    await onPress();
  };

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: colors.radius,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={palette.fg} />
        ) : (
          <>
            {icon ? (
              <Feather
                name={icon}
                size={18}
                color={palette.fg}
                style={{ marginRight: 8 }}
              />
            ) : null}
            <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 18,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
});
