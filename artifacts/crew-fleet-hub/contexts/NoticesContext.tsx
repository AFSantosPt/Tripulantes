import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/utils/apiClient";

const POLL_INTERVAL_MS = 30000;

export interface Notice {
  id: string;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  targetMemberId: string | null;
  createdAt: string;
  readByIds: string[];
}

interface NoticesState {
  notices: Notice[];
  unreadCount: number;
  fetchNotices: () => Promise<void>;
  sendNotice: (title: string, body: string, targetMemberId?: string | null) => Promise<{ ok: boolean; reason?: string }>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotice: (id: string) => Promise<void>;
}

const NoticesContext = createContext<NoticesState | null>(null);

export function NoticesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);

  const fetchNotices = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiFetch("/api/notices", { memberId: user.id });
      if (res.ok) {
        const data = await res.json();
        setNotices(data.notices as Notice[]);
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!user) { setNotices([]); return; }
    fetchNotices();
    const interval = setInterval(fetchNotices, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, fetchNotices]);

  const sendNotice = useCallback(
    async (title: string, body: string, targetMemberId?: string | null): Promise<{ ok: boolean; reason?: string }> => {
      if (!user) return { ok: false, reason: "Sem sessão" };
      try {
        const res = await apiFetch("/api/notices", {
          method: "POST",
          memberId: user.id,
          body: JSON.stringify({ title, body, targetMemberId: targetMemberId ?? null }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, reason: data.error ?? "Erro" };
        setNotices((prev) => [data.notice as Notice, ...prev]);
        return { ok: true };
      } catch {
        return { ok: false, reason: "Erro de ligação" };
      }
    },
    [user],
  );

  const markRead = useCallback(
    async (id: string) => {
      if (!user) return;
      setNotices((prev) =>
        prev.map((n) =>
          n.id === id && !n.readByIds.includes(user.id)
            ? { ...n, readByIds: [...n.readByIds, user.id] }
            : n,
        ),
      );
      try {
        await apiFetch(`/api/notices/${id}/read`, { method: "POST", memberId: user.id });
      } catch {}
    },
    [user],
  );

  const markAllRead = useCallback(
    async () => {
      if (!user) return;
      let unreadIds: string[] = [];
      setNotices((prev) => {
        unreadIds = prev.filter((n) => !n.readByIds.includes(user.id)).map((n) => n.id);
        return prev.map((n) =>
          n.readByIds.includes(user.id) ? n : { ...n, readByIds: [...n.readByIds, user.id] },
        );
      });
      await Promise.all(
        unreadIds.map((id) =>
          apiFetch(`/api/notices/${id}/read`, { method: "POST", memberId: user.id }).catch(() => {}),
        ),
      );
    },
    [user],
  );

  const deleteNotice = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        const res = await apiFetch(`/api/notices/${id}`, { method: "DELETE", memberId: user.id });
        if (res.ok) setNotices((prev) => prev.filter((n) => n.id !== id));
      } catch {}
    },
    [user],
  );

  const unreadCount = useMemo(
    () => (user ? notices.filter((n) => !n.readByIds.includes(user.id)).length : 0),
    [notices, user],
  );

  const value = useMemo(
    () => ({ notices, unreadCount, fetchNotices, sendNotice, markRead, markAllRead, deleteNotice }),
    [notices, unreadCount, fetchNotices, sendNotice, markRead, markAllRead, deleteNotice],
  );

  return <NoticesContext.Provider value={value}>{children}</NoticesContext.Provider>;
}

export function useNotices(): NoticesState {
  const ctx = useContext(NoticesContext);
  if (!ctx) throw new Error("useNotices must be used inside NoticesProvider");
  return ctx;
}
