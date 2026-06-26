"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { BarChart3, Trophy, RefreshCw, Plus, Swords, HelpCircle } from "lucide-react";
import CreateGameForm from "./CreateGameForm";
import HowToPlayModal from "./HowToPlayModal";

type Game = {
  id: string;
  gridSize: number;
  host: { displayName: string };
};

const HOWTO_STORAGE_KEY = "battleship_seen_howto";

export default function LobbyClient({
  player,
  openGames,
}: {
  player: { id: string; displayName: string };
  openGames: Game[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(HOWTO_STORAGE_KEY);
    if (!seen) setShowHowTo(true);
  }, []);

  function closeHowTo() {
    setShowHowTo(false);
    localStorage.setItem(HOWTO_STORAGE_KEY, "1");
  }

  async function joinGame(id: string) {
    setLoading(true);
    const res = await fetch(`/api/games/${id}/join`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      router.push(`/game/${id}`);
    } else {
      toast.error(data.error ?? "Could not join game.");
      router.refresh();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <p className="text-sea-foam text-sm">Playing as</p>
          <h1 className="text-2xl font-semibold text-mist">{player.displayName}</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowHowTo(true)}
            className="rounded-lg border border-sandy text-sandy px-4 py-2 text-sm hover:bg-sandy/10 flex items-center gap-1.5"
          >
            <HelpCircle size={16} />
            Guide
          </button>
          <Link
            href="/stats"
            className="rounded-lg border border-sea-foam/40 text-sea-foam px-4 py-2 text-sm hover:bg-ocean-blue/40 flex items-center gap-1.5"
          >
            <BarChart3 size={16} />
            My stats
          </Link>
          <Link
            href="/leaderboard"
            className="rounded-lg border border-sea-foam/40 text-sea-foam px-4 py-2 text-sm hover:bg-ocean-blue/40 flex items-center gap-1.5"
          >
            <Trophy size={16} />
            Leaderboard
          </Link>
          <button
            onClick={() => router.refresh()}
            className="group rounded-lg border border-sea-foam/40 text-sea-foam px-4 py-2 text-sm hover:bg-ocean-blue/40 flex items-center gap-1.5"
          >
            <RefreshCw size={16} className="transition-transform group-hover:rotate-180" />
            Refresh
          </button>
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="rounded-lg bg-coral text-deep-navy font-semibold px-4 py-2 text-sm hover:opacity-90 flex items-center gap-1.5"
            >
              <Plus size={16} />
              Create game
            </button>
          )}
        </div>
      </div>

      {showCreateForm && (
        <div className="mb-8">
          <CreateGameForm onClose={() => setShowCreateForm(false)} />
        </div>
      )}

      <h2 className="text-sea-foam text-sm uppercase tracking-wide mb-3">Open games</h2>

      {openGames.length === 0 ? (
        <p className="text-mist/60 rounded-lg border border-sea-foam/20 p-6 text-center">
          No open games right now. Create one and wait for an opponent.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {openGames.map((game) => (
            <li
              key={game.id}
              className="flex items-center justify-between rounded-lg bg-ocean-blue/30 border border-sea-foam/20 px-4 py-3"
            >
              <span className="text-mist">
                {game.host.displayName}&apos;s game
                <span className="text-mist/40 text-xs ml-2">
                  {game.gridSize}×{game.gridSize}
                </span>
              </span>
              <button
                onClick={() => joinGame(game.id)}
                disabled={loading}
                className="rounded-md bg-sea-foam text-deep-navy text-sm font-semibold px-3 py-1.5 hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Swords size={14} />
                Join
              </button>
            </li>
          ))}
        </ul>
      )}

      <HowToPlayModal open={showHowTo} onClose={closeHowTo} />
    </div>
  );
}