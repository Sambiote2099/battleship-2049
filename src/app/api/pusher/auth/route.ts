import { NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";
import { getCurrentPlayer } from "@/lib/identity";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const player = await getCurrentPlayer();
  if (!player) {
    return NextResponse.json({ error: "No active identity." }, { status: 401 });
  }

  const formData = await req.formData();
  const socketId = formData.get("socket_id") as string | null;
  const channelName = formData.get("channel_name") as string | null;

  if (!socketId || !channelName) {
    return NextResponse.json({ error: "Missing socket_id or channel_name." }, { status: 400 });
  }

  const match = channelName.match(/^private-game-(.+)$/);
  if (!match) {
    return NextResponse.json({ error: "Unrecognized channel." }, { status: 403 });
  }

  const game = await prisma.gameSession.findUnique({ where: { id: match[1] } });
  if (!game || (game.hostId !== player.id && game.guestId !== player.id)) {
    return NextResponse.json({ error: "Not authorized for this channel." }, { status: 403 });
  }

  const authResponse = pusherServer.authorizeChannel(socketId, channelName);
  return NextResponse.json(authResponse);
}