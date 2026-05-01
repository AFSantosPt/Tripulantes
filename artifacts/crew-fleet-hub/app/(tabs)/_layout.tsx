import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Redirect, Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import React from "react";
import {
  Platform,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useSwaps } from "@/contexts/SwapsContext";
import { useColors } from "@/hooks/useColors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "clock", selected: "clock.fill" }} />
        <Label>Serviços</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="breakdowns">
        <Icon
          sf={{
            default: "wrench.and.screwdriver",
            selected: "wrench.and.screwdriver.fill",
          }}
        />
        <Label>Avarias</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="swaps">
        <Icon sf={{ default: "arrow.2.squarepath", selected: "arrow.2.squarepath" }} />
        <Label>Trocas</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="team">
        <Icon sf={{ default: "person.2", selected: "person.2.fill" }} />
        <Label>Equipa</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const { user } = useAuth();
  const { swapRequests } = useSwaps();
  const pendingSwapsBadge = swapRequests.filter(
    (r) => r.offererId === user?.id && r.status === "pending",
  ).length;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 11,
        },
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Serviços",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="clock" tintColor={color} size={24} />
            ) : (
              <Feather name="clock" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="breakdowns"
        options={{
          title: "Avarias",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView
                name="wrench.and.screwdriver"
                tintColor={color}
                size={24}
              />
            ) : (
              <Feather name="tool" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="swaps"
        options={{
          title: "Trocas",
          tabBarBadge: pendingSwapsBadge > 0 ? pendingSwapsBadge : undefined,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="arrow.2.squarepath" tintColor={color} size={24} />
            ) : (
              <Feather name="repeat" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: "Equipa",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.2" tintColor={color} size={24} />
            ) : (
              <Feather name="users" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen name="notices" options={{ href: null }} />
    </Tabs>
  );
}

export default function TabLayout() {
  const { user, isReady } = useAuth();

  if (!isReady) return null;
  if (!user) return <Redirect href="/login" />;

  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
