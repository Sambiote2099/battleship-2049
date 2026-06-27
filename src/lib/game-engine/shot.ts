import { prisma } from "@/lib/prisma";
import { safeTrigger } from "@/lib/pusher";
import { cellsForAttack } from "./attacks";
import { AttackType } from "./types";

export type CellOutcome = { x: number; y: number; result: "hit" | "miss" | "sunk"; sunkShipType: string | null };

export type AttackOutcome = {
  attackType: AttackType;
  cells: CellOutcome[];
  gameFinished: boolean;
  winnerId: string | null;
  nextTurn: string | null;
  hostTimeMs: number | null;
  guestTimeMs: number | null;
};

type ShipRow = { id: string; type: string; cells: any; hits: any; sunk: boolean };

function resolveCellAgainstShips(opponentShips: ShipRow[], x: number, y: number) {
  for (const ship of opponentShips) {
    const cells: { x: number; y: number }[] = ship.cells as any;
    const isHit = cells.some((c) => c.x === x && c.y === y);
    if (!isHit) continue;

    const hits: { x: number; y: number }[] = (ship.hits as any) ?? [];
    if (hits.some((h) => h.x === x && h.y === y)) {
      return { ship, result: ship.sunk ? ("sunk" as const) : ("hit" as const), alreadyResolved: true };
    }

    const newHits = [...hits, { x, y }];
    const isSunk = cells.every((c) => newHits.some((h) => h.x === c.x && h.y === c.y));
    return { ship, newHits, isSunk, result: isSunk ? ("sunk" as const) : ("hit" as const), alreadyResolved: false };
  }
  return null;
}

async function finalizeTurn(
  gameId: string,
  shooterId: string,
  opponentId: string,
  outcomes: CellOutcome[],
  requestReceivedAt: Date
) {
  const game = await prisma.gameSession.findUnique({ where: { id: gameId } });
  if (!game) throw new Error("Game not found during finalize.");

  const remainingShips = await prisma.ship.count({ where: { gameId, playerId: opponentId, sunk: false } });
  const shotsFiredThisAttack = outcomes.length;
  const shotsHitThisAttack = outcomes.filter((o) => o.result !== "miss").length;

  let gameFinished = false;
  let winnerId: string | null = null;
  let nextTurn: string | null = null;
  let hostTimeMs = game.hostTimeMs;
  let guestTimeMs = game.guestTimeMs;

  if (!game.vsAI && game.turnStartedAt) {
    const elapsed = requestReceivedAt.getTime() - game.turnStartedAt.getTime();
    if (shooterId === game.hostId && hostTimeMs != null) {
      hostTimeMs = Math.max(0, hostTimeMs - elapsed);
    } else if (shooterId === game.guestId && guestTimeMs != null) {
      guestTimeMs = Math.max(0, guestTimeMs - elapsed);
    }
  }

  if (remainingShips === 0) {
    gameFinished = true;
    winnerId = shooterId;
    await Promise.all([
      prisma.gameSession.update({
        where: { id: gameId },
        data: { status: "FINISHED", winnerId: shooterId, finishedAt: new Date(), hostTimeMs, guestTimeMs },
      }),
      prisma.player.update({
        where: { id: shooterId },
        data: {
          wins: { increment: 1 },
          shotsFired: { increment: shotsFiredThisAttack },
          shotsHit: { increment: shotsHitThisAttack },
        },
      }),
      prisma.player.update({ where: { id: opponentId }, data: { losses: { increment: 1 } } }),
    ]);
  } else {
    nextTurn = opponentId;
    await Promise.all([
      prisma.gameSession.update({
        where: { id: gameId },
        data: { currentTurn: opponentId, turnStartedAt: new Date(), hostTimeMs, guestTimeMs },
      }),
      prisma.player.update({
        where: { id: shooterId },
        data: {
          shotsFired: { increment: shotsFiredThisAttack },
          shotsHit: { increment: shotsHitThisAttack },
        },
      }),
    ]);
  }

  return { gameFinished, winnerId, nextTurn, hostTimeMs, guestTimeMs };
}

