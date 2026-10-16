import { assessJump } from "./jump-rules.js";

// Pure layout planning: reserve navigable corridors before adding household clutter.
export function overlaps(a, b, margin = 0) {
  return a.maxX + margin > b.minX && a.minX - margin < b.maxX
    && a.maxZ + margin > b.minZ && a.minZ - margin < b.maxZ;
}

export function footprint(x, z, width, depth = width) {
  return { minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 };
}

export function findFloorRoute(start, target, bounds, boxes, bodyHeight = 0.76) {
  const grid = 0.65;
  const columns = Math.floor((bounds.maxX - bounds.minX) / grid) + 1;
  const rows = Math.floor((bounds.maxZ - bounds.minZ) / grid) + 1;
  const cell = (point) => [
    Math.max(0, Math.min(columns - 1, Math.round((point[0] - bounds.minX) / grid))),
    Math.max(0, Math.min(rows - 1, Math.round((point[2] - bounds.minZ) / grid))),
  ];
  const world = (index) => [bounds.minX + (index % columns) * grid, 0, bounds.minZ + Math.floor(index / columns) * grid];
  const [sx, sz] = cell(start);
  const [tx, tz] = cell(target);
  const first = sz * columns + sx;
  const last = tz * columns + tx;
  const solid = boxes.filter((box) => box.maxY > 0.18 && box.minY < bodyHeight
    && !(target[1] > 0.2 && target[0] >= box.minX && target[0] <= box.maxX
      && target[2] >= box.minZ && target[2] <= box.maxZ && Math.abs(box.maxY - target[1]) < 0.16));
  const blocked = new Uint8Array(columns * rows);
  for (let index = 0; index < blocked.length; index += 1) {
    const [x, , z] = world(index);
    blocked[index] = solid.some((box) => x > box.minX - 0.55 && x < box.maxX + 0.55
      && z > box.minZ - 0.55 && z < box.maxZ + 0.55) ? 1 : 0;
  }
  blocked[first] = blocked[last] = 0;
  const previous = new Int32Array(columns * rows).fill(-1);
  const queue = [first];
  previous[first] = first;
  for (let cursor = 0; cursor < queue.length && previous[last] < 0; cursor += 1) {
    const index = queue[cursor];
    const x = index % columns;
    const z = Math.floor(index / columns);
    for (const [dx, dz] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nx >= columns || nz < 0 || nz >= rows) continue;
      const next = nz * columns + nx;
      if (blocked[next] || previous[next] >= 0) continue;
      previous[next] = index;
      queue.push(next);
    }
  }
  if (previous[last] < 0) return null;
  const route = [target];
  for (let index = last; index !== first; index = previous[index]) route.push(world(index));
  route.push(start);
  return route.reverse();
}

export function generateCourse({ random, difficulty, bounds, boxes, spawn, targets, protectedAreas = [], bodyHeight }) {
  const routes = targets.map((target) => findFloorRoute(spawn, target, bounds, boxes, bodyHeight));
  if (routes.some((route) => !route)) throw new Error("House layout has an unreachable objective");
  const corridors = routes.flat().map(([x, , z]) => footprint(x, z, 1.8));
  const occupied = [...boxes, ...protectedAreas, ...targets.map(([x, , z]) => footprint(x, z, 3.0))];
  const obstacles = [];
  const clear = (area) => area.minX > bounds.minX + 0.8 && area.maxX < bounds.maxX - 0.8
    && area.minZ > bounds.minZ + 0.8 && area.maxZ < bounds.maxZ - 0.8
    && !occupied.some((box) => overlaps(area, box, 0.45))
    && !corridors.some((box) => overlaps(area, box, 0.12));
  const place = (type, count, dimensions) => {
    let placed = 0;
    for (let attempt = 0; placed < count && attempt < count * 1200; attempt += 1) {
      const x = bounds.minX + 2 + random() * (bounds.maxX - bounds.minX - 4);
      const z = bounds.minZ + 2 + random() * (bounds.maxZ - bounds.minZ - 4);
      const size = dimensions();
      if (size.jump && !size.jump.allowed) continue;
      const area = footprint(x, z, size.reserveWidth ?? size.width, size.reserveDepth ?? size.depth);
      if (!clear(area)) continue;
      const obstacle = { type, x, z, ...size, phase: random() * Math.PI * 2, area };
      obstacles.push(obstacle);
      occupied.push(area);
      placed += 1;
    }
  };
  // Reserve the largest swept hazards first, before smaller obstacles fragment
  // the available space around protected routes and optional enemy patrols.
  place("vacuum", 1 + Math.floor(difficulty / 2), () => {
    const length = 2.0 + random() * 0.7;
    return { width: (length + 0.65) * 2, depth: (length + 0.65) * 2, length };
  });
  place("bridge", 1 + Math.floor(difficulty / 2), () => {
    const depth = 2.4 + random() * 0.4;
    return { width: 4.6 + random() * 1.2, depth, height: 0.34, jump: assessJump({ rise: 0.34, gap: (depth - 1.4) / 2 }) };
  });
  place("hurdle", 3 + difficulty, () => {
    const width = 2.3 + random() * 1.7;
    const height = Math.min(assessJump().peak - 0.20, 0.32 + random() * (0.20 + difficulty * 0.06));
    const jump = assessJump({ rise: height, gap: 0.46 });
    return { width, depth: 0.46, height, reserveWidth: width + 0.6, reserveDepth: 0.46 + jump.runup + jump.landing, jump };
  });
  place("clutter", 20 + difficulty * 4, () => ({ width: 0.9 + random() * 0.85, depth: 0.9 + random() * 0.65, height: 0.24 + random() * 0.44, style: Math.floor(random() * 3) }));
  return { obstacles, routes, corridorWidth: 1.8 };
}
