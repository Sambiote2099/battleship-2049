import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/identity";
import { validateFleetPlacement } from "@/lib/game-engine/ships";
import { CLASSIC_FLEET, turnDurationMsForGrid } from "@/lib/game-engine/types";
import type { ShipPlacement, ShipSpec } from "@/lib/game-engine/types";
import { safeTrigger } from "@/lib/pusher";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const player = await getCurrentPlayer();
  if (!player) return NextResponse.json({ error: "No active identity." }, { status: 401 });

  const game = await prisma.gameSession.findUnique({ where: { id } });
  if (!game) return NextResponse.json({ error: "Game not found." }, { status: 404 });

  if (game.hostId !== player.id && game.guestId !== player.id) {
    return NextResponse.json({ error: "You're not part of this game." }, { status: 403 });
  }
  if (game.status !== "PLACING") {
    return NextResponse.json({ error: "This game isn't in the placement phase." }, { status: 409 });
  }

  const existing = await prisma.ship.count({ where: { gameId: id, playerId: player.id } });
  if (existing > 0) {
    return NextResponse.json({ error: "You've already placed your fleet." }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const placements: ShipPlacement[] = body?.ships;

  if (!Array.isArray(placements)) {
    return NextResponse.json({ error: "Malformed placement payload." }, { status: 400 });
  }

  const fleet: ShipSpec[] = (game.shipConfig as any) ?? CLASSIC_FLEET;

  const validationError = validateFleetPlacement(placements, fleet, game.gridSize);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  await prisma.ship.createMany({
    data: placements.map((p) => ({
      gameId: id,
      playerId: player.id,
      type: p.type,
      cells: p.cells,
    })),
  });

  const shipCounts = await prisma.ship.groupBy({
    by: ["playerId"],
    where: { gameId: id },
    _count: { id: true },
  });

  const bothReady =
    shipCounts.length === 2 && shipCounts.every((s) => s._count.id === fleet.length);

  if (bothReady) {
    const updateData: any = { status: "ACTIVE", currentTurn: game.hostId };
    if (!game.vsAI) {
      const durationMs = turnDurationMsForGrid(game.gridSize);
      updateData.turnStartedAt = new Date();
      updateData.hostTimeMs = durationMs;
      updateData.guestTimeMs = durationMs;
    }
    await prisma.gameSession.update({ where: { id }, data: updateData });
  }

  await safeTrigger(`private-game-${id}`, "ships-placed", { playerId: player.id, bothReady });

  return NextResponse.json({ ok: true, bothReady });
}