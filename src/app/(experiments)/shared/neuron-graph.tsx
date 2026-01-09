/* eslint-disable react-hooks/immutability */
"use client";

import { useMemo, useEffect, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { color as colorNode, float, length, positionLocal, abs, sub, uniform, smoothstep, mix, attribute, time } from "three/tsl";
import { MeshBasicNodeMaterial, LineBasicNodeMaterial } from "three/webgpu";
import { useMaterial } from "@/lib/tsl/use-material";
import { useUniforms } from "@/lib/tsl/use-uniforms";

// Component to apply shader material to all meshes in the model
function NeuronModel({ position, rotation, scale, neuronIndex, seed, neuronSize, modelPath }: { 
  position: [number, number, number]; 
  rotation?: [number, number, number]; 
  scale?: number;
  neuronIndex: number;
  seed: number;
  neuronSize: number;
  modelPath: string;
}) {
  const { scene } = useGLTF(modelPath);
  const groupRef = useRef<THREE.Group>(null);
  
  // Clone the scene to avoid sharing geometry between instances
  const clonedScene = useMemo(() => {
    return scene.clone();
  }, [scene]);

  // Create random time offset for this neuron
  const randomOffset = useMemo(() => {
    const x = Math.sin(seed * 12.9898 + neuronIndex * 78.233 + 99.456) * 43758.5453;
    return (x - Math.floor(x)) * 5.0;
  }, [neuronIndex, seed]);

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

  // Create the shader material with lighting effect
  const shaderMaterial = useMaterial(
    MeshBasicNodeMaterial,
    (mat) => {
      // Calculate distance from the center of THIS neuron (using local position)
      // positionLocal gives us the vertex position relative to the object's center
      const distanceFromCenter = length(positionLocal);

      // Use the neuronSize parameter to normalize distance
      // Normalize distance: 0 at center, 1 at edge
      const normalizedDistance = distanceFromCenter.div(float(neuronSize));

      // Invert for emission: close to center = high emission, far = low emission
      // Using smoothstep for a nice falloff
      const baseEmission = smoothstep(float(1.0), float(0.0), normalizedDistance);

      // Pulse calculation - pulse travels from center outward
      // Remap pulse position (0-1) to actual distance (0 to neuronSize)
      const pulsePos = uniforms.pulsePosition.mul(float(neuronSize));
      
      // Calculate distance between this vertex and the pulse wavefront
      const distToPulse = abs(sub(distanceFromCenter, pulsePos));
      
      // Pulse width - how wide the pulse effect is
      const pulseWidth = float(0.3);
      
      // Create pulse multiplier that goes 0→3→0
      // When distToPulse is 0, we're at peak (3), when it's > pulseWidth, we're at 0
      const pulseStrength = smoothstep(pulseWidth, float(0.0), distToPulse).mul(float(3.0));
      
      // Final pulse multiplier: 1.0 when no pulse, up to 3.0 during pulse
      const pulseMult = float(1.0).add(pulseStrength.mul(float(2.0)));

      const emissionStrength = baseEmission.mul(pulseMult).add(0.2);

      // Mix of violet, blue, and gray colors
      const violet = colorNode("#8B5CF6"); // Violeta
      const blue = colorNode("#3B82F6");   // Azul
      const gray = colorNode("#9CA3AF");   // Gris
      
      // First mix: blend violet and blue (50/50)
      const violetBlue = mix(violet, blue, float(0.5));
      
      // Second mix: blend the result with gray (70% violet-blue, 30% gray)
      const finalColor = mix(violetBlue, gray, float(0.3));

      mat.colorNode = finalColor.mul(emissionStrength);
    },
    [uniforms, neuronSize]
  );

  // Apply the shader material to all meshes in the cloned scene
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Store original material if needed
        if (!(child.userData.originalMaterial)) {
          child.userData.originalMaterial = child.material;
        }
        // Apply shader material
        child.material = shaderMaterial;
      }
    });
  }, [clonedScene, shaderMaterial]);

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      scale={scale || 1}
    >
      <primitive object={clonedScene} />
    </group>
  );
}

