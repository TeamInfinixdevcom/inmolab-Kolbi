"use client";

import { onIdTokenChanged, type User } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { roleFromClaims, type Role } from "@/lib/rbac";
import { DEFAULT_AVATAR_ID, isAvatarId } from "@/lib/avatar-catalog";

type RBACContextValue = {
  user: User | null;
  role: Role;
  loading: boolean;
  avatarId: string | null;
  avatarLoading: boolean;
  avatarError: string | null;
  setAvatarId: (avatarId: string) => void;
};

const RBACContext = createContext<RBACContextValue | null>(null);

export function RBACProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>("AGENTE");
  const [loading, setLoading] = useState(true);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarRequestId = useRef(0);
  const refreshedRoleUid = useRef<string | null>(null);
  const updateAvatarId = useCallback((nextAvatarId: string) => {
    setAvatarId(nextAvatarId);
    setAvatarError(null);
  }, []);

  useEffect(() => {
    if (!auth) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    return onIdTokenChanged(auth, async (nextUser) => {
      const requestId = ++avatarRequestId.current;
      const isCurrentRequest = () => requestId === avatarRequestId.current;
      setUser(nextUser);
      setLoading(true);
      setAvatarId(null);
      setAvatarError(null);

      if (!nextUser) {
        refreshedRoleUid.current = null;
        setRole("AGENTE");
        setAvatarLoading(false);
        setLoading(false);
        return;
      }

      setAvatarLoading(true);

      try {
        let token = await nextUser.getIdTokenResult();
        if (!isCurrentRequest()) return;
        if (refreshedRoleUid.current !== nextUser.uid) {
          refreshedRoleUid.current = nextUser.uid;
          try {
            token = await nextUser.getIdTokenResult(true);
          } catch (refreshError) {
            console.error("No se pudo actualizar el rol de la sesión; se usará el rol disponible.", refreshError);
          }
          if (!isCurrentRequest()) return;
        }
        const nextRole = roleFromClaims(token.claims);
        setRole(nextRole);
        if (db) {
          try {
            await setDoc(doc(db, "users", nextUser.uid), {
              uid: nextUser.uid,
              email: nextUser.email ?? "",
              displayName: nextUser.displayName ?? nextUser.email ?? "Usuario",
              role: nextRole,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
          } catch (directoryError) {
            console.error("No se pudo actualizar el directorio de usuarios.", directoryError);
          }
        }
      } catch (error) {
        console.error("No se pudo leer el rol del usuario.", error);
        if (!isCurrentRequest()) return;
        setRole("AGENTE");
      }

      setAvatarLoading(true);
      setAvatarError(null);
      try {
        const idToken = await nextUser.getIdToken();
        const response = await fetch("/api/avatar", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(typeof result.error === "string" ? result.error : "No se pudo cargar el avatar.");
        }
        if (!isCurrentRequest()) return;
        setAvatarId(isAvatarId(result.avatarId) ? result.avatarId : DEFAULT_AVATAR_ID);
      } catch (error) {
        if (!isCurrentRequest()) return;
        setAvatarId(DEFAULT_AVATAR_ID);
        setAvatarError(error instanceof Error ? error.message : "No se pudo cargar el avatar.");
      } finally {
        if (isCurrentRequest()) {
          setAvatarLoading(false);
          setLoading(false);
        }
      }
    });
  }, []);

  const value = useMemo(() => ({
    user,
    role,
    loading,
    avatarId,
    avatarLoading,
    avatarError,
    setAvatarId: updateAvatarId,
  }), [avatarError, avatarId, avatarLoading, loading, role, updateAvatarId, user]);

  return <RBACContext.Provider value={value}>{children}</RBACContext.Provider>;
}

export function useRBAC(): RBACContextValue {
  const context = useContext(RBACContext);

  if (!context) {
    throw new Error("useRBAC debe utilizarse dentro de RBACProvider");
  }

  return context;
}
