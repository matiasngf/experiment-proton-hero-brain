 "use client";

import { useMemo } from "react";
import * as THREE from "three";
import { color as colorNode, float, attribute, smoothstep } from "three/tsl";
import { LineBasicNodeMaterial } from "three/webgpu";
import { useMaterial } from "@/lib/tsl/use-material";
import { BranchData, generateBrainGraph, GraphConfig } from "./utils";

interface BranchLineProps {
  branch: BranchData;
  color: string;
  opacity: number;
  resolution: number;
  isMainBranch: boolean;
}

function branchRemap(points: THREE.Vector3[]): THREE.Vector3[] {
  return points.map((point) => {
    const l = point.length();

    // Skip remapping for points at or very near the origin to avoid NaN
    if (l < 0.0001) return point;

    const newL = Math.pow(l, 0.5);

    point.multiplyScalar(1 / l).multiplyScalar(newL);

    return point;
  });
}

function BranchLine({ branch, color, opacity, resolution, isMainBranch }: BranchLineProps) {
  const geometry = useMemo(() => {
    let points = branch.curve.getPoints(resolution);
    points = branchRemap(points);
    const geo = new THREE.BufferGeometry().setFromPoints(points);

    // Add branch progress attribute (0 at start, 1 at end)
    const progress = new Float32Array(points.length);
    for (let i = 0; i < points.length; i++) {
      progress[i] = i / (points.length - 1);
    }
    geo.setAttribute("branchProgress", new THREE.BufferAttribute(progress, 1));

    return geo;
  }, [branch.curve, resolution]);

  const material = useMaterial(
    LineBasicNodeMaterial,
    (mat) => {
      const progress = attribute("branchProgress", "float");

      let fade;
      if (isMainBranch) {
        // Main branch: fade in at start (0-5%) and fade out at end (95-100%)
        const fadeIn = smoothstep(float(0.01), float(0.1), progress); // 0→1 over 0-5%
        const fadeOut = smoothstep(float(1.0), float(0.98), progress); // 0→1 over 100-95%
        // Both go from 0.2 to 1.0
        fade = fadeIn.mul(fadeOut)
      } else {
        // Sub branch: fade out from start to end (1.0 → 0.2)
        fade = float(1.0).sub(progress.mul(0.8));
      }

      mat.colorNode = colorNode(color);
      mat.opacityNode = float(opacity).mul(fade);
      mat.transparent = true;
    },
    [color, opacity, isMainBranch]
  );

  return (
    // @ts-expect-error Three.js r150+: <line geometry={...}> TS error workaround (TS types lag behind)
    <line geometry={geometry} material={material} />
  );
}

interface BrainGraphProps {
  config: GraphConfig;
  color: string;
  opacity: number;
  resolution: number;
  seed: number;
}

export function BrainGraph({
  config,
  color,
  opacity,
  resolution,
  seed,
}: BrainGraphProps) {
  const graph = useMemo(() => {
    // Use seed to trigger regeneration
    void seed;
    return generateBrainGraph(config);
  }, [config, seed]);

  return (
    <group>
      {graph.mainBranches.map((branch, i) => (
        <BranchLine
          key={`main-${i}-${seed}`}
          branch={branch}
          color={color}
          opacity={opacity}
          resolution={resolution}
          isMainBranch={true}
        />
      ))}
      {graph.subBranches.map((branch, i) => (
        <BranchLine
          key={`sub-${i}-${seed}`}
          branch={branch}
          color={color}
          opacity={opacity}
          resolution={resolution}
          isMainBranch={false}
        />
      ))}
    </group>
  );
}

