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
  if (game.status !== "WAITING" && game.status !== "PLACING") {
    return NextResponse.json(
      { error: "This game has already started — resign instead." },
      { status: 409 }
    );
  }

  await safeTrigger(`private-game-${id}`, "game-cancelled", { byPlayerId: player.id });
  await prisma.gameSession.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}