import { NextResponse } from "next/server";
import { requireServerRole } from "@/lib/server-rbac";

export async function GET(request: Request) {
  try {
    const { token, role } = await requireServerRole(request);
    return NextResponse.json({ uid: token.uid, role });
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: status === 401 ? "Autenticación requerida." : "Permisos insuficientes." }, { status });
  }
}
