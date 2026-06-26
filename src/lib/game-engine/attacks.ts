import { Cell, AttackType } from "./types";

export function nuclearCells(cx: number, cy: number, gridSize: number): Cell[] {
  const cells: Cell[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) cells.push({ x, y });
    }
  }
  return cells;
}

export function mortarCells(cx: number, cy: number, gridSize: number): Cell[] {
  const offsets: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const cells: Cell[] = [];
  for (const [dx, dy] of offsets) {
    const x = cx + dx;
    const y = cy + dy;
    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) cells.push({ x, y });
  }
  return cells;
}

export function clusterCells(cx: number, cy: number, gridSize: number, alreadyFired: Set<string>): Cell[] {
  const cells: Cell[] = [{ x: cx, y: cy }];
  const seen = new Set<string>([`${cx},${cy}`]);
  const extraTargets = 4;
  let attempts = 0;
  while (cells.length < extraTargets + 1 && attempts < 200) {
    attempts++;
    const x = Math.floor(Math.random() * gridSize);
    const y = Math.floor(Math.random() * gridSize);
    const key = `${x},${y}`;
    if (seen.has(key) || alreadyFired.has(key)) continue;
    seen.add(key);
    cells.push({ x, y });
  }
  return cells;
}

export function cellsForAttack(
  type: AttackType,
  cx: number,
  cy: number,
  gridSize: number,
  alreadyFired: Set<string>
): Cell[] {
  switch (type) {
    case "single":
      return [{ x: cx, y: cy }];
    case "nuclear":
      return nuclearCells(cx, cy, gridSize);
    case "mortar":
      return mortarCells(cx, cy, gridSize);
    case "cluster":
      return clusterCells(cx, cy, gridSize, alreadyFired);
  }
}