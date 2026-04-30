"use client";

import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Environment, useGLTF } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import * as THREE from "three";

/* ── Cinematic 3D scene ────────────────────────────────────────
   - Centerpiece: GoldenX (Meshy-generated .glb sigil) framed by a
     slow-rotating gold halo torus, sitting behind the headline
   - Orbit cluster: cubes / spheres / octahedrons / icosahedra in
     gold + obsidian, orbit the centerpiece
   - Mouse parallax rig: whole scene tilts toward cursor
   - Post: bloom for the gold glow, vignette for cinema, light
     chromatic aberration at edges for premium feel
*/

const HERO_MODEL = "/models/GoldenX.glb";

function GoldenXSigil() {
  const ref = useRef<THREE.Group>(null);
  const { scene } = useGLTF(HERO_MODEL);

  // Memoize a cloned + tuned copy of the loaded scene so we don't mutate
  // the cached gltf and so we can boost emissive on every gold material.
  const tuned = useMemo(() => {
    const cloned = scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    cloned.position.sub(center);
    // Scale so the longest axis fits inside ~2.0 world units — subtle
    // backdrop element, not a dominant centerpiece.
    const longest = Math.max(size.x, size.y, size.z) || 1;
    const target = 2.0;
    const k = target / longest;
    cloned.scale.setScalar(k);
    cloned.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        const mat = o.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
        const apply = (m: THREE.MeshStandardMaterial) => {
          // Tuned to read cleanly without dominating the hero.
          m.envMapIntensity = 1.2;
          if (m.emissiveIntensity != null) m.emissiveIntensity = Math.min(m.emissiveIntensity, 0.18);
          if (!m.emissive || m.emissive.getHex() === 0) {
            m.emissive = new THREE.Color("#ff8e1a");
            m.emissiveIntensity = 0.10;
          }
          m.metalness = Math.max(m.metalness ?? 0, 0.85);
          m.roughness = Math.min(m.roughness ?? 1, 0.35);
          m.needsUpdate = true;
        };
        if (Array.isArray(mat)) mat.forEach(apply); else apply(mat);
      }
    });
    return cloned;
  }, [scene]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.18; // slow continuous Y rotation
  });

  return (
    <group ref={ref} position={[0, 0, -2.8]}>
      <primitive object={tuned} />
    </group>
  );
}

function HaloRing() {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.x += delta * 0.05;
      ringRef.current.rotation.z += delta * 0.10;
    }
  });
  return (
    <mesh ref={ringRef} position={[0, 0, -3.0]}>
      <torusGeometry args={[1.8, 0.025, 20, 200]} />
      <meshStandardMaterial
        color="#ffbe1a"
        emissive="#f0a500"
        emissiveIntensity={1.8}
        roughness={0.18}
        metalness={1}
      />
    </mesh>
  );
}

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

// Orbit cluster — pushed wider so the centerpiece reads clearly
const SHAPES: ShapeProps[] = [
  { position: [-4.4, 1.8, -2.5],   type: "cube",   scale: 0.6,  color: "#1a1430", emissive: "#f0a500", emissiveIntensity: 0.25, speed: 0.9, rotSpeed: [0.10, 0.12, 0.04] },
  { position: [ 4.2, -1.4, -3.5],  type: "sphere", scale: 0.7,  color: "#ffbe1a", emissive: "#f0a500", emissiveIntensity: 0.6,  speed: 1.1, rotSpeed: [0.05, 0.08, 0.02] },
  { position: [-3.6, -2.4, -2],    type: "octa",   scale: 0.5,  color: "#ff6b35", emissive: "#ff6b35", emissiveIntensity: 0.8,  speed: 1.3, rotSpeed: [0.18, 0.06, 0.10] },
  { position: [ 3.4, 2.6, -3],     type: "icos",   scale: 0.55, color: "#2a1f48", emissive: "#5a3aa0", emissiveIntensity: 0.20, speed: 0.8, rotSpeed: [0.07, 0.14, 0.05] },
  { position: [ 0.6, 3.6, -4.5],   type: "cube",   scale: 0.4,  color: "#1a1430",                                              speed: 1.0, rotSpeed: [0.09, 0.05, 0.11] },
  { position: [-1.6, -3.4, -5],    type: "sphere", scale: 1.0,  color: "#0d0820",                                              speed: 0.6, rotSpeed: [0.03, 0.04, 0.02] },
  { position: [ 5.2, 1.0, -5],     type: "icos",   scale: 0.45, color: "#f0a500", emissive: "#f0a500", emissiveIntensity: 0.5, speed: 1.2, rotSpeed: [0.12, 0.10, 0.07] },
  { position: [-5.0, -0.6, -4],    type: "octa",   scale: 0.6,  color: "#241a40", emissive: "#3d2080", emissiveIntensity: 0.18, speed: 0.95, rotSpeed: [0.08, 0.13, 0.04] },
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
      <directionalLight position={[5, 5, 5]} intensity={1.8} color="#ffd066" />
      <directionalLight position={[-5, -3, -2]} intensity={0.9} color="#ff6b35" />
      <pointLight position={[0, 0, 3]} intensity={1.6} color="#f0a500" />
      <pointLight position={[0, 0, -1.2]} intensity={2.4} color="#ffbe1a" distance={6} decay={2} />
      <Environment preset="night" />
      <ParallaxRig>
        <Suspense fallback={null}>
          <GoldenXSigil />
        </Suspense>
        <HaloRing />
        {SHAPES.map((s, i) => <Shape key={i} {...s} />)}
      </ParallaxRig>
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={1.0}
          luminanceThreshold={0.45}
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

// Preload hint so the asset starts downloading the moment the bundle parses
useGLTF.preload(HERO_MODEL);
