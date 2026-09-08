import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { api, clearToken, getToken, setToken } from "../api/client";

export interface Consultant {
  id: string;
  email: string;
  fullName: string;
  professionalTitle?: string | null;
  phone?: string | null;
  clinicName?: string | null;
  clinicAddress?: string | null;
  profileImageUrl?: string | null;
  defaultLanguage: string;
  timeZone: string;
  dateFormat: string;
  defaultVisitDurationMinutes: number;
  sessionTimeoutMinutes: number;
}

interface AuthContextValue {
  consultant: Consultant | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setConsultant: (c: Consultant) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [consultant, setConsultantState] = useState<Consultant | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setConsultantState(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get("/auth/me");
      setConsultantState(res.data.consultant);
    } catch {
      clearToken();
      setConsultantState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean) => {
    const res = await api.post("/auth/login", { email, password, rememberMe });
    setToken(res.data.token, rememberMe);
    setConsultantState(res.data.consultant);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore network errors on logout
    }
    clearToken();
    setConsultantState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ consultant, loading, login, logout, refresh, setConsultant: setConsultantState }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
