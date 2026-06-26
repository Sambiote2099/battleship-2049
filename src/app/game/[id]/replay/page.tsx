import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/identity";
import { prisma } from "@/lib/prisma";
import ReplayViewer from "@/components/ReplayViewer";
import Image from "next/image";

export default async function ReplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const player = await getCurrentPlayer();
  if (!player) redirect("/");

  const game = await prisma.gameSession.findUnique({
    where: { id },
    include: { host: true, guest: true, moves: { orderBy: { turnNumber: "asc" } } },
  });

  if (!game) {
    return (
      <main id="main" className="min-h-screen bg-deep-navy flex items-center justify-center">
        <p className="text-mist">This game doesn't exist.</p>
      </main>
    );
  }

  if (game.status !== "FINISHED") {
    return (
      <main id="main" className="min-h-screen bg-deep-navy flex items-center justify-center">
        <p className="text-mist">This game isn't finished yet.</p>
      </main>
    );
  }

  if (game.hostId !== player.id && game.guestId !== player.id) {
    return (
      <main id="main" className="min-h-screen bg-deep-navy flex items-center justify-center">
        <p className="text-mist">You didn't play in this game.</p>
      </main>
    );
  }

  return (
    <main id="main" className="min-h-screen bg-deep-navy px-4 py-10">
      <div className="fixed inset-0 z-0 bg-black overflow-hidden">
                     <Image
                       src="/23ba737b-1dab-4d8d-9286-05c29905a099.jpg"
                       alt=""
                       fill
                       priority
                       className="object-cover opacity-45"
                     />
                   </div>
      <div className="max-w-4xl mx-auto z-10 relative">
        <div className="mb-8">
          <a href="/stats" className="text-sea-foam text-sm hover:underline">
            ← Back to stats
          </a>
        </div>
        <ReplayViewer game={game} />
      </div>
    </main>
  );
}