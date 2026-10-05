import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "@/lib/firebase-admin";
import { isRole, type Role } from "@/lib/rbac";

export type AuthenticatedRequest = {
  token: DecodedIdToken;
  role: Role;
};

export async function requireServerRole(request: Request, allowedRoles?: readonly Role[]): Promise<AuthenticatedRequest> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) throw new Error("UNAUTHENTICATED");

  const token = await adminAuth().verifyIdToken(header.slice(7));
  const role = (token as DecodedIdToken & { role?: unknown }).role;
  if (!isRole(role)) throw new Error("FORBIDDEN");
  if (allowedRoles && !allowedRoles.includes(role)) throw new Error("FORBIDDEN");
  return { token, role };
}
