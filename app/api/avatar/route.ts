import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireServerRole } from "@/lib/server-rbac";
import { DEFAULT_AVATAR_ID, isAvatarId } from "@/lib/avatar-catalog";

export async function PUT(request: Request) {
  try {
    const { token } = await requireServerRole(request);

    const body = await request.json() as { avatarId?: unknown };

    if (!isAvatarId(body.avatarId)) {
      return NextResponse.json(
        { error: "El avatar seleccionado no es válido." },
        { status: 400 },
      );
    }

    await adminDb()
      .collection("inmobiliarios")
      .doc(token.uid)
      .set({ avatarId: body.avatarId }, { merge: true });

    return NextResponse.json({
      ok: true,
      avatarId: body.avatarId,
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

    const storedAvatarId = snapshot.data()?.avatarId;
    const avatarId = isAvatarId(storedAvatarId)
      ? storedAvatarId
      : DEFAULT_AVATAR_ID;

    return NextResponse.json({
      avatarId,
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
        { error: "No tenés permiso para consultar tu avatar." },
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


