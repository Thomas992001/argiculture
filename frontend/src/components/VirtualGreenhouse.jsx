import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

function GlassPanel({ position, rotation, size }) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={size} />
      <meshPhysicalMaterial
        color="#88ccaa"
        transparent
        opacity={0.15}
        roughness={0.1}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function GreenhouseFrame() {
  const frameColor = "#555555";
  const frameMaterial = (
    <meshStandardMaterial color={frameColor} metalness={0.6} roughness={0.3} />
  );

  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 6]} />
        <meshStandardMaterial color="#2d1f0e" roughness={0.9} />
      </mesh>

      {/* Glass walls */}
      <GlassPanel position={[0, 1.5, -3]} size={[8, 3, 0.05]} />
      <GlassPanel position={[0, 1.5, 3]} size={[8, 3, 0.05]} />
      <GlassPanel position={[-4, 1.5, 0]} size={[0.05, 3, 6]} />
      <GlassPanel position={[4, 1.5, 0]} size={[0.05, 3, 6]} />

      {/* Roof panels (angled) */}
      <GlassPanel
        position={[-2, 3.4, 0]}
        rotation={[0, 0, 0.3]}
        size={[4.2, 0.05, 6]}
      />
      <GlassPanel
        position={[2, 3.4, 0]}
        rotation={[0, 0, -0.3]}
        size={[4.2, 0.05, 6]}
      />

      {/* Frame beams */}
      {[-4, 0, 4].map((x) =>
        [-3, 3].map((z) => (
          <mesh key={`beam-${x}-${z}`} position={[x, 1.5, z]}>
            <boxGeometry args={[0.08, 3, 0.08]} />
            {frameMaterial}
          </mesh>
        ))
      )}
    </group>
  );
}

function PlantBed({ position, color, label }) {
  return (
    <group position={position}>
      <RoundedBox args={[2.5, 0.4, 1.2]} radius={0.05} position={[0, 0.2, 0]}>
        <meshStandardMaterial color="#3d2b1a" roughness={0.9} />
      </RoundedBox>
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} position={[-1 + i * 0.4, 0.6, 0]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      ))}
      <Text
        position={[0, -0.1, 0.7]}
        fontSize={0.15}
        color="#9ca3af"
        anchorX="center"
      >
        {label}
      </Text>
    </group>
  );
}

function NFTChannel({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[3, 0.1, 0.4]} />
        <meshStandardMaterial color="#f0f0f0" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Water inside */}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[2.9, 0.06, 0.35]} />
        <meshPhysicalMaterial
          color="#2299cc"
          transparent
          opacity={0.6}
          roughness={0.1}
        />
      </mesh>
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[-1.2 + i * 0.6, 0.35, 0]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color="#22c55e" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Reservoir({ position, waterLevel = 0.6 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.8, 16]} />
        <meshPhysicalMaterial
          color="#666666"
          transparent
          opacity={0.4}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, waterLevel * 0.4, 0]}>
        <cylinderGeometry args={[0.45, 0.45, waterLevel * 0.7, 16]} />
        <meshPhysicalMaterial
          color="#1e90ff"
          transparent
          opacity={0.5}
          roughness={0.1}
        />
      </mesh>
      <Text
        position={[0, 1, 0]}
        fontSize={0.12}
        color="#60a5fa"
        anchorX="center"
      >
        Reservoir
      </Text>
    </group>
  );
}

function SensorNode({ position, label, color = "#22c55e", value = "" }) {
  const ref = useRef();

  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y =
        position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.03;
    }
  });

  return (
    <group ref={ref} position={position}>
      <mesh>
        <boxGeometry args={[0.12, 0.08, 0.08]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      <Text position={[0, 0.15, 0]} fontSize={0.08} color={color} anchorX="center">
        {label}
      </Text>
      {value && (
        <Text
          position={[0, 0.25, 0]}
          fontSize={0.1}
          color="white"
          anchorX="center"
          fontWeight="bold"
        >
          {value}
        </Text>
      )}
    </group>
  );
}

function Fan({ position, isOn }) {
  const ref = useRef();

  useFrame((_, delta) => {
    if (ref.current && isOn) {
      ref.current.rotation.z += delta * 8;
    }
  });

  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.25, 0.25, 0.05, 16]} />
        <meshStandardMaterial color="#444" metalness={0.8} />
      </mesh>
      <group ref={ref}>
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            position={[
              Math.cos((i * Math.PI) / 2) * 0.15,
              0.03,
              Math.sin((i * Math.PI) / 2) * 0.15,
            ]}
          >
            <boxGeometry args={[0.15, 0.02, 0.05]} />
            <meshStandardMaterial
              color={isOn ? "#22c55e" : "#666"}
              emissive={isOn ? "#22c55e" : "#000"}
              emissiveIntensity={isOn ? 0.5 : 0}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function GreenhouseScene({ sensorData = {}, actuatorStates = {} }) {
  const temp = sensorData["zone_air:temperature"]?.value;
  const rh = sensorData["zone_air:humidity"]?.value;
  const co2 = sensorData["zone_air:co2"]?.value;
  const moisture = sensorData["zone_bed:soil_moisture"]?.value;
  const nftPh = sensorData["zone_nft:ph"]?.value;
  const waterLevel = sensorData["zone_reservoir:water_level"]?.value;

  const fanOn = actuatorStates?.fan_exhaust === "on";

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 3]} intensity={0.8} castShadow />
      <pointLight position={[0, 3, 0]} intensity={0.3} color="#ffffcc" />

      <GreenhouseFrame />

      {/* Substrate beds */}
      <PlantBed position={[-1.5, 0, -1.5]} color="#22c55e" label="Bed A" />
      <PlantBed position={[-1.5, 0, 1.5]} color="#16a34a" label="Bed B" />

      {/* NFT channels */}
      <NFTChannel position={[2, 0.5, -1.2]} />
      <NFTChannel position={[2, 0.5, 0]} />
      <NFTChannel position={[2, 0.5, 1.2]} />

      {/* Reservoir */}
      <Reservoir
        position={[3.2, 0, -2.2]}
        waterLevel={waterLevel ? waterLevel / 100 : 0.6}
      />

      {/* Sensor nodes */}
      <SensorNode
        position={[0, 2.5, 0]}
        label="T/RH/CO₂"
        color="#f87171"
        value={temp != null ? `${temp.toFixed(1)}°C` : ""}
      />
      <SensorNode
        position={[-1.5, 0.8, -1.5]}
        label="Moisture"
        color="#22d3ee"
        value={moisture != null ? `${moisture.toFixed(0)}%` : ""}
      />
      <SensorNode
        position={[2, 0.9, 0]}
        label="pH/EC"
        color="#4ade80"
        value={nftPh != null ? `pH ${nftPh.toFixed(1)}` : ""}
      />

      {/* Fan */}
      <Fan position={[3.9, 2.2, 0]} isOn={fanOn} />

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        maxPolarAngle={Math.PI / 2.1}
        minDistance={3}
        maxDistance={15}
      />
    </>
  );
}

export default function VirtualGreenhouse({
  sensorData = {},
  actuatorStates = {},
  height = "500px",
}) {
  return (
    <div
      className="rounded-xl border border-gray-800 overflow-hidden bg-gray-900/50"
      style={{ height }}
    >
      <Canvas
        camera={{ position: [6, 5, 6], fov: 50 }}
        gl={{ antialias: true }}
      >
        <GreenhouseScene
          sensorData={sensorData}
          actuatorStates={actuatorStates}
        />
      </Canvas>
    </div>
  );
}
