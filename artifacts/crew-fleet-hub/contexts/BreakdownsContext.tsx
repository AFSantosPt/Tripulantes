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
const REQUIRED_CONFIRMATIONS = 2;
const PHOTO_LIFETIME_DAYS = 14;
const PHOTO_LIFETIME_MS = PHOTO_LIFETIME_DAYS * 24 * 60 * 60 * 1000;
const MAX_PHOTOS_PER_BREAKDOWN = 3;

export const BREAKDOWN_PHOTO_LIFETIME_DAYS = PHOTO_LIFETIME_DAYS;
export const BREAKDOWN_MAX_PHOTOS = MAX_PHOTOS_PER_BREAKDOWN;

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
  addPhoto: (
    breakdownId: string,
    uri: string,
  ) => Promise<{ ok: boolean; reason?: string }>;
  removePhoto: (breakdownId: string, photoId: string) => Promise<void>;
}

const BreakdownsContext = createContext<BreakdownsState | null>(null);

function normalizeBreakdown(raw: any): Breakdown {
  return {
    id: raw?.id ?? newId(),
    vehicleKind: raw?.vehicleKind ?? "autocarro",
    fleetNumber: String(raw?.fleetNumber ?? ""),
    description: String(raw?.description ?? ""),
    reportedById: String(raw?.reportedById ?? ""),
    reportedByName: String(raw?.reportedByName ?? ""),
    reportedByCrewId: String(raw?.reportedByCrewId ?? ""),
    reportedAt: raw?.reportedAt ?? new Date().toISOString(),
    confirmations: Array.isArray(raw?.confirmations) ? raw.confirmations : [],
    photos: Array.isArray(raw?.photos)
      ? raw.photos.map((p: any) => ({
          id: String(p?.id ?? newId()),
          uri: String(p?.uri ?? ""),
          addedAt: String(p?.addedAt ?? new Date().toISOString()),
          addedById: String(p?.addedById ?? ""),
          addedByName: String(p?.addedByName ?? ""),
        }))
      : [],
  };
}

function pruneExpiredPhotos(items: Breakdown[]): {
  next: Breakdown[];
  changed: boolean;
} {
  const now = Date.now();
  let changed = false;
  const next = items.map((b) => {
    if (!b.photos || b.photos.length === 0) return b;
    const fresh = b.photos.filter(
      (p) => now - new Date(p.addedAt).getTime() < PHOTO_LIFETIME_MS,
    );
    if (fresh.length !== b.photos.length) {
      changed = true;
      return { ...b, photos: fresh };
    }
    return b;
  });
  return { next, changed };
}

export function BreakdownsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([]);
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const normalized = parsed.map(normalizeBreakdown);
            const { next, changed } = pruneExpiredPhotos(normalized);
            setBreakdowns(next);
            if (
              changed ||
              parsed.some((p: any, i: number) => !Array.isArray(p?.photos))
            ) {
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            }
          }
        }
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
        photos: [],
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

  const addPhoto = useCallback<BreakdownsState["addPhoto"]>(
    async (breakdownId, uri) => {
      if (!user) return { ok: false, reason: "Sem sessão iniciada" };
      if (!uri) return { ok: false, reason: "Imagem inválida" };
      const target = breakdowns.find((b) => b.id === breakdownId);
      if (!target) return { ok: false, reason: "Avaria não encontrada" };
      if (target.photos.length >= MAX_PHOTOS_PER_BREAKDOWN) {
        return {
          ok: false,
          reason: `Máximo de ${MAX_PHOTOS_PER_BREAKDOWN} fotografias por avaria`,
        };
      }
      const photo: BreakdownPhoto = {
        id: newId(),
        uri,
        addedAt: new Date().toISOString(),
        addedById: user.id,
        addedByName: user.name,
      };
      const next = breakdowns.map((b) =>
        b.id === breakdownId
          ? { ...b, photos: [photo, ...b.photos] }
          : b,
      );
      await persist(next);
      return { ok: true };
    },
    [user, breakdowns, persist],
  );

  const removePhoto = useCallback(
    async (breakdownId: string, photoId: string) => {
      const next = breakdowns.map((b) =>
        b.id === breakdownId
          ? { ...b, photos: b.photos.filter((p) => p.id !== photoId) }
          : b,
      );
      await persist(next);
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
      addPhoto,
      removePhoto,
    };
  }, [
    breakdowns,
    isReady,
    reportBreakdown,
    confirmRepair,
    removeBreakdown,
    addPhoto,
    removePhoto,
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
