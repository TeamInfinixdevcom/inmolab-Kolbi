export const ROLES = ["ADMIN", "SUPERVISOR", "AGENTE"] as const;
export type Role = (typeof ROLES)[number];

export const MODULES = ["dashboard", "inmobiliarios", "propiedades", "clientes", "eventos", "actividad", "mapa", "reportes", "condominios"] as const;
export type Module = (typeof MODULES)[number];

export const ACTIONS = ["read", "create", "update", "delete", "manage"] as const;
export type Action = (typeof ACTIONS)[number];

export type Permission = `${Module}:${Action}`;
export type PermissionMap = Readonly<Record<Module, Readonly<Record<Action, boolean>>>>;

const noPermissions = (): Record<Action, boolean> => ({
  read: false,
  create: false,
  update: false,
  delete: false,
  manage: false,
});

const permissionsFor = (granted: readonly Permission[]): PermissionMap => {
  const permissions = Object.fromEntries(
    MODULES.map((module) => [module, noPermissions()]),
  ) as Record<Module, Record<Action, boolean>>;

  for (const permission of granted) {
    const [module, action] = permission.split(":") as [Module, Action];
    permissions[module][action] = true;
  }

  return permissions;
};

export const ROLE_PERMISSIONS: Readonly<Record<Role, PermissionMap>> = {
  ADMIN: permissionsFor(
    MODULES.flatMap((module) => ACTIONS.map((action) => `${module}:${action}` as Permission)),
  ),
  SUPERVISOR: permissionsFor([
    "dashboard:read",
    "inmobiliarios:read",
    "propiedades:read",
    "propiedades:create",
    "propiedades:update",
    "clientes:read",
    "clientes:create",
    "clientes:update",
    "eventos:read",
    "eventos:create",
    "eventos:update",
    "eventos:delete",
    "actividad:read",
    "actividad:create",
    "actividad:update",
    "mapa:read",
    "reportes:read",
    "condominios:read",
  ]),
  AGENTE: permissionsFor([
    "dashboard:read",
    "propiedades:read",
    "propiedades:create",
    "propiedades:update",
    "clientes:read",
    "clientes:create",
    "clientes:update",
    "eventos:read",
    "eventos:create",
    "eventos:update",
    "eventos:delete",
    "actividad:read",
    "actividad:create",
    "actividad:update",
    "mapa:read",
    "reportes:read",
    "condominios:read",
    "condominios:create",
    "condominios:update",
  ]),
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

export function roleFromClaims(claims: Record<string, unknown>): Role {
  return isRole(claims.role) ? claims.role : "AGENTE";
}

export function hasPermission(role: Role, module: Module, action: Action): boolean {
  return ROLE_PERMISSIONS[role][module][action];
}

export function canAccessModule(role: Role, module: Module): boolean {
  return hasPermission(role, module, "read") || hasPermission(role, module, "manage");
}
