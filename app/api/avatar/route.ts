import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireServerRole } from "@/lib/server-rbac";

const APPEARANCE_LIMITS = {
  skinTone: 4,
  hairColor: 4,
  shirtColor: 4,
  hairStyle: 3,
} as const;

type AvatarAppearance = {
  skinTone: number;
  hairColor: number;
  shirtColor: number;
  hairStyle: number;
};

function isValidAppearance(value: unknown): value is AvatarAppearance {
  if (!value || typeof value !== "object") return false;

  const appearance = value as Record<string, unknown>;

  return Object.entries(APPEARANCE_LIMITS).every(([key, limit]) => {
    const index = appearance[key];
    return typeof index === "number"
      && Number.isInteger(index)
      && index >= 0
      && index < limit;
  });
}

export async function PUT(request: Request) {
  try {
    const { token } = await requireServerRole(request);

    const body = await request.json() as { appearance?: unknown };

    if (!isValidAppearance(body.appearance)) {
      return NextResponse.json(
        { error: "La configuración del avatar no es válida." },
        { status: 400 },
      );
    }

    await adminDb()
      .collection("inmobiliarios")
      .doc(token.uid)
      .set({ avatarConfig: body.appearance }, { merge: true });

    return NextResponse.json({
      ok: true,
      appearance: body.appearance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Autenticación requerida." },
        { status: 401 },
      );
    }

    if (message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "No tenés permiso para guardar el avatar." },
        { status: 403 },
      );
    }

    console.error("No se pudo guardar el avatar:", error);

    return NextResponse.json(
      { error: "No se pudo guardar el avatar." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const { token } = await requireServerRole(request);
    const snapshot = await adminDb()
      .collection("inmobiliarios")
      .doc(token.uid)
      .get();

    const storedAppearance = snapshot.data()?.avatarConfig;
    const appearance = storedAppearance && typeof storedAppearance === "object"
      ? { hairStyle: 0, ...(storedAppearance as Record<string, unknown>) }
      : storedAppearance;

    return NextResponse.json({
      appearance: isValidAppearance(appearance) ? appearance : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Autenticación requerida." },
        { status: 401 },
      );
    }

    if (message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "No tenés permiso para consultar el avatar." },
        { status: 403 },
      );
    }

    console.error("No se pudo cargar el avatar:", error);

    return NextResponse.json(
      { error: "No se pudo cargar el avatar." },
      { status: 500 },
    );
  }
}


