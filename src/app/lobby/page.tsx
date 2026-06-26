import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/identity";
import { prisma } from "@/lib/prisma";
import LobbyClient from "@/components/LobbyClient";
import Image from "next/image";

export default async function LobbyPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/");

  const openGames = await prisma.gameSession.findMany({
    where: { status: "WAITING" },
    include: { host: true },
    orderBy: { createdAt: "desc" },
  }).then(games => games.map(g => ({
    id: g.id,
    gridSize: g.gridSize,
    host: g.host,
  })));

 return (
    <main id="main" className="min-h-screen px-4 py-10 relative">
      
      <div className="fixed inset-0 z-0 bg-black overflow-hidden">
        <Image
          src="/logo-light-transparent.png"
          alt=""
          height={320}
          width={320}
          priority
          className="object-cover"
        />
        <Image
          src="/23ba737b-1dab-4d8d-9286-05c29905a099.jpg"
          alt=""
          fill
          priority
          className="object-cover opacity-45"
        />
      </div>

      <div className="max-w-2xl mx-auto relative z-10">
        <LobbyClient player={player} openGames={openGames} />
      </div>
    </main>
  );
}