interface NeuronGraphProps {
  modelFormat?: "gltf" | "glb";
  neuronCount?: number;
  distribution?: "clustered" | "uniform";
  seed?: number;
  spread?: number;
  separation?: number;
  scale?: number;
  neuronSize?: number;
  showConnections?: boolean;
  connectionColor?: string;
  connectionOpacity?: number;
  maxConnectionDistance?: number;
  lineWidth?: number;
  synapseSpeed?: number;
  synapseIntensity?: number;
}

// Component for connection lines between neurons
interface ConnectionLineProps {
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  opacity: number;
  resolution?: number;
  lineWidth?: number;
  synapseSpeed?: number;
  synapseIntensity?: number;
}

function ConnectionLine({ 
  start, 
  end, 
  color, 
  opacity, 
  resolution = 30, 
  seed = 0, 
  connectionIndex = 0,
  lineWidth = 2,
  synapseSpeed = 1.0,
  synapseIntensity = 1.0,
}: ConnectionLineProps & { seed?: number; connectionIndex?: number }) {
  // Seeded random for consistent curves
  const seededRandom = useMemo(() => {
    return (offset: number) => {
      const x = Math.sin(seed * 12.9898 + connectionIndex * 78.233 + offset * 43.758) * 43758.5453;
      return x - Math.floor(x);
    };
  }, [seed, connectionIndex]);

  // Create curve
  const curve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      start,
      new THREE.Vector3().lerpVectors(start, end, 0.33).add(
        new THREE.Vector3(
          (seededRandom(1) - 0.5) * 0.5,
          (seededRandom(2) - 0.5) * 0.5,
          (seededRandom(3) - 0.5) * 0.5
        )
      ),
      new THREE.Vector3().lerpVectors(start, end, 0.67).add(
        new THREE.Vector3(
          (seededRandom(4) - 0.5) * 0.5,
          (seededRandom(5) - 0.5) * 0.5,
          (seededRandom(6) - 0.5) * 0.5
        )
      ),
      end,
    ]);
  }, [start, end, seededRandom]);

  // Create tube geometry for thick lines
  const tubeGeometry = useMemo(() => {
    const radius = lineWidth * 0.01; // Convert lineWidth to radius
    const radialSegments = 8;
    const tubularSegments = resolution;
    
    const tube = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
    
    // Add branch progress attribute (0 at start, 1 at end)
    const vertexCount = tube.attributes.position.count;
    const progress = new Float32Array(vertexCount);
    
    // For tube geometry, we need to map u coordinate (along the curve) to progress
    const uAttribute = tube.attributes.uv;
    for (let i = 0; i < vertexCount; i++) {
      progress[i] = uAttribute.getX(i); // u coordinate goes from 0 to 1 along the curve
    }
    tube.setAttribute("branchProgress", new THREE.BufferAttribute(progress, 1));

    return tube;
  }, [curve, resolution, lineWidth]);

  // Fallback to line geometry if lineWidth is very small
  const lineGeometry = useMemo(() => {
    const points = curve.getPoints(resolution);
    const geo = new THREE.BufferGeometry().setFromPoints(points);

    // Add branch progress attribute (0 at start, 1 at end)
    const progress = new Float32Array(points.length);
    for (let i = 0; i < points.length; i++) {
      progress[i] = i / (points.length - 1);
    }
    geo.setAttribute("branchProgress", new THREE.BufferAttribute(progress, 1));

    return geo;
  }, [curve, resolution]);

  const geometry = lineWidth > 1.5 ? tubeGeometry : lineGeometry;

  // Create random time offset for synapse animation
  const synapseOffset = useMemo(() => {
    const x = Math.sin(seed * 12.9898 + connectionIndex * 78.233 + 123.456) * 43758.5453;
    return (x - Math.floor(x)) * 2.0; // Offset between 0 and 2 seconds
  }, [connectionIndex, seed]);

  const useTube = lineWidth > 1.5;

  // Material setup function (shared logic)
  const setupMaterial = (mat: any) => {
    const progress = attribute("branchProgress", "float");

    // Fade in at start (0-10%) and fade out at end (90-100%)
    const fadeIn = smoothstep(float(0.0), float(0.1), progress);
    const fadeOut = smoothstep(float(1.0), float(0.9), progress);
    const baseFade = fadeIn.mul(fadeOut);

    // Synapse effect - animated pulse that travels along the line
    const currentTime = time.add(float(synapseOffset));
    const synapsePosition = currentTime.mul(float(synapseSpeed)).mod(float(1.0));
    
    // Calculate distance from current position to synapse pulse
    const distToSynapse = abs(sub(progress, synapsePosition));
    
    // Create a pulse effect (wider than the neuron pulse)
    const synapseWidth = float(0.15);
    const synapsePulse = smoothstep(synapseWidth, float(0.0), distToSynapse);
    
    // Synapse color (brighter, more intense)
    const synapseColor = colorNode("#ffffff");
    const baseColor = colorNode(color);
    
    // Mix base color with synapse color based on pulse intensity
    const finalColor = mix(baseColor, synapseColor, synapsePulse.mul(float(synapseIntensity)));
    
    // Combine base fade with synapse pulse for opacity
    const synapseOpacity = baseFade.add(synapsePulse.mul(float(0.5 * synapseIntensity)));
    const finalOpacity = synapseOpacity.min(float(1.0));

    mat.colorNode = finalColor;
    mat.opacityNode = float(opacity).mul(finalOpacity);
    mat.transparent = true;
  };

  const lineMaterial = useMaterial(
    LineBasicNodeMaterial,
    setupMaterial,
    [color, opacity, synapseSpeed, synapseIntensity, synapseOffset]
  );

  const meshMaterial = useMaterial(
    MeshBasicNodeMaterial,
    setupMaterial,
    [color, opacity, synapseSpeed, synapseIntensity, synapseOffset]
  );

  // Use mesh for tube geometry, line for thin lines
  if (useTube) {
    return (
      <mesh geometry={geometry} material={meshMaterial} />
    );
  } else {
    return (
      // @ts-expect-error Three.js r150+: <line geometry={...}> TS error workaround
      <line geometry={geometry} material={lineMaterial} />
    );
  }
}

