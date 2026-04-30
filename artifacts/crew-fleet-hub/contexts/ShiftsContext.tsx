import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "@/contexts/AuthContext";
import { newId } from "@/utils/id";
import {
  ABSENCE_TYPES,
  AffectationType,
  ShiftCalc,
  calcShiftMinutes,
  formatMinutesToTime,
  parseTimeToMinutes,
} from "@/utils/time";

const STORAGE_KEY = "@crew-fleet-hub/shifts/v1";

export interface ShiftStop {
  location: string;
  time: string;
}

export interface Shift {
  id: string;
  crewMemberId: string;
  date: string;
  code?: string;
  vehicleCode?: string;
  affectation: AffectationType;
  affectationLabel?: string;
  stops: ShiftStop[];
  notes?: string;
  availableForSwap?: boolean;
  createdAt: string;
}

export interface ShiftWithCalc extends Shift, ShiftCalc {
  startMinutes: number;
  endMinutes: number;
}

export interface SaveShiftResult {
  ok: boolean;
  reason?: string;
  id?: string;
}

interface ShiftsState {
  shifts: ShiftWithCalc[];
  allShifts: ShiftWithCalc[];
  isReady: boolean;
  addShift: (
    input: Omit<Shift, "id" | "createdAt" | "crewMemberId">,
  ) => Promise<SaveShiftResult>;
  updateShift: (
    id: string,
    input: Omit<Shift, "id" | "createdAt" | "crewMemberId">,
  ) => Promise<SaveShiftResult>;
  removeShift: (id: string) => Promise<void>;
  setSwapAvailable: (id: string, available: boolean) => Promise<void>;
  setMultipleSwapAvailable: (ids: string[], available: boolean) => Promise<void>;
  byId: (id: string) => ShiftWithCalc | undefined;
}

const ShiftsContext = createContext<ShiftsState | null>(null);

function migrateLoadedShift(raw: any): Shift {
  if (raw && Array.isArray(raw.stops) && raw.stops.length >= 2) {
    return {
      id: raw.id,
      crewMemberId: raw.crewMemberId,
      date: raw.date,
      code: raw.code ?? undefined,
      vehicleCode: raw.vehicleCode ?? undefined,
      affectation: raw.affectation ?? "normal",
      affectationLabel: raw.affectationLabel ?? undefined,
      stops: raw.stops.map((s: any) => ({
        location: String(s.location ?? ""),
        time: String(s.time ?? "00:00"),
      })),
      notes: raw.notes ?? undefined,
      availableForSwap: raw.availableForSwap ?? false,
      createdAt: raw.createdAt ?? new Date().toISOString(),
    };
  }
  const sm = typeof raw?.startMinutes === "number" ? raw.startMinutes : 0;
  const em = typeof raw?.endMinutes === "number" ? raw.endMinutes : sm;
  return {
    id: raw?.id ?? newId(),
    crewMemberId: raw?.crewMemberId ?? "",
    date: raw?.date ?? new Date().toISOString().slice(0, 10),
    code: raw?.code ?? undefined,
    vehicleCode: raw?.vehicleCode ?? undefined,
    affectation: raw?.affectation ?? "normal",
    affectationLabel: raw?.affectationLabel ?? undefined,
    stops: [
      { location: "", time: formatMinutesToTime(sm) },
      { location: "", time: formatMinutesToTime(em) },
    ],
    notes: raw?.notes ?? undefined,
    availableForSwap: raw?.availableForSwap ?? false,
    createdAt: raw?.createdAt ?? new Date().toISOString(),
  };
}

function decorate(shift: Shift): ShiftWithCalc {
  const first = shift.stops[0];
  const last = shift.stops[shift.stops.length - 1];
  const startMin = parseTimeToMinutes(first?.time ?? "00:00") ?? 0;
  const endMin = parseTimeToMinutes(last?.time ?? "00:00") ?? startMin;
  const safeEnd = endMin >= startMin ? endMin : startMin;
  return {
    ...shift,
    startMinutes: startMin,
    endMinutes: safeEnd,
    ...calcShiftMinutes(startMin, safeEnd, shift.affectation),
  };
}

