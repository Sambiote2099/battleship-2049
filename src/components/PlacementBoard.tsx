"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ShipSpec, ShipType, colorForShip } from "@/lib/game-engine/types";
import { toast } from "react-toastify";

type Cell = { x: number; y: number };
type PlacedShip = { type: ShipType; cells: Cell[]; horizontal: boolean };

function cellsFor(startX: number, startY: number, length: number, horizontal: boolean): Cell[] {
  const cells: Cell[] = [];
  for (let i = 0; i < length; i++) {
    cells.push(horizontal ? { x: startX + i, y: startY } : { x: startX, y: startY + i });
  }
  return cells;
}

function inBounds(cells: Cell[], gridSize: number) {
  return cells.every((c) => c.x >= 0 && c.x < gridSize && c.y >= 0 && c.y < gridSize);
}

function overlapsOthers(cells: Cell[], placements: PlacedShip[], excludeType: string | null) {
  const occupied = new Set(
    placements
      .filter((p) => p.type !== excludeType)
      .flatMap((p) => p.cells.map((c) => `${c.x},${c.y}`))
  );
  return cells.some((c) => occupied.has(`${c.x},${c.y}`));
}

function startCellFromAnchor(anchor: Cell, grabIndex: number, horizontal: boolean): Cell {
  return horizontal
    ? { x: anchor.x - grabIndex, y: anchor.y }
    : { x: anchor.x, y: anchor.y - grabIndex };
}

type DragState = {
  type: string;
  length: number;
  horizontal: boolean;
  grabIndex: number;
  fromBoard: boolean;
  pointerX: number;
  pointerY: number;
  prospectiveCells: Cell[];
  valid: boolean;
  overBoard: boolean;
};

