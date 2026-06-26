"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MIN_GRID_SIZE, MAX_GRID_SIZE, MIN_SHIPS, MAX_SHIPS, CLASSIC_FLEET, DEFAULT_ATTACK_CONFIG, ATTACK_LABELS, MAX_CHARGES_PER_TYPE, AttackConfig } from "@/lib/game-engine/types";
import { toast } from "react-toastify";

type ShipDraft = { type: string; length: number; label: string };

let shipCounter = CLASSIC_FLEET.length;

export default function CreateGameForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [gridSize, setGridSize] = useState(10);
  const [ships, setShips] = useState<ShipDraft[]>(
    CLASSIC_FLEET.map((s) => ({ type: s.type, length: s.length, label: s.label }))
  );
  const [attackConfig, setAttackConfig] = useState<AttackConfig>(() =>
    JSON.parse(JSON.stringify(DEFAULT_ATTACK_CONFIG))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxShipLength = Math.min(8, gridSize);
  const totalCells = ships.reduce((sum, s) => sum + s.length, 0);
  const tooBig = totalCells > gridSize * gridSize * 0.6;

  function addShip() {
    if (ships.length >= MAX_SHIPS) return;
    shipCounter++;
    setShips((prev) => [
      ...prev,
      { type: `ship-${shipCounter}`, length: Math.min(3, maxShipLength), label: `Ship ${prev.length + 1}` },
    ]);
  }

  function removeShip(type: string) {
    if (ships.length <= MIN_SHIPS) return;
    setShips((prev) => prev.filter((s) => s.type !== type));
  }

  function updateLength(type: string, length: number) {
    setShips((prev) => prev.map((s) => (s.type === type ? { ...s, length } : s)));
  }

  function updateLabel(type: string, label: string) {
    setShips((prev) => prev.map((s) => (s.type === type ? { ...s, label } : s)));
  }

  async function submit(endpoint: "/api/games" | "/api/games/vs-ai") {
    setError(null);
    if (tooBig) {
      const message = "This fleet is too large for this grid size.";
      setError(message);
      toast.error(message);
      return;
    }
    setSubmitting(true);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gridSize, ships, attackConfig }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      const message = data.error ?? "Could not create game.";
      setError(message);
      toast.error(message);
      return;
    }
    router.push(`/game/${data.game.id}`);
  }

  return (
    <div className="rounded-xl bg-ocean-blue/30 border border-sea-foam/30 p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-mist font-semibold text-lg">Configure your battle</h2>
        <button onClick={onClose} className="text-sea-foam text-sm hover:underline">
          Cancel
        </button>
      </div>

      <div>
        <label className="text-sea-foam text-sm block mb-1">
          Grid size: {gridSize} × {gridSize}
        </label>
        <input
          type="range"
          min={MIN_GRID_SIZE}
          max={MAX_GRID_SIZE}
          value={gridSize}
          onChange={(e) => setGridSize(Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-mist/50">
          <span>{MIN_GRID_SIZE}</span>
          <span>{MAX_GRID_SIZE}</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sea-foam text-sm">Fleet ({ships.length} ships)</label>
          <button
            onClick={addShip}
            disabled={ships.length >= MAX_SHIPS}
            className="text-xs rounded-md border border-sea-foam/40 text-sea-foam px-2 py-1 hover:bg-ocean-blue/40 disabled:opacity-40"
          >
            + Add ship
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {ships.map((ship) => (
            <div key={ship.type} className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={ship.label}
                onChange={(e) => updateLabel(ship.type, e.target.value)}
                maxLength={20}
                className="flex-1 rounded-md bg-deep-navy border border-sea-foam/20 px-2 py-1.5 text-mist text-sm"
              />
              <input
                type="number"
                min={1}
                max={maxShipLength}
                value={ship.length}
                onChange={(e) =>
                  updateLength(ship.type, Math.max(1, Math.min(maxShipLength, Number(e.target.value))))
                }
                className="w-16 rounded-md bg-deep-navy border border-sea-foam/20 px-2 py-1.5 text-mist text-sm text-center"
              />
              <span className="text-mist/40 text-xs w-10">cells</span>
              <button
                onClick={() => removeShip(ship.type)}
                disabled={ships.length <= MIN_SHIPS}
                className="text-coral text-sm px-2 disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {tooBig && (
          <p className="text-coral text-xs mt-2">
            This fleet ({totalCells} cells) is too large for a {gridSize}×{gridSize} grid. Reduce ships or
            increase grid size.
          </p>
        )}
      </div>
        <div>
        <label className="text-sea-foam text-sm block mb-2">Special attacks</label>
        <div className="flex flex-col gap-2">
          {(["nuclear", "cluster", "mortar"] as const).map((type) => (
            <div key={type} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={attackConfig[type].enabled}
                onChange={(e) =>
                  setAttackConfig((prev) => ({ ...prev, [type]: { ...prev[type], enabled: e.target.checked } }))
                }
              />
              <span className="text-mist text-sm flex-1">{ATTACK_LABELS[type]}</span>
              <input
                type="number"
                min={0}
                max={MAX_CHARGES_PER_TYPE}
                value={attackConfig[type].charges}
                disabled={!attackConfig[type].enabled}
                onChange={(e) =>
                  setAttackConfig((prev) => ({
                    ...prev,
                    [type]: { ...prev[type], charges: Math.max(0, Math.min(MAX_CHARGES_PER_TYPE, Number(e.target.value))) },
                  }))
                }
                className="w-16 rounded-md bg-deep-navy border border-sea-foam/20 px-2 py-1 text-mist text-sm text-center disabled:opacity-30"
              />
              <span className="text-mist/40 text-xs w-12">charges</span>
            </div>
          ))}
        </div>
      </div>
      {error && <p className="text-coral text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={() => submit("/api/games")}
          disabled={submitting || tooBig}
          className="flex-1 rounded-lg bg-coral text-deep-navy font-semibold py-2.5 hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create game"}
        </button>
        <button
          onClick={() => submit("/api/games/vs-ai")}
          disabled={submitting || tooBig}
          className="flex-1 rounded-lg border border-sandy text-sandy font-semibold py-2.5 hover:bg-sandy/10 disabled:opacity-50"
        >
          {submitting ? "Creating..." : "vs Computer"}
        </button>
      </div>
    </div>
  );
}