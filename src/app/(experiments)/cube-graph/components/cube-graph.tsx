/* eslint-disable react-hooks/immutability */
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { color as colorNode, float, attribute, smoothstep, length, positionLocal, abs, sub, uniform, time, mix } from "three/tsl";
import { LineBasicNodeMaterial, MeshBasicNodeMaterial } from "three/webgpu";
import { useMaterial } from "@/lib/tsl/use-material";
import { useUniforms } from "@/lib/tsl/use-uniforms";

// Función estática para generar la estructura de un cubo como grafo
function generateCubeGraph(size = 1) {
  const nodes = [
    new THREE.Vector3(-size, -size, -size),
    new THREE.Vector3( size, -size, -size),
    new THREE.Vector3( size,  size, -size),
    new THREE.Vector3(-size,  size, -size),
    new THREE.Vector3(-size, -size,  size),
    new THREE.Vector3( size, -size,  size),
    new THREE.Vector3( size,  size,  size),
    new THREE.Vector3(-size,  size,  size),
  ];

  const edges = [
    [0,1],[1,2],[2,3],[3,0], // bottom face
    [4,5],[5,6],[6,7],[7,4], // top face
    [0,4],[1,5],[2,6],[3,7]  // vertical edges
  ];

  return { nodes, edges };
}

interface CubeNodeProps {
  position: THREE.Vector3;
  color: string;
  size: number;
  opacity: number;
  cubeIndex: number;
  nodeIndex: number;
  seed: number;
  isConnected?: boolean;
  connectionSynapseSpeed?: number;
  connectionSynapseIntensity?: number;
  connectionIndex?: number;
}

function CubeNode({
  position,
  color,
  size,
  opacity,
  cubeIndex,
  nodeIndex,
  seed,
  isConnected = false,
  connectionSynapseSpeed = 0.8,
  connectionSynapseIntensity = 1.5,
  connectionIndex = 0,
}: CubeNodeProps) {
  // Geometría de esfera compartida (se reutiliza)
  const sphereGeometry = useMemo(() => {
    return new THREE.SphereGeometry(1, 16, 16);
  }, []);

  // Offset aleatorio para animación de pulso interno
  const pulseOffset = useMemo(() => {
    const x = Math.sin(seed * 12.9898 + cubeIndex * 78.233 + nodeIndex * 43.758 + 99.456) * 43758.5453;
    return (x - Math.floor(x)) * 5.0;
  }, [cubeIndex, nodeIndex, seed]);

  // Offset aleatorio para sinapsis de conexión (igual al usado en ConnectionLine)
  const synapseOffset = useMemo(() => {
    if (!isConnected) return 0;
    const x = Math.sin(seed * 12.9898 + connectionIndex * 78.233 + 123.456) * 43758.5453;
    return (x - Math.floor(x)) * 2.0;
  }, [isConnected, connectionIndex, seed]);

  // Uniforms para animación de pulso
  const uniforms = useUniforms(() => ({
    pulsePosition: uniform(0.0),
    synapsePulse: uniform(0.0),
  }));

  // Animar pulso interno y sinapsis de conexión
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime() + pulseOffset;
    const pulseSpeed = 0.5;
    const pulseCycle = 3.0;
    uniforms.pulsePosition.value = ((time * pulseSpeed) % pulseCycle) / pulseCycle;

    // Calcular sinapsis de conexión (cuando el pulso pasa por el nodo)
    if (isConnected) {
      const synapseTime = clock.getElapsedTime() + synapseOffset;
      // El pulso viaja de 0 a 1 a lo largo de la conexión
      const synapsePos = ((synapseTime * connectionSynapseSpeed) % 1.0);
      
      // El nodo se ilumina cuando el pulso está cerca de 0 (sale del nodo) 
      // o cerca de 1 (llega al nodo)
      let synapseFade = 0.0;
      
      // Cuando el pulso está cerca del final (llega al nodo)
      if (synapsePos > 0.85) {
        const t = (synapsePos - 0.85) / (0.95 - 0.85);
        synapseFade = t * t * (3.0 - 2.0 * t); // Smoothstep manual
      }
      // Cuando el pulso está cerca del inicio (sale del nodo)
      else if (synapsePos < 0.15) {
        const t = (0.15 - synapsePos) / 0.15;
        const fadeValue = t * t * (3.0 - 2.0 * t); // Smoothstep manual
        synapseFade = Math.max(synapseFade, fadeValue);
      }
      
      uniforms.synapsePulse.value = Math.min(1.0, synapseFade);
    } else {
      uniforms.synapsePulse.value = 0.0;
    }
  });

  const material = useMaterial(
    MeshBasicNodeMaterial,
    (mat) => {
      // Calcular distancia desde el centro de la esfera
      const distanceFromCenter = length(positionLocal);

      // Normalizar distancia basado en el tamaño del nodo
      const normalizedDistance = distanceFromCenter.div(float(size));

      // Emisión base: más brillante en el centro
      const baseEmission = smoothstep(float(1.0), float(0.0), normalizedDistance);

      // Efecto de pulso interno que viaja desde el centro hacia afuera
      const pulsePos = uniforms.pulsePosition.mul(float(size));
      const distToPulse = abs(sub(distanceFromCenter, pulsePos));
      
      const pulseWidth = float(0.3);
      const pulseStrength = smoothstep(pulseWidth, float(0.0), distToPulse).mul(float(2.0));
      const pulseMult = float(1.0).add(pulseStrength);

      // Efecto de sinapsis entrante desde conexiones
      const synapsePulse = uniforms.synapsePulse;
      const synapseBoost = synapsePulse.mul(float(connectionSynapseIntensity));
      const synapseColor = colorNode("#ffffff");
      const baseNodeColor = colorNode(color);
      
      // Mezclar color base con color de sinapsis cuando llega el pulso
      const finalColor = mix(baseNodeColor, synapseColor, synapseBoost.mul(float(0.8)));

      // Combinar emisión base con efectos de pulso y sinapsis
      const totalPulseMult = pulseMult.add(synapseBoost.mul(float(2.0)));
      const emissionStrength = baseEmission.mul(totalPulseMult).add(0.2);

      mat.colorNode = finalColor.mul(emissionStrength);
      mat.opacityNode = float(opacity);
      mat.transparent = opacity < 1.0;
    },
    [color, size, opacity, uniforms, isConnected, connectionSynapseIntensity]
  );

  return (
    <mesh
      geometry={sphereGeometry}
      material={material}
      position={[position.x, position.y, position.z]}
      scale={size}
    />
  );
}