export function NeuronGraph({
  modelFormat = "glb",
  neuronCount = 20,
  distribution = "clustered",
  seed = 0,
  spread = 8,
  separation = 2,
  scale = 1,
  neuronSize = 1.0,
  showConnections = true,
  connectionColor = "#797979",
  connectionOpacity = 0.6,
  maxConnectionDistance = 5,
  lineWidth = 2,
  synapseSpeed = 1.0,
  synapseIntensity = 1.0,
}: NeuronGraphProps) {
  // Determine model path based on format
  const modelPath = useMemo(() => {
    return modelFormat === "glb" ? "/scene.glb" : "/scene.gltf";
  }, [modelFormat]);

  // Generate positions for neurons distributed in 3D space
  const neuronPositions = useMemo(() => {
    const positions: Array<{ position: [number, number, number]; rotation: [number, number, number]; scale: number }> = [];
    
    const seededRandom = (offset: number) => {
      const x = Math.sin(seed * 12.9898 + offset * 43.758) * 43758.5453;
      return x - Math.floor(x);
    };
    
    if (distribution === "clustered") {
      // Original clustered distribution in a sphere
      for (let i = 0; i < neuronCount; i++) {
        const theta = seededRandom(i * 10) * Math.PI * 2;
        const phi = Math.acos(2 * seededRandom(i * 10 + 1) - 1);
        const radius = spread * (0.3 + seededRandom(i * 10 + 2) * 0.7);
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);
        
        // Random rotation
        const rotX = seededRandom(i * 20) * Math.PI * 2;
        const rotY = seededRandom(i * 20 + 1) * Math.PI * 2;
        const rotZ = seededRandom(i * 20 + 2) * Math.PI * 2;
        
        // Slight scale variation
        const neuronScale = scale * (0.8 + seededRandom(i * 30) * 0.4);
        
        positions.push({
          position: [x, y, z],
          rotation: [rotX, rotY, rotZ],
          scale: neuronScale,
        });
      }
    } else {
      // Uniform distribution - grid-based with spacing
      // Calculate grid dimensions to fit all neurons
      const gridSize = Math.ceil(Math.cbrt(neuronCount));
      
      const usedPositions: THREE.Vector3[] = [];
      
      for (let i = 0; i < neuronCount; i++) {
        let attempts = 0;
        let position: THREE.Vector3 | null = null;
        let validPosition = false;
        
        // Try to find a valid position with minimum separation
        while (!validPosition && attempts < 100) {
          // Generate position in a grid-like pattern with some randomness
          const gridX = (i % gridSize) - (gridSize - 1) * 0.5;
          const gridY = Math.floor((i / gridSize) % gridSize) - (gridSize - 1) * 0.5;
          const gridZ = Math.floor(i / (gridSize * gridSize)) - (gridSize - 1) * 0.5;
          
          // Add some randomness to break perfect grid
          const randomOffset = 0.3;
          const x = (gridX * separation) + (seededRandom(i * 10) - 0.5) * separation * randomOffset;
          const y = (gridY * separation) + (seededRandom(i * 10 + 1) - 0.5) * separation * randomOffset;
          const z = (gridZ * separation) + (seededRandom(i * 10 + 2) - 0.5) * separation * randomOffset;
          
          const candidatePosition = new THREE.Vector3(x, y, z);
          
          // Check minimum distance from other neurons
          validPosition = true;
          for (const usedPos of usedPositions) {
            if (candidatePosition.distanceTo(usedPos) < separation * 0.8) {
              validPosition = false;
              break;
            }
          }
          
          if (validPosition) {
            position = candidatePosition;
          }
          
          attempts++;
        }
        
        if (validPosition && position) {
          usedPositions.push(position);
          
          // Random rotation
          const rotX = seededRandom(i * 20) * Math.PI * 2;
          const rotY = seededRandom(i * 20 + 1) * Math.PI * 2;
          const rotZ = seededRandom(i * 20 + 2) * Math.PI * 2;
          
          // Slight scale variation
          const neuronScale = scale * (0.8 + seededRandom(i * 30) * 0.4);
          
          positions.push({
            position: [position.x, position.y, position.z],
            rotation: [rotX, rotY, rotZ],
            scale: neuronScale,
          });
        }
      }
    }
    
    return positions;
  }, [neuronCount, seed, spread, separation, scale, distribution]);

  // Generate connections between nearby neurons
  const connections = useMemo(() => {
    if (!showConnections) return [];
    
    const conns: Array<{ start: THREE.Vector3; end: THREE.Vector3 }> = [];
    const positions = neuronPositions.map(p => new THREE.Vector3(...p.position));
    
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const distance = positions[i].distanceTo(positions[j]);
        if (distance <= maxConnectionDistance) {
          conns.push({
            start: positions[i],
            end: positions[j],
          });
        }
      }
    }
    
    return conns;
  }, [neuronPositions, showConnections, maxConnectionDistance]);

  return (
    <group>
      {/* Render connection lines */}
      {showConnections && connections.map((conn, i) => (
        <ConnectionLine
          key={`connection-${i}-${seed}`}
          start={conn.start}
          end={conn.end}
          color={connectionColor}
          opacity={connectionOpacity}
          seed={seed}
          connectionIndex={i}
          lineWidth={lineWidth}
          synapseSpeed={synapseSpeed}
          synapseIntensity={synapseIntensity}
        />
      ))}
      
      {/* Render neurons */}
      {neuronPositions.map((neuron, i) => (
        <NeuronModel
          key={`neuron-${i}-${seed}`}
          position={neuron.position}
          rotation={neuron.rotation}
          scale={neuron.scale}
          neuronIndex={i}
          seed={seed}
          neuronSize={neuronSize}
          modelPath={modelPath}
        />
      ))}
    </group>
  );
}

// Preload both models
useGLTF.preload("/scene.gltf");
useGLTF.preload("/scene.glb");