export default function PlacementBoard({
  gameId,
  gridSize,
  fleet,
  onPlaced,
}: {
  gameId: string;
  gridSize: number;
  fleet: ShipSpec[];
  onPlaced: () => void;
}) {
  const [placements, setPlacements] = useState<PlacedShip[]>([]);
  const [trayHorizontal, setTrayHorizontal] = useState<Record<string, boolean>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const placedTypes = new Set(placements.map((p) => p.type));
  const unplacedShips = fleet.filter((s) => !placedTypes.has(s.type));
  const allPlaced = unplacedShips.length === 0;

  const getCellFromPoint = useCallback(
    (clientX: number, clientY: number): { cell: Cell | null; overBoard: boolean } => {
      const rect = boardRef.current?.getBoundingClientRect();
      if (!rect) return { cell: null, overBoard: false };
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        return { cell: null, overBoard: false };
      }
      const cellW = rect.width / gridSize;
      const cellH = rect.height / gridSize;
      const x = Math.min(gridSize - 1, Math.max(0, Math.floor((clientX - rect.left) / cellW)));
      const y = Math.min(gridSize - 1, Math.max(0, Math.floor((clientY - rect.top) / cellH)));
      return { cell: { x, y }, overBoard: true };
    },
    [gridSize]
  );

  const updateDragPosition = useCallback(
    (clientX: number, clientY: number) => {
      const current = dragRef.current;
      if (!current) return;

      const { cell, overBoard } = getCellFromPoint(clientX, clientY);
      let prospectiveCells: Cell[] = [];
      let valid = false;

      if (cell) {
        const start = startCellFromAnchor(cell, current.grabIndex, current.horizontal);
        prospectiveCells = cellsFor(start.x, start.y, current.length, current.horizontal);
        valid =
          inBounds(prospectiveCells, gridSize) &&
          !overlapsOthers(prospectiveCells, placements, current.fromBoard ? current.type : null);
      }

      const next: DragState = { ...current, pointerX: clientX, pointerY: clientY, prospectiveCells, valid, overBoard };
      dragRef.current = next;
      setDrag(next);
    },
    [getCellFromPoint, gridSize, placements]
  );

  const endDrag = useCallback(() => {
    const current = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    document.body.style.touchAction = "";
    document.body.style.userSelect = "";

    if (!current) return;

   if (current.overBoard && current.valid && current.prospectiveCells.length > 0) {
      setPlacements((prev) => {
        const withoutThis = prev.filter((p) => p.type !== current.type);
        return [...withoutThis, { type: current.type, cells: current.prospectiveCells, horizontal: current.horizontal }];
      });
      setError(null);
    } else if (current.overBoard && !current.valid) {
      const message = "That spot doesn't fit — try elsewhere.";
      setError(message);
      toast.error(message, { toastId: "placement-error" });
    }
  }, []);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragRef.current) return;
      updateDragPosition(e.clientX, e.clientY);
    }
    function onUp() {
      if (!dragRef.current) return;
      endDrag();
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [updateDragPosition, endDrag]);

  function beginDrag(
    e: React.PointerEvent,
    type: string,
    length: number,
    horizontal: boolean,
    grabIndex: number,
    fromBoard: boolean
  ) {
    e.preventDefault();
    document.body.style.touchAction = "none";
    document.body.style.userSelect = "none";
    const initial: DragState = {
      type, length, horizontal, grabIndex, fromBoard,
      pointerX: e.clientX, pointerY: e.clientY,
      prospectiveCells: [], valid: false, overBoard: false,
    };
    dragRef.current = initial;
    setDrag(initial);
    updateDragPosition(e.clientX, e.clientY);
  }

  function rotateTrayShip(type: string) {
    if (drag) return;
    setTrayHorizontal((prev) => ({ ...prev, [type]: !(prev[type] ?? true) }));
  }

  function rotatePlacedShip(ship: PlacedShip) {
    if (drag) return;
    const xs = ship.cells.map((c) => c.x);
    const ys = ship.cells.map((c) => c.y);
    const anchor = ship.horizontal ? { x: Math.min(...xs), y: ys[0] } : { x: xs[0], y: Math.min(...ys) };
    const newHorizontal = !ship.horizontal;
    const newCells = cellsFor(anchor.x, anchor.y, ship.cells.length, newHorizontal);

    if (!inBounds(newCells, gridSize) || overlapsOthers(newCells, placements, ship.type)) {
      const message = "Can't rotate there — not enough room.";
      setError(message);
      toast.error(message, { toastId: "placement-error" });
      return;
    }
    setError(null);
    setPlacements((prev) =>
      prev.map((p) => (p.type === ship.type ? { ...p, cells: newCells, horizontal: newHorizontal } : p))
    );
  }

  function removeShip(type: string) {
    if (drag) return;
    setPlacements((prev) => prev.filter((p) => p.type !== type));
  }

  function cellOwner(x: number, y: number): PlacedShip | null {
    return placements.find((p) => p.cells.some((c) => c.x === x && c.y === y)) ?? null;
  }

  function isInDragPreview(x: number, y: number): boolean {
    return !!drag && drag.overBoard && drag.prospectiveCells.some((c) => c.x === x && c.y === y);
  }

  async function confirmFleet() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/games/${gameId}/place`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ships: placements.map((p) => ({ type: p.type, cells: p.cells })) }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      const message = data.error ?? "Could not save your fleet.";
      setError(message);
      toast.error(message);
      return;
    }
    toast.success("Fleet confirmed!");
    onPlaced();
  }

  const cellPx = "w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7";

  return (
    <div className="flex flex-col items-center gap-6">
      <div>
        <h2 className="text-mist text-lg font-semibold mb-1 text-center">Place your fleet</h2>
        <p className="text-sea-foam text-sm text-center">
          Drag ships onto the board. Use ⟳ to rotate.
        </p>
      </div>

      {unplacedShips.length > 0 && (
        <div className="flex flex-wrap gap-4 justify-center bg-ocean-blue/20 rounded-lg p-4 w-full max-w-md">
          {unplacedShips.map((spec) => {
            const horizontal = trayHorizontal[spec.type] ?? true;
            const isBeingDragged = !!drag && drag.type === spec.type && !drag.fromBoard;
            return (
              <div key={spec.type} className="flex flex-col items-center gap-1">
                <div
                  className={`flex ${horizontal ? "flex-row" : "flex-col"} gap-[2px] ${isBeingDragged ? "opacity-30" : ""}`}
                  style={{ touchAction: "none" }}
                >
                  {Array.from({ length: spec.length }).map((_, i) => (
                    <div
                      key={i}
                      onPointerDown={(e) => beginDrag(e, spec.type, spec.length, horizontal, i, false)}
                      style={{ backgroundColor: colorForShip(fleet, spec.type) }}
                      className={`${cellPx} rounded-sm cursor-grab active:cursor-grabbing border border-ocean-blue/40`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-mist/60 text-xs">{spec.label}</span>
                  <button
                    onClick={() => rotateTrayShip(spec.type)}
                    className="text-sea-foam text-xs rounded-md border border-sea-foam/30 px-1.5 py-0.5 hover:bg-ocean-blue/40"
                    title="Rotate"
                  >
                    ⟳
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        ref={boardRef}
        className="grid gap-[2px] bg-ocean-blue/20 p-2 rounded-lg"
        style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
          const x = idx % gridSize;
          const y = Math.floor(idx / gridSize);
          const owner = cellOwner(x, y);
          const isBeingDraggedShip = !!owner && !!drag && drag.type === owner.type && drag.fromBoard;
          const previewing = isInDragPreview(x, y);

          let bg: string | undefined = "bg-deep-navy";
          let cellStyle: React.CSSProperties = { touchAction: "none" };

          if (owner && !isBeingDraggedShip) {
            bg = undefined;
            cellStyle.backgroundColor = colorForShip(fleet, owner.type);
          }
          if (previewing) {
            bg = drag?.valid ? "bg-sea-foam/70" : "bg-coral/70";
            delete cellStyle.backgroundColor;
          }

          return (
            <div
              key={idx}
              onPointerDown={(e) => {
                if (!owner) return;
                const idxInShip = owner.cells.findIndex((c) => c.x === x && c.y === y);
                beginDrag(e, owner.type, owner.cells.length, owner.horizontal, idxInShip, true);
              }}
              className={`${cellPx} rounded-sm transition border border-ocean-blue/40 ${bg ?? ""} ${owner ? "cursor-grab active:cursor-grabbing" : ""}`}
              title={owner ? "Drag to move" : `${x},${y}`}
              style={cellStyle}
            />
          );
        })}
      </div>

      {placements.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {placements.map((p) => {
            const spec = fleet.find((f) => f.type === p.type);
            return (
              <div key={p.type} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-sea-foam text-sea-foam">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorForShip(fleet, p.type) }} />
                <span>{spec?.label ?? p.type}</span>
                <button onClick={() => rotatePlacedShip(p)} className="hover:opacity-70" title="Rotate">⟳</button>
                <button onClick={() => removeShip(p.type)} className="text-coral hover:opacity-70" title="Remove">✕</button>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-coral text-sm">{error}</p>}

      <button
        onClick={confirmFleet}
        disabled={!allPlaced || submitting}
        className="rounded-lg bg-coral text-deep-navy font-semibold px-6 py-3 hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Saving..." : "Confirm fleet"}
      </button>

      {drag && drag.overBoard && (
        <div
          className="fixed pointer-events-none z-50 px-2 py-1 rounded-md text-xs font-semibold"
          style={{
            left: drag.pointerX + 12,
            top: drag.pointerY + 12,
            backgroundColor: drag.valid ? "rgba(95,168,211,0.9)" : "rgba(255,107,92,0.9)",
            color: "#0B2545",
          }}
        >
          {drag.valid ? "Drop to place" : "Won't fit here"}
        </div>
      )}
    </div>
  );
}