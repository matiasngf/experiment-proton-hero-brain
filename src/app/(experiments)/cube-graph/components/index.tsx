"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { WebGPURenderer } from "three/webgpu";
import { Scene } from "./scene";

export function CubeGraphCanvas() {
  return (
    <div className="w-screen h-screen">
      <Canvas
        style={{ background: "#ffffff" }}
        gl={async (props) => {
          const renderer = new WebGPURenderer({
            ...props,
            antialias: true,
          } as never);
          await renderer.init();
          return renderer;
        }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
