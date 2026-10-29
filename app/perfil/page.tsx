"use client";

import { useState } from "react";
import { Check, RotateCw } from "lucide-react";
import { useRBAC } from "@/components/auth/rbac-provider";
import { AvatarImage } from "@/components/avatar/avatar-image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import {
  AVATAR_CATALOG,
  DEFAULT_AVATAR_ID,
  isAvatarId,
} from "@/lib/avatar-catalog";

type SaveStatus = "loading" | "saving" | "saved" | "error";
type SaveState = {
  uid: string;
  status: SaveStatus;
  errorMessage?: string;
};

export default function PerfilPage() {
  const {
    user,
    role,
    loading,
    avatarId,
    avatarLoading,
    avatarError,
    setAvatarId,
  } = useRBAC();
  const [pendingSelection, setPendingSelection] = useState<{
    uid: string;
    avatarId: string;
  } | null>(null);
  const [saveState, setSaveState] = useState<SaveState | null>(null);
  const userSaveState = user && saveState?.uid === user.uid ? saveState : null;
  const saveStatus: SaveStatus = loading || avatarLoading
    ? "loading"
    : userSaveState?.status ?? (avatarError ? "error" : "saved");
  const errorMessage = userSaveState?.errorMessage ?? avatarError ?? "";
  const selectedAvatarId = user && pendingSelection?.uid === user.uid
    ? pendingSelection.avatarId
    : isAvatarId(avatarId) ? avatarId : DEFAULT_AVATAR_ID;

  async function saveAvatar(nextAvatarId: string) {
    if (!user || !isAvatarId(nextAvatarId)) return;

    setPendingSelection({ uid: user.uid, avatarId: nextAvatarId });
    setSaveState({ uid: user.uid, status: "saving" });

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/avatar", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatarId: nextAvatarId }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "No se pudo guardar el avatar.",
        );
      }

      if (auth?.currentUser?.uid !== user.uid) return;
      setAvatarId(nextAvatarId);
      setSaveState({ uid: user.uid, status: "saved" });
    } catch (error) {
      setSaveState({
        uid: user.uid,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "No se pudo guardar el avatar.",
      });
    }
  }

  const currentAvatarId = selectedAvatarId;

  if (loading) {
    return (
      <section className="p-8 text-center text-muted-foreground" role="status">
        Cargando perfil...
      </section>
    );
  }

  if (!user) {
    return (
      <section className="rounded-lg border border-dashed p-10 text-center">
        <h1 className="text-2xl font-bold">Mi perfil</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Iniciá sesión para consultar tu perfil.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">Tu espacio personal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Mi perfil</h1>
        <p className="mt-2 text-muted-foreground">
          Elegí la imagen que te identifica en INMOLAB y en el mapa.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Elegí tu avatar</CardTitle>
          <p className="text-sm text-muted-foreground">
            Podés cambiar tu selección cuando querás. Se guarda automáticamente.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 rounded-xl border bg-muted/20 p-4">
            <span className="inline-flex overflow-hidden rounded-full border bg-background">
              <AvatarImage
                avatarId={currentAvatarId}
                size={72}
                alt={`Avatar de ${user.displayName || "usuario"}`}
                className="rounded-full"
              />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-semibold">
                {user.displayName || "Usuario INMOLAB"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {avatarLoading ? "Cargando tu selección..." : "Tu avatar actual"}
              </p>
              <p
                role={saveStatus === "error" ? "alert" : "status"}
                aria-live="polite"
                className={`mt-1 text-sm ${
                  saveStatus === "error" ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {saveStatus === "loading" && "Cargando galería..."}
                {saveStatus === "saving" && "Guardando selección..."}
                {saveStatus === "saved" && "Avatar guardado correctamente."}
                {saveStatus === "error" && errorMessage}
              </p>
            </div>
          </div>

          <div
            role="region"
            aria-label="Galería de avatares"
            aria-busy={avatarLoading || saveStatus === "saving"}
            className="grid max-h-[62vh] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
          >
            {AVATAR_CATALOG.map((avatar) => {
              const selected = currentAvatarId === avatar.id;
              return (
                <button
                  key={avatar.id}
                  type="button"
                  aria-label={`${avatar.name}${selected ? ", avatar seleccionado" : ", seleccionar avatar"}`}
                  aria-pressed={selected}
                  disabled={avatarLoading || saveStatus === "saving"}
                  onClick={() => void saveAvatar(avatar.id)}
                  className={`ios-interactive group relative rounded-xl border p-2 text-left hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-70 ${
                    selected
                      ? "border-primary bg-primary/5 ring-2 ring-primary"
                      : "border-border bg-background"
                  }`}
                >
                  <span className="relative block aspect-square overflow-hidden rounded-lg bg-muted">
                    <AvatarImage
                      avatarId={avatar.id}
                      size={192}
                      alt={avatar.name}
                      className="h-full w-full"
                      fill
                    />
                  </span>
                  <span className="mt-2 flex min-h-6 items-center justify-between gap-2 px-1 text-sm font-medium">
                    {avatar.name}
                    {selected && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-primary">
                        <Check size={15} aria-hidden="true" />
                        <span className="sr-only">Seleccionado</span>
                      </span>
                    )}
                  </span>
                  {selected && (
                    <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
                      Seleccionado
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {saveStatus === "error" && !avatarLoading && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void saveAvatar(currentAvatarId)}
            >
              <RotateCw size={16} className="mr-2" />
              Reintentar guardado
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la cuenta</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Nombre</p>
            <p className="mt-1 font-medium">
              {user.displayName || "Sin nombre registrado"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Correo electrónico</p>
            <p className="mt-1 break-all font-medium">
              {user.email || "Sin correo registrado"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Rol</p>
            <p className="mt-1 font-medium">{role}</p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
