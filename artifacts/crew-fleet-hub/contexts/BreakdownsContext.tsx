import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/contexts/AuthContext";
import { newId } from "@/utils/id";

const STORAGE_KEY = "@crew-fleet-hub/breakdowns/v1";
const REQUIRED_CONFIRMATIONS = 3;

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
}

export const REQUIRED_CONFIRMATIONS_COUNT = REQUIRED_CONFIRMATIONS;

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
}

const BreakdownsContext = createContext<BreakdownsState | null>(null);

export function BreakdownsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([]);
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setBreakdowns(JSON.parse(raw));
      } catch (e) {
        console.warn("Breakdowns load error", e);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next: Breakdown[]) => {
    setBreakdowns(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const reportBreakdown = useCallback<BreakdownsState["reportBreakdown"]>(
    async (input) => {
      if (!user) throw new Error("Sem sessão iniciada");
      const created: Breakdown = {
        id: newId(),
        vehicleKind: input.vehicleKind,
        fleetNumber: input.fleetNumber.trim(),
        description: input.description.trim(),
        reportedById: user.id,
        reportedByName: user.name,
        reportedByCrewId: user.crewId,
        reportedAt: new Date().toISOString(),
        confirmations: [],
      };
      await persist([created, ...breakdowns]);
      return created;
    },
    [user, breakdowns, persist],
  );

  const confirmRepair = useCallback<BreakdownsState["confirmRepair"]>(
    async (id) => {
      if (!user) return { ok: false, reason: "Sem sessão iniciada" };
      const target = breakdowns.find((b) => b.id === id);
      if (!target) return { ok: false, reason: "Avaria não encontrada" };
      if (target.reportedById === user.id) {
        return {
          ok: false,
          reason: "Quem reportou não pode validar a sua própria avaria",
        };
      }
      if (target.confirmations.some((c) => c.crewMemberId === user.id)) {
        return { ok: false, reason: "Já validaste esta avaria" };
      }
      if (target.confirmations.length >= REQUIRED_CONFIRMATIONS) {
        return { ok: false, reason: "Avaria já resolvida" };
      }
      const next = breakdowns.map((b) =>
        b.id === id
          ? {
              ...b,
              confirmations: [
                ...b.confirmations,
                {
                  crewMemberId: user.id,
                  crewMemberName: user.name,
                  crewIdLabel: user.crewId,
                  at: new Date().toISOString(),
                },
              ],
            }
          : b,
      );
      await persist(next);
      return { ok: true };
    },
    [user, breakdowns, persist],
  );

  const removeBreakdown = useCallback(
    async (id: string) => {
      await persist(breakdowns.filter((b) => b.id !== id));
    },
    [breakdowns, persist],
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
    };
  }, [breakdowns, isReady, reportBreakdown, confirmRepair, removeBreakdown]);

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
