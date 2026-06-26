import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/identity";
import { CLASSIC_FLEET } from "@/lib/game-engine/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const player = await getCurrentPlayer();
  if (!player) return NextResponse.json({ error: "No active identity." }, { status: 401 });

  const game = await prisma.gameSession.findUnique({
    where: { id },
    include: { host: true, guest: true, ships: true, moves: { orderBy: { turnNumber: "asc" } } },
  });

  if (!game) return NextResponse.json({ error: "Game not found." }, { status: 404 });
  if (game.hostId !== player.id && game.guestId !== player.id) {
    return NextResponse.json({ error: "Not your game." }, { status: 403 });
  }

  const opponentId = game.hostId === player.id ? game.guestId : game.hostId;

  const myShips = game.ships.filter((s) => s.playerId === player.id);
  const opponentShips = game.ships
    .filter((s) => s.playerId === opponentId)
    .map((s) => (s.sunk ? s : { ...s, cells: [] })); // hide unsunk opponent ships

  return NextResponse.json({
    game: {
      id: game.id,
      status: game.status,
      currentTurn: game.currentTurn,
      winnerId: game.winnerId,
      host: game.host,
      guest: game.guest,
      gridSize: game.gridSize,
      fleet: (game.shipConfig as any) ?? CLASSIC_FLEET,
      vsAI: game.vsAI,
      attackConfig: game.attackConfig ?? null,
      attackCharges: game.attackCharges ?? null,
      turnStartedAt: game.turnStartedAt,
      hostTimeMs: game.hostTimeMs,
      guestTimeMs: game.guestTimeMs,
    },
    you: { id: player.id, ships: myShips, ready: myShips.length === 5 },
    opponent: {
      id: opponentId,
      ships: opponentShips,
      ready: game.ships.filter((s) => s.playerId === opponentId).length === 5,
    },
    moves: game.moves,
  });
}