interface CubeEdgeProps {
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  opacity: number;
  width: number;
  cubeIndex: number;
  edgeIndex: number;
  seed: number;
  synapseSpeed: number;
  synapseIntensity: number;
}

function CubeEdge({ 
  start, 
  end, 
  color, 
  opacity, 
  width,
  cubeIndex, 
  edgeIndex, 
  seed,
  synapseSpeed,
  synapseIntensity,
}: CubeEdgeProps) {
  // Crear geometría de línea o tubo según el ancho
  const useTube = width > 1.0;
  
  const curve = useMemo(() => {
    return new THREE.LineCurve3(start, end);
  }, [start, end]);

  const lineGeometry = useMemo(() => {
    const points = [start, end];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    
    // Agregar atributo de progreso (0 en start, 1 en end)
    const progress = new Float32Array(2);
    progress[0] = 0;
    progress[1] = 1;
    geo.setAttribute("edgeProgress", new THREE.BufferAttribute(progress, 1));
    
    return geo;
  }, [start, end]);

  const tubeGeometry = useMemo(() => {
    const radius = width * 0.01;
    const radialSegments = 8;
    const tubularSegments = 20;
    
    const tube = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
    
    // Agregar atributo de progreso
    const vertexCount = tube.attributes.position.count;
    const progress = new Float32Array(vertexCount);
    
    const uAttribute = tube.attributes.uv;
    for (let i = 0; i < vertexCount; i++) {
      progress[i] = uAttribute.getX(i);
    }
    tube.setAttribute("edgeProgress", new THREE.BufferAttribute(progress, 1));
    
    return tube;
  }, [curve, width]);

  const geometry = useTube ? tubeGeometry : lineGeometry;

  // Offset aleatorio para la animación de sinapsis
  const synapseOffset = useMemo(() => {
    const x = Math.sin(seed * 12.9898 + cubeIndex * 78.233 + edgeIndex * 43.758 + 123.456) * 43758.5453;
    return (x - Math.floor(x)) * 2.0;
  }, [cubeIndex, edgeIndex, seed]);

  const material = useMaterial(
    LineBasicNodeMaterial,
    (mat) => {
      const progress = attribute("edgeProgress", "float");

      // Efecto de sinapsis - pulso que viaja a lo largo de la arista
      const currentTime = time.add(float(synapseOffset));
      const synapsePosition = currentTime.mul(float(synapseSpeed)).mod(float(1.0));
      
      // Calcular distancia desde la posición actual al pulso de sinapsis
      const distToSynapse = abs(sub(progress, synapsePosition));
      
      // Crear efecto de pulso
      const synapseWidth = float(0.2);
      const synapsePulse = smoothstep(synapseWidth, float(0.0), distToSynapse);
      
      // Color de sinapsis (más brillante)
      const synapseColor = colorNode("#ffffff");
      const baseColor = colorNode(color);
      
      // Mezclar color base con color de sinapsis
      const finalColor = mix(baseColor, synapseColor, synapsePulse.mul(float(synapseIntensity)));
      
      // Opacidad con efecto de sinapsis
      const baseOpacity = float(opacity);
      const synapseOpacityBoost = synapsePulse.mul(float(0.5 * synapseIntensity));
      const finalOpacity = baseOpacity.add(synapseOpacityBoost).min(float(1.0));

      mat.colorNode = finalColor;
      mat.opacityNode = finalOpacity;
      mat.transparent = true;
    },
    [color, opacity, synapseSpeed, synapseIntensity, synapseOffset]
  );

  const meshMaterial = useMaterial(
    MeshBasicNodeMaterial,
    (mat) => {
      const progress = attribute("edgeProgress", "float");

      // Efecto de sinapsis - pulso que viaja a lo largo de la arista
      const currentTime = time.add(float(synapseOffset));
      const synapsePosition = currentTime.mul(float(synapseSpeed)).mod(float(1.0));
      
      // Calcular distancia desde la posición actual al pulso de sinapsis
      const distToSynapse = abs(sub(progress, synapsePosition));
      
      // Crear efecto de pulso
      const synapseWidth = float(0.2);
      const synapsePulse = smoothstep(synapseWidth, float(0.0), distToSynapse);
      
      // Color de sinapsis (más brillante)
      const synapseColor = colorNode("#ffffff");
      const baseColor = colorNode(color);
      
      // Mezclar color base con color de sinapsis
      const finalColor = mix(baseColor, synapseColor, synapsePulse.mul(float(synapseIntensity)));
      
      // Opacidad con efecto de sinapsis
      const baseOpacity = float(opacity);
      const synapseOpacityBoost = synapsePulse.mul(float(0.5 * synapseIntensity));
      const finalOpacity = baseOpacity.add(synapseOpacityBoost).min(float(1.0));

      mat.colorNode = finalColor;
      mat.opacityNode = finalOpacity;
      mat.transparent = true;
    },
    [color, opacity, synapseSpeed, synapseIntensity, synapseOffset]
  );

  if (useTube) {
    return (
      <mesh geometry={geometry} material={meshMaterial} />
    );
  } else {
    return (
      // @ts-expect-error Three.js r150+: <line geometry={...}> TS error workaround
      <line geometry={geometry} material={material} />
    );
  }
}

