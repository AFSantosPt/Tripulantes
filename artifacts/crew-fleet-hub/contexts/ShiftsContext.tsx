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
import { apiFetch } from "@/utils/apiClient";

import {
  ABSENCE_TYPES,
  AffectationType,
  ShiftCalc,
  calcShiftMinutes,
  formatMinutesToTime,
  parseTimeToMinutes,
} from "@/utils/time";

const POLL_INTERVAL_MS = 30000;
const LEGACY_STORAGE_KEY = "@crew-fleet-hub/shifts/v1";
const MIGRATED_KEY = "@crew-fleet-hub/shifts/migrated-to-server";

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
  vehicleKind?: string;
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
  refresh: () => Promise<void>;
}

const ShiftsContext = createContext<ShiftsState | null>(null);

function migrateRaw(raw: any): Shift {
  if (raw && Array.isArray(raw.stops) && raw.stops.length >= 2) {
    return {
      id: raw.id,
      crewMemberId: raw.crewMemberId ?? "",
      date: raw.date,
      code: raw.code ?? undefined,
      vehicleCode: raw.vehicleCode ?? undefined,
      vehicleKind: raw.vehicleKind ?? undefined,
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
    id: raw?.id ?? "",
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
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const shiftsRef = useRef<Shift[]>([]);
  const [isReady, setIsReady] = useState<boolean>(false);

  const fetchShifts = useCallback(async () => {
    if (!user) return;
    try {
      const [mineRes, allRes] = await Promise.all([
        apiFetch("/api/shifts", { memberId: user.id }),
        apiFetch("/api/shifts/all", { memberId: user.id }),
      ]);
      if (mineRes.ok) {
        const data = await mineRes.json();
        const serverShifts = (data.shifts as any[]).map(migrateRaw);
        if (serverShifts.length === 0) {
          const alreadyMigrated = await AsyncStorage.getItem(MIGRATED_KEY);
          if (!alreadyMigrated) {
            const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
            if (legacy) {
              const parsed = JSON.parse(legacy) as any[];
              const mine = parsed
                .map(migrateRaw)
                .filter((s) => s.crewMemberId === user.id || !s.crewMemberId);
              for (const s of mine) {
                const body = {
                  date: s.date,
                  code: s.code,
                  vehicleCode: s.vehicleCode,
                  affectation: s.affectation,
                  affectationLabel: s.affectationLabel,
                  stops: s.stops,
                  notes: s.notes,
                  availableForSwap: s.availableForSwap,
                };
                await apiFetch("/api/shifts", {
                  method: "POST",
                  memberId: user.id,
                  body: JSON.stringify(body),
                });
              }
              await AsyncStorage.setItem(MIGRATED_KEY, "1");
              const refreshed = await apiFetch("/api/shifts", { memberId: user.id });
              if (refreshed.ok) {
                const d = await refreshed.json();
                const migrated = (d.shifts as any[]).map(migrateRaw);
                shiftsRef.current = migrated;
                setShifts(migrated);
              }
              return;
            }
            await AsyncStorage.setItem(MIGRATED_KEY, "1");
          }
        }
        shiftsRef.current = serverShifts;
        setShifts(serverShifts);
      }
      if (allRes.ok) {
        const data = await allRes.json();
        setAllShifts((data.shifts as any[]).map(migrateRaw));
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!user) {
      setShifts([]);
      setAllShifts([]);
      shiftsRef.current = [];
      setIsReady(false);
      return;
    }
    setIsReady(false);
    fetchShifts().finally(() => setIsReady(true));
    const interval = setInterval(fetchShifts, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, fetchShifts]);

  const addShift = useCallback<ShiftsState["addShift"]>(
    async (input) => {
      if (!user) return { ok: false, reason: "Sem sessão iniciada" };
      try {
        const res = await apiFetch("/api/shifts", {
          method: "POST",
          memberId: user.id,
          body: JSON.stringify(input),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, reason: data.error ?? "Erro ao guardar" };
        const created = migrateRaw(data.shift);
        shiftsRef.current = [created, ...shiftsRef.current];
        setShifts([created, ...shifts]);
        setAllShifts((prev) => [created, ...prev]);
        return { ok: true, id: created.id };
      } catch {
        return { ok: false, reason: "Erro de ligação" };
      }
    },
    [user, shifts],
  );

  const updateShift = useCallback<ShiftsState["updateShift"]>(
    async (id, input) => {
      if (!user) return { ok: false, reason: "Sem sessão iniciada" };
      try {
        const res = await apiFetch(`/api/shifts/${id}`, {
          method: "PUT",
          memberId: user.id,
          body: JSON.stringify(input),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, reason: data.error ?? "Erro ao atualizar" };
        const updated = migrateRaw(data.shift);
        shiftsRef.current = shiftsRef.current.map((s) => (s.id === id ? updated : s));
        setShifts((prev) => prev.map((s) => (s.id === id ? updated : s)));
        setAllShifts((prev) => prev.map((s) => (s.id === id ? updated : s)));
        return { ok: true, id };
      } catch {
        return { ok: false, reason: "Erro de ligação" };
      }
    },
    [user],
  );

  const removeShift = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        const res = await apiFetch(`/api/shifts/${id}`, {
          method: "DELETE",
          memberId: user.id,
        });
        if (res.ok) {
          shiftsRef.current = shiftsRef.current.filter((s) => s.id !== id);
          setShifts((prev) => prev.filter((s) => s.id !== id));
          setAllShifts((prev) => prev.filter((s) => s.id !== id));
        }
      } catch {}
    },
    [user],
  );

  const setSwapAvailable = useCallback(
    async (id: string, available: boolean) => {
      if (!user) return;
      try {
        const res = await apiFetch(`/api/shifts/${id}/swap-available`, {
          method: "PATCH",
          memberId: user.id,
          body: JSON.stringify({ available }),
        });
        if (res.ok) {
          const data = await res.json();
          const updated = migrateRaw(data.shift);
          shiftsRef.current = shiftsRef.current.map((s) => (s.id === id ? updated : s));
          setShifts((prev) => prev.map((s) => (s.id === id ? updated : s)));
          setAllShifts((prev) => prev.map((s) => (s.id === id ? updated : s)));
        }
      } catch {}
    },
    [user],
  );

  const setMultipleSwapAvailable = useCallback(
    async (ids: string[], available: boolean) => {
      if (!user) return;
      try {
        const res = await apiFetch("/api/shifts/swap-available/bulk", {
          method: "POST",
          memberId: user.id,
          body: JSON.stringify({ ids, available }),
        });
        if (res.ok) {
          const idSet = new Set(ids);
          const update = (s: Shift) =>
            idSet.has(s.id) ? { ...s, availableForSwap: available } : s;
          shiftsRef.current = shiftsRef.current.map(update);
          setShifts((prev) => prev.map(update));
          setAllShifts((prev) => prev.map(update));
        }
      } catch {}
    },
    [user],
  );

  const byId = useCallback((id: string) => {
    const raw = shiftsRef.current.find((s) => s.id === id);
    return raw ? decorate(raw) : undefined;
  }, []);

  const value = useMemo<ShiftsState>(() => {
    const decoratedMine = shifts
      .map(decorate)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const decoratedAll = allShifts.map(decorate);
    return {
      shifts: decoratedMine,
      allShifts: decoratedAll,
      isReady,
      addShift,
      updateShift,
      removeShift,
      setSwapAvailable,
      setMultipleSwapAvailable,
      byId,
      refresh: fetchShifts,
    };
  }, [
    shifts,
    allShifts,
    isReady,
    addShift,
    updateShift,
    removeShift,
    setSwapAvailable,
    setMultipleSwapAvailable,
    byId,
    fetchShifts,
  ]);

  return (
    <ShiftsContext.Provider value={value}>{children}</ShiftsContext.Provider>
  );
}

export function useShifts(): ShiftsState {
  const ctx = useContext(ShiftsContext);
  if (!ctx) throw new Error("useShifts must be used within ShiftsProvider");
  return ctx;
}
