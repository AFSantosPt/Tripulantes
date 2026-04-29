import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { hashPassword, verifyPassword } from "@/utils/hash";
import { newId } from "@/utils/id";

const SESSION_KEY = "@tripulante-gestao/session/v2";
const MEMBERS_KEY = "@tripulante-gestao/members/v2";

const DEFAULT_ADMIN = {
  name: "André Santos",
  crewId: "180939",
  password: "andres91",
};

export type AccountStatus = "pending" | "active";

export interface CrewMember {
  id: string;
  name: string;
  crewId: string;
  passwordHash: string;
  status: AccountStatus;
  isAdmin: boolean;
  createdAt: string;
  approvedAt?: string;
  approvedById?: string;
}

export type RegisterResult =
  | { ok: true; autoActivated: boolean; member: CrewMember }
  | { ok: false; error: string };

export type SignInResult =
  | { ok: true; member: CrewMember }
  | { ok: false; error: string };

interface AuthState {
  user: CrewMember | null;
  members: CrewMember[];
  pendingMembers: CrewMember[];
  activeMembers: CrewMember[];
  isReady: boolean;
  isFirstSetup: boolean;
  signIn: (crewId: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  registerRequest: (input: {
    name: string;
    crewId: string;
    password: string;
  }) => Promise<RegisterResult>;
  approveMember: (id: string) => Promise<void>;
  rejectMember: (id: string) => Promise<void>;
  toggleAdmin: (id: string) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function normalizeCrewId(crewId: string): string {
  return crewId.trim().toLowerCase();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [members, setMembers] = useState<CrewMember[]>([]);
  const [user, setUser] = useState<CrewMember | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const [rawMembers, rawSession] = await Promise.all([
          AsyncStorage.getItem(MEMBERS_KEY),
          AsyncStorage.getItem(SESSION_KEY),
        ]);
        let loadedMembers: CrewMember[] = rawMembers
          ? JSON.parse(rawMembers)
          : [];
        if (loadedMembers.length === 0) {
          const seed: CrewMember = {
            id: newId(),
            name: DEFAULT_ADMIN.name,
            crewId: DEFAULT_ADMIN.crewId,
            passwordHash: hashPassword(DEFAULT_ADMIN.password),
            status: "active",
            isAdmin: true,
            createdAt: new Date().toISOString(),
            approvedAt: new Date().toISOString(),
          };
          loadedMembers = [seed];
          await AsyncStorage.setItem(
            MEMBERS_KEY,
            JSON.stringify(loadedMembers),
          );
        }
        setMembers(loadedMembers);
        if (rawSession) {
          const sessionId: string = JSON.parse(rawSession);
          const found = loadedMembers.find(
            (m) => m.id === sessionId && m.status === "active",
          );
          if (found) setUser(found);
        }
      } catch (e) {
        console.warn("Auth load error", e);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const persistMembers = useCallback(async (next: CrewMember[]) => {
    setMembers(next);
    await AsyncStorage.setItem(MEMBERS_KEY, JSON.stringify(next));
  }, []);

  const persistSession = useCallback(async (member: CrewMember | null) => {
    setUser(member);
    if (member) {
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(member.id));
    } else {
      await AsyncStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const signIn = useCallback<AuthState["signIn"]>(
    async (crewId, password) => {
      const id = normalizeCrewId(crewId);
      if (!id) return { ok: false, error: "Indica o teu Nº Tripulante" };
      if (!password) return { ok: false, error: "Indica a tua password" };
      const found = members.find(
        (m) => normalizeCrewId(m.crewId) === id,
      );
      if (!found) {
        return { ok: false, error: "Nº Tripulante não encontrado" };
      }
      if (!verifyPassword(password, found.passwordHash)) {
        return { ok: false, error: "Password incorreta" };
      }
      if (found.status === "pending") {
        return {
          ok: false,
          error: "Conta ainda não aprovada por um tripulante autorizado",
        };
      }
      await persistSession(found);
      return { ok: true, member: found };
    },
    [members, persistSession],
  );

  const signOut = useCallback(async () => {
    await persistSession(null);
  }, [persistSession]);

  const registerRequest = useCallback<AuthState["registerRequest"]>(
    async ({ name, crewId, password }) => {
      const trimmedName = name.trim();
      const trimmedCrewId = crewId.trim();
      if (!trimmedName) return { ok: false, error: "Indica o teu nome" };
      if (!trimmedCrewId)
        return { ok: false, error: "Indica o teu Nº Tripulante" };
      if (password.length < 4)
        return { ok: false, error: "Password tem de ter pelo menos 4 caracteres" };

      const idLower = normalizeCrewId(trimmedCrewId);
      const existing = members.find(
        (m) => normalizeCrewId(m.crewId) === idLower,
      );
      if (existing) {
        return { ok: false, error: "Já existe um pedido com este Nº Tripulante" };
      }

      const hasActiveAdmin = members.some(
        (m) => m.status === "active" && m.isAdmin,
      );
      const autoActivated = !hasActiveAdmin;

      const created: CrewMember = {
        id: newId(),
        name: trimmedName,
        crewId: trimmedCrewId,
        passwordHash: hashPassword(password),
        status: autoActivated ? "active" : "pending",
        isAdmin: autoActivated,
        createdAt: new Date().toISOString(),
        approvedAt: autoActivated ? new Date().toISOString() : undefined,
      };

      await persistMembers([...members, created]);
      if (autoActivated) {
        await persistSession(created);
      }
      return { ok: true, autoActivated, member: created };
    },
    [members, persistMembers, persistSession],
  );

  const approveMember = useCallback(
    async (id: string) => {
      if (!user?.isAdmin) return;
      const next = members.map((m) =>
        m.id === id
          ? {
              ...m,
              status: "active" as const,
              approvedAt: new Date().toISOString(),
              approvedById: user.id,
            }
          : m,
      );
      await persistMembers(next);
    },
    [members, persistMembers, user],
  );

  const rejectMember = useCallback(
    async (id: string) => {
      if (!user?.isAdmin) return;
      const next = members.filter((m) => m.id !== id);
      await persistMembers(next);
    },
    [members, persistMembers, user],
  );

  const toggleAdmin = useCallback(
    async (id: string) => {
      if (!user?.isAdmin) return;
      const target = members.find((m) => m.id === id);
      if (!target || target.status !== "active") return;
      const remainingAdmins = members.filter(
        (m) => m.status === "active" && m.isAdmin && m.id !== id,
      ).length;
      if (target.isAdmin && remainingAdmins === 0) {
        return;
      }
      const next = members.map((m) =>
        m.id === id ? { ...m, isAdmin: !m.isAdmin } : m,
      );
      await persistMembers(next);
      if (id === user.id) {
        const updated = next.find((m) => m.id === id);
        if (updated) await persistSession(updated);
      }
    },
    [members, persistMembers, persistSession, user],
  );

  const removeMember = useCallback(
    async (id: string) => {
      if (!user?.isAdmin) return;
      if (id === user.id) return;
      const target = members.find((m) => m.id === id);
      if (!target) return;
      if (target.isAdmin) {
        const remainingAdmins = members.filter(
          (m) => m.status === "active" && m.isAdmin && m.id !== id,
        ).length;
        if (remainingAdmins === 0) return;
      }
      await persistMembers(members.filter((m) => m.id !== id));
    },
    [members, persistMembers, user],
  );

  const value = useMemo<AuthState>(() => {
    const pending = members.filter((m) => m.status === "pending");
    const active = members.filter((m) => m.status === "active");
    const isFirstSetup = !active.some((m) => m.isAdmin);
    return {
      user,
      members,
      pendingMembers: pending,
      activeMembers: active,
      isReady,
      isFirstSetup,
      signIn,
      signOut,
      registerRequest,
      approveMember,
      rejectMember,
      toggleAdmin,
      removeMember,
    };
  }, [
    user,
    members,
    isReady,
    signIn,
    signOut,
    registerRequest,
    approveMember,
    rejectMember,
    toggleAdmin,
    removeMember,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
