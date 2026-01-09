"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useControls, button, folder } from "leva";
import { useState, useRef } from "react";
import { NeuronGraph } from "../../shared/neuron-graph";
import * as THREE from "three";

function RotatingCamera() {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useFrame(() => {
    if (cameraRef.current) {
      // Rotate camera around Y axis
      const radius = 5; // distance from center
      const speed = 0.02; // rotation speed
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
      position={[0, 0, 5]}
      fov={50}
    />
  );
}

export function Scene() {
  const [seed, setSeed] = useState(0);

  const [controls] = useControls(() => ({
    Appearance: folder({
      neuronCount: { value: 20, min: 5, max: 50, step: 1, label: "Number of Neurons" },
      separation: { value: 3.2, min: 0.5, max: 10, step: 0.1, label: "Separation" },
      scale: { value: 0.2, min: 0.1, max: 3, step: 0.1, label: "Scale" },
      neuronSize: { value: 5.0, min: 0.1, max: 5, step: 0.1, label: "Neuron Size (Shader)" },
    }),
    Connections: folder({
      showConnections: { value: true, label: "Show Connections" },
      connectionColor: { value: "#000000", label: "Connection Color" },
      connectionOpacity: { value: 0.25, min: 0, max: 1, step: 0.05, label: "Connection Opacity" },
      maxConnectionDistance: { value: 4.0, min: 1, max: 15, step: 0.5, label: "Max Connection Distance" },
      lineWidth: { value: 2.0, min: 0.5, max: 2.0, step: 0.5, label: "Line Width" },
      synapseSpeed: { value: 0.1, min: 0.1, max: 5, step: 0.1, label: "Synapse Speed" },
      synapseIntensity: { value: 1.7, min: 0, max: 2, step: 0.1, label: "Synapse Intensity" },
    }),
    Regenerate: button(() => setSeed((s) => s + 1)),
  }));

  return (
    <>
      <RotatingCamera />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <NeuronGraph
        modelFormat="glb"
        neuronCount={controls.neuronCount}
        distribution="uniform"
        seed={seed}
        spread={6.5}
        separation={controls.separation}
        scale={controls.scale}
        neuronSize={controls.neuronSize}
        showConnections={controls.showConnections}
        connectionColor={controls.connectionColor}
        connectionOpacity={controls.connectionOpacity}
        maxConnectionDistance={controls.maxConnectionDistance}
        lineWidth={controls.lineWidth}
        synapseSpeed={controls.synapseSpeed}
        synapseIntensity={controls.synapseIntensity}
      />
    </>
  );
}

