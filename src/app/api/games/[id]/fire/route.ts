import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/identity";
import { executeShot, executeAreaAttack } from "@/lib/game-engine/shot";
import { pickAIAttack } from "@/lib/game-engine/ai";
import type { AttackType } from "@/lib/game-engine/types";

const SPECIAL_TYPES: AttackType[] = ["nuclear", "cluster", "mortar"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestReceivedAt = new Date();
  const { id } = await params;
  const player = await getCurrentPlayer();
  if (!player) return NextResponse.json({ error: "No active identity." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const x = body?.x;
  const y = body?.y;
  const attackType: AttackType = SPECIAL_TYPES.includes(body?.attackType) ? body.attackType : "single";

  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }

  const game = await prisma.gameSession.findUnique({ where: { id } });
  if (!game) return NextResponse.json({ error: "Game not found." }, { status: 404 });

  if (x < 0 || x >= game.gridSize || y < 0 || y >= game.gridSize) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }
  if (game.status !== "ACTIVE") {
    return NextResponse.json({ error: "This game isn't active." }, { status: 409 });
  }
  if (game.hostId !== player.id && game.guestId !== player.id) {
    return NextResponse.json({ error: "You're not part of this game." }, { status: 403 });
  }
  if (game.currentTurn !== player.id) {
    return NextResponse.json({ error: "It's not your turn." }, { status: 409 });
  }

  if (attackType !== "single") {
    const config: any = game.attackConfig ?? {};
    const entry = config[attackType];
    if (!entry?.enabled) {
      return NextResponse.json({ error: "That attack type isn't enabled for this game." }, { status: 400 });
    }
    const charges: any = (game.attackCharges as any) ?? {};
    const mine = charges[player.id] ?? {};
    const remaining = mine[attackType] ?? 0;
    if (remaining <= 0) {
      return NextResponse.json({ error: "No charges remaining for that attack." }, { status: 409 });
    }
  } else {
    const alreadyFired = await prisma.move.findFirst({ where: { gameId: id, playerId: player.id, x, y } });
    if (alreadyFired) {
      return NextResponse.json({ error: "You already fired there." }, { status: 409 });
    }
  }

  let humanOutcome;
  try {
    humanOutcome =
      attackType === "single"
        ? await executeShot(id, player.id, x, y)
        : await executeAreaAttack(id, player.id, attackType, x, y, requestReceivedAt);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Could not process attack." }, { status: 400 });
  }

  if (attackType !== "single") {
    await decrementCharge(id, player.id, attackType);
  }

  let aiOutcome = null;

  if (!humanOutcome.gameFinished && game.vsAI && humanOutcome.nextTurn) {
    const aiId = humanOutcome.nextTurn;
    await new Promise((resolve) => setTimeout(resolve, 400));

    const freshGame = await prisma.gameSession.findUnique({ where: { id } });
    const aiCharges = (freshGame?.attackCharges as any)?.[aiId] ?? {};

    const aiChoice = await pickAIAttack(id, aiId, player.id, game.gridSize, aiCharges, game.attackConfig as any);

    aiOutcome =
      aiChoice.attackType === "single"
        ? await executeShot(id, aiId, aiChoice.x, aiChoice.y)
        : await executeAreaAttack(id, aiId, aiChoice.attackType, aiChoice.x, aiChoice.y, new Date());

    if (aiChoice.attackType !== "single") {
      await decrementCharge(id, aiId, aiChoice.attackType);
    }
  }

  return NextResponse.json({ human: humanOutcome, ai: aiOutcome });
}

async function decrementCharge(gameId: string, playerId: string, attackType: AttackType) {
  const fresh = await prisma.gameSession.findUnique({ where: { id: gameId } });
  const allCharges: any = (fresh?.attackCharges as any) ?? {};
  const mine = { ...(allCharges[playerId] ?? {}) };
  mine[attackType] = Math.max(0, (mine[attackType] ?? 0) - 1);
  const updatedCharges = { ...allCharges, [playerId]: mine };
  await prisma.gameSession.update({ where: { id: gameId }, data: { attackCharges: updatedCharges } });
}