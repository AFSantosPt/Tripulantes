import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  label: string;
  value: string;
  tone?: "default" | "accent" | "primary";
  style?: ViewStyle;
}

export function StatPill({ label, value, tone = "default", style }: Props) {
  const colors = useColors();
  const palette = (() => {
    switch (tone) {
      case "accent":
        return { bg: colors.accent, fg: colors.accentForeground };
      case "primary":
        return { bg: colors.primary, fg: colors.primaryForeground };
      default:
        return { bg: colors.card, fg: colors.foreground };
    }
  })();
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: palette.bg,
          borderRadius: colors.radius,
          borderColor: tone === "default" ? colors.border : palette.bg,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color:
              tone === "default" ? colors.mutedForeground : palette.fg,
            opacity: tone === "default" ? 1 : 0.85,
          },
        ]}
      >
        {label}
      </Text>
      <Text style={[styles.value, { color: palette.fg }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  value: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
});
