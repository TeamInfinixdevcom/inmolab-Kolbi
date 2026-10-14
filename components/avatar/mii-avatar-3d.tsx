"use client";

import { Canvas } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  OrbitControls,
} from "@react-three/drei";
import { Suspense, useState } from "react";
import {
  HAIR_COLORS,
  SHIRT_COLORS,
  SKIN_TONES,
  defaultMiiAppearance,
  MiiAvatar,
  type MiiAppearance,
} from "./mii-avatar";

type Props = {
  seed?: number;
  size?: number;
  appearance?: MiiAppearance;
  interactive?: boolean;
};

function Character({ appearance }: { appearance: MiiAppearance }) {
  const skin =
    SKIN_TONES[appearance.skinTone]?.value ?? SKIN_TONES[0].value;
  const hair =
    HAIR_COLORS[appearance.hairColor]?.value ?? HAIR_COLORS[0].value;
  const shirt =
    SHIRT_COLORS[appearance.shirtColor]?.value ?? SHIRT_COLORS[0].value;

  return (
    <group position={[0, -0.15, 0]}>
      <mesh position={[0, -0.48, 0]} castShadow>
        <cylinderGeometry args={[0.19, 0.22, 0.42, 32]} />
        <meshStandardMaterial color={skin} roughness={0.68} />
      </mesh>

      <mesh position={[0, -0.91, 0]} castShadow>
        <capsuleGeometry args={[0.48, 0.48, 8, 32]} />
        <meshStandardMaterial color={shirt} roughness={0.72} />
      </mesh>

      <mesh position={[0, 0.25, 0]} castShadow>
        <sphereGeometry args={[0.68, 48, 48]} />
        <meshStandardMaterial color={skin} roughness={0.46} />
      </mesh>

      <mesh position={[0, 0.59, -0.015]} castShadow>
        <sphereGeometry
          args={[0.695, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.53]}
        />
        <meshStandardMaterial color={hair} roughness={0.82} />
      </mesh>

      <mesh position={[0, 0.57, 0.37]} rotation={[-0.12, 0, 0]} castShadow>
        <sphereGeometry args={[0.43, 32, 20, 0, Math.PI, 0, Math.PI * 0.52]} />
        <meshStandardMaterial color={hair} roughness={0.8} />
      </mesh>

      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.235, 0.29, 0.405]}>
          <mesh>
            <sphereGeometry args={[0.105, 24, 24]} />
            <meshStandardMaterial color="#fffdf9" roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.005, 0.087]}>
            <sphereGeometry args={[0.055, 24, 24]} />
            <meshStandardMaterial color="#49352d" roughness={0.3} />
          </mesh>
          <mesh position={[0.018, 0.025, 0.132]}>
            <sphereGeometry args={[0.019, 16, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}

      <mesh position={[0, 0.12, 0.49]} rotation={[0.2, 0, 0]}>
        <sphereGeometry args={[0.075, 24, 20]} />
        <meshStandardMaterial color={skin} roughness={0.5} />
      </mesh>

      <mesh position={[0, -0.035, 0.45]} scale={[0.13, 0.035, 0.025]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color="#a94750" roughness={0.55} />
      </mesh>
    </group>
  );
}

export default function MiiAvatar3D({
  seed = 1,
  size = 240,
  appearance,
  interactive = false,
}: Props) {
  const config = appearance ?? defaultMiiAppearance(seed);
  const [webglFailed, setWebglFailed] = useState(false);

  if (webglFailed) {
    return (
      <div
        style={{ width: size, height: size, maxWidth: "100%" }}
        title="Se muestra el avatar alternativo porque WebGL no está disponible."
      >
        <MiiAvatar seed={seed} size={size} appearance={config} />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label="Avatar personalizable"
      style={{ width: size, height: size, maxWidth: "100%" }}
    >
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.1, 4.1], fov: 35 }}
        gl={{ alpha: true, antialias: true }}
        fallback={
          <MiiAvatar seed={seed} size={size} appearance={config} />
        }
        onCreated={({ gl }) => {
          gl.domElement.addEventListener(
            "webglcontextcreationerror",
            () => setWebglFailed(true),
            { once: true },
          );
        }}
        onError={() => setWebglFailed(true)}
      >
        <ambientLight intensity={1.5} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} castShadow />
        <Suspense fallback={null}>
          <Character appearance={config} />
          <Environment preset="studio" />
          <ContactShadows
            position={[0, -1.55, 0]}
            opacity={0.22}
            scale={3}
            blur={2}
          />
        </Suspense>
        {interactive && (
          <OrbitControls
            enablePan={false}
            minDistance={3.5}
            maxDistance={5}
            minPolarAngle={Math.PI / 2.8}
            maxPolarAngle={Math.PI / 1.8}
          />
        )}
      </Canvas>
    </div>
  );
}
