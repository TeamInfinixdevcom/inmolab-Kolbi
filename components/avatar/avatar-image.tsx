"use client";

import Image from "next/image";
import { UserRound } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { getAvatarById } from "@/lib/avatar-catalog";

type AvatarImageProps = {
  avatarId?: string | null;
  alt: string;
  decorative?: boolean;
  size: number;
  className?: string;
  fill?: boolean;
};

export function AvatarImage({
  avatarId,
  alt,
  decorative = false,
  size,
  className,
  fill = false,
}: Readonly<AvatarImageProps>) {
  const avatar = getAvatarById(avatarId);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(avatar && failedSrc !== avatar.src);
  const imageLoaded = Boolean(avatar && loadedSrc === avatar.src);

  return (
    <span
      className={cn("relative block overflow-hidden bg-muted", className)}
      style={fill ? undefined : { width: size, height: size }}
    >
      {showImage && avatar && (
        <Image
          src={avatar.src}
          alt={decorative ? "" : alt}
          {...(fill ? { fill: true } : { width: size, height: size })}
          sizes={`${size}px`}
          className="h-full w-full object-cover"
          onLoad={() => setLoadedSrc(avatar.src)}
          onError={() => setFailedSrc(avatar.src)}
        />
      )}
      {!imageLoaded && (
        <span
          className="absolute inset-0 flex items-center justify-center text-muted-foreground"
          aria-hidden={decorative || showImage || undefined}
          role={decorative || showImage ? undefined : "img"}
          aria-label={decorative || showImage ? undefined : `${alt} no disponible`}
        >
          <UserRound size={Math.max(16, Math.round(size * 0.52))} strokeWidth={1.6} />
        </span>
      )}
    </span>
  );
}
