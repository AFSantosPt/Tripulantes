import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { NetworkError, apiFetch } from "@/utils/apiClient";

const SESSION_KEY = "@tripulante-gestao/session/v2";

export type AccountStatus = "pending" | "active" | "inactive";

export type CrewCategory = "guarda-freio" | "motorista" | "ascensor" | "outro";

export const ALL_CREW_CATEGORIES: CrewCategory[] = [
  "guarda-freio",
  "motorista",
  "ascensor",
  "outro",
];

export const CREW_CATEGORY_LABELS: Record<CrewCategory, string> = {
  "guarda-freio": "Eléctrico",
  motorista: "Autocarro",
  ascensor: "Ascensor",
  outro: "Outro",
};

export interface CrewMember {
  id: string;
  name: string;
  crewId: string;
  nickname?: string;
  phone?: string;
  folgaGroup?: string;
  status: AccountStatus;
  isAdmin: boolean;
  categories: CrewCategory[];
  categoryOtherLabel?: string;
  createdAt: string;
  approvedAt?: string;
  approvedById?: string;
  lastSeenAt?: string;
}

export type RegisterResult =
  | { ok: true; autoActivated: boolean; member: CrewMember }
  | { ok: false; error: string };

export type SignInResult =
  | { ok: true; member: CrewMember }
  | { ok: false; error: string };

export interface EditMemberFields {
  name?: string;
  nickname?: string;
  crewId?: string;
  categories?: CrewCategory[];
  categoryOtherLabel?: string;
  folgaGroup?: string;
}

interface AuthState {
  user: CrewMember | null;
  members: CrewMember[];
  pendingMembers: CrewMember[];
  activeMembers: CrewMember[];
  inactiveMembers: CrewMember[];
  isReady: boolean;
  isFirstSetup: boolean;
  signIn: (crewId: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  registerRequest: (input: {
    name: string;
    crewId: string;
    password: string;
    categories: CrewCategory[];
  }) => Promise<RegisterResult>;
  approveMember: (id: string) => Promise<void>;
  rejectMember: (id: string) => Promise<void>;
  toggleAdmin: (id: string) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  editMember: (id: string, fields: EditMemberFields) => Promise<{ ok: true } | { ok: false; error: string }>;
  deactivateMember: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  reactivateMember: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  resetMemberPassword: (id: string) => Promise<{ ok: true; tempPassword: string } | { ok: false; error: string }>;
  updateCategories: (
    memberId: string,
    categories: CrewCategory[],
    categoryOtherLabel?: string,
  ) => Promise<void>;
  changePassword: (input: {
    current: string;
    next: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  updateNickname: (nickname: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  updatePhone: (phone: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  updateFolgaGroup: (group: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  updateName: (name: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  adminUpdateName: (memberId: string, name: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  refreshMembers: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CrewMember | null>(null);
  const [members, setMembers] = useState<CrewMember[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isFirstSetup, setIsFirstSetup] = useState<boolean>(false);

  const fetchMembers = useCallback(async (adminId: string) => {
    try {
      const res = await apiFetch("/api/auth/members", { memberId: adminId });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members as CrewMember[]);
      }
    } catch {
    }
  }, []);

  const fetchActiveMembers = useCallback(async (memberId: string) => {
    try {
      const res = await apiFetch("/api/auth/active-members", { memberId });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members as CrewMember[]);
      }
    } catch {
    }
  }, []);

  const fetchMe = useCallback(async (id: string): Promise<CrewMember | null> => {
    try {
      const res = await apiFetch("/api/auth/me", { memberId: id });
      if (res.ok) {
        const data = await res.json();
        return data.member as CrewMember;
      }
    } catch {
    }
    return null;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const rawSession = await AsyncStorage.getItem(SESSION_KEY);
        if (rawSession) {
          const id: string = JSON.parse(rawSession);
          const me = await fetchMe(id);
          if (me) {
            setUser(me);
            setSessionId(id);
            if (me.isAdmin) {
              await fetchMembers(id);
            } else if (me.status === "active") {
              await fetchActiveMembers(id);
            }
          } else {
            await AsyncStorage.removeItem(SESSION_KEY);
            const statusRes = await apiFetch("/api/auth/status");
            if (statusRes.ok) {
              const { hasAdmin } = await statusRes.json();
              setIsFirstSetup(!hasAdmin);
            }
          }
        } else {
          const statusRes = await apiFetch("/api/auth/status");
          if (statusRes.ok) {
            const { hasAdmin } = await statusRes.json();
            setIsFirstSetup(!hasAdmin);
          }
        }
      } catch {
      } finally {
        setIsReady(true);
      }
    })();
  }, [fetchMe, fetchMembers, fetchActiveMembers]);

  const persistSession = useCallback(
    async (member: CrewMember | null) => {
      setUser(member);
      if (member) {
        setSessionId(member.id);
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(member.id));
      } else {
        setSessionId(null);
        setMembers([]);
        await AsyncStorage.removeItem(SESSION_KEY);
      }
    },
    [],
  );

