import { generatedAvatarCatalog } from "@/lib/avatar-catalog.generated";

export type Avatar = (typeof generatedAvatarCatalog)[number];

export const AVATAR_CATALOG: readonly Avatar[] = generatedAvatarCatalog;
export const DEFAULT_AVATAR_ID = AVATAR_CATALOG[0].id;

const avatarsById = new Map<string, Avatar>(
  AVATAR_CATALOG.map((avatar) => [avatar.id, avatar]),
);

export function isAvatarId(value: unknown): value is Avatar["id"] {
  return typeof value === "string" && avatarsById.has(value);
}

export function getAvatarById(value: unknown): Avatar | undefined {
  return typeof value === "string" ? avatarsById.get(value) : undefined;
}

export function getOptimizedAvatarSrc(avatarId: string, width = 64): string | undefined {
  const avatar = getAvatarById(avatarId);
  if (!avatar) return undefined;

  const params = new URLSearchParams({ url: avatar.src, w: String(width), q: "75" });
  return `/_next/image?${params.toString()}`;
}
