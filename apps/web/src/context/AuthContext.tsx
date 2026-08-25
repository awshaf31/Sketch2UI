import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { PublicUser } from "@sketch2ui/shared-types";
import { api, ApiError } from "../services/api.js";

// Mounted once at the App root, same pattern as ToastProvider/DialogProvider
// (see App.tsx) — a `useAuth()` hook callable from anywhere without prop-drilling.
// ProtectedRoute is the ONLY gate that acts on `status`; individual pages never run
// their own "am I logged in" check.

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

interface AuthContextValue {
  status: AuthStatus;
  user: PublicUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-runs the initial /me check — lets an "error" screen offer a real retry. */
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);

  const refresh = useCallback(() => {
    setStatus("loading");
    api
      .me()
      .then((u) => {
        setUser(u);
        setStatus("authenticated");
      })
      .catch((e) => {
        setUser(null);
        // A clean 401 means "not logged in"; anything else (network down, 500) is a
        // real error — ProtectedRoute treats the two differently rather than
        // silently redirecting to /login on a server outage.
        setStatus(e instanceof ApiError && e.status === 401 ? "unauthenticated" : "error");
      });
  }, []);

  useEffect(refresh, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const u = await api.login(email, password);
    setUser(u);
    setStatus("authenticated");
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const u = await api.register(email, password);
    setUser(u);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
