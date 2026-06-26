"use client";

import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { colorForShip } from "@/lib/game-engine/types";
import { nuclearCells, mortarCells } from "@/lib/game-engine/attacks";
import type { AttackType, ShipSpec } from "@/lib/game-engine/types";

type Ship = { type: string; cells: { x: number; y: number }[]; sunk: boolean };
type Move = { playerId: string; x: number; y: number; result: string; attackType?: string };
type Cell = { x: number; y: number };

const ATTACK_META: Record<AttackType, { label: string; icon: string }> = {
  single: { label: "Single", icon: "●" },
  nuclear: { label: "Nuclear", icon: "☢" },
  cluster: { label: "Cluster", icon: "✺" },
  mortar: { label: "Mortar", icon: "◎" },
};

export default function BattleBoards({
  gameId,
  gridSize,
  myId,
  opponentId,
  myShips,
  fleet,
  isMyTurn,
  moves,
  gameStatus,
  attackConfig,
  myCharges,
  onFired,
}: {
  gameId: string;
  gridSize: number;
  myId: string;
  opponentId: string;
  myShips: Ship[];
  fleet: ShipSpec[];
  isMyTurn: boolean;
  moves: Move[];
  gameStatus: string;
  attackConfig: Record<string, { enabled: boolean; charges: number }> | null;
  myCharges: Record<string, number>;
  onFired: () => void;
}) {
  const [firing, setFiring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAttack, setSelectedAttack] = useState<AttackType>("single");
  const [hoverCell, setHoverCell] = useState<Cell | null>(null);

  useEffect(() => {
    if (!isMyTurn && selectedAttack !== "single") {
      setSelectedAttack("single");
    }
  }, [isMyTurn]);

  const myCellOwner = (x: number, y: number) => myShips.find((s) => s.cells.some((c) => c.x === x && c.y === y));
  const incomingHits = moves.filter((m) => m.playerId === opponentId);
  const myShots = moves.filter((m) => m.playerId === myId);
  const shotAt = (list: Move[], x: number, y: number) => list.find((m) => m.x === x && m.y === y);

  const availableAttacks: AttackType[] = (["single", "nuclear", "cluster", "mortar"] as AttackType[]).filter(
    (type) => type === "single" || attackConfig?.[type]?.enabled
  );

  function chargesFor(type: AttackType) {
    if (type === "single") return null;
    return myCharges?.[type] ?? 0;
  }

  function previewCellsFor(center: Cell): Cell[] {
    if (selectedAttack === "nuclear") return nuclearCells(center.x, center.y, gridSize);
    if (selectedAttack === "mortar") return mortarCells(center.x, center.y, gridSize);
    return [center];
  }

  const previewSet = hoverCell
    ? new Set(previewCellsFor(hoverCell).map((c) => `${c.x},${c.y}`))
    : new Set<string>();

  async function fire(x: number, y: number) {
    if (!isMyTurn || gameStatus !== "ACTIVE" || firing) return;
    if (selectedAttack === "single" && shotAt(myShots, x, y)) return;

    setFiring(true);
    setError(null);
    const res = await fetch(`/api/games/${gameId}/fire`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x, y, attackType: selectedAttack }),
    });
    const data = await res.json();
    setFiring(false);
    if (!res.ok) {
      const message = data.error ?? "Could not fire.";
      setError(message);
      toast.error(message, { toastId: "fire-error" });
      return;
    }
    setSelectedAttack("single");
    onFired();
  }

  return (
    <div className="flex flex-col gap-4 items-center">
      {availableAttacks.length > 1 && (
        <div className="flex gap-2 flex-wrap justify-center">
          {availableAttacks.map((type) => {
            const charges = chargesFor(type);
            const outOfCharges = type !== "single" && (charges ?? 0) <= 0;
            const disabled = outOfCharges || !isMyTurn || gameStatus !== "ACTIVE";
            return (
              <button
                key={type}
                onClick={() => !disabled && setSelectedAttack(type)}
                disabled={disabled}
                title={!isMyTurn ? "Wait for your turn" : outOfCharges ? "No charges left" : undefined}
                className={`text-xs rounded-full border px-3 py-1.5 transition ${
                  selectedAttack === type
                    ? "bg-coral text-deep-navy border-coral font-semibold"
                    : "border-sea-foam/40 text-sea-foam hover:bg-ocean-blue/40"
                } disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                {ATTACK_META[type].icon} {ATTACK_META[type].label}
                {type !== "single" && ` (${charges})`}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-10 items-center justify-center">
        <div>
          <h3 className="text-sea-foam text-sm uppercase tracking-wide text-center mb-2">Your waters</h3>
          <div
            className="grid gap-[2px] bg-ocean-blue/20 p-2 rounded-lg"
            style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
              const x = idx % gridSize;
              const y = Math.floor(idx / gridSize);
              const ship = myCellOwner(x, y);
              const hit = shotAt(incomingHits, x, y);
              const style = ship && !hit ? { backgroundColor: colorForShip(fleet, ship.type) } : undefined;

              return (
                <div
                  key={idx}
                  style={style}
                  className={`w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-sm border border-ocean-blue/40 flex items-center justify-center text-xs ${
                    !ship && !hit ? "bg-deep-navy" : ""
                  } ${hit ? "bg-coral" : ""}`}
                >
                  {hit ? (hit.result === "miss" ? "•" : "✕") : ""}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-sea-foam text-sm uppercase tracking-wide text-center mb-2">
            Enemy waters {isMyTurn ? "— your move" : "— waiting"}
          </h3>
          <div
            className="grid gap-[2px] bg-ocean-blue/20 p-2 rounded-lg"
            style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
              const x = idx % gridSize;
              const y = Math.floor(idx / gridSize);
              const shot = shotAt(myShots, x, y);
              const clickable = isMyTurn && gameStatus === "ACTIVE" && (selectedAttack !== "single" || !shot);
              const previewing = previewSet.has(`${x},${y}`);

              let bg = "bg-deep-navy";
              if (shot) bg = shot.result === "miss" ? "bg-ocean-blue/60" : "bg-coral";
              else if (previewing) bg = "bg-sandy/60";
              else if (clickable) bg = "bg-deep-navy hover:bg-sea-foam/40";

              return (
                <button
                  key={idx}
                  onClick={() => fire(x, y)}
                  onMouseEnter={() => setHoverCell({ x, y })}
                  onMouseLeave={() => setHoverCell(null)}
                  disabled={!clickable}
                  className={`w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-sm border border-ocean-blue/40 flex items-center justify-center text-xs ${bg} ${
                    clickable ? "cursor-pointer" : ""
                  }`}
                >
                  {shot ? (shot.result === "miss" ? "•" : "✕") : ""}
                </button>
              );
            })}
          </div>
          {selectedAttack === "cluster" && hoverCell && (
            <p className="text-sandy text-xs text-center mt-1">+ 4 random cells elsewhere</p>
          )}
        </div>
      </div>

      {error && <p className="text-coral text-sm text-center mt-2">{error}</p>}
    </div>
  );
}