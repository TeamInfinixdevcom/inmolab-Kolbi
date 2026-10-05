"use client";

import { onIdTokenChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { roleFromClaims, type Role } from "@/lib/rbac";

type RBACContextValue = {
  user: User | null;
  role: Role;
  loading: boolean;
};

const RBACContext = createContext<RBACContextValue | null>(null);

export function RBACProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>("AGENTE");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    return onIdTokenChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setRole("AGENTE");
        setLoading(false);
        return;
      }

      try {
        const token = await nextUser.getIdTokenResult();
        setRole(roleFromClaims(token.claims));
      } catch (error) {
        console.error("No se pudo leer el rol del usuario.", error);
        setRole("AGENTE");
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo(() => ({ user, role, loading }), [loading, role, user]);

  return <RBACContext.Provider value={value}>{children}</RBACContext.Provider>;
}

export function useRBAC(): RBACContextValue {
  const context = useContext(RBACContext);

  if (!context) {
    throw new Error("useRBAC debe utilizarse dentro de RBACProvider");
  }

  return context;
}
