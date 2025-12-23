/* eslint-disable react-hooks/immutability */
"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { color as colorNode, float, attribute, smoothstep, length, positionGeometry, abs, sub, uniform } from "three/tsl";
import { LineBasicNodeMaterial, MeshBasicNodeMaterial } from "three/webgpu";
import { useMaterial } from "@/lib/tsl/use-material";
import { useUniforms } from "@/lib/tsl/use-uniforms";
import { useFrame } from "@react-three/fiber";
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

interface SubBranchBoxProps {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  color: string;
  maxRadius: number;
  branchIndex: number;
  seed: number;
}
const boxGeometry = new THREE.BoxGeometry(1, 1, 1)
// Create the corner/edges geometry ("wireframe" box of just line segments)
const boxEdgeGeometry = (() => {
  // Defines unit box corners
  const vertices = [
    [-0.5, -0.5, -0.5],
    [+0.5, -0.5, -0.5],
    [+0.5, +0.5, -0.5],
    [-0.5, +0.5, -0.5],
    [-0.5, -0.5, +0.5],
    [+0.5, -0.5, +0.5],
    [+0.5, +0.5, +0.5],
    [-0.5, +0.5, +0.5],
  ];
  // Each pair is an edge between two corners
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0], // bottom face
    [4, 5], [5, 6], [6, 7], [7, 4], // top face
    [0, 4], [1, 5], [2, 6], [3, 7], // vertical edges
  ];
  const positions: number[] = [];
  edges.forEach(([a, b]) => {
    positions.push(...vertices[a], ...vertices[b]);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  return geo;
})();


function SubBranchBox({ position, rotation, color, maxRadius, branchIndex, seed }: SubBranchBoxProps) {
  
  // Create random time offset for this branch
  const randomOffset = useMemo(() => {
    const x = Math.sin(seed * 12.9898 + branchIndex * 78.233 + 99.456) * 43758.5453;
    return (x - Math.floor(x)) * 5.0;
  }, [branchIndex, seed]);

  // Create uniforms for pulse animation
  const uniforms = useUniforms(() => ({
    pulsePosition: uniform(0.0), // 0 to 1
  }));

  // Animate pulse position with random offset
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime() + randomOffset;
    const pulseSpeed = 0.5; // How fast the pulse travels
    const pulseCycle = 3.0; // Duration of one complete pulse cycle in seconds
    
    // Create a repeating pulse that goes from 0 to 1
    uniforms.pulsePosition.value = ((time * pulseSpeed) % pulseCycle) / pulseCycle;
  });

  const material = useMaterial(
    MeshBasicNodeMaterial,
    (mat) => {
      // Calculate distance from world origin (0, 0, 0) using sphere SDF
      const distanceFromCenter = length(positionGeometry);

      // Normalize distance based on maxRadius
      // Close to center = 0, at maxRadius = 1
      const normalizedDistance = distanceFromCenter.div(float(1.3));

      // Invert for emission: close to center = high emission, far = low emission
      // Using smoothstep for a nice falloff
      const baseEmission = smoothstep(float(1.0), float(0.0), normalizedDistance);

      // Pulse calculation
      // Remap pulse position (0-1) to actual distance (0 to maxRadius)
      const pulsePos = uniforms.pulsePosition.mul(float(maxRadius));
      
      // Calculate distance between this box and the pulse wavefront
      const distToPulse = abs(sub(distanceFromCenter, pulsePos)).pow(2)
      
      // Pulse width - how wide the pulse effect is
      const pulseWidth = float(0.5);
      
      // Create pulse multiplier that goes 0→3→0
      // When distToPulse is 0, we're at peak (3), when it's > pulseWidth, we're at 0
      const pulseStrength = smoothstep(pulseWidth, float(0.0), distToPulse).mul(float(3.0));
      
      // Final pulse multiplier: 1.0 when no pulse, up to 3.0 during pulse
      const pulseMult = float(0).add(pulseStrength.mul(float(2.0)));

      const emissionStrength = baseEmission.mul(pulseMult).add(0.2)

      mat.colorNode = colorNode("#fff").mul(emissionStrength);
      // mat.emissiveNode = colorNode("#fff").mul(emissionStrength);
      // mat.roughness = 0.3;
      // mat.metalness = 0.1;
    },
    [color, maxRadius, uniforms]
  );

  const wireframeMaterial = useMaterial(
    LineBasicNodeMaterial,
    (mat) => {
      mat.colorNode = colorNode("#000");
    },
    []
  );




  return (
    <group>
      <mesh
        scale={0.02}
        geometry={boxGeometry}
        material={material}
        position={[position.x, position.y, position.z]}
        rotation={rotation}
      />
      <lineSegments
        scale={0.0201}
        geometry={boxEdgeGeometry}
        material={wireframeMaterial}
        position={[position.x, position.y, position.z]}
        rotation={rotation}
      />
    </group>
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

  // Extract spawn points from subBranches with deterministic random rotations
  const subBranchSpawnData = useMemo(() => {
    // Simple seeded random function for deterministic results
    const seededRandom = (index: number, component: number) => {
      const x = Math.sin(seed * 12.9898 + index * 78.233 + component * 43.758) * 43758.5453;
      return x - Math.floor(x);
    };

    return graph.subBranches.map((branch, index) => {
      // The first point of the branch is the spawn point
      const spawnPoint = branch.points[0].clone();
      
      // Apply the same remap that's applied to the branch lines
      const l = spawnPoint.length();
      if (l >= 0.0001) {
        const newL = Math.pow(l, 0.5);
        spawnPoint.multiplyScalar(1 / l).multiplyScalar(newL);
      }
      
      // Generate deterministic rotation based on seed and index
      const rotation = new THREE.Euler(
        seededRandom(index, 0) * Math.PI * 2,
        seededRandom(index, 1) * Math.PI * 2,
        seededRandom(index, 2) * Math.PI * 2
      );
      return { position: spawnPoint, rotation, branchIndex: index };
    });
  }, [graph.subBranches, seed]);

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
      {subBranchSpawnData.map((data, i) => (
        <SubBranchBox
          key={`box-${i}-${seed}`}
          position={data.position}
          rotation={data.rotation}
          color={color}
          maxRadius={config.maxRadius}
          branchIndex={data.branchIndex}
          seed={seed}
        />
      ))}
    </group>
  );
}

