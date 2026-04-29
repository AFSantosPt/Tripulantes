import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { newId } from "@/utils/id";

const STORAGE_KEY = "@crew-fleet-hub/auth/v1";
const ROSTER_KEY = "@crew-fleet-hub/roster/v1";

export interface CrewMember {
  id: string;
  name: string;
  crewId: string;
  createdAt: string;
}

interface AuthState {
  user: CrewMember | null;
  roster: CrewMember[];
  isReady: boolean;
  signIn: (name: string, crewId: string) => Promise<CrewMember>;
  signOut: () => Promise<void>;
  resumeAs: (member: CrewMember) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CrewMember | null>(null);
  const [roster, setRoster] = useState<CrewMember[]>([]);
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const [savedUser, savedRoster] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(ROSTER_KEY),
        ]);
        if (savedUser) setUser(JSON.parse(savedUser));
        if (savedRoster) setRoster(JSON.parse(savedRoster));
      } catch (e) {
        console.warn("Auth load error", e);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const persistRoster = useCallback(async (next: CrewMember[]) => {
    setRoster(next);
    await AsyncStorage.setItem(ROSTER_KEY, JSON.stringify(next));
  }, []);

  const signIn = useCallback(
    async (name: string, crewId: string) => {
      const trimmedName = name.trim();
      const trimmedId = crewId.trim();
      let existing = roster.find(
        (m) =>
          m.crewId.toLowerCase() === trimmedId.toLowerCase() ||
          m.name.toLowerCase() === trimmedName.toLowerCase(),
      );
      let nextRoster = roster;
      if (!existing) {
        existing = {
          id: newId(),
          name: trimmedName,
          crewId: trimmedId,
          createdAt: new Date().toISOString(),
        };
        nextRoster = [...roster, existing];
        await persistRoster(nextRoster);
      } else if (
        existing.name !== trimmedName ||
        existing.crewId !== trimmedId
      ) {
        nextRoster = roster.map((m) =>
          m.id === existing!.id
            ? { ...m, name: trimmedName, crewId: trimmedId }
            : m,
        );
        existing = { ...existing, name: trimmedName, crewId: trimmedId };
        await persistRoster(nextRoster);
      }
      setUser(existing);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      return existing;
    },
    [roster, persistRoster],
  );

  const signOut = useCallback(async () => {
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const resumeAs = useCallback(async (member: CrewMember) => {
    setUser(member);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(member));
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, roster, isReady, signIn, signOut, resumeAs }),
    [user, roster, isReady, signIn, signOut, resumeAs],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
