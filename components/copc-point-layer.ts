import * as THREE from "three";
import { Bounds, Copc, Key } from "copc";

export type CopcLayerStats = {
  sourcePoints: number;
  loadedPoints: number;
  loadedNodes: number;
  hierarchyPages: number;
  maxLoadedDepth: number;
  spacing: number;
  hasRgb: boolean;
  coordinateSystem: string | null;
};

export type CopcLoadedLayer = {
  root: THREE.Group;
  bounds: THREE.Box3;
  stats: CopcLayerStats;
  dispose: () => void;
};

type HierarchyNode = {
  key: string;
  depth: number;
  pointCount: number;
  pointDataOffset: number;
  pointDataLength: number;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function colorDivisor(getRed: (index: number) => number, getGreen: (index: number) => number, getBlue: (index: number) => number, count: number) {
  let maximum = 0;
  const stride = Math.max(1, Math.floor(count / 24));
  for (let index = 0; index < count; index += stride) {
    maximum = Math.max(maximum, getRed(index), getGreen(index), getBlue(index));
    if (maximum > 255) return 65535;
  }
  return 255;
}

async function collectHierarchy(url: string, rootPage: { pageOffset: number; pageLength: number }, maxDepth: number) {
  const nodes = new Map<string, HierarchyNode>();
  const queue: Array<{ key: string; page: { pageOffset: number; pageLength: number } }> = [{ key: "0-0-0-0", page: rootPage }];
  const seenPages = new Set<string>();
  let hierarchyPages = 0;

  while (queue.length) {
    const current = queue.shift();
    if (!current || seenPages.has(current.key)) continue;
    seenPages.add(current.key);
    const currentDepth = Key.depth(Key.create(current.key));
    if (currentDepth > maxDepth) continue;
    const subtree = await Copc.loadHierarchyPage(url, current.page);
    hierarchyPages += 1;
    for (const [key, node] of Object.entries(subtree.nodes)) {
      if (!node) continue;
      const depth = Key.depth(Key.create(key));
      if (depth <= maxDepth && node.pointCount > 0) {
        nodes.set(key, { key, depth, ...node });
      }
    }
    for (const [key, page] of Object.entries(subtree.pages)) {
      if (!page) continue;
      if (Key.depth(Key.create(key)) <= maxDepth) queue.push({ key, page });
    }
    if (hierarchyPages >= 96) break;
  }

  return { nodes: [...nodes.values()].sort((a, b) => a.depth - b.depth || a.key.localeCompare(b.key)), hierarchyPages };
}

function selectNodes(nodes: HierarchyNode[], pointBudget: number) {
  const selected: Array<{ node: HierarchyNode; quota: number }> = [];
  let remaining = Math.max(10_000, pointBudget);
  const byDepth = new Map<number, HierarchyNode[]>();
  for (const node of nodes) {
    const list = byDepth.get(node.depth) || [];
    list.push(node);
    byDepth.set(node.depth, list);
  }

  for (const depth of [...byDepth.keys()].sort((a, b) => a - b)) {
    const level = byDepth.get(depth) || [];
    const total = level.reduce((sum, node) => sum + node.pointCount, 0);
    if (!remaining) break;
    if (total <= remaining) {
      for (const node of level) selected.push({ node, quota: node.pointCount });
      remaining -= total;
      continue;
    }

    const ratio = remaining / Math.max(total, 1);
    for (const node of level) {
      const quota = Math.max(1, Math.floor(node.pointCount * ratio));
      if (quota > 0) selected.push({ node, quota });
    }
    remaining = 0;
  }
  return selected;
}

export async function loadCopcPointLayer(input: {
  url: string;
  transformMatrix: number[];
  pointBudget: number;
  maxDepth: number;
  opacity: number;
  pointScale?: number;
  signal?: AbortSignal;
}): Promise<CopcLoadedLayer> {
  if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const copc = await Copc.create(input.url);
  if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const hierarchy = await collectHierarchy(input.url, copc.info.rootHierarchyPage, input.maxDepth);
  const selected = selectNodes(hierarchy.nodes, input.pointBudget);
  const root = new THREE.Group();
  root.matrixAutoUpdate = false;
  root.matrix.fromArray(input.transformMatrix.length === 16 ? input.transformMatrix : new THREE.Matrix4().identity().toArray());

  const cube = copc.info.cube;
  const centerTuple = Bounds.mid(cube);
  const origin = new THREE.Vector3(centerTuple[0], centerTuple[1], centerTuple[2]);
  const originGroup = new THREE.Group();
  originGroup.position.copy(origin);
  originGroup.userData.copcOrigin = centerTuple;
  root.add(originGroup);

  let loadedPoints = 0;
  let loadedNodes = 0;
  let maxLoadedDepth = 0;
  let hasRgb = false;
  const materials: THREE.PointsMaterial[] = [];
  const geometries: THREE.BufferGeometry[] = [];

  for (const { node, quota } of selected) {
    if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const include = ["X", "Y", "Z", "Red", "Green", "Blue", "Intensity", "Classification"];
    const view = await Copc.loadPointDataView(input.url, copc, node, { include });
    const x = view.getter("X");
    const y = view.getter("Y");
    const z = view.getter("Z");
    const useRgb = Boolean(view.dimensions.Red && view.dimensions.Green && view.dimensions.Blue);
    const useIntensity = Boolean(view.dimensions.Intensity);
    hasRgb ||= useRgb;
    const red = useRgb ? view.getter("Red") : null;
    const green = useRgb ? view.getter("Green") : null;
    const blue = useRgb ? view.getter("Blue") : null;
    const intensity = useIntensity ? view.getter("Intensity") : null;
    const divisor = red && green && blue ? colorDivisor(red, green, blue, view.pointCount) : 255;
    const count = Math.min(view.pointCount, quota);
    const stride = Math.max(1, Math.floor(view.pointCount / Math.max(count, 1)));
    const actualCount = Math.min(count, Math.ceil(view.pointCount / stride));
    const positions = new Float32Array(actualCount * 3);
    const colors = new Float32Array(actualCount * 3);

    let targetIndex = 0;
    for (let sourceIndex = 0; sourceIndex < view.pointCount && targetIndex < actualCount; sourceIndex += stride) {
      positions[targetIndex * 3] = x(sourceIndex) - origin.x;
      positions[targetIndex * 3 + 1] = y(sourceIndex) - origin.y;
      positions[targetIndex * 3 + 2] = z(sourceIndex) - origin.z;
      if (red && green && blue) {
        colors[targetIndex * 3] = clamp01(red(sourceIndex) / divisor);
        colors[targetIndex * 3 + 1] = clamp01(green(sourceIndex) / divisor);
        colors[targetIndex * 3 + 2] = clamp01(blue(sourceIndex) / divisor);
      } else if (intensity) {
        const value = 0.18 + clamp01(intensity(sourceIndex) / 65535) * 0.82;
        colors[targetIndex * 3] = value;
        colors[targetIndex * 3 + 1] = value;
        colors[targetIndex * 3 + 2] = value;
      } else {
        colors[targetIndex * 3] = 0.85;
        colors[targetIndex * 3 + 1] = 0.82;
        colors[targetIndex * 3 + 2] = 0.73;
      }
      targetIndex += 1;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const localSpacing = copc.info.spacing / Math.max(1, 2 ** node.depth);
    const material = new THREE.PointsMaterial({
      vertexColors: true,
      transparent: true,
      opacity: input.opacity,
      size: Math.max(localSpacing * (input.pointScale || 0.7), copc.info.spacing * 0.025),
      sizeAttenuation: true,
      depthWrite: input.opacity >= 0.9
    });
    const points = new THREE.Points(geometry, material);
    points.userData.copcNodeKey = node.key;
    points.userData.copcOrigin = centerTuple;
    originGroup.add(points);
    geometries.push(geometry);
    materials.push(material);
    loadedPoints += targetIndex;
    loadedNodes += 1;
    maxLoadedDepth = Math.max(maxLoadedDepth, node.depth);
  }

  root.updateMatrixWorld(true);
  const sourceBounds = new THREE.Box3(
    new THREE.Vector3(copc.header.min[0], copc.header.min[1], copc.header.min[2]),
    new THREE.Vector3(copc.header.max[0], copc.header.max[1], copc.header.max[2])
  );
  const bounds = sourceBounds.clone().applyMatrix4(root.matrix);
  return {
    root,
    bounds,
    stats: {
      sourcePoints: copc.header.pointCount,
      loadedPoints,
      loadedNodes,
      hierarchyPages: hierarchy.hierarchyPages,
      maxLoadedDepth,
      spacing: copc.info.spacing,
      hasRgb,
      coordinateSystem: copc.wkt || null
    },
    dispose: () => {
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      root.clear();
    }
  };
}
