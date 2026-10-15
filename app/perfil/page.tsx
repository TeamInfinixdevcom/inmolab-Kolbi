"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRBAC } from "@/components/auth/rbac-provider";
import {
  MiiAvatar,
  MII_GENDERS,
  defaultMiiAppearance,
  SKIN_TONES,
  HAIR_COLORS,
  HAIR_STYLES,
  SHIRT_COLORS,
  type MiiAppearance,
} from "@/components/avatar/mii-avatar";

const MiiAvatar3D = dynamic(
  () => import("@/components/avatar/mii-avatar-3d"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[180px] w-[180px] items-center justify-center text-sm text-muted-foreground">
        Cargando avatar 3D...
      </div>
    ),
  },
);

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function seedFromUid(uid: string): number {
  let hash = 0;
  for (let index = 0; index < uid.length; index += 1) {
    hash = (hash * 31 + uid.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function isMiiAppearance(value: unknown): value is MiiAppearance {
  if (!value || typeof value !== "object") return false;

  const appearance = value as Record<string, unknown>;

  return (
    Number.isInteger(appearance.skinTone) &&
    typeof appearance.skinTone === "number" &&
    appearance.skinTone >= 0 &&
    appearance.skinTone < SKIN_TONES.length &&
    Number.isInteger(appearance.hairColor) &&
    typeof appearance.hairColor === "number" &&
    appearance.hairColor >= 0 &&
    appearance.hairColor < HAIR_COLORS.length &&
    Number.isInteger(appearance.shirtColor) &&
    typeof appearance.shirtColor === "number" &&
    appearance.shirtColor >= 0 &&
    appearance.shirtColor < SHIRT_COLORS.length &&
    (appearance.hairStyle === undefined ||
      (Number.isInteger(appearance.hairStyle) &&
        typeof appearance.hairStyle === "number" &&
        appearance.hairStyle >= 0 &&
        appearance.hairStyle <= 2))
  );
}

type SaveStatus = "idle" | "loading" | "saving" | "saved" | "error";

export default function PerfilPage() {
  const { user, role, loading } = useRBAC();
  const [appearance, setAppearance] = useState<MiiAppearance | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const seed = user ? seedFromUid(user.uid) : 1;
  const currentAppearance = appearance ?? defaultMiiAppearance(seed);

  const saveAppearance = useCallback(async (
    nextAppearance: MiiAppearance,
  ): Promise<boolean> => {
    if (!user) return false;

    setSaveStatus("saving");
    setErrorMessage("");

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/avatar", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ appearance: nextAppearance }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "No se pudo guardar el avatar.",
        );
      }

      setSaveStatus("saved");
      return true;
    } catch (error) {
      setSaveStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el avatar.",
      );
      return false;
    }
  }, [user]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setAppearance(null);
      setSaveStatus("idle");
      return;
    }

    const currentUser = user;
    let cancelled = false;

    async function loadAppearance() {
      setSaveStatus("loading");
      setErrorMessage("");

      try {
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/avatar", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            typeof result.error === "string"
              ? result.error
              : "No se pudo cargar el avatar.",
          );
        }

        if (cancelled) return;

        if (isMiiAppearance(result.appearance)) {
          setAppearance(result.appearance);
        } else {
          const initialAppearance = defaultMiiAppearance(seedFromUid(currentUser.uid));
          setAppearance(initialAppearance);
          await saveAppearance(initialAppearance);
          return;
        }

        setSaveStatus("saved");
      } catch (error) {
        if (cancelled) return;
        setSaveStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo cargar el avatar.",
        );
      }
    }

    void loadAppearance();

    return () => {
      cancelled = true;
    };
  }, [loading, user, saveAppearance]);

  const updateAppearance = (nextAppearance: MiiAppearance) => {
    setAppearance(nextAppearance);
    void saveAppearance(nextAppearance);
  };

  if (loading) {
    return (
      <section className="p-8 text-center text-muted-foreground">
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
    <section className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">Tu espacio personal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Mi perfil</h1>
        <p className="mt-2 text-muted-foreground">
          Personalizá tu Mii para identificarte en INMOLAB y en el mapa.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Personalizá tu avatar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-4 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-start">
            <div className="rounded-2xl border bg-background p-3">
              <MiiAvatar3D
                seed={seed}
                size={180}
                appearance={currentAppearance}
                interactive
              />
            </div>
            <div className="space-y-2 text-center sm:pt-5 sm:text-left">
              <h2 className="text-xl font-semibold">
                {user.displayName || "Usuario INMOLAB"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Tu apariencia se guarda automáticamente.
              </p>
              <p
                role="status"
                aria-live="polite"
                className={`text-sm ${
                  saveStatus === "error"
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {saveStatus === "loading" && "Cargando tu Mii..."}
                {saveStatus === "saving" && "Guardando cambios..."}
                {saveStatus === "saved" && "Mii guardado correctamente."}
                {saveStatus === "error" && errorMessage}
                {saveStatus === "idle" && ""}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Tipo de avatar</h3>
            <div className="flex flex-wrap gap-3">
              {MII_GENDERS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={(currentAppearance.gender ?? "male") === option.value ? "default" : "outline"}
                  aria-pressed={(currentAppearance.gender ?? "male") === option.value}
                  disabled={saveStatus === "saving" || saveStatus === "loading"}
                  onClick={() => updateAppearance({ ...currentAppearance, gender: option.value })}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <h3 className="font-semibold">Tono de piel</h3>
            <div className="flex flex-wrap gap-3">
              {SKIN_TONES.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  title={option.label}
                  aria-label={`Tono de piel: ${option.label}`}
                  aria-pressed={currentAppearance.skinTone === index}
                  onClick={() =>
                    updateAppearance({ ...currentAppearance, skinTone: index })
                  }
                  className={`h-11 w-11 rounded-full border-2 ${
                    currentAppearance.skinTone === index
                      ? "border-primary ring-2 ring-primary ring-offset-2"
                      : "border-border"
                  }`}
                  style={{ backgroundColor: option.value }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Peinado</h3>
            <div className="flex flex-wrap gap-3">
              {HAIR_STYLES.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={currentAppearance.hairStyle === option.value ? "default" : "outline"}
                  aria-pressed={currentAppearance.hairStyle === option.value}
                  onClick={() =>
                    updateAppearance({ ...currentAppearance, hairStyle: option.value })
                  }
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Color de cabello</h3>
            <div className="flex flex-wrap gap-3">
              {HAIR_COLORS.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  title={option.label}
                  aria-label={`Color de cabello: ${option.label}`}
                  aria-pressed={currentAppearance.hairColor === index}
                  onClick={() =>
                    updateAppearance({ ...currentAppearance, hairColor: index })
                  }
                  className={`h-11 w-11 rounded-full border-2 ${
                    currentAppearance.hairColor === index
                      ? "border-primary ring-2 ring-primary ring-offset-2"
                      : "border-border"
                  }`}
                  style={{ backgroundColor: option.value }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold">Color de camisa</h3>
            <div className="flex flex-wrap gap-3">
              {SHIRT_COLORS.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  title={option.label}
                  aria-label={`Color de camisa: ${option.label}`}
                  aria-pressed={currentAppearance.shirtColor === index}
                  onClick={() =>
                    updateAppearance({ ...currentAppearance, shirtColor: index })
                  }
                  className={`h-11 w-11 rounded-full border-2 ${
                    currentAppearance.shirtColor === index
                      ? "border-primary ring-2 ring-primary ring-offset-2"
                      : "border-border"
                  }`}
                  style={{ backgroundColor: option.value }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={saveStatus === "saving" || saveStatus === "loading"}
              onClick={() =>
                updateAppearance(defaultMiiAppearance(seed))
              }
            >
              Restaurar Mii inicial
            </Button>
            {saveStatus === "error" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void saveAppearance(currentAppearance)}
              >
                Reintentar guardado
              </Button>
            )}
          </div>
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
