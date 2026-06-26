import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { PLAYER_COOKIE } from "@/lib/identity";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const rawName = body?.name;

  if (!rawName || typeof rawName !== "string" || !rawName.trim()) {
    return NextResponse.json({ error: "Enter a name to continue." }, { status: 400 });
  }

  const trimmed = rawName.trim().slice(0, 20);
  const baseName = trimmed.toLowerCase();

  let player = null;
  let attempt = 0;

  while (!player && attempt < 5) {
    const count = await prisma.player.count({ where: { baseName } });
    const suffix = count + 1 + attempt;
    const displayName = suffix === 1 ? trimmed : `${trimmed} ${suffix}`;

    try {
      player = await prisma.player.create({
        data: { baseName, displayName, suffix },
      });
    } catch (err: any) {
      if (err.code === "P2002") {
        attempt++;
        continue;
      }
      throw err;
    }
  }

  if (!player) {
    return NextResponse.json({ error: "That name is busy right now, try again." }, { status: 500 });
  }

  const cookieStore = await cookies();
  cookieStore.set(PLAYER_COOKIE, player.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  return NextResponse.json({ player });
}