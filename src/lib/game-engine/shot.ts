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

async function resolveCellHit(
  gameId: string,
  opponentId: string,
  x: number,
  y: number,
  shooterId: string,
  turnNumber: number,
  attackType: AttackType
): Promise<CellOutcome> {
  const opponentShips = await prisma.ship.findMany({ where: { gameId, playerId: opponentId } });

  let result: "hit" | "miss" | "sunk" = "miss";
  let sunkShipType: string | null = null;

  for (const ship of opponentShips) {
    const cells: { x: number; y: number }[] = ship.cells as any;
    const isHit = cells.some((c) => c.x === x && c.y === y);
    if (isHit) {
      const hits: { x: number; y: number }[] = (ship.hits as any) ?? [];
      if (hits.some((h) => h.x === x && h.y === y)) {
        result = ship.sunk ? "sunk" : "hit";
        sunkShipType = ship.sunk ? ship.type : null;
        break;
      }
      const newHits = [...hits, { x, y }];
      const isSunk = cells.every((c) => newHits.some((h) => h.x === c.x && h.y === c.y));
      await prisma.ship.update({ where: { id: ship.id }, data: { hits: newHits, sunk: isSunk } });
      result = isSunk ? "sunk" : "hit";
      if (isSunk) sunkShipType = ship.type;
      break;
    }
  }

  await prisma.move.create({
    data: { gameId, playerId: shooterId, x, y, result, turnNumber, attackType },
  });

  return { x, y, result, sunkShipType };
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

  // Chess-clock: charge elapsed thinking time to whoever just moved. PvP only —
  // vs-AI games never set up a clock in the first place, so this is a no-op there.
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

  const outcomes: CellOutcome[] = [];
  for (const cell of newCells) {
    outcomes.push(await resolveCellHit(gameId, opponentId, cell.x, cell.y, shooterId, turnNumber, attackType));
  }

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