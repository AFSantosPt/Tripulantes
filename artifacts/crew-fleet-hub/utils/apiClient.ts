import { Platform } from "react-native";

export function getApiBase(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}`;
  return "";
}

export async function apiFetch(
  path: string,
  options: RequestInit & { memberId?: string } = {},
): Promise<Response> {
  const { memberId, headers: extraHeaders, ...rest } = options;
  const base = getApiBase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders as Record<string, string>),
  };
  if (memberId) {
    headers["x-member-id"] = memberId;
  }
  return fetch(`${base}${path}`, { ...rest, headers });
}
