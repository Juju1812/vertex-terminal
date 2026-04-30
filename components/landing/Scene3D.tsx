"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Environment } from "@react-three/drei";
import * as THREE from "three";

/* ── Floating geometric cluster ────────────────────────────────
   - Mix of cubes + icosahedrons + spheres
   - Gold-tinted PBR materials with subtle distortion
   - Slow orbital drift driven by mouse parallax
*/

interface ShapeProps {
  position: [number, number, number];
  type: "cube" | "sphere" | "octa" | "icos";
  scale: number;
  color: string;
  speed: number;
  rotSpeed: [number, number, number];
}

function Shape({ position, type, scale, color, speed, rotSpeed }: ShapeProps) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * rotSpeed[0];
    ref.current.rotation.y += delta * rotSpeed[1];
    ref.current.rotation.z += delta * rotSpeed[2];
  });

  const geom = useMemo(() => {
    switch (type) {
      case "cube":   return <boxGeometry args={[1, 1, 1]} />;
      case "sphere": return <sphereGeometry args={[0.8, 32, 32]} />;
      case "octa":   return <octahedronGeometry args={[0.9, 0]} />;
      case "icos":   return <icosahedronGeometry args={[0.85, 0]} />;
    }
  }, [type]);

  return (
    <Float speed={speed} rotationIntensity={0.4} floatIntensity={1.6} floatingRange={[-0.3, 0.3]}>
      <mesh ref={ref} position={position} scale={scale}>
        {geom}
        <MeshDistortMaterial
          color={color}
          roughness={0.25}
          metalness={0.85}
          distort={type === "sphere" ? 0.25 : 0}
          speed={1.4}
          envMapIntensity={1.2}
        />
      </mesh>
    </Float>
  );
}

function ParallaxRig({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    const { x, y } = state.pointer;
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, x * 0.18, 0.04);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -y * 0.12, 0.04);
  });
  return <group ref={group}>{children}</group>;
}

const SHAPES: ShapeProps[] = [
  { position: [-3.4, 1.6, -2],   type: "cube",   scale: 0.7, color: "#f0a500", speed: 0.9, rotSpeed: [0.10, 0.12, 0.04] },
  { position: [ 3.2, -1.2, -3],  type: "sphere", scale: 0.9, color: "#ffbe1a", speed: 1.1, rotSpeed: [0.05, 0.08, 0.02] },
  { position: [-2.8, -2.0, -1],  type: "octa",   scale: 0.55, color: "#ff6b35", speed: 1.3, rotSpeed: [0.18, 0.06, 0.10] },
  { position: [ 2.6, 2.4, -2.5], type: "icos",   scale: 0.6, color: "#2a1f48", speed: 0.8, rotSpeed: [0.07, 0.14, 0.05] },
  { position: [ 0.0, 3.2, -4],   type: "cube",   scale: 0.45, color: "#1a1430", speed: 1.0, rotSpeed: [0.09, 0.05, 0.11] },
  { position: [-1.4, 0.4, -5],   type: "sphere", scale: 1.4, color: "#0d0820", speed: 0.6, rotSpeed: [0.03, 0.04, 0.02] },
  { position: [ 4.2, 0.8, -4.5], type: "icos",   scale: 0.5, color: "#f0a500", speed: 1.2, rotSpeed: [0.12, 0.10, 0.07] },
  { position: [-4.0, -0.4, -3.5], type: "octa",  scale: 0.7, color: "#241a40", speed: 0.95, rotSpeed: [0.08, 0.13, 0.04] },
];

export default function Scene3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 5, 5]} intensity={1.4} color="#ffd066" />
      <directionalLight position={[-5, -3, -2]} intensity={0.6} color="#ff6b35" />
      <pointLight position={[0, 0, 3]} intensity={1.2} color="#f0a500" />
      <Environment preset="night" />
      <ParallaxRig>
        {SHAPES.map((s, i) => <Shape key={i} {...s} />)}
      </ParallaxRig>
    </Canvas>
  );
}
