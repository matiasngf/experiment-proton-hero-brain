"use client";

import { Canvas } from "@react-three/fiber";
import { Scene } from "./scene";

export function BrainCanvas() {
  return (
    <div className="w-screen h-screen">
      <Canvas
        style={{ background: "#ffffff" }}
        camera={{ position: [0, 0, 10], fov: 50 }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}

