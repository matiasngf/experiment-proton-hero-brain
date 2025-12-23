import * as THREE from "three";

export interface BranchConfig {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  segments: number;
  curvature: number;
  stepLength: number;
  targetRadius?: number;
  maxRadius?: number;
}

export interface BranchData {
  points: THREE.Vector3[];
  curve: THREE.CatmullRomCurve3;
}

/**
 * Generate a random unit vector (uniformly distributed on a sphere)
 */
export function randomDirection(): THREE.Vector3 {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.sin(phi) * Math.sin(theta),
    Math.cos(phi)
  );
}

/**
 * Generate control points for a branch with soft direction changes
 */
export function generateBranchPoints(config: BranchConfig): THREE.Vector3[] {
  const { origin, direction, segments, curvature, stepLength } = config;

  const points: THREE.Vector3[] = [origin.clone()];
  const currentDir = direction.clone().normalize();

  for (let i = 0; i < segments; i++) {
    // Create a random rotation axis perpendicular to current direction
    const randomAxis = randomDirection();
    const perpAxis = currentDir.clone().cross(randomAxis).normalize();

    // If perpAxis is zero (randomAxis parallel to currentDir), try another approach
    if (perpAxis.length() < 0.001) {
      perpAxis.set(1, 0, 0).cross(currentDir).normalize();
      if (perpAxis.length() < 0.001) {
        perpAxis.set(0, 1, 0).cross(currentDir).normalize();
      }
    }

    // Apply a small rotation around the perpendicular axis
    const rotationAngle = (Math.random() - 0.5) * curvature;
    const quaternion = new THREE.Quaternion().setFromAxisAngle(
      perpAxis,
      rotationAngle
    );
    currentDir.applyQuaternion(quaternion);
    currentDir.normalize();

    // Add next point
    const lastPoint = points[points.length - 1];
    const nextPoint = lastPoint
      .clone()
      .add(currentDir.clone().multiplyScalar(stepLength));
    points.push(nextPoint);
  }

  return points;
}

/**
 * Normalize branch so that endpoint is at targetRadius from origin
 */
export function normalizeBranchToRadius(
  points: THREE.Vector3[],
  origin: THREE.Vector3,
  targetRadius: number
): THREE.Vector3[] {
  if (points.length < 2) return points;

  const endpoint = points[points.length - 1];
  const currentRadius = endpoint.clone().sub(origin).length();

  if (currentRadius < 0.001) return points;

  const scale = targetRadius / currentRadius;

  return points.map((p) => {
    const offset = p.clone().sub(origin);
    return origin.clone().add(offset.multiplyScalar(scale));
  });
}

/**
 * Clip branch points that exceed maxRadius from world origin
 */
export function clipBranchToRadius(
  points: THREE.Vector3[],
  maxRadius: number
): THREE.Vector3[] {
  const clipped: THREE.Vector3[] = [];

  for (const point of points) {
    if (point.length() > maxRadius) {
      // Optionally could interpolate to find exact intersection point
      break;
    }
    clipped.push(point);
  }

  return clipped;
}

/**
 * Generate a complete branch with normalization/clipping applied
 */
export function generateBranch(config: BranchConfig): BranchData | null {
  let points = generateBranchPoints(config);

  // Apply radius normalization for main branches
  if (config.targetRadius !== undefined) {
    points = normalizeBranchToRadius(points, config.origin, config.targetRadius);
  }

  // Apply radius clipping for sub-branches
  if (config.maxRadius !== undefined) {
    points = clipBranchToRadius(points, config.maxRadius);
  }

  // Need at least 2 points for a curve
  if (points.length < 2) {
    return null;
  }

  const curve = new THREE.CatmullRomCurve3(points);

  return { points, curve };
}

/**
 * Get direction for a sub-branch at a given point along parent curve
 */
export function getSubBranchDirection(
  parentCurve: THREE.CatmullRomCurve3,
  t: number,
  offsetStrength: number
): THREE.Vector3 {
  const tangent = parentCurve.getTangentAt(t);

  // Create a perpendicular vector
  let up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(tangent.dot(up)) > 0.99) {
    up = new THREE.Vector3(1, 0, 0);
  }

  const normal = tangent.clone().cross(up).normalize();
  const binormal = tangent.clone().cross(normal).normalize();

  // Random angle around the tangent
  const angle = Math.random() * Math.PI * 2;
  const perpDir = normal
    .clone()
    .multiplyScalar(Math.cos(angle))
    .add(binormal.clone().multiplyScalar(Math.sin(angle)));

  // Combine tangent with perpendicular direction
  const direction = tangent
    .clone()
    .multiplyScalar(1 - offsetStrength)
    .add(perpDir.multiplyScalar(offsetStrength));

  return direction.normalize();
}

export interface GraphConfig {
  mainBranchCount: number;
  subBranchCount: number;
  mainRadius: number;
  maxRadius: number;
  segments: number;
  curvature: number;
  subBranchOffset: number;
  subBranchSegments: number;
  subBranchCurvature: number;
}

export interface GeneratedGraph {
  mainBranches: BranchData[];
  subBranches: BranchData[];
}

/**
 * Generate the complete brain graph structure
 */
export function generateBrainGraph(config: GraphConfig): GeneratedGraph {
  const mainBranches: BranchData[] = [];
  const subBranches: BranchData[] = [];

  const origin = new THREE.Vector3(0, 0, 0);
  const stepLength = config.mainRadius / config.segments;

  // Generate main branches
  for (let i = 0; i < config.mainBranchCount; i++) {
    const direction = randomDirection();

    const branch = generateBranch({
      origin,
      direction,
      segments: config.segments,
      curvature: config.curvature,
      stepLength,
      targetRadius: config.mainRadius,
    });

    if (branch) {
      mainBranches.push(branch);

      // Generate sub-branches for this main branch
      for (let j = 0; j < config.subBranchCount; j++) {
        // Pick a random point along the main branch (between 20% and 80%)
        const t = 0.2 + Math.random() * 0.6;
        const spawnPoint = branch.curve.getPointAt(t);
        const subDirection = getSubBranchDirection(
          branch.curve,
          t,
          config.subBranchOffset
        );

        const subStepLength = (config.maxRadius - config.mainRadius * 0.5) / config.subBranchSegments;

        const subBranch = generateBranch({
          origin: spawnPoint,
          direction: subDirection,
          segments: config.subBranchSegments,
          curvature: config.subBranchCurvature,
          stepLength: subStepLength,
          maxRadius: config.maxRadius,
        });

        if (subBranch) {
          subBranches.push(subBranch);
        }
      }
    }
  }

  return { mainBranches, subBranches };
}

