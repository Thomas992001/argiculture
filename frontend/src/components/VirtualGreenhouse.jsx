import { useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

const BEDS = [
  { id: "zone_bed_a", label: "Substrate Bed A", position: [0, 0, -1.7], accent: "#22c55e" },
  { id: "zone_bed_b", label: "Substrate Bed B", position: [0, 0, 0], accent: "#3b82f6" },
  { id: "zone_bed_c", label: "Substrate Bed C", position: [0, 0, 1.7], accent: "#f59e0b" },
];

const DEFAULT_CAMERA = { position: [6, 4.5, 5.5], target: [0, 0.3, 0] };

function getCameraForBed(pos) {
  return {
    position: [pos[0] + 2.8, pos[1] + 2, pos[2] + 2.2],
    target: [pos[0], pos[1] + 0.35, pos[2]],
  };
}

/* ─── Lighting ───────────────────────────────────────────── */

function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.35} color="#f0f4ff" />
      <directionalLight position={[5, 9, 4]} intensity={1.1} color="#fff8e7" />
      <directionalLight position={[-4, 5, -3]} intensity={0.2} color="#cce0ff" />
      <pointLight position={[0, 3.3, 0]} intensity={0.3} color="#fffde7" distance={9} decay={2} />
    </>
  );
}

/* ─── Greenhouse structure ───────────────────────────────── */

function GlassWall({ position, rotation, size }) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={size} />
      <meshPhysicalMaterial
        color="#b8e0c8"
        transparent
        opacity={0.1}
        roughness={0.05}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function GreenhouseStructure() {
  const beamMat = <meshStandardMaterial color="#78878f" metalness={0.75} roughness={0.22} />;

  return (
    <group>
      {/* Concrete floor */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 6]} />
        <meshStandardMaterial color="#c2b9ad" roughness={0.92} metalness={0} />
      </mesh>

      {/* Glass walls */}
      <GlassWall position={[0, 1.5, -3]} size={[8, 3, 0.04]} />
      <GlassWall position={[0, 1.5, 3]} size={[8, 3, 0.04]} />
      <GlassWall position={[-4, 1.5, 0]} size={[0.04, 3, 6]} />
      <GlassWall position={[4, 1.5, 0]} size={[0.04, 3, 6]} />

      {/* Roof panels */}
      <GlassWall position={[-2, 3.4, 0]} rotation={[0, 0, 0.3]} size={[4.2, 0.04, 6]} />
      <GlassWall position={[2, 3.4, 0]} rotation={[0, 0, -0.3]} size={[4.2, 0.04, 6]} />

      {/* Vertical pillars */}
      {[-4, 0, 4].map((x) =>
        [-3, 3].map((z) => (
          <mesh key={`p-${x}-${z}`} position={[x, 1.5, z]}>
            <boxGeometry args={[0.06, 3, 0.06]} />
            {beamMat}
          </mesh>
        ))
      )}

      {/* Ridge beam */}
      <mesh position={[0, 3.72, 0]}>
        <boxGeometry args={[0.06, 0.06, 6]} />
        {beamMat}
      </mesh>

      {/* Top horizontal beams */}
      {[-4, 4].map((x) => (
        <mesh key={`h-${x}`} position={[x, 3, 0]}>
          <boxGeometry args={[0.06, 0.06, 6]} />
          {beamMat}
        </mesh>
      ))}

      {/* Mid-height horizontal rails */}
      {[-4, 4].map((x) => (
        <mesh key={`rail-${x}`} position={[x, 1.2, 0]}>
          <boxGeometry args={[0.04, 0.04, 6]} />
          {beamMat}
        </mesh>
      ))}
    </group>
  );
}

/* ─── Plant ──────────────────────────────────────────────── */

function Plant({ position }) {
  return (
    <group position={position}>
      {/* Stem */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.014, 0.024, 0.24, 6]} />
        <meshStandardMaterial color="#5d4037" roughness={0.9} />
      </mesh>

      {/* Main canopy */}
      <mesh position={[0, 0.34, 0]} scale={[1, 0.75, 1]}>
        <icosahedronGeometry args={[0.19, 1]} />
        <meshStandardMaterial color="#2e7d32" roughness={0.55} />
      </mesh>

      {/* Side leaf clusters */}
      <mesh position={[0.11, 0.25, 0.05]} scale={[0.8, 0.5, 0.8]}>
        <icosahedronGeometry args={[0.1, 0]} />
        <meshStandardMaterial color="#43a047" roughness={0.5} />
      </mesh>
      <mesh position={[-0.09, 0.27, -0.07]} scale={[0.8, 0.5, 0.8]}>
        <icosahedronGeometry args={[0.09, 0]} />
        <meshStandardMaterial color="#388e3c" roughness={0.5} />
      </mesh>
      <mesh position={[0.04, 0.43, -0.04]} scale={[0.8, 0.5, 0.8]}>
        <icosahedronGeometry args={[0.07, 0]} />
        <meshStandardMaterial color="#4caf50" roughness={0.5} />
      </mesh>
    </group>
  );
}

