import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/identity";
import { prisma } from "@/lib/prisma";
import GameClient from "@/components/GameClient";
import Image from "next/image";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getCurrentPlayer();
  if (!player) redirect("/");

  const game = await prisma.gameSession.findUnique({
    where: { id },
    include: { host: true, guest: true },
  });

  if (!game) {
    return (
      <main id="main" className="min-h-screen bg-deep-navy flex items-center justify-center">
        <p className="text-mist">This game doesn&apos;t exist.</p>
      </main>
    );
  }

  if (game.hostId !== player.id && game.guestId !== player.id) {
    return (
      <main id="main" className="min-h-screen bg-deep-navy flex items-center justify-center">
        <p className="text-mist">You&apos;re not part of this game.</p>
      </main>
    );
  }

  return (
    <main id="main" className="min-h-screen px-4 py-10">
       <div className="fixed inset-0 z-0 bg-black overflow-hidden">
               <Image
                 src="/23ba737b-1dab-4d8d-9286-05c29905a099.jpg"
                 alt=""
                 fill
                 priority
                 className="object-cover opacity-45"
               />
             </div>
      <div className="max-w-3xl mx-auto flex flex-col gap-8 z-10 relative">
        <GameClient gameId={id} />
      </div>
    </main>
  );
}