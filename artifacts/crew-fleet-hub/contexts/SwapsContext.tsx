import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { CrewCategory, useAuth } from "@/contexts/AuthContext";
import { ShiftStop, ShiftWithCalc } from "@/contexts/ShiftsContext";
import { NetworkError, apiFetch } from "@/utils/apiClient";
import { todayIso } from "@/utils/time";

const POLL_INTERVAL_MS = 30000;

export type SwapStatus = "pending" | "confirmed" | "rejected";

export interface OfferShiftSnapshot {
  id: string;
  code?: string;
  vehicleCode?: string;
  stops: ShiftStop[];
}

export interface SwapRequest {
  id: string;
  offerShiftId: string;
  offerShiftIds: string[];
  offerShifts: OfferShiftSnapshot[];
  offererId: string;
  offererName: string;
  offererCrewId: string;
  offererCategories: CrewCategory[];
  offerShiftDate: string;
  offerShiftCode?: string;
  offerShiftStart: string;
  offerShiftEnd: string;
  offerShiftStops: ShiftStop[];
  offerShiftVehicle?: string;
  requesterId: string;
  requesterName: string;
  requesterCrewId: string;
  requesterCategories: CrewCategory[];
  status: SwapStatus;
  createdAt: string;
}

interface SwapsState {
  swapRequests: SwapRequest[];
  adminHistory: SwapRequest[];
  isReady: boolean;
  requestSwap: (input: {
    shifts: ShiftWithCalc[];
    offererName: string;
    offererCrewId: string;
    offererCategories: CrewCategory[];
  }) => Promise<{ ok: boolean; reason?: string }>;
  confirmSwap: (id: string) => Promise<void>;
  rejectSwap: (id: string) => Promise<void>;
  cancelSwap: (id: string) => Promise<void>;
  fetchAdminHistory: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SwapsContext = createContext<SwapsState | null>(null);

export function SwapsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [adminHistory, setAdminHistory] = useState<SwapRequest[]>([]);
  const [isReady, setIsReady] = useState(false);

  const fetchSwaps = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiFetch("/api/swaps", { memberId: user.id });
      if (res.ok) {
        const data = await res.json();
        const today = todayIso();
        const fresh = (data.swapRequests as SwapRequest[]).filter(
          (r) => r.offerShiftDate >= today,
        );
        setSwapRequests(fresh);
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchSwaps().finally(() => setIsReady(true));
    const interval = setInterval(fetchSwaps, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, fetchSwaps]);

  const requestSwap = useCallback(
    async ({
      shifts,
      offererName,
      offererCrewId,
      offererCategories,
    }: {
      shifts: ShiftWithCalc[];
      offererName: string;
      offererCrewId: string;
      offererCategories: CrewCategory[];
    }): Promise<{ ok: boolean; reason?: string }> => {
      if (!user) return { ok: false, reason: "Sem sessão iniciada" };
      if (!shifts.length) return { ok: false, reason: "Nenhum serviço" };
      const sorted = [...shifts].sort((a, b) => a.startMinutes - b.startMinutes);
      const first = sorted[0];
      if (first.crewMemberId === user.id)
        return { ok: false, reason: "Não podes trocar contigo próprio" };
      const body = {
        offerShiftId: first.id,
        offerShiftIds: sorted.map((s) => s.id),
        offerShifts: sorted.map((s) => ({
          id: s.id,
          code: s.code,
          vehicleCode: s.vehicleCode,
          stops: s.stops,
        })),
        offererId: first.crewMemberId,
        offererName,
        offererCrewId,
        offererCategories,
        offerShiftDate: first.date,
        offerShiftCode: first.code,
        offerShiftStart: first.stops[0]?.time ?? "00:00",
        offerShiftEnd:
          sorted[sorted.length - 1].stops[
            sorted[sorted.length - 1].stops.length - 1
          ]?.time ?? "00:00",
        offerShiftStops: sorted.flatMap((s) => s.stops),
        offerShiftVehicle: first.vehicleCode,
      };
      try {
        const res = await apiFetch("/api/swaps", {
          method: "POST",
          memberId: user.id,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, reason: data.error ?? "Erro" };
        const newSwap = data.swapRequest as SwapRequest;
        setSwapRequests((prev) => [...prev, newSwap]);
        setAdminHistory((prev) => [newSwap, ...prev]);
        return { ok: true };
      } catch (err) {
        const msg = err instanceof NetworkError ? err.message : "Erro de ligação";
        return { ok: false, reason: msg };
      }
    },
    [user],
  );

  const confirmSwap = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        const res = await apiFetch(`/api/swaps/${id}/confirm`, {
          method: "POST",
          memberId: user.id,
        });
        if (res.ok) {
          const data = await res.json();
          const updated = data.swapRequest as SwapRequest;
          setSwapRequests((prev) => prev.map((r) => r.id === id ? updated : r));
          setAdminHistory((prev) => prev.map((r) => r.id === id ? updated : r));
        }
      } catch {}
    },
    [user],
  );

  const rejectSwap = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        const res = await apiFetch(`/api/swaps/${id}/reject`, {
          method: "POST",
          memberId: user.id,
        });
        if (res.ok) {
          const data = await res.json();
          const updated = data.swapRequest as SwapRequest;
          setSwapRequests((prev) => prev.map((r) => r.id === id ? updated : r));
          setAdminHistory((prev) => prev.map((r) => r.id === id ? updated : r));
        }
      } catch {}
    },
    [user],
  );

  const cancelSwap = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        const res = await apiFetch(`/api/swaps/${id}`, {
          method: "DELETE",
          memberId: user.id,
        });
        if (res.ok) {
          setSwapRequests((prev) => prev.filter((r) => r.id !== id));
          setAdminHistory((prev) => prev.filter((r) => r.id !== id));
        }
      } catch {}
    },
    [user],
  );

  const fetchAdminHistory = useCallback(async () => {
    if (!user?.isAdmin) return;
    try {
      const res = await apiFetch("/api/swaps/history", { memberId: user.id });
      if (res.ok) {
        const data = await res.json();
        setAdminHistory(data.swapRequests as SwapRequest[]);
      }
    } catch {}
  }, [user]);

  const value = useMemo<SwapsState>(
    () => ({
      swapRequests,
      adminHistory,
      isReady,
      requestSwap,
      confirmSwap,
      rejectSwap,
      cancelSwap,
      fetchAdminHistory,
      refresh: fetchSwaps,
    }),
    [
      swapRequests,
      adminHistory,
      isReady,
      requestSwap,
      confirmSwap,
      rejectSwap,
      cancelSwap,
      fetchAdminHistory,
      fetchSwaps,
    ],
  );

  return (
    <SwapsContext.Provider value={value}>{children}</SwapsContext.Provider>
  );
}

export function useSwaps(): SwapsState {
  const ctx = useContext(SwapsContext);
  if (!ctx) throw new Error("useSwaps must be used within SwapsProvider");
  return ctx;
}