/* ─── Substrate bed (clickable) ──────────────────────────── */

function SubstrateBed({ id, position, label, accent, selected, onClick }) {
  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick(id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
      {/* Selection glow pad */}
      {selected && (
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.5, 1.3]} />
          <meshBasicMaterial color={accent} transparent opacity={0.12} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Wooden planter */}
      <RoundedBox args={[2.2, 0.4, 1.0]} radius={0.03} position={[0, 0.2, 0]}>
        <meshStandardMaterial
          color={selected ? "#7d5c3e" : "#6d4c34"}
          roughness={0.85}
          metalness={0.05}
        />
      </RoundedBox>

      {/* Soil */}
      <mesh position={[0, 0.39, 0]}>
        <boxGeometry args={[2.05, 0.07, 0.85]} />
        <meshStandardMaterial color="#3e2723" roughness={1} metalness={0} />
      </mesh>

      {/* Plant */}
      <Plant position={[0, 0.42, 0]} />

      {/* Label */}
      <Text
        position={[0, -0.05, 0.62]}
        fontSize={0.12}
        color={selected ? accent : "#8b8b8b"}
        anchorX="center"
        anchorY="top"
      >
        {label}
      </Text>

      {/* Selection highlight — glowing border on top edges */}
      {selected && (
        <>
          <mesh position={[0, 0.405, 0.505]}>
            <boxGeometry args={[2.25, 0.025, 0.025]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.5} />
          </mesh>
          <mesh position={[0, 0.405, -0.505]}>
            <boxGeometry args={[2.25, 0.025, 0.025]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.5} />
          </mesh>
          <mesh position={[1.115, 0.405, 0]}>
            <boxGeometry args={[0.025, 0.025, 1.035]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.5} />
          </mesh>
          <mesh position={[-1.115, 0.405, 0]}>
            <boxGeometry args={[0.025, 0.025, 1.035]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.5} />
          </mesh>
        </>
      )}
    </group>
  );
}

/* ─── Camera controller (smooth animation) ───────────────── */

function CameraController({ selectedBed }) {
  const { camera } = useThree();
  const controlsRef = useRef();
  const targetPos = useRef(new THREE.Vector3(...DEFAULT_CAMERA.position));
  const targetLook = useRef(new THREE.Vector3(...DEFAULT_CAMERA.target));

  useEffect(() => {
    if (selectedBed) {
      const bed = BEDS.find((b) => b.id === selectedBed);
      if (bed) {
        const cam = getCameraForBed(bed.position);
        targetPos.current.set(...cam.position);
        targetLook.current.set(...cam.target);
      }
    } else {
      targetPos.current.set(...DEFAULT_CAMERA.position);
      targetLook.current.set(...DEFAULT_CAMERA.target);
    }
  }, [selectedBed]);

  useFrame(() => {
    camera.position.lerp(targetPos.current, 0.045);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLook.current, 0.045);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom
      enableRotate
      maxPolarAngle={Math.PI / 2.1}
      minDistance={2}
      maxDistance={14}
      enableDamping
      dampingFactor={0.08}
    />
  );
}

/* ─── Main scene ─────────────────────────────────────────── */

function GreenhouseScene({ selectedBed, onBedSelect }) {
  return (
    <>
      <color attach="background" args={["#151921"]} />
      <SceneLighting />
      <GreenhouseStructure />

      {BEDS.map((bed) => (
        <SubstrateBed
          key={bed.id}
          id={bed.id}
          position={bed.position}
          label={bed.label}
          accent={bed.accent}
          selected={selectedBed === bed.id}
          onClick={onBedSelect}
        />
      ))}

      <CameraController selectedBed={selectedBed} />
    </>
  );
}

/* ─── Public component ───────────────────────────────────── */

export default function VirtualGreenhouse({
  sensorData = {},
  selectedBed = null,
  onBedSelect = () => {},
  height = "500px",
}) {
  return (
    <div
      className="rounded-xl border border-gray-800 overflow-hidden"
      style={{ height }}
    >
      <Canvas
        camera={{ position: DEFAULT_CAMERA.position, fov: 45 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      >
        <GreenhouseScene
          selectedBed={selectedBed}
          onBedSelect={onBedSelect}
        />
      </Canvas>
    </div>
  );
}
