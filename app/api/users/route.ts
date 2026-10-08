import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { requireServerRole } from "@/lib/server-rbac";
import { isRole, type Role } from "@/lib/rbac";

type UserPayload = {
  uid?: string;
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
  disabled?: boolean;
};

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Autenticación requerida." }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "Solo ADMIN puede administrar usuarios." }, { status: 403 });
  console.error("No se pudo administrar el usuario.", error);
  return NextResponse.json({ error: "No se pudo completar la operación." }, { status: 400 });
}

function publicUser(user: { uid: string; email?: string; displayName?: string; disabled: boolean; customClaims?: Record<string, unknown> }) {
  return {
    uid: user.uid,
    email: user.email ?? "",
    name: user.displayName ?? "",
    disabled: user.disabled,
    role: isRole(user.customClaims?.role) ? user.customClaims.role : "AGENTE",
  };
}

export async function GET(request: Request) {
  try {
    await requireServerRole(request, ["ADMIN"]);
    const result = await adminAuth().listUsers(1000);
    return NextResponse.json({ users: result.users.map(publicUser) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireServerRole(request, ["ADMIN"]);
    const body = await request.json() as UserPayload;
    if (!body.email || !body.password || !body.name || !isRole(body.role)) {
      return NextResponse.json({ error: "Nombre, correo, contraseña y rol son obligatorios." }, { status: 400 });
    }
    if (body.password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
    }

    const authUser = await adminAuth().createUser({
      email: body.email.trim(),
      password: body.password,
      displayName: body.name.trim(),
    });
    await adminAuth().setCustomUserClaims(authUser.uid, { role: body.role });
    await adminDb().collection("inmobiliarios").doc(authUser.uid).set({
      name: body.name.trim(),
      email: body.email.trim(),
      phone: "",
      status: "Activo",
      role: body.role,
      authUid: authUser.uid,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ user: publicUser({ ...authUser, customClaims: { role: body.role } }) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireServerRole(request, ["ADMIN"]);
    const body = await request.json() as UserPayload;
    if (!body.uid || !body.email || !body.name || !isRole(body.role)) {
      return NextResponse.json({ error: "UID, nombre, correo y rol son obligatorios." }, { status: 400 });
    }
    const authUser = await adminAuth().updateUser(body.uid, {
      email: body.email.trim(),
      displayName: body.name.trim(),
      ...(body.password ? { password: body.password } : {}),
      ...(typeof body.disabled === "boolean" ? { disabled: body.disabled } : {}),
    });
    await adminAuth().setCustomUserClaims(body.uid, { role: body.role });
    await adminDb().collection("inmobiliarios").doc(body.uid).set({
      name: body.name.trim(),
      email: body.email.trim(),
      role: body.role,
      authUid: body.uid,
    }, { merge: true });
    return NextResponse.json({ user: publicUser({ ...authUser, customClaims: { role: body.role } }) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { token } = await requireServerRole(request, ["ADMIN"]);
    const body = await request.json() as UserPayload;
    if (!body.uid || body.uid === token.uid) {
      return NextResponse.json({ error: "Indica un usuario válido distinto al administrador actual." }, { status: 400 });
    }
    await adminAuth().deleteUser(body.uid);
    await adminDb().collection("inmobiliarios").doc(body.uid).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