// Componente para conexiones tubulares entre cubos
interface ConnectionLineProps {
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  opacity: number;
  resolution?: number;
  lineWidth?: number;
  synapseSpeed?: number;
  synapseIntensity?: number;
  seed?: number;
  connectionIndex?: number;
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
}: ConnectionLineProps) {
  // Seeded random para curvas consistentes
  const seededRandom = useMemo(() => {
    return (offset: number) => {
      const x = Math.sin(seed * 12.9898 + connectionIndex * 78.233 + offset * 43.758) * 43758.5453;
      return x - Math.floor(x);
    };
  }, [seed, connectionIndex]);

  // Crear curva
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

  // Crear geometría de tubo para líneas gruesas
  const tubeGeometry = useMemo(() => {
    const radius = lineWidth * 0.01;
    const radialSegments = 8;
    const tubularSegments = resolution;
    
    const tube = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
    
    // Agregar atributo de progreso
    const vertexCount = tube.attributes.position.count;
    const progress = new Float32Array(vertexCount);
    
    const uAttribute = tube.attributes.uv;
    for (let i = 0; i < vertexCount; i++) {
      progress[i] = uAttribute.getX(i);
    }
    tube.setAttribute("branchProgress", new THREE.BufferAttribute(progress, 1));

    return tube;
  }, [curve, resolution, lineWidth]);

  // Geometría de línea como fallback
  const lineGeometry = useMemo(() => {
    const points = curve.getPoints(resolution);
    const geo = new THREE.BufferGeometry().setFromPoints(points);

    const progress = new Float32Array(points.length);
    for (let i = 0; i < points.length; i++) {
      progress[i] = i / (points.length - 1);
    }
    geo.setAttribute("branchProgress", new THREE.BufferAttribute(progress, 1));

    return geo;
  }, [curve, resolution]);

  const geometry = lineWidth > 1.5 ? tubeGeometry : lineGeometry;

  // Offset aleatorio para animación de sinapsis
  const synapseOffset = useMemo(() => {
    const x = Math.sin(seed * 12.9898 + connectionIndex * 78.233 + 123.456) * 43758.5453;
    return (x - Math.floor(x)) * 2.0;
  }, [connectionIndex, seed]);

  const useTube = lineWidth > 1.5;

  // Material con efecto de sinapsis
  const setupMaterial = (mat: any) => {
    const progress = attribute("branchProgress", "float");

    // Fade in/out en los extremos
    const fadeIn = smoothstep(float(0.0), float(0.1), progress);
    const fadeOut = smoothstep(float(1.0), float(0.9), progress);
    const baseFade = fadeIn.mul(fadeOut);

    // Efecto de sinapsis
    const currentTime = time.add(float(synapseOffset));
    const synapsePosition = currentTime.mul(float(synapseSpeed)).mod(float(1.0));
    
    const distToSynapse = abs(sub(progress, synapsePosition));
    
    const synapseWidth = float(0.15);
    const synapsePulse = smoothstep(synapseWidth, float(0.0), distToSynapse);
    
    const synapseColor = colorNode("#ffffff");
    const baseColor = colorNode(color);
    
    const finalColor = mix(baseColor, synapseColor, synapsePulse.mul(float(synapseIntensity)));
    
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

interface CubeGraphProps {
  cubeCount: number;
  seed: number;
  separation: number;
  cubeSize: number;
  spread: number;
  nodeColor: string;
  nodeSize: number;
  nodeOpacity: number;
  edgeColor: string;
  edgeWidth: number;
  edgeOpacity: number;
  synapseSpeed: number;
  synapseIntensity: number;
  showConnections: boolean;
  connectionColor: string;
  connectionOpacity: number;
  maxConnectionDistance: number;
  lineWidth: number;
  connectionSynapseSpeed: number;
  connectionSynapseIntensity: number;
}

export function CubeGraph({
  cubeCount,
  seed,
  separation,
  cubeSize,
  spread,
  nodeColor,
  nodeSize,
  nodeOpacity,
  edgeColor,
  edgeWidth,
  edgeOpacity,
  synapseSpeed,
  synapseIntensity,
  showConnections,
  connectionColor,
  connectionOpacity,
  maxConnectionDistance,
  lineWidth,
  connectionSynapseSpeed,
  connectionSynapseIntensity,
}: CubeGraphProps) {
  // Generar posiciones de cubos distribuidos en 3D
  const cubeData = useMemo(() => {
    const cubes: Array<{ 
      position: THREE.Vector3; 
      rotation: THREE.Euler; 
      scale: number;
      nodePositions: THREE.Vector3[];
    }> = [];
    
    const seededRandom = (offset: number) => {
      const x = Math.sin(seed * 12.9898 + offset * 43.758) * 43758.5453;
      return x - Math.floor(x);
    };
    
    // Distribución uniforme en una esfera
    for (let i = 0; i < cubeCount; i++) {
      const theta = seededRandom(i * 10) * Math.PI * 2;
      const phi = Math.acos(2 * seededRandom(i * 10 + 1) - 1);
      const radius = spread * (0.3 + seededRandom(i * 10 + 2) * 0.7);
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      const position = new THREE.Vector3(x, y, z);
      
      // Rotación aleatoria
      const rotX = seededRandom(i * 20) * Math.PI * 2;
      const rotY = seededRandom(i * 20 + 1) * Math.PI * 2;
      const rotZ = seededRandom(i * 20 + 2) * Math.PI * 2;
      const rotation = new THREE.Euler(rotX, rotY, rotZ);
      
      // Variación de escala
      const scale = cubeSize * (0.8 + seededRandom(i * 30) * 0.4);
      
      // Generar estructura del cubo y aplicar transformaciones
      const cubeGraph = generateCubeGraph(scale);
      const nodePositions = cubeGraph.nodes.map(node => {
        const rotated = node.clone().applyEuler(rotation);
        return rotated.add(position);
      });
      
      cubes.push({
        position,
        rotation,
        scale,
        nodePositions,
      });
    }
    
    return cubes;
  }, [cubeCount, seed, spread, cubeSize]);

  // Generar conexiones entre nodos de diferentes cubos y mapeo de nodos conectados
  const { connections, nodeConnectionMap } = useMemo(() => {
    if (!showConnections) {
      return { connections: [], nodeConnectionMap: new Map<string, { connectionIndex: number }>() };
    }
    
    const conns: Array<{ start: THREE.Vector3; end: THREE.Vector3; startCubeIndex: number; startNodeIndex: number; endCubeIndex: number; endNodeIndex: number }> = [];
    const nodeMap = new Map<string, { connectionIndex: number }>();
    
    // Conectar nodos de diferentes cubos que estén dentro de la distancia máxima
    for (let i = 0; i < cubeData.length; i++) {
      for (let j = i + 1; j < cubeData.length; j++) {
        // Encontrar el par de nodos más cercano entre los dos cubos
        let closestPair: { 
          start: THREE.Vector3; 
          end: THREE.Vector3; 
          startNodeIndex: number;
          endNodeIndex: number;
          distance: number 
        } | null = null;
        
        for (let nodeIdxI = 0; nodeIdxI < cubeData[i].nodePositions.length; nodeIdxI++) {
          const nodeI = cubeData[i].nodePositions[nodeIdxI];
          for (let nodeIdxJ = 0; nodeIdxJ < cubeData[j].nodePositions.length; nodeIdxJ++) {
            const nodeJ = cubeData[j].nodePositions[nodeIdxJ];
            const distance = nodeI.distanceTo(nodeJ);
            if (distance <= maxConnectionDistance) {
              if (!closestPair || distance < closestPair.distance) {
                closestPair = {
                  start: nodeI,
                  end: nodeJ,
                  startNodeIndex: nodeIdxI,
                  endNodeIndex: nodeIdxJ,
                  distance,
                };
              }
            }
          }
        }
        
        // Agregar solo la conexión más cercana si existe
        if (closestPair) {
          const connectionIndex = conns.length;
          conns.push({
            start: closestPair.start,
            end: closestPair.end,
            startCubeIndex: i,
            startNodeIndex: closestPair.startNodeIndex,
            endCubeIndex: j,
            endNodeIndex: closestPair.endNodeIndex,
          });
          
          // Mapear los nodos conectados
          const startKey = `${i}-${closestPair.startNodeIndex}`;
          const endKey = `${j}-${closestPair.endNodeIndex}`;
          nodeMap.set(startKey, { connectionIndex });
          nodeMap.set(endKey, { connectionIndex });
        }
      }
    }
    
    return { connections: conns, nodeConnectionMap: nodeMap };
  }, [cubeData, showConnections, maxConnectionDistance]);

  // Estructura del cubo (común para todos)
  const cubeGraphStructure = useMemo(() => generateCubeGraph(1), []);

  return (
    <group>
      {/* Renderizar cubos como grafos */}
      {cubeData.map((cube, cubeIndex) => (
        <group key={`cube-${cubeIndex}-${seed}`}>
          {/* Renderizar nodos como esferas */}
          {cube.nodePositions.map((nodePosition, nodeIndex) => {
            const nodeKey = `${cubeIndex}-${nodeIndex}`;
            const connectionInfo = nodeConnectionMap.get(nodeKey);
            const isConnected = !!connectionInfo;
            
            return (
              <CubeNode
                key={`node-${cubeIndex}-${nodeIndex}`}
                position={nodePosition}
                color={nodeColor}
                size={nodeSize}
                opacity={nodeOpacity}
                cubeIndex={cubeIndex}
                nodeIndex={nodeIndex}
                seed={seed}
                isConnected={isConnected}
                connectionSynapseSpeed={connectionSynapseSpeed}
                connectionSynapseIntensity={connectionSynapseIntensity}
                connectionIndex={connectionInfo?.connectionIndex ?? 0}
              />
            );
          })}
          
          {/* Renderizar aristas */}
          {cubeGraphStructure.edges.map((edge, edgeIndex) => {
            // Aplicar transformaciones a los nodos
            const start = cube.nodePositions[edge[0]];
            const end = cube.nodePositions[edge[1]];
            
            return (
              <CubeEdge
                key={`edge-${cubeIndex}-${edgeIndex}`}
                start={start}
                end={end}
                color={edgeColor}
                opacity={edgeOpacity}
                width={edgeWidth}
                cubeIndex={cubeIndex}
                edgeIndex={edgeIndex}
                seed={seed}
                synapseSpeed={synapseSpeed}
                synapseIntensity={synapseIntensity}
              />
            );
          })}
        </group>
      ))}
      
      {/* Renderizar conexiones entre cubos */}
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
          synapseSpeed={connectionSynapseSpeed}
          synapseIntensity={connectionSynapseIntensity}
        />
      ))}
    </group>
  );
}
