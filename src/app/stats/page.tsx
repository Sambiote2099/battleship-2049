import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentPlayer } from "@/lib/identity";
import { prisma } from "@/lib/prisma";
import Image from "next/image";

export default async function StatsPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/");

  const games = await prisma.gameSession.findMany({
    where: {
      status: "FINISHED",
      OR: [{ hostId: player.id }, { guestId: player.id }],
    },
    include: { host: true, guest: true },
    orderBy: { finishedAt: "desc" },
    take: 20,
  });

  const totalGames = player.wins + player.losses;
  const winRate = totalGames > 0 ? Math.round((player.wins / totalGames) * 100) : 0;
  const accuracy = player.shotsFired > 0 ? Math.round((player.shotsHit / player.shotsFired) * 100) : 0;

  return (
    <main id="main" className="min-h-screen  px-4 py-10">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <Image
          src="/Tirpitz_Brandenburg_Bismarck_Art_key-artwork_1920x1080_WG_Spb_WoWSL_NoLogo.jpg.9c31f53053d6b05df1ee40b32b722d9c.jpg"
          alt=""
          fill
          priority
          className="object-cover opacity-45 blur-[3px]"
        />
      </div>
      <div className="max-w-2xl mx-auto z-10">
       
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-mist">{player.displayName}&apos;s stats</h1>
          <Link href="/lobby" className="text-sea-foam text-sm hover:underline">
            Back to lobby
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <StatCard label="Wins" value={player.wins} />
          <StatCard label="Losses" value={player.losses} />
          <StatCard label="Win rate" value={`${winRate}%`} />
          <StatCard label="Accuracy" value={`${accuracy}%`} />
        </div>

        <h2 className="text-sea-foam text-sm uppercase tracking-wide mb-3">Match history</h2>

        {games.length === 0 ? (
          <p className="text-mist/60 rounded-lg border border-sea-foam/20 p-6 text-center">
            No finished games yet. Go sink something.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {games.map((game) => {
              const opponent = game.hostId === player.id ? game.guest : game.host;
              const won = game.winnerId === player.id;
              return (
                <li
              key={game.id}
              className="flex items-center justify-between rounded-lg bg-ocean-blue/30 border border-sea-foam/20 px-4 py-3"
            >
              <span className="text-mist">vs {opponent?.displayName ?? "Unknown"}</span>
              <div className="flex items-center gap-3">
                <span className="text-mist/50 text-xs">
                  {game.finishedAt?.toLocaleDateString()}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    won ? "bg-sea-foam/20 text-sea-foam" : "bg-coral/20 text-coral"
                  }`}
                >
                  {won ? "WIN" : "LOSS"}
                </span>
                <a
                  href={`/game/${game.id}/replay`}
                  className="text-sandy text-xs hover:underline ml-2"
                >
                  Watch
                </a>
              </div>
            </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-ocean-blue/30 border border-sea-foam/20 px-4 py-4 text-center">
      <p className="text-2xl font-bold text-mist">{value}</p>
      <p className="text-sea-foam text-xs uppercase tracking-wide mt-1">{label}</p>
    </div>
  );
}