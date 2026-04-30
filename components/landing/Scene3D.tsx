"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Environment } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import * as THREE from "three";

/* ── Cinematic 3D scene ────────────────────────────────────────
   - Centerpiece: large glowing torus ring + emissive sphere
     (the "financial sigil" anchoring the headline)
   - Orbit cluster: cubes / spheres / octahedrons / icosahedra
     in gold + obsidian, with subtle distortion on spheres
   - Mouse parallax rig: whole scene tilts toward cursor
   - Post: bloom for the glow, vignette for cinema, light
     chromatic aberration at edges for premium feel
*/

interface ShapeProps {
  position: [number, number, number];
  type: "cube" | "sphere" | "octa" | "icos";
  scale: number;
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  speed: number;
  rotSpeed: [number, number, number];
}

function Shape({
  position, type, scale, color,
  emissive, emissiveIntensity = 0,
  speed, rotSpeed,
}: ShapeProps) {
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
      case "sphere": return <sphereGeometry args={[0.8, 48, 48]} />;
      case "octa":   return <octahedronGeometry args={[0.9, 0]} />;
      case "icos":   return <icosahedronGeometry args={[0.85, 0]} />;
    }
  }, [type]);

  return (
    <Float speed={speed} rotationIntensity={0.4} floatIntensity={1.6} floatingRange={[-0.3, 0.3]}>
      <mesh ref={ref} position={position} scale={scale}>
        {geom}
        {type === "sphere" ? (
          <MeshDistortMaterial
            color={color}
            roughness={0.18}
            metalness={0.92}
            distort={0.25}
            speed={1.4}
            emissive={emissive}
            emissiveIntensity={emissiveIntensity}
            envMapIntensity={1.4}
          />
        ) : (
          <meshStandardMaterial
            color={color}
            roughness={0.22}
            metalness={0.88}
            emissive={emissive}
            emissiveIntensity={emissiveIntensity}
            envMapIntensity={1.4}
          />
        )}
      </mesh>
    </Float>
  );
}

function Centerpiece() {
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.x += delta * 0.18;
      ringRef.current.rotation.y += delta * 0.12;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x -= delta * 0.10;
      ring2Ref.current.rotation.z += delta * 0.16;
    }
    if (coreRef.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 1.1) * 0.05;
      coreRef.current.scale.setScalar(s);
    }
  });
  return (
    <group position={[0, 0, -1.5]}>
      {/* Outer torus — dramatic gold halo */}
      <mesh ref={ringRef}>
        <torusGeometry args={[2.0, 0.045, 24, 200]} />
        <meshStandardMaterial
          color="#ffbe1a"
          emissive="#f0a500"
          emissiveIntensity={2.2}
          roughness={0.15}
          metalness={1}
        />
      </mesh>
      {/* Inner counter-rotating torus — ember accent */}
      <mesh ref={ring2Ref} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[1.45, 0.022, 16, 160]} />
        <meshStandardMaterial
          color="#ff6b35"
          emissive="#ff6b35"
          emissiveIntensity={1.6}
          roughness={0.2}
          metalness={1}
        />
      </mesh>
      {/* Glowing core */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.18, 32, 32]} />
        <meshStandardMaterial
          color="#ffd066"
          emissive="#ffbe1a"
          emissiveIntensity={3.5}
          roughness={0.0}
          metalness={0.5}
        />
      </mesh>
    </group>
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
  { position: [-3.4, 1.6, -2],   type: "cube",   scale: 0.7,  color: "#1a1430", emissive: "#f0a500", emissiveIntensity: 0.25, speed: 0.9, rotSpeed: [0.10, 0.12, 0.04] },
  { position: [ 3.2, -1.2, -3],  type: "sphere", scale: 0.9,  color: "#ffbe1a", emissive: "#f0a500", emissiveIntensity: 0.6,  speed: 1.1, rotSpeed: [0.05, 0.08, 0.02] },
  { position: [-2.8, -2.0, -1],  type: "octa",   scale: 0.55, color: "#ff6b35", emissive: "#ff6b35", emissiveIntensity: 0.8,  speed: 1.3, rotSpeed: [0.18, 0.06, 0.10] },
  { position: [ 2.6, 2.4, -2.5], type: "icos",   scale: 0.6,  color: "#2a1f48", emissive: "#5a3aa0", emissiveIntensity: 0.20, speed: 0.8, rotSpeed: [0.07, 0.14, 0.05] },
  { position: [ 0.0, 3.2, -4],   type: "cube",   scale: 0.45, color: "#1a1430",                                              speed: 1.0, rotSpeed: [0.09, 0.05, 0.11] },
  { position: [-1.4, 0.4, -5],   type: "sphere", scale: 1.4,  color: "#0d0820",                                              speed: 0.6, rotSpeed: [0.03, 0.04, 0.02] },
  { position: [ 4.2, 0.8, -4.5], type: "icos",   scale: 0.5,  color: "#f0a500", emissive: "#f0a500", emissiveIntensity: 0.5, speed: 1.2, rotSpeed: [0.12, 0.10, 0.07] },
  { position: [-4.0, -0.4, -3.5], type: "octa",  scale: 0.7,  color: "#241a40", emissive: "#3d2080", emissiveIntensity: 0.18, speed: 0.95, rotSpeed: [0.08, 0.13, 0.04] },
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
      <directionalLight position={[5, 5, 5]} intensity={1.6} color="#ffd066" />
      <directionalLight position={[-5, -3, -2]} intensity={0.8} color="#ff6b35" />
      <pointLight position={[0, 0, 3]} intensity={1.4} color="#f0a500" />
      <pointLight position={[0, 0, -1.5]} intensity={2.0} color="#ffbe1a" distance={6} decay={2} />
      <Environment preset="night" />
      <ParallaxRig>
        <Centerpiece />
        {SHAPES.map((s, i) => <Shape key={i} {...s} />)}
      </ParallaxRig>
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={1.1}
          luminanceThreshold={0.4}
          luminanceSmoothing={0.85}
          mipmapBlur
          kernelSize={KernelSize.LARGE}
        />
        <ChromaticAberration
          offset={[0.0008, 0.0012] as unknown as THREE.Vector2}
          radialModulation={false}
          modulationOffset={0}
          blendFunction={BlendFunction.NORMAL}
        />
        <Vignette eskil={false} offset={0.1} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  );
}