export function ShiftsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const shiftsRef = useRef<Shift[]>([]);
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const migrated = parsed.map(migrateLoadedShift);
            shiftsRef.current = migrated;
            setShifts(migrated);
            const needsRewrite = migrated.some(
              (m, i) => !Array.isArray(parsed[i]?.stops),
            );
            if (needsRewrite) {
              await AsyncStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(migrated),
              );
            }
          }
        }
      } catch (e) {
        console.warn("Shifts load error", e);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next: Shift[]) => {
    shiftsRef.current = next;
    setShifts(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const findDuplicate = useCallback(
    (
      crewMemberId: string,
      input: Omit<Shift, "id" | "createdAt" | "crewMemberId">,
      ignoreId?: string,
    ): Shift | undefined => {
      if (ABSENCE_TYPES.has(input.affectation)) {
        return shiftsRef.current.find(
          (s) =>
            s.id !== ignoreId &&
            s.crewMemberId === crewMemberId &&
            s.date === input.date &&
            s.affectation === input.affectation,
        );
      }
      const startTime = input.stops[0]?.time ?? "";
      const endTime = input.stops[input.stops.length - 1]?.time ?? "";
      return shiftsRef.current.find(
        (s) =>
          s.id !== ignoreId &&
          s.crewMemberId === crewMemberId &&
          s.date === input.date &&
          !ABSENCE_TYPES.has(s.affectation) &&
          (s.stops[0]?.time ?? "") === startTime &&
          (s.stops[s.stops.length - 1]?.time ?? "") === endTime,
      );
    },
    [],
  );

  const addShift = useCallback<ShiftsState["addShift"]>(
    async (input) => {
      if (!user) return { ok: false, reason: "Sem sessão iniciada" };
      if (findDuplicate(user.id, input)) {
        return {
          ok: false,
          reason:
            "Já existe um serviço neste dia com as mesmas horas de início e fim.",
        };
      }
      const newShift: Shift = {
        ...input,
        id: newId(),
        crewMemberId: user.id,
        createdAt: new Date().toISOString(),
      };
      await persist([newShift, ...shiftsRef.current]);
      return { ok: true, id: newShift.id };
    },
    [persist, user, findDuplicate],
  );

  const updateShift = useCallback<ShiftsState["updateShift"]>(
    async (id, input) => {
      if (!user) return { ok: false, reason: "Sem sessão iniciada" };
      const existing = shiftsRef.current.find((s) => s.id === id);
      if (!existing) return { ok: false, reason: "Serviço não encontrado" };
      if (existing.crewMemberId !== user.id) {
        return { ok: false, reason: "Sem permissão para editar este serviço" };
      }
      if (findDuplicate(user.id, input, id)) {
        return {
          ok: false,
          reason:
            "Já existe outro serviço neste dia com as mesmas horas de início e fim.",
        };
      }
      const updated: Shift = {
        ...existing,
        ...input,
      };
      await persist(shiftsRef.current.map((s) => (s.id === id ? updated : s)));
      return { ok: true, id };
    },
    [persist, user, findDuplicate],
  );

  const removeShift = useCallback(
    async (id: string) => {
      await persist(shiftsRef.current.filter((s) => s.id !== id));
    },
    [persist],
  );

  const setSwapAvailable = useCallback(
    async (id: string, available: boolean) => {
      await persist(
        shiftsRef.current.map((s) => (s.id === id ? { ...s, availableForSwap: available } : s)),
      );
    },
    [persist],
  );

  const setMultipleSwapAvailable = useCallback(
    async (ids: string[], available: boolean) => {
      const set = new Set(ids);
      await persist(
        shiftsRef.current.map((s) => (set.has(s.id) ? { ...s, availableForSwap: available } : s)),
      );
    },
    [persist],
  );

  const byId = useCallback(
    (id: string) => {
      const raw = shiftsRef.current.find((s) => s.id === id);
      return raw ? decorate(raw) : undefined;
    },
    [],
  );

  const value = useMemo<ShiftsState>(() => {
    const decorated = shifts.map(decorate);
    const own = user
      ? decorated
          .filter((s) => s.crewMemberId === user.id)
          .sort((a, b) => (a.date < b.date ? 1 : -1))
      : [];
    return {
      shifts: own,
      allShifts: decorated,
      isReady,
      addShift,
      updateShift,
      removeShift,
      setSwapAvailable,
      setMultipleSwapAvailable,
      byId,
    };
  }, [shifts, user, isReady, addShift, updateShift, removeShift, setSwapAvailable, setMultipleSwapAvailable, byId]);

  return (
    <ShiftsContext.Provider value={value}>{children}</ShiftsContext.Provider>
  );
}

export function useShifts(): ShiftsState {
  const ctx = useContext(ShiftsContext);
  if (!ctx) throw new Error("useShifts must be used within ShiftsProvider");
  return ctx;
}
