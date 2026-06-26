import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/identity";
import { validateFleetConfig, validateAttackConfig } from "@/lib/game-engine/ships";
import { CLASSIC_FLEET, DEFAULT_GRID_SIZE, DEFAULT_ATTACK_CONFIG } from "@/lib/game-engine/types";

export async function POST(req: Request) {
  const player = await getCurrentPlayer();
  if (!player) return NextResponse.json({ error: "No active identity." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const gridSize = Number.isInteger(body?.gridSize) ? body.gridSize : DEFAULT_GRID_SIZE;
  const fleet = Array.isArray(body?.ships) && body.ships.length > 0 ? body.ships : CLASSIC_FLEET;
  const attackConfig = body?.attackConfig ?? DEFAULT_ATTACK_CONFIG;

  const configError = validateFleetConfig(gridSize, fleet);
  if (configError) return NextResponse.json({ error: configError }, { status: 400 });

  const attackConfigError = validateAttackConfig(attackConfig);
  if (attackConfigError) return NextResponse.json({ error: attackConfigError }, { status: 400 });

  const initialCharges: Record<string, number> = {};
  for (const key of ["nuclear", "cluster", "mortar"] as const) {
    if (attackConfig[key]?.enabled) initialCharges[key] = attackConfig[key].charges;
  }

  const game = await prisma.gameSession.create({
    data: {
      hostId: player.id,
      gridSize,
      shipConfig: fleet,
      attackConfig,
      attackCharges: { [player.id]: initialCharges },
    },
  });

  return NextResponse.json({ game });
}