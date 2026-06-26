import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/identity";
import { safeTrigger } from "@/lib/pusher";
import { DEFAULT_ATTACK_CONFIG } from "@/lib/game-engine/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const player = await getCurrentPlayer();
  if (!player) {
    return NextResponse.json({ error: "No active identity." }, { status: 401 });
  }

  const game = await prisma.gameSession.findUnique({ where: { id } });

  if (!game) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  }
  if (game.status !== "WAITING") {
    return NextResponse.json({ error: "This game already has two players." }, { status: 409 });
  }
  if (game.hostId === player.id) {
    return NextResponse.json({ error: "You can't join your own game." }, { status: 400 });
  }

  const config: any = game.attackConfig ?? DEFAULT_ATTACK_CONFIG;
  const initialCharges: Record<string, number> = {};
  for (const key of ["nuclear", "cluster", "mortar"] as const) {
    if (config[key]?.enabled) initialCharges[key] = config[key].charges;
  }
  const existingCharges: any = game.attackCharges ?? {};
  const updatedCharges = { ...existingCharges, [player.id]: initialCharges };

  const updated = await prisma.gameSession.update({
    where: { id },
    data: { guestId: player.id, status: "PLACING", startedAt: new Date(), attackCharges: updatedCharges },
  });

  await safeTrigger(`private-game-${id}`, "player-joined", {
    guestId: player.id,
    guestName: player.displayName,
  });

  return NextResponse.json({ game: updated });
}