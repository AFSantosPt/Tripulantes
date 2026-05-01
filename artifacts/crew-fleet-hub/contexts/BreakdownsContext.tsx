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

export const BREAKDOWN_PHOTO_LIFETIME_DAYS = 14;
export const BREAKDOWN_MAX_PHOTOS = 3;
const REQUIRED_CONFIRMATIONS = 2;
export const REQUIRED_CONFIRMATIONS_COUNT = REQUIRED_CONFIRMATIONS;
const POLL_INTERVAL_MS = 30000;

export type VehicleKind = "eletrico" | "autocarro";

export const VEHICLE_LABELS: Record<VehicleKind, string> = {
  eletrico: "Elétrico",
  autocarro: "Autocarro",
};

export interface Confirmation {
  crewMemberId: string;
  crewMemberName: string;
  crewIdLabel: string;
  at: string;
}

export interface BreakdownPhoto {
  id: string;
  uri: string;
  addedAt: string;
  addedById: string;
  addedByName: string;
}

export interface Breakdown {
  id: string;
  vehicleKind: VehicleKind;
  fleetNumber: string;
  description: string;
  reportedById: string;
  reportedByName: string;
  reportedByCrewId: string;
  reportedAt: string;
  confirmations: Confirmation[];
  photos: BreakdownPhoto[];
}

interface BreakdownsState {
  breakdowns: Breakdown[];
  active: Breakdown[];
  resolved: Breakdown[];
  isReady: boolean;
  byId: (id: string) => Breakdown | undefined;
  reportBreakdown: (input: {
    vehicleKind: VehicleKind;
    fleetNumber: string;
    description: string;
  }) => Promise<Breakdown>;
  confirmRepair: (id: string) => Promise<{ ok: boolean; reason?: string }>;
  removeBreakdown: (id: string) => Promise<void>;
  addPhoto: (
    breakdownId: string,
    uri: string,
  ) => Promise<{ ok: boolean; reason?: string }>;
  removePhoto: (breakdownId: string, photoId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const BreakdownsContext = createContext<BreakdownsState | null>(null);

export function BreakdownsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([]);
  const [isReady, setIsReady] = useState<boolean>(false);

  const fetchBreakdowns = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiFetch("/api/breakdowns", { memberId: user.id });
      if (res.ok) {
        const data = await res.json();
        setBreakdowns(data.breakdowns as Breakdown[]);
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchBreakdowns().finally(() => setIsReady(true));
    const interval = setInterval(fetchBreakdowns, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, fetchBreakdowns]);

  const reportBreakdown = useCallback<BreakdownsState["reportBreakdown"]>(
    async (input) => {
      if (!user) throw new Error("Sem sessão iniciada");
      const res = await apiFetch("/api/breakdowns", {
        method: "POST",
        memberId: user.id,
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao registar avaria");
      }
      const data = await res.json();
      const created = data.breakdown as Breakdown;
      setBreakdowns((prev) => [created, ...prev]);
      return created;
    },
    [user],
  );

  const confirmRepair = useCallback<BreakdownsState["confirmRepair"]>(
    async (id) => {
      if (!user) return { ok: false, reason: "Sem sessão iniciada" };
      try {
        const res = await apiFetch(`/api/breakdowns/${id}/confirm`, {
          method: "POST",
          memberId: user.id,
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, reason: data.error };
        setBreakdowns((prev) =>
          prev.map((b) => (b.id === id ? (data.breakdown as Breakdown) : b)),
        );
        return { ok: true };
      } catch {
        return { ok: false, reason: "Erro de ligação" };
      }
    },
    [user],
  );

  const removeBreakdown = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        const res = await apiFetch(`/api/breakdowns/${id}`, {
          method: "DELETE",
          memberId: user.id,
        });
        if (res.ok) setBreakdowns((prev) => prev.filter((b) => b.id !== id));
      } catch {}
    },
    [user],
  );

  const addPhoto = useCallback<BreakdownsState["addPhoto"]>(
    async (breakdownId, uri) => {
      if (!user) return { ok: false, reason: "Sem sessão iniciada" };
      try {
        const res = await apiFetch(`/api/breakdowns/${breakdownId}/photos`, {
          method: "POST",
          memberId: user.id,
          body: JSON.stringify({ uri }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, reason: data.error };
        setBreakdowns((prev) =>
          prev.map((b) =>
            b.id === breakdownId ? (data.breakdown as Breakdown) : b,
          ),
        );
        return { ok: true };
      } catch {
        return { ok: false, reason: "Erro de ligação" };
      }
    },
    [user],
  );

  const removePhoto = useCallback(
    async (breakdownId: string, photoId: string) => {
      if (!user) return;
      try {
        const res = await apiFetch(
          `/api/breakdowns/${breakdownId}/photos/${photoId}`,
          { method: "DELETE", memberId: user.id },
        );
        if (res.ok) {
          const data = await res.json();
          setBreakdowns((prev) =>
            prev.map((b) =>
              b.id === breakdownId ? (data.breakdown as Breakdown) : b,
            ),
          );
        }
      } catch {}
    },
    [user],
  );

  const value = useMemo<BreakdownsState>(() => {
    const sorted = [...breakdowns].sort((a, b) =>
      a.reportedAt < b.reportedAt ? 1 : -1,
    );
    const active = sorted.filter(
      (b) => b.confirmations.length < REQUIRED_CONFIRMATIONS,
    );
    const resolved = sorted.filter(
      (b) => b.confirmations.length >= REQUIRED_CONFIRMATIONS,
    );
    return {
      breakdowns: sorted,
      active,
      resolved,
      isReady,
      byId: (id: string) => breakdowns.find((b) => b.id === id),
      reportBreakdown,
      confirmRepair,
      removeBreakdown,
      addPhoto,
      removePhoto,
      refresh: fetchBreakdowns,
    };
  }, [
    breakdowns,
    isReady,
    reportBreakdown,
    confirmRepair,
    removeBreakdown,
    addPhoto,
    removePhoto,
    fetchBreakdowns,
  ]);

  return (
    <BreakdownsContext.Provider value={value}>
      {children}
    </BreakdownsContext.Provider>
  );
}

export function useBreakdowns(): BreakdownsState {
  const ctx = useContext(BreakdownsContext);
  if (!ctx)
    throw new Error("useBreakdowns must be used within BreakdownsProvider");
  return ctx;
}
