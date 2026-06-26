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
    return NextResponse.json({ error: "You can only resign an active game." }, { status: 409 });
  }

  const opponentId = game.hostId === player.id ? game.guestId! : game.hostId;

  await prisma.$transaction([
    prisma.gameSession.update({
      where: { id },
      data: { status: "FINISHED", winnerId: opponentId, finishedAt: new Date() },
    }),
    prisma.player.update({ where: { id: opponentId }, data: { wins: { increment: 1 } } }),
    prisma.player.update({ where: { id: player.id }, data: { losses: { increment: 1 } } }),
  ]);

  await safeTrigger(`private-game-${id}`, "game-resigned", { byPlayerId: player.id, winnerId: opponentId });

  return NextResponse.json({ ok: true, winnerId: opponentId });
}