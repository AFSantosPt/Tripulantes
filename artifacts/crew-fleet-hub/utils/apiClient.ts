import { Platform } from "react-native";

const REQUEST_TIMEOUT_MS = 10000;

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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${base}${path}`, {
      ...rest,
      headers,
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new NetworkError("O servidor demorou demasiado a responder. Verifica a tua ligação.");
    }
    throw new NetworkError("Sem ligação ao servidor. Verifica a tua rede.");
  } finally {
    clearTimeout(timer);
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}
