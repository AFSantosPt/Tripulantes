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
import {
  AffectationType,
  ShiftCalc,
  calcShiftMinutes,
} from "@/utils/time";

const STORAGE_KEY = "@crew-fleet-hub/shifts/v1";

export interface Shift {
  id: string;
  crewMemberId: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  affectation: AffectationType;
  notes?: string;
  createdAt: string;
}

export interface ShiftWithCalc extends Shift, ShiftCalc {}

interface ShiftsState {
  shifts: ShiftWithCalc[];
  allShifts: ShiftWithCalc[];
  isReady: boolean;
  addShift: (input: Omit<Shift, "id" | "createdAt" | "crewMemberId">) => Promise<void>;
  removeShift: (id: string) => Promise<void>;
}

const ShiftsContext = createContext<ShiftsState | null>(null);

function decorate(shift: Shift): ShiftWithCalc {
  return { ...shift, ...calcShiftMinutes(shift.startMinutes, shift.endMinutes) };
}

export function ShiftsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setShifts(JSON.parse(raw));
      } catch (e) {
        console.warn("Shifts load error", e);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next: Shift[]) => {
    setShifts(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addShift = useCallback<ShiftsState["addShift"]>(
    async (input) => {
      if (!user) throw new Error("Sem sessão iniciada");
      const newShift: Shift = {
        ...input,
        id: newId(),
        crewMemberId: user.id,
        createdAt: new Date().toISOString(),
      };
      await persist([newShift, ...shifts]);
    },
    [shifts, persist, user],
  );

  const removeShift = useCallback(
    async (id: string) => {
      await persist(shifts.filter((s) => s.id !== id));
    },
    [shifts, persist],
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
      removeShift,
    };
  }, [shifts, user, isReady, addShift, removeShift]);

  return (
    <ShiftsContext.Provider value={value}>{children}</ShiftsContext.Provider>
  );
}

export function useShifts(): ShiftsState {
  const ctx = useContext(ShiftsContext);
  if (!ctx) throw new Error("useShifts must be used within ShiftsProvider");
  return ctx;
}
