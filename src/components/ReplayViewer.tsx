"use client";

import { useState, useEffect } from "react";

type Player = { id: string; displayName: string };
type Move = { playerId: string; x: number; y: number; result: string; turnNumber: number };
type Game = {
  id: string;
  status: string;
  gridSize: number;
  host: Player;
  guest: Player | null;
  winnerId: string | null;
  moves: Move[];
};

export default function ReplayViewer({ game }: { game: Game }) {
  const [playing, setPlaying] = useState(true);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [speed, setSpeed] = useState(1); // 0.5x, 1x, 2x

  const hostId = game.host.id;
  const guestId = game.guest?.id || "unknown";
  const totalMoves = game.moves.length;

  useEffect(() => {
    if (!playing || currentTurn >= totalMoves) {
      setPlaying(false);
      return;
    }

    const delayMs = 1000 / speed; // Faster speed = shorter delay
    const timer = setTimeout(() => setCurrentTurn((t) => t + 1), delayMs);
    return () => clearTimeout(timer);
  }, [playing, currentTurn, totalMoves, speed]);

  const movesUpToNow = game.moves.slice(0, currentTurn);
  const hostMoves = movesUpToNow.filter((m) => m.playerId === hostId);
  const guestMoves = movesUpToNow.filter((m) => m.playerId === guestId);

  const hostBoardHits = hostMoves.filter((m) => m.result !== "miss");
  const guestBoardHits = guestMoves.filter((m) => m.result !== "miss");

  const shotAt = (moves: Move[], x: number, y: number) =>
    moves.find((m) => m.x === x && m.y === y);

  const hostStatus = game.winnerId === hostId ? "✓ Won" : game.winnerId === guestId ? "✗ Lost" : "—";
  const guestStatus = game.winnerId === guestId ? "✓ Won" : game.winnerId === hostId ? "✗ Lost" : "—";

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-mist mb-2">
          {game.host.displayName} vs {game.guest?.displayName ?? "Computer"}
        </h1>
        <p className="text-sea-foam text-sm">
          Move {currentTurn} of {totalMoves}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-8 items-center justify-center">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-mist font-semibold">{game.host.displayName}</h3>
            <span className="text-sea-foam text-sm">{hostStatus}</span>
          </div>
          <Grid gridSize={game.gridSize} myShots={hostMoves} enemyMisses={guestMoves.filter(m => m.result === "miss")} />
          <p className="text-mist/50 text-xs mt-2 text-center">Fired {hostMoves.length} shots</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-mist font-semibold">{game.guest?.displayName ?? "Computer"}</h3>
            <span className="text-sea-foam text-sm">{guestStatus}</span>
          </div>
          <Grid gridSize={game.gridSize} myShots={guestMoves} enemyMisses={hostMoves.filter(m => m.result === "miss")} />
          <p className="text-mist/50 text-xs mt-2 text-center">Fired {guestMoves.length} shots</p>
        </div>
      </div>

      <div className="bg-ocean-blue/30 border border-sea-foam/20 rounded-lg p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPlaying(!playing)}
            className="rounded-md bg-coral text-deep-navy font-semibold px-4 py-2 hover:opacity-90"
          >
            {playing ? "Pause" : "Play"}
          </button>
          <input
            type="range"
            min={0}
            max={totalMoves}
            value={currentTurn}
            onChange={(e) => {
              setCurrentTurn(Number(e.target.value));
              setPlaying(false);
            }}
            className="flex-1"
          />
          <span className="text-mist text-sm w-12 text-right">{currentTurn}/{totalMoves}</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sea-foam text-xs">Speed:</label>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="rounded-md bg-deep-navy border border-sea-foam/20 text-mist text-xs px-2 py-1"
          >
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={4}>4×</option>
          </select>
        </div>
      </div>

      <div className="text-mist/60 text-xs text-center">
        <p>Green = hit, Blue = miss</p>
      </div>
    </div>
  );
}

function Grid({
  gridSize,
  myShots,
  enemyMisses,
}: {
  gridSize: number;
  myShots: Move[];
  enemyMisses: Move[];
}) {
  return (
    <div
      className="grid gap-[2px] bg-ocean-blue/20 p-2 rounded-lg"
      style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
        const x = idx % gridSize;
        const y = Math.floor(idx / gridSize);
        const shot = myShots.find((m) => m.x === x && m.y === y);
        const isMiss = enemyMisses.find((m) => m.x === x && m.y === y);

        return (
          <div
            key={idx}
            className={`w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-sm border border-ocean-blue/40 flex items-center justify-center text-xs font-bold transition ${
              shot
                ? shot.result === "miss"
                  ? "bg-ocean-blue/80"
                  : shot.result === "sunk"
                  ? "bg-coral"
                  : "bg-green-500"
                : isMiss
                ? "bg-ocean-blue/40"
                : "bg-deep-navy"
            }`}
          >
            {shot ? (shot.result === "miss" ? "•" : "✕") : ""}
          </div>
        );
      })}
    </div>
  );
}