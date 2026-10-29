import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  { ignores: [".firebase/**", ".next/**", "out/**", "build/**"] },
  ...nextVitals,
  ...nextTs,
];

export default config;
