"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useControls, button, folder } from "leva";
import { useState, useRef } from "react";
import { CubeGraph } from "./cube-graph";
import * as THREE from "three";

function RotatingCamera() {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useFrame(() => {
    if (cameraRef.current) {
      const radius = 8;
      const speed = 0.02;
      const angle = performance.now() * 0.001 * speed;
      
      cameraRef.current.position.x = Math.sin(angle) * radius;
      cameraRef.current.position.z = Math.cos(angle) * radius;
      cameraRef.current.lookAt(0, 0, 0);
    }
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      position={[0, 0, 8]}
      fov={50}
    />
  );
}

export function Scene() {
  const [seed, setSeed] = useState(0);

  const [controls] = useControls(() => ({
    Cubes: folder({
      cubeCount: { value: 46, min: 5, max: 50, step: 1, label: "Number of Cubes" },
      separation: { value: 5.2, min: 0.5, max: 10, step: 0.1, label: "Separation" },
      cubeSize: { value: 0.2, min: 0.1, max: 2, step: 0.1, label: "Cube Size" },
      spread: { value: 12.5, min: 2, max: 15, step: 0.5, label: "Spread" },
    }),
    Appearance: folder({
      edgeColor: { value: "#000000", label: "Edge Color" },
      edgeOpacity: { value: 0.40, min: 0, max: 1, step: 0.05, label: "Edge Opacity" },
      synapseSpeed: { value: 0.5, min: 0.1, max: 2, step: 0.1, label: "Synapse Speed" },
      synapseIntensity: { value: 1.5, min: 0, max: 3, step: 0.1, label: "Synapse Intensity" },
      nodeColor: { value: "#000000", label: "Node Color" },
      nodeSize: { value: 0.05, min: 0.01, max: 0.2, step: 0.01, label: "Node Size" },
      nodeOpacity: { value: 0.65, min: 0, max: 1, step: 0.05, label: "Node Opacity" },
      edgeWidth: { value: 1.5, min: 0.5, max: 3.0, step: 0.5, label: "Edge Width" },
    }),
    Connections: folder({
      showConnections: { value: true, label: "Show Connections" },
      connectionColor: { value: "#0d0c0c", label: "Connection Color" },
      connectionOpacity: { value: 0.40, min: 0, max: 1, step: 0.05, label: "Connection Opacity" },
      maxConnectionDistance: { value: 5.0, min: 1, max: 15, step: 0.5, label: "Max Connection Distance" },
      lineWidth: { value: 1.8, min: 0.5, max: 2.0, step: 0.5, label: "Line Width" },
      connectionSynapseSpeed: { value: 0.8, min: 0.1, max: 3, step: 0.1, label: "Connection Synapse Speed" },
      connectionSynapseIntensity: { value: 0.1, min: 0, max: 3, step: 0.1, label: "Connection Synapse Intensity" },
    }),
    Regenerate: button(() => setSeed((s) => s + 1)),
  }));

  return (
    <>
      <RotatingCamera />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <CubeGraph
        cubeCount={controls.cubeCount}
        seed={seed}
        separation={controls.separation}
        cubeSize={controls.cubeSize}
        spread={controls.spread}
        nodeColor={controls.nodeColor}
        nodeSize={controls.nodeSize}
        nodeOpacity={controls.nodeOpacity}
        edgeColor={controls.edgeColor}
        edgeWidth={controls.edgeWidth}
        edgeOpacity={controls.edgeOpacity}
        synapseSpeed={controls.synapseSpeed}
        synapseIntensity={controls.synapseIntensity}
        showConnections={controls.showConnections}
        connectionColor={controls.connectionColor}
        connectionOpacity={controls.connectionOpacity}
        maxConnectionDistance={controls.maxConnectionDistance}
        lineWidth={controls.lineWidth}
        connectionSynapseSpeed={controls.connectionSynapseSpeed}
        connectionSynapseIntensity={controls.connectionSynapseIntensity}
      />
    </>
  );
}
