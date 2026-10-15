"use client";

export const SKIN_TONES = [
  { label: "Claro", value: "#f6d7bd" },
  { label: "Medio claro", value: "#e8b58e" },
  { label: "Medio", value: "#c9875b" },
  { label: "Oscuro", value: "#8d573d" },
] as const;

export const HAIR_COLORS = [
  { label: "Negro", value: "#30241f" },
  { label: "Castaño", value: "#65432f" },
  { label: "Rubio", value: "#b77b36" },
  { label: "Azul oscuro", value: "#252b35" },
] as const;

export const SHIRT_COLORS = [
  { label: "Azul", value: "#2563eb" },
  { label: "Morado", value: "#7c3aed" },
  { label: "Verde", value: "#0f766e" },
  { label: "Rojo", value: "#be123c" },
] as const;

export const HAIR_STYLES = [
  { label: "Clásico", value: 0 },
  { label: "Puntiagudo", value: 1 },
  { label: "Largo", value: 2 },
] as const;

export const MII_GENDERS = [
  { label: "Masculino", value: "male" },
  { label: "Femenino", value: "female" },
] as const;

export type MiiGender = "male" | "female";

export type MiiAppearance = {
  gender?: MiiGender;
  skinTone: number;
  hairColor: number;
  shirtColor: number;
  hairStyle: number;
};

export function defaultMiiAppearance(seed: number): MiiAppearance {
  return {
    skinTone: Math.abs(seed) % SKIN_TONES.length,
    hairColor: Math.abs(seed * 3) % HAIR_COLORS.length,
    shirtColor: Math.abs(seed * 7) % SHIRT_COLORS.length,
    hairStyle: 0,
    gender: "male",
  };
}

type MiiAvatarProps = {
  seed?: number;
  size?: number;
  appearance?: MiiAppearance;
};

export function MiiAvatar({
  seed = 1,
  size = 160,
  appearance,
}: MiiAvatarProps) {
  const defaults = defaultMiiAppearance(seed);

  const skin = SKIN_TONES[appearance?.skinTone ?? defaults.skinTone]?.value
    ?? SKIN_TONES[defaults.skinTone].value;
  const hair = HAIR_COLORS[appearance?.hairColor ?? defaults.hairColor]?.value
    ?? HAIR_COLORS[defaults.hairColor].value;
  const shirt = SHIRT_COLORS[appearance?.shirtColor ?? defaults.shirtColor]?.value
    ?? SHIRT_COLORS[defaults.shirtColor].value;
  const hairStyle = appearance?.hairStyle ?? defaults.hairStyle;
  const isFemale = (appearance?.gender ?? defaults.gender) === "female";

  return (
    <svg
      role="img"
      aria-label={isFemale ? "Avatar Mii femenino" : "Avatar Mii masculino"}
      viewBox="0 0 160 180"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`face-${seed}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".45" />
          <stop offset="100%" stopColor="#7c442d" stopOpacity=".12" />
        </linearGradient>
        <linearGradient id={`shirt-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".2" />
          <stop offset="100%" stopColor="#000000" stopOpacity=".18" />
        </linearGradient>
      </defs>

      <ellipse cx="80" cy="165" rx="48" ry="9" fill="#0f172a" opacity=".12" />

      <path d="M27 160 Q32 124 59 121 L101 121 Q128 124 133 160 L133 169 L27 169Z" fill={shirt} />
      <path d="M27 160 Q32 124 59 121 L101 121 Q128 124 133 160 L133 169 L27 169Z" fill={`url(#shirt-${seed})`} />

      <rect x="66" y="105" width="28" height="28" rx="10" fill={skin} />

      <path d="M43 47 Q43 20 80 20 Q117 20 117 47 L113 88 Q108 116 80 120 Q52 116 47 88Z" fill={skin} />
      <path d="M43 47 Q43 20 80 20 Q117 20 117 47 L113 88 Q108 116 80 120 Q52 116 47 88Z" fill={`url(#face-${seed})`} />

      {hairStyle === 1 ? (
        <path d="M42 58 L29 28 L48 34 L48 12 L67 25 L80 5 L91 25 L112 14 L110 35 L130 29 L117 61 L109 45 Q93 35 78 37 Q59 37 48 53Z" fill={hair} />
      ) : hairStyle === 2 ? (
        <path d="M42 58 Q29 23 62 13 Q88 4 109 20 Q129 33 117 61 L117 105 Q110 121 104 96 L109 45 Q93 35 78 37 Q59 37 48 53 L49 96 Q43 116 38 96Z" fill={hair} />
      ) : (
        <path d="M42 58 Q29 23 62 13 Q88 4 109 20 Q129 33 117 61 L109 45 Q93 35 78 37 Q59 37 48 53Z" fill={hair} />
      )}
      <path d="M44 49 Q61 36 78 38 Q98 36 114 49 L111 61 Q103 49 94 49 Q75 44 53 57 L48 70Z" fill={hair} />

      {isFemale && (
        <>
          <path d="M44 48 Q28 67 37 101 Q40 115 49 117 L53 91 L49 59Z" fill={hair} />
          <path d="M116 48 Q132 67 123 101 Q120 115 111 117 L107 91 L111 59Z" fill={hair} />
        </>
      )}

      <ellipse cx="62" cy="70" rx="11" ry="13" fill="#ffffff" />
      <ellipse cx="98" cy="70" rx="11" ry="13" fill="#ffffff" />
      <circle cx="64" cy="72" r="5.5" fill="#49352d" />
      <circle cx="96" cy="72" r="5.5" fill="#49352d" />
      <circle cx="65.5" cy="70" r="2" fill="#ffffff" />
      <circle cx="97.5" cy="70" r="2" fill="#ffffff" />

      <path d="M51 56 Q61 50 71 56" fill="none" stroke={hair} strokeWidth="4" strokeLinecap="round" />
      <path d="M89 56 Q99 50 109 56" fill="none" stroke={hair} strokeWidth="4" strokeLinecap="round" />

      <path d="M80 72 Q75 85 81 87" fill="none" stroke="#9b6045" strokeWidth="3" strokeLinecap="round" />
      <path d="M65 99 Q80 111 95 99" fill="none" stroke="#9d3d48" strokeWidth="4" strokeLinecap="round" />
      <path d="M69 99 Q80 103 91 99" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />

      <ellipse cx="48" cy="84" rx="7" ry="10" fill={skin} />
      <ellipse cx="112" cy="84" rx="7" ry="10" fill={skin} />
    </svg>
  );
}




