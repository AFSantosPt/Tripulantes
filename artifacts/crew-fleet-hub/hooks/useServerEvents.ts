import { Platform } from "react-native";
import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getApiBase } from "@/utils/apiClient";

export type SseEvent = "shifts" | "breakdowns" | "swaps" | "members";

type Handler = () => void;

const listeners = new Map<SseEvent, Set<Handler>>();

function getListeners(event: SseEvent): Set<Handler> {
  if (!listeners.has(event)) listeners.set(event, new Set());
  return listeners.get(event)!;
}

let eventSource: EventSource | null = null;
let currentMemberId: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connect(memberId: string): void {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  currentMemberId = memberId;
  const url = `${getApiBase()}/api/events?mid=${encodeURIComponent(memberId)}`;
  const es = new EventSource(url);

  const notify = (event: SseEvent) => {
    const set = listeners.get(event);
    if (set) set.forEach((fn) => fn());
  };

  es.addEventListener("shifts", () => notify("shifts"));
  es.addEventListener("breakdowns", () => notify("breakdowns"));
  es.addEventListener("swaps", () => notify("swaps"));
  es.addEventListener("members", () => notify("members"));

  es.onerror = () => {
    es.close();
    eventSource = null;
    reconnectTimer = setTimeout(() => {
      if (currentMemberId) connect(currentMemberId);
    }, 5000);
  };

  eventSource = es;
}

function disconnect(): void {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (eventSource) { eventSource.close(); eventSource = null; }
  currentMemberId = null;
}

export function useServerEvents(
  event: SseEvent,
  handler: Handler,
): void {
  const { user } = useAuth();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const stableHandler = useCallback(() => handlerRef.current(), []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!user) { disconnect(); return; }

    if (currentMemberId !== user.id) connect(user.id);

    const set = getListeners(event);
    set.add(stableHandler);
    return () => { set.delete(stableHandler); };
  }, [user, event, stableHandler]);
}
