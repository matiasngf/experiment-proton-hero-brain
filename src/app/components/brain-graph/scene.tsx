"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useControls, button, folder } from "leva";
import { useState, useMemo, useRef } from "react";
import { BrainGraph } from "./brain-graph";
import { GraphConfig } from "./utils";
import * as THREE from "three";

function RotatingCamera() {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useFrame(() => {
    if (cameraRef.current) {
      // Rotate camera around Y axis
      const radius = 2; // distance from center (z position from initial config)
      const speed = 0.05; // rotation speed
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
      position={[0, 0, 2]}
      fov={50}
    />
  );
}

export function Scene() {
  const [seed, setSeed] = useState(0);

  const [controls] = useControls(() => ({
    "Main Branches": folder({
      // Base radius of the icosahedron used to distribute branch starting points
      icosahedronRadius: { label: "Radius", value: 1, min: 0.01, max: 1, step: 0.01 },
      // Subdivision level of the icosahedron (higher = more evenly distributed points and more branches)
      icosahedronDetail: { label: "Detail", value: 0, min: 0, max: 3, step: 1 },
      // Distance from center that each main branch should reach
      mainRadius: { value: 3.4, min: 0.5, max: 10, step: 0.1 },
      // Number of control points along each main branch (higher = smoother curves)
      segments: { value: 3, min: 3, max: 20, step: 1 },
      // How much each branch randomly bends as it grows (higher = more wiggly)
      curvature: { value: 1.3, min: 0, max: 2, step: 0.05 },
    }),
    "Sub Branches": folder({
      // Number of smaller branches spawned from each main branch
      subBranchCount: { label: "Count", value: 9, min: 0, max: 10, step: 1 },
      // Maximum distance from center that sub-branches can reach
      maxRadius: { label: "Max Radius", value: 7.4, min: 1, max: 15, step: 0.1 },
      // How strongly sub-branches curve away from their parent (0 = follow parent, 1 = perpendicular)
      subBranchOffset: { label: "Offset", value: 0.35, min: 0, max: 1, step: 0.05 },
      // Number of control points along each sub-branch (higher = smoother curves)
      subBranchSegments: { label: "Segments", value: 6, min: 2, max: 15, step: 1 },
      // How much each sub-branch randomly bends as it grows
      subBranchCurvature: { label: "Curvature", value: 0.35, min: 0, max: 2, step: 0.05 },
    }),
    Appearance: folder({
      color: "#797979",
      opacity: { value: 1, min: 0, max: 1, step: 0.05 },
      resolution: { value: 30, min: 10, max: 200, step: 5 },
    }),
    Regenerate: button(() => setSeed((s) => s + 1)),
    "Copy Settings": button((get) => {
      const settings = {
        icosahedronRadius: get("Main Branches.icosahedronRadius"),
        icosahedronDetail: get("Main Branches.icosahedronDetail"),
        mainRadius: get("Main Branches.mainRadius"),
        segments: get("Main Branches.segments"),
        curvature: get("Main Branches.curvature"),
        subBranchCount: get("Sub Branches.subBranchCount"),
        maxRadius: get("Sub Branches.maxRadius"),
        subBranchOffset: get("Sub Branches.subBranchOffset"),
        subBranchSegments: get("Sub Branches.subBranchSegments"),
        subBranchCurvature: get("Sub Branches.subBranchCurvature"),
        color: get("Appearance.color"),
        opacity: get("Appearance.opacity"),
        resolution: get("Appearance.resolution"),
      };
      navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
      console.log("Settings copied to clipboard:", settings);
    }),
  }));

  const graphConfig: GraphConfig = useMemo(
    () => ({
      icosahedronRadius: controls.icosahedronRadius,
      icosahedronDetail: controls.icosahedronDetail,
      subBranchCount: controls.subBranchCount,
      mainRadius: controls.mainRadius,
      maxRadius: controls.maxRadius,
      segments: controls.segments,
      curvature: controls.curvature,
      subBranchOffset: controls.subBranchOffset,
      subBranchSegments: controls.subBranchSegments,
      subBranchCurvature: controls.subBranchCurvature,
    }),
    [
      controls.icosahedronRadius,
      controls.icosahedronDetail,
      controls.subBranchCount,
      controls.mainRadius,
      controls.maxRadius,
      controls.segments,
      controls.curvature,
      controls.subBranchOffset,
      controls.subBranchSegments,
      controls.subBranchCurvature,
    ]
  );

  return (
    <>
      <RotatingCamera />
      {/* <OrbitControls autoRotate={false} /> */}
      <BrainGraph
        config={graphConfig}
        color={controls.color}
        opacity={controls.opacity}
        resolution={controls.resolution}
        seed={seed}
      />
    </>
  );
}
