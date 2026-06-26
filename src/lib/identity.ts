import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const PLAYER_COOKIE = "playerId";

export async function getCurrentPlayer() {
  const cookieStore = await cookies();
  const playerId = cookieStore.get(PLAYER_COOKIE)?.value;
  if (!playerId) return null;

  return prisma.player.findUnique({ where: { id: playerId } });
}