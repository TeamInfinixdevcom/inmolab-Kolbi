"use client";

import { useState } from "react";
import { useRBAC } from "@/components/auth/rbac-provider";
import {
  MiiAvatar,
  defaultMiiAppearance,
  SKIN_TONES,
  HAIR_COLORS,
  SHIRT_COLORS,
  type MiiAppearance,
} from "@/components/avatar/mii-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function seedFromUid(uid: string): number {
  let hash = 0;
  for (let index = 0; index < uid.length; index += 1) {
    hash = (hash * 31 + uid.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export default function PerfilPage() {
  const { user, role, loading } = useRBAC();
  const [appearance, setAppearance] = useState<MiiAppearance | null>(null);

  if (loading) {
    return <section className="p-8 text-center text-muted-foreground">Cargando perfil...</section>;
  }

  if (!user) {
    return (
      <section className="rounded-lg border border-dashed p-10 text-center">
        <h1 className="text-2xl font-bold">Mi perfil</h1>
        <p className="mt-2 text-sm text-muted-foreground">Iniciá sesión para consultar tu perfil.</p>
      </section>
    );
  }

  const seed = seedFromUid(user.uid);
  const currentAppearance = appearance ?? defaultMiiAppearance(seed);

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">Tu espacio personal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Mi perfil</h1>
        <p className="mt-2 text-muted-foreground">
          Personalizá tu Mii y preparalo para identificarte en el mapa.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Personalizá tu avatar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-4 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-start">
            <div className="rounded-2xl border bg-background p-3">
              <MiiAvatar seed={seed} size={180} appearance={currentAppearance} />
            </div>
            <div className="space-y-2 text-center sm:pt-5 sm:text-left">
              <h2 className="text-xl font-semibold">{user.displayName || "Usuario INMOLAB"}</h2>
              <p className="text-sm text-muted-foreground">
                Así se verá tu avatar. Los cambios se muestran al instante.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Tono de piel</h3>
            <div className="flex flex-wrap gap-3">
              {SKIN_TONES.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  title={option.label}
                  aria-label={`Tono de piel: ${option.label}`}
                  aria-pressed={currentAppearance.skinTone === index}
                  onClick={() => setAppearance({ ...currentAppearance, skinTone: index })}
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
            <h3 className="font-semibold">Color de cabello</h3>
            <div className="flex flex-wrap gap-3">
              {HAIR_COLORS.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  title={option.label}
                  aria-label={`Color de cabello: ${option.label}`}
                  aria-pressed={currentAppearance.hairColor === index}
                  onClick={() => setAppearance({ ...currentAppearance, hairColor: index })}
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
                  onClick={() => setAppearance({ ...currentAppearance, shirtColor: index })}
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
              onClick={() => setAppearance(defaultMiiAppearance(seed))}
            >
              Restaurar Mii inicial
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Tus elecciones todavía son temporales: al recargar la página se restaurará el Mii inicial.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la cuenta</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Nombre</p>
            <p className="mt-1 font-medium">{user.displayName || "Sin nombre registrado"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Correo electrónico</p>
            <p className="mt-1 break-all font-medium">{user.email || "Sin correo registrado"}</p>
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