  const refreshMembers = useCallback(async () => {
    const id = sessionId ?? user?.id;
    if (!id) return;
    if (user?.isAdmin) {
      await fetchMembers(id);
    } else if (user?.status === "active") {
      await fetchActiveMembers(id);
    }
  }, [sessionId, user, fetchMembers, fetchActiveMembers]);

  const signIn = useCallback<AuthState["signIn"]>(
    async (crewId, password) => {
      if (!crewId.trim()) return { ok: false, error: "Indica o teu Nº Tripulante" };
      if (!password) return { ok: false, error: "Indica a tua password" };
      try {
        const res = await apiFetch("/api/auth/signin", {
          method: "POST",
          body: JSON.stringify({ crewId, password }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error ?? "Erro ao entrar" };
        const member = data.member as CrewMember;
        await persistSession(member);
        if (member.isAdmin) {
          await fetchMembers(member.id);
        } else if (member.status === "active") {
          await fetchActiveMembers(member.id);
        }
        return { ok: true, member };
      } catch (err) {
        const msg = err instanceof NetworkError ? err.message : "Sem ligação ao servidor";
        return { ok: false, error: msg };
      }
    },
    [persistSession, fetchMembers, fetchActiveMembers],
  );

  const signOut = useCallback(async () => {
    await persistSession(null);
  }, [persistSession]);

  const registerRequest = useCallback<AuthState["registerRequest"]>(
    async ({ name, crewId, password, categories }) => {
      try {
        const res = await apiFetch("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ name, crewId, password, categories }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error ?? "Erro ao registar" };
        const member = data.member as CrewMember;
        if (data.autoActivated) {
          await persistSession(member);
        }
        return { ok: true, autoActivated: data.autoActivated, member };
      } catch (err) {
        const msg = err instanceof NetworkError ? err.message : "Sem ligação ao servidor";
        return { ok: false, error: msg };
      }
    },
    [persistSession],
  );

  const approveMember = useCallback(
    async (id: string) => {
      if (!user?.isAdmin) return;
      try {
        const res = await apiFetch(`/api/auth/members/${id}/approve`, {
          method: "POST",
          memberId: user.id,
        });
        if (res.ok) await fetchMembers(user.id);
      } catch {
      }
    },
    [user, fetchMembers],
  );

  const rejectMember = useCallback(
    async (id: string) => {
      if (!user?.isAdmin) return;
      try {
        await apiFetch(`/api/auth/members/${id}`, {
          method: "DELETE",
          memberId: user.id,
        });
        await fetchMembers(user.id);
      } catch {
      }
    },
    [user, fetchMembers],
  );

  const toggleAdmin = useCallback(
    async (id: string) => {
      if (!user?.isAdmin) return;
      try {
        const res = await apiFetch(`/api/auth/members/${id}/toggle-admin`, {
          method: "POST",
          memberId: user.id,
        });
        if (res.ok) {
          const data = await res.json();
          const updated = data.member as CrewMember;
          await fetchMembers(user.id);
          if (id === user.id) setUser(updated);
        }
      } catch {
      }
    },
    [user, fetchMembers],
  );

  const removeMember = useCallback(
    async (id: string) => {
      if (!user?.isAdmin || id === user.id) return;
      try {
        await apiFetch(`/api/auth/members/${id}`, {
          method: "DELETE",
          memberId: user.id,
        });
        await fetchMembers(user.id);
      } catch {
      }
    },
    [user, fetchMembers],
  );

  const updateCategories = useCallback(
    async (memberId: string, categories: CrewCategory[], categoryOtherLabel?: string) => {
      if (!user) return;
      try {
        const res = await apiFetch(`/api/auth/members/${memberId}/categories`, {
          method: "POST",
          memberId: user.id,
          body: JSON.stringify({ categories, categoryOtherLabel }),
        });
        if (res.ok) {
          const data = await res.json();
          const updated = data.member as CrewMember;
          if (memberId === user.id) setUser(updated);
          if (user.isAdmin) await fetchMembers(user.id);
        }
      } catch {
      }
    },
    [user, fetchMembers],
  );

  const changePassword = useCallback<AuthState["changePassword"]>(
    async ({ current, next: nextPassword }) => {
      if (!user) return { ok: false, error: "Sessão inválida" };
      try {
        const res = await apiFetch("/api/auth/change-password", {
          method: "POST",
          memberId: user.id,
          body: JSON.stringify({ current, next: nextPassword }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error ?? "Erro" };
        setUser(data.member as CrewMember);
        return { ok: true };
      } catch (err) {
        const msg = err instanceof NetworkError ? err.message : "Sem ligação ao servidor";
        return { ok: false, error: msg };
      }
    },
    [user],
  );

  const updateNickname = useCallback<AuthState["updateNickname"]>(
    async (nickname) => {
      if (!user) return { ok: false, error: "Sessão inválida" };
      try {
        const res = await apiFetch("/api/auth/nickname", {
          method: "PATCH",
          memberId: user.id,
          body: JSON.stringify({ nickname }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error ?? "Erro" };
        setUser(data.member as CrewMember);
        return { ok: true };
      } catch (err) {
        const msg = err instanceof NetworkError ? err.message : "Sem ligação ao servidor";
        return { ok: false, error: msg };
      }
    },
    [user],
  );

  const updatePhone = useCallback<AuthState["updatePhone"]>(
    async (phone) => {
      if (!user) return { ok: false, error: "Sessão inválida" };
      try {
        const res = await apiFetch("/api/auth/phone", {
          method: "PATCH",
          memberId: user.id,
          body: JSON.stringify({ phone }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error ?? "Erro" };
        setUser(data.member as CrewMember);
        return { ok: true };
      } catch (err) {
        const msg = err instanceof NetworkError ? err.message : "Sem ligação ao servidor";
        return { ok: false, error: msg };
      }
    },
    [user],
  );

  const updateFolgaGroup = useCallback<AuthState["updateFolgaGroup"]>(
    async (group) => {
      if (!user) return { ok: false, error: "Sessão inválida" };
      try {
        const res = await apiFetch("/api/auth/folga-group", {
          method: "PATCH",
          memberId: user.id,
          body: JSON.stringify({ folgaGroup: group }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error ?? "Erro" };
        setUser(data.member as CrewMember);
        return { ok: true };
      } catch (err) {
        const msg = err instanceof NetworkError ? err.message : "Sem ligação ao servidor";
        return { ok: false, error: msg };
      }
    },
    [user],
  );

  const updateName = useCallback<AuthState["updateName"]>(
    async (name) => {
      if (!user) return { ok: false, error: "Sessão inválida" };
      try {
        const res = await apiFetch("/api/auth/name", {
          method: "PATCH",
          memberId: user.id,
          body: JSON.stringify({ name }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error ?? "Erro" };
        setUser(data.member as CrewMember);
        return { ok: true };
      } catch (err) {
        const msg = err instanceof NetworkError ? err.message : "Sem ligação ao servidor";
        return { ok: false, error: msg };
      }
    },
    [user],
  );

  const editMember = useCallback<AuthState["editMember"]>(
    async (id, fields) => {
      if (!user?.isAdmin) return { ok: false, error: "Sem permissão" };
      try {
        const res = await apiFetch(`/api/auth/members/${id}`, {
          method: "PATCH",
          memberId: user.id,
          body: JSON.stringify(fields),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error ?? "Erro" };
        const updated = data.member as CrewMember;
        if (id === user.id) setUser(updated);
        await fetchMembers(user.id);
        return { ok: true };
      } catch (err) {
        const msg = err instanceof NetworkError ? err.message : "Sem ligação ao servidor";
        return { ok: false, error: msg };
      }
    },
    [user, fetchMembers],
  );

  const deactivateMember = useCallback<AuthState["deactivateMember"]>(
    async (id) => {
      if (!user?.isAdmin) return { ok: false, error: "Sem permissão" };
      try {
        const res = await apiFetch(`/api/auth/members/${id}/deactivate`, {
          method: "PATCH",
          memberId: user.id,
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error ?? "Erro" };
        await fetchMembers(user.id);
        return { ok: true };
      } catch (err) {
        const msg = err instanceof NetworkError ? err.message : "Sem ligação ao servidor";
        return { ok: false, error: msg };
      }
    },
    [user, fetchMembers],
  );

  const reactivateMember = useCallback<AuthState["reactivateMember"]>(
    async (id) => {
      if (!user?.isAdmin) return { ok: false, error: "Sem permissão" };
      try {
        const res = await apiFetch(`/api/auth/members/${id}/reactivate`, {
          method: "PATCH",
          memberId: user.id,
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error ?? "Erro" };
        await fetchMembers(user.id);
        return { ok: true };
      } catch (err) {
        const msg = err instanceof NetworkError ? err.message : "Sem ligação ao servidor";
        return { ok: false, error: msg };
      }
    },
    [user, fetchMembers],
  );

  const resetMemberPassword = useCallback<AuthState["resetMemberPassword"]>(
    async (id) => {
      if (!user?.isAdmin) return { ok: false, error: "Sem permissão" };
      try {
        const res = await apiFetch(`/api/auth/members/${id}/reset-password`, {
          method: "POST",
          memberId: user.id,
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error ?? "Erro" };
        return { ok: true, tempPassword: data.tempPassword as string };
      } catch (err) {
        const msg = err instanceof NetworkError ? err.message : "Sem ligação ao servidor";
        return { ok: false, error: msg };
      }
    },
    [user],
  );

  const adminUpdateName = useCallback<AuthState["adminUpdateName"]>(
    async (memberId, name) => {
      if (!user) return { ok: false, error: "Sessão inválida" };
      try {
        const res = await apiFetch(`/api/auth/members/${memberId}/name`, {
          method: "PATCH",
          memberId: user.id,
          body: JSON.stringify({ name }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error ?? "Erro" };
        const updated = data.member as CrewMember;
        if (memberId === user.id) setUser(updated);
        await fetchMembers(user.id);
        return { ok: true };
      } catch (err) {
        const msg = err instanceof NetworkError ? err.message : "Sem ligação ao servidor";
        return { ok: false, error: msg };
      }
    },
    [user, fetchMembers],
  );

  const value = useMemo<AuthState>(() => {
    const pending = members.filter((m) => m.status === "pending");
    const active = members.filter((m) => m.status === "active");
    const inactive = members.filter((m) => m.status === "inactive");
    return {
      user,
      members,
      pendingMembers: pending,
      activeMembers: active,
      inactiveMembers: inactive,
      isReady,
      isFirstSetup,
      signIn,
      signOut,
      registerRequest,
      approveMember,
      rejectMember,
      toggleAdmin,
      removeMember,
      editMember,
      deactivateMember,
      reactivateMember,
      resetMemberPassword,
      updateCategories,
      changePassword,
      updateNickname,
      updatePhone,
      updateFolgaGroup,
      updateName,
      adminUpdateName,
      refreshMembers,
    };
  }, [
    user,
    members,
    isReady,
    isFirstSetup,
    signIn,
    signOut,
    registerRequest,
    approveMember,
    rejectMember,
    toggleAdmin,
    removeMember,
    editMember,
    deactivateMember,
    reactivateMember,
    resetMemberPassword,
    updateCategories,
    changePassword,
    updateNickname,
    updatePhone,
    updateFolgaGroup,
    updateName,
    adminUpdateName,
    refreshMembers,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
