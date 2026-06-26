import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/identity";
import { prisma } from "@/lib/prisma";
import Image from "next/image";

export default async function LeaderboardPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/");

  const players = await prisma.player.findMany({
    where: { isBot: false, OR: [{ wins: { gt: 0 } }, { losses: { gt: 0 } }] },
    orderBy: [{ wins: "desc" }, { shotsHit: "desc" }],
    take: 20,
  });

  return (
    <main id="main" className="min-h-screen px-4 py-10">
      <div className="fixed inset-0 -z-10 overflow-hidden">
              <Image
                src="/1984473930_itdd.jpg.b31bcecb0dd59e3c1206bdb9a04501b7.jpg"
                alt=""
                fill
                priority
                className="object-cover opacity-45 blur-[3px]"
              />
            </div>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-mist">Leaderboard</h1>
          <Link href="/lobby" className="text-sea-foam text-sm hover:underline">
            Back to lobby
          </Link>
        </div>

        {players.length === 0 ? (
          <p className="text-mist/60 rounded-lg border border-sea-foam/20 p-6 text-center">
            No games played yet. Be the first to win one.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {players.map((p, i) => {
              const totalGames = p.wins + p.losses;
              const winRate = totalGames > 0 ? Math.round((p.wins / totalGames) * 100) : 0;
              const isYou = p.id === player.id;
              return (
                <li
                  key={p.id}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                    isYou ? "bg-coral/10 border-coral/40" : "bg-ocean-blue/30 border-sea-foam/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sea-foam text-sm w-6 text-right">{i + 1}</span>
                    <span className="text-mist">
                      {p.displayName}
                      {isYou && <span className="text-coral text-xs ml-2">(you)</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-mist/60">{p.wins}W–{p.losses}L</span>
                    <span className="text-sea-foam">{winRate}%</span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </main>
  );
}