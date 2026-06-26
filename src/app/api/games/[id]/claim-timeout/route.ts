import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/identity";
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

  if (game.status !== "ACTIVE") {
    return NextResponse.json({ ok: true, alreadyResolved: true, winnerId: game.winnerId });
  }

  if (game.vsAI || !game.turnStartedAt || !game.currentTurn) {
    return NextResponse.json({ error: "Timer isn't active for this game." }, { status: 400 });
  }

  const elapsed = Date.now() - game.turnStartedAt.getTime();
  const movingPlayerId = game.currentTurn;
  const movingPlayerBank = movingPlayerId === game.hostId ? game.hostTimeMs : game.guestTimeMs;

  if (movingPlayerBank == null || elapsed < movingPlayerBank) {
    return NextResponse.json({ error: "That player's clock hasn't actually run out yet." }, { status: 409 });
  }

  const winnerId = movingPlayerId === game.hostId ? game.guestId! : game.hostId;
  const loserId = movingPlayerId;

  await prisma.$transaction([
    prisma.gameSession.update({
      where: { id },
      data: {
        status: "FINISHED",
        winnerId,
        finishedAt: new Date(),
        ...(movingPlayerId === game.hostId ? { hostTimeMs: 0 } : { guestTimeMs: 0 }),
      },
    }),
    prisma.player.update({ where: { id: winnerId }, data: { wins: { increment: 1 } } }),
    prisma.player.update({ where: { id: loserId }, data: { losses: { increment: 1 } } }),
  ]);

  await safeTrigger(`private-game-${id}`, "game-timeout", { winnerId, loserId });

  return NextResponse.json({ ok: true, winnerId });
}