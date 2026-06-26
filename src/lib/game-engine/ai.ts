import { prisma } from "@/lib/prisma";
import { ShipPlacement, ShipSpec, AttackType } from "./types";

export async function getOrCreateBot() {
  let bot = await prisma.player.findFirst({ where: { isBot: true } });
  if (!bot) {
    bot = await prisma.player.create({
      data: { baseName: "computer", displayName: "Computer", suffix: 1, isBot: true },
    });
  }
  return bot;
}

function cellsFor(startX: number, startY: number, length: number, horizontal: boolean) {
  const cells = [];
  for (let i = 0; i < length; i++) {
    cells.push(horizontal ? { x: startX + i, y: startY } : { x: startX, y: startY + i });
  }
  return cells;
}

function inBounds(cells: { x: number; y: number }[], gridSize: number) {
  return cells.every((c) => c.x >= 0 && c.x < gridSize && c.y >= 0 && c.y < gridSize);
}

function overlaps(cells: { x: number; y: number }[], placements: ShipPlacement[]) {
  const occupied = new Set(placements.flatMap((p) => p.cells.map((c) => `${c.x},${c.y}`)));
  return cells.some((c) => occupied.has(`${c.x},${c.y}`));
}

export function generateRandomFleet(gridSize: number, fleet: ShipSpec[]): ShipPlacement[] {
  const placements: ShipPlacement[] = [];
  for (const spec of fleet) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 500) {
      attempts++;
      const horizontal = Math.random() < 0.5;
      const startX = Math.floor(Math.random() * gridSize);
      const startY = Math.floor(Math.random() * gridSize);
      const cells = cellsFor(startX, startY, spec.length, horizontal);
      if (!inBounds(cells, gridSize) || overlaps(cells, placements)) continue;
      placements.push({ type: spec.type, cells });
      placed = true;
    }
    if (!placed) throw new Error("Could not generate a random fleet — please retry.");
  }
  return placements;
}

export async function pickAIMove(
  gameId: string,
  aiId: string,
  humanId: string,
  gridSize: number
): Promise<{ x: number; y: number }> {
  const [aiMoves, humanShips] = await Promise.all([
    prisma.move.findMany({ where: { gameId, playerId: aiId } }),
    prisma.ship.findMany({ where: { gameId, playerId: humanId } }),
  ]);

  const tried = new Set(aiMoves.map((m) => `${m.x},${m.y}`));

  const liveHitCells: { x: number; y: number }[] = [];
  for (const move of aiMoves) {
    if (move.result === "miss") continue;
    const ship = humanShips.find((s) =>
      (s.cells as any).some((c: any) => c.x === move.x && c.y === move.y)
    );
    if (ship && !ship.sunk) liveHitCells.push({ x: move.x, y: move.y });
  }

  const candidates: { x: number; y: number }[] = [];
  for (const cell of liveHitCells) {
    const neighbors = [
      { x: cell.x + 1, y: cell.y },
      { x: cell.x - 1, y: cell.y },
      { x: cell.x, y: cell.y + 1 },
      { x: cell.x, y: cell.y - 1 },
    ];
    for (const n of neighbors) {
      if (n.x < 0 || n.x >= gridSize || n.y < 0 || n.y >= gridSize) continue;
      if (tried.has(`${n.x},${n.y}`)) continue;
      candidates.push(n);
    }
  }

  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  const untried: { x: number; y: number }[] = [];
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      if (!tried.has(`${x},${y}`)) untried.push({ x, y });
    }
  }
  return untried[Math.floor(Math.random() * untried.length)];
}

export async function pickAIAttack(
  gameId: string,
  aiId: string,
  humanId: string,
  gridSize: number,
  charges: Record<string, number>,
  attackConfig: any
): Promise<{ attackType: AttackType; x: number; y: number }> {
  const target = await pickAIMove(gameId, aiId, humanId, gridSize);

  const available: AttackType[] = [];
  for (const type of ["nuclear", "cluster", "mortar"] as const) {
    if (attackConfig?.[type]?.enabled && (charges?.[type] ?? 0) > 0) {
      available.push(type);
    }
  }

  if (available.length === 0) {
    return { attackType: "single", x: target.x, y: target.y };
  }

  // 40% chance to use a special attack when one's available, rather than
  // burning through limited charges on every single turn.
  if (Math.random() < 0.4) {
    const chosen = available[Math.floor(Math.random() * available.length)];
    return { attackType: chosen, x: target.x, y: target.y };
  }

  return { attackType: "single", x: target.x, y: target.y };
}