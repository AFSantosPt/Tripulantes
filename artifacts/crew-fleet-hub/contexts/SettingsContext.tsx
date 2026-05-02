import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/utils/apiClient";

export interface AppSettings {
  nightStart: string;
  nightEnd: string;
}

interface SettingsState {
  settings: AppSettings;
  isReady: boolean;
  updateSettings: (fields: Partial<AppSettings>) => Promise<void>;
  refresh: () => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = { nightStart: "22:00", nightEnd: "06:00" };

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isReady, setIsReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings ?? DEFAULT_SETTINGS);
      }
    } catch {}
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  const updateSettings = useCallback(
    async (fields: Partial<AppSettings>) => {
      if (!user) return;
      const res = await apiFetch("/api/settings", {
        method: "PUT",
        memberId: user.id,
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings ?? DEFAULT_SETTINGS);
      }
    },
    [user],
  );

  return (
    <SettingsContext.Provider value={{ settings, isReady, updateSettings, refresh }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
