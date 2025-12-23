"use client";

import { OrbitControls } from "@react-three/drei";
import { useControls, button, folder } from "leva";
import { useState, useMemo } from "react";
import { BrainGraph } from "./brain-graph";
import { GraphConfig } from "./utils";

export function Scene() {
  const [seed, setSeed] = useState(0);

  const controls = useControls({
    "Main Branches": folder({
      mainBranchCount: { value: 12, min: 1, max: 50, step: 1 },
      mainRadius: { value: 3, min: 0.5, max: 10, step: 0.1 },
      segments: { value: 8, min: 3, max: 20, step: 1 },
      curvature: { value: 0.5, min: 0, max: 2, step: 0.05 },
    }),
    "Sub Branches": folder({
      subBranchCount: { value: 3, min: 0, max: 10, step: 1 },
      maxRadius: { value: 4, min: 1, max: 15, step: 0.1 },
      subBranchOffset: { value: 0.7, min: 0, max: 1, step: 0.05 },
      subBranchSegments: { value: 6, min: 2, max: 15, step: 1 },
      subBranchCurvature: { value: 0.6, min: 0, max: 2, step: 0.05 },
    }),
    Appearance: folder({
      color: "#000000",
      opacity: { value: 1, min: 0, max: 1, step: 0.05 },
      resolution: { value: 50, min: 10, max: 200, step: 5 },
    }),
    Regenerate: button(() => setSeed((s) => s + 1)),
  });

  const graphConfig: GraphConfig = useMemo(
    () => ({
      mainBranchCount: controls.mainBranchCount,
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
      controls.mainBranchCount,
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
      <OrbitControls autoRotate={false} />
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
