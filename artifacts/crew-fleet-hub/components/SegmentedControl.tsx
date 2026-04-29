import * as Haptics from "expo-haptics";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: Props<T>) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.muted,
          borderRadius: colors.radius,
        },
      ]}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={async () => {
              if (active) return;
              if (Platform.OS !== "web") {
                try {
                  await Haptics.selectionAsync();
                } catch {}
              }
              onChange(opt.value);
            }}
            style={[
              styles.segment,
              {
                backgroundColor: active ? colors.card : "transparent",
                borderRadius: colors.radius - 4,
              },
              active
                ? Platform.OS === "ios"
                  ? styles.shadowIOS
                  : styles.shadowAndroid
                : null,
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: active
                    ? colors.foreground
                    : colors.mutedForeground,
                  fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium",
                },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 14,
  },
  shadowIOS: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  shadowAndroid: {
    elevation: 1,
  },
});