export async function executeShot(gameId: string, shooterId: string, x: number, y: number) {
  return executeAreaAttack(gameId, shooterId, "single", x, y, new Date());
}

export async function executeAreaAttack(
  gameId: string,
  shooterId: string,
  attackType: AttackType,
  centerX: number,
  centerY: number,
  requestReceivedAt: Date
): Promise<AttackOutcome> {
  const game = await prisma.gameSession.findUnique({ where: { id: gameId } });
  if (!game) throw new Error("Game not found.");

  const opponentId = game.hostId === shooterId ? game.guestId! : game.hostId;

  const previousMoves = await prisma.move.findMany({ where: { gameId, playerId: shooterId } });
  const alreadyFired = new Set(previousMoves.map((m) => `${m.x},${m.y}`));

  const candidateCells = cellsForAttack(attackType, centerX, centerY, game.gridSize, alreadyFired);
  const newCells = candidateCells.filter((c) => !alreadyFired.has(`${c.x},${c.y}`));

  if (newCells.length === 0) {
    throw new Error("Every cell in that area has already been targeted.");
  }

  const turnNumber = (await prisma.move.count({ where: { gameId } })) + 1;

  // Fetch opponent ships ONCE for the whole attack, not once per cell.
  const opponentShips: ShipRow[] = await prisma.ship.findMany({ where: { gameId, playerId: opponentId } });

  const outcomes: CellOutcome[] = [];
  const shipUpdates: { id: string; hits: any; sunk: boolean }[] = [];

  for (const cell of newCells) {
    const resolved = resolveCellAgainstShips(opponentShips, cell.x, cell.y);

    if (!resolved) {
      outcomes.push({ x: cell.x, y: cell.y, result: "miss", sunkShipType: null });
      continue;
    }

    if (resolved.alreadyResolved) {
      outcomes.push({ x: cell.x, y: cell.y, result: resolved.result, sunkShipType: resolved.result === "sunk" ? resolved.ship.type : null });
      continue;
    }

    // Mutate the in-memory copy so subsequent cells in this same attack
    // see the updated hit state (matters when one attack hits the same
    // ship twice, e.g. two adjacent nuke cells on one ship).
    resolved.ship.hits = resolved.newHits;
    resolved.ship.sunk = resolved.isSunk!;
    shipUpdates.push({ id: resolved.ship.id, hits: resolved.newHits, sunk: resolved.isSunk! });

    outcomes.push({
      x: cell.x,
      y: cell.y,
      result: resolved.result,
      sunkShipType: resolved.isSunk ? resolved.ship.type : null,
    });
  }

  // Ship updates must stay sequential if they target the same ship (rare but
  // possible within one attack), so we keep this loop simple rather than
  // risking a lost-update race from parallelizing same-ship writes.
  for (const update of shipUpdates) {
    await prisma.ship.update({ where: { id: update.id }, data: { hits: update.hits, sunk: update.sunk } });
  }

  // All Move rows for this attack are written in a single batched insert
  // instead of one round-trip per cell.
  await prisma.move.createMany({
    data: outcomes.map((o) => ({
      gameId,
      playerId: shooterId,
      x: o.x,
      y: o.y,
      result: o.result,
      turnNumber,
      attackType,
    })),
  });

  const { gameFinished, winnerId, nextTurn, hostTimeMs, guestTimeMs } = await finalizeTurn(
    gameId,
    shooterId,
    opponentId,
    outcomes,
    requestReceivedAt
  );

  const result: AttackOutcome = { attackType, cells: outcomes, gameFinished, winnerId, nextTurn, hostTimeMs, guestTimeMs };

  await safeTrigger(`private-game-${gameId}`, "shot-fired", { playerId: shooterId, ...result });

  return result;
}