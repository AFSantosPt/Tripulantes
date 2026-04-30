import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { CrewCategory, useAuth } from "@/contexts/AuthContext";
import { ShiftWithCalc } from "@/contexts/ShiftsContext";
import { newId } from "@/utils/id";
import { todayIso } from "@/utils/time";

const STORAGE_KEY = "@crew-fleet-hub/swaps/v1";

export type SwapStatus = "pending" | "confirmed" | "rejected";

export interface SwapRequest {
  id: string;
  offerShiftId: string;
  offererId: string;
  offererName: string;
  offererCrewId: string;
  offererCategories: CrewCategory[];
  offerShiftDate: string;
  offerShiftCode?: string;
  offerShiftStart: string;
  offerShiftEnd: string;
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
  isReady: boolean;
  requestSwap: (input: {
    shift: ShiftWithCalc;
    offererName: string;
    offererCrewId: string;
    offererCategories: CrewCategory[];
  }) => Promise<{ ok: boolean; reason?: string }>;
  confirmSwap: (id: string) => Promise<void>;
  rejectSwap: (id: string) => Promise<void>;
  cancelSwap: (id: string) => Promise<void>;
}

const SwapsContext = createContext<SwapsState | null>(null);

function normalizeSwapRequest(raw: any): SwapRequest {
  const validStatuses: SwapStatus[] = ["pending", "confirmed", "rejected"];
  return {
    id: String(raw?.id ?? newId()),
    offerShiftId: String(raw?.offerShiftId ?? ""),
    offererId: String(raw?.offererId ?? ""),
    offererName: String(raw?.offererName ?? ""),
    offererCrewId: String(raw?.offererCrewId ?? ""),
    offererCategories: Array.isArray(raw?.offererCategories)
      ? raw.offererCategories
      : [],
    offerShiftDate: String(raw?.offerShiftDate ?? ""),
    offerShiftCode: raw?.offerShiftCode ?? undefined,
    offerShiftStart: String(raw?.offerShiftStart ?? ""),
    offerShiftEnd: String(raw?.offerShiftEnd ?? ""),
    offerShiftVehicle: raw?.offerShiftVehicle ?? undefined,
    requesterId: String(raw?.requesterId ?? ""),
    requesterName: String(raw?.requesterName ?? ""),
    requesterCrewId: String(raw?.requesterCrewId ?? ""),
    requesterCategories: Array.isArray(raw?.requesterCategories)
      ? raw.requesterCategories
      : [],
    status: validStatuses.includes(raw?.status) ? raw.status : "pending",
    createdAt: raw?.createdAt ?? new Date().toISOString(),
  };
}

export function SwapsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const today = todayIso();
            const normalized = parsed.map(normalizeSwapRequest);
            const fresh = normalized.filter((r) => r.offerShiftDate >= today);
            setSwapRequests(fresh);
            if (fresh.length !== normalized.length) {
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
            }
          }
        }
      } catch (e) {
        console.warn("Swaps load error", e);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next: SwapRequest[]) => {
    setSwapRequests(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const requestSwap = useCallback(
    async ({
      shift,
      offererName,
      offererCrewId,
      offererCategories,
    }: {
      shift: ShiftWithCalc;
      offererName: string;
      offererCrewId: string;
      offererCategories: CrewCategory[];
    }): Promise<{ ok: boolean; reason?: string }> => {
      if (!user) return { ok: false, reason: "Sem sessão iniciada" };
      if (shift.crewMemberId === user.id)
        return { ok: false, reason: "Não podes trocar contigo próprio" };
      const existing = swapRequests.find(
        (r) =>
          r.offerShiftId === shift.id &&
          r.requesterId === user.id &&
          r.status === "pending",
      );
      if (existing)
        return {
          ok: false,
          reason: "Já enviaste um pedido para este serviço",
        };
      const req: SwapRequest = {
        id: newId(),
        offerShiftId: shift.id,
        offererId: shift.crewMemberId,
        offererName,
        offererCrewId,
        offererCategories,
        offerShiftDate: shift.date,
        offerShiftCode: shift.code,
        offerShiftStart: shift.stops[0]?.time ?? "00:00",
        offerShiftEnd: shift.stops[shift.stops.length - 1]?.time ?? "00:00",
        offerShiftVehicle: shift.vehicleCode,
        requesterId: user.id,
        requesterName: user.name,
        requesterCrewId: user.crewId,
        requesterCategories: user.categories ?? [],
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      await persist([...swapRequests, req]);
      return { ok: true };
    },
    [user, swapRequests, persist],
  );

  const confirmSwap = useCallback(
    async (id: string) => {
      if (!user) return;
      await persist(
        swapRequests.map((r) =>
          r.id === id && r.offererId === user.id && r.status === "pending"
            ? { ...r, status: "confirmed" as const }
            : r,
        ),
      );
    },
    [user, swapRequests, persist],
  );

  const rejectSwap = useCallback(
    async (id: string) => {
      if (!user) return;
      await persist(
        swapRequests.map((r) =>
          r.id === id && r.offererId === user.id && r.status === "pending"
            ? { ...r, status: "rejected" as const }
            : r,
        ),
      );
    },
    [user, swapRequests, persist],
  );

  const cancelSwap = useCallback(
    async (id: string) => {
      if (!user) return;
      await persist(
        swapRequests.filter(
          (r) => !(r.id === id && r.requesterId === user.id),
        ),
      );
    },
    [user, swapRequests, persist],
  );

  const value = useMemo<SwapsState>(
    () => ({
      swapRequests,
      isReady,
      requestSwap,
      confirmSwap,
      rejectSwap,
      cancelSwap,
    }),
    [
      swapRequests,
      isReady,
      requestSwap,
      confirmSwap,
      rejectSwap,
      cancelSwap,
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
