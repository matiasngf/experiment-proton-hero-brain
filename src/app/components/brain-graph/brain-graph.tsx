 "use client";

import { useMemo } from "react";
import * as THREE from "three";
import { color as colorNode, float } from "three/tsl";
import { LineBasicNodeMaterial } from "three/webgpu";
import { BranchData, generateBrainGraph, GraphConfig } from "./utils";

interface BranchLineProps {
  branch: BranchData;
  color: string;
  opacity: number;
  resolution: number;
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

function BranchLine({ branch, color, opacity, resolution }: BranchLineProps) {
  const geometry = useMemo(() => {
    let points = branch.curve.getPoints(resolution);
    points = branchRemap(points);
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return geo;
  }, [branch.curve, resolution]);

  const material = useMemo(() => {
    const mat = new LineBasicNodeMaterial();
    mat.colorNode = colorNode(color);
    mat.opacityNode = float(opacity);
    mat.transparent = opacity < 1;
    return mat;
  }, [color, opacity]);

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
        />
      ))}
      {graph.subBranches.map((branch, i) => (
        <BranchLine
          key={`sub-${i}-${seed}`}
          branch={branch}
          color={color}
          opacity={opacity}
          resolution={resolution}
        />
      ))}
    </group>
  );
}

