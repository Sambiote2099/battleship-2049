import { Cell, ShipPlacement, ShipSpec, MIN_GRID_SIZE, MAX_GRID_SIZE, MIN_SHIPS, MAX_SHIPS, MAX_SHIP_LENGTH_CAP, MAX_CHARGES_PER_TYPE } from "./types";

export function validateFleetConfig(gridSize: number, fleet: ShipSpec[]): string | null {
  if (!Number.isInteger(gridSize) || gridSize < MIN_GRID_SIZE || gridSize > MAX_GRID_SIZE) {
    return `Grid size must be between ${MIN_GRID_SIZE} and ${MAX_GRID_SIZE}.`;
  }
  if (!Array.isArray(fleet) || fleet.length < MIN_SHIPS || fleet.length > MAX_SHIPS) {
    return `Choose between ${MIN_SHIPS} and ${MAX_SHIPS} ships.`;
  }

  const types = new Set<string>();
  let totalCells = 0;
  const maxLen = Math.min(MAX_SHIP_LENGTH_CAP, gridSize);

  for (const ship of fleet) {
    if (!ship.type || typeof ship.type !== "string") return "Each ship needs a valid type.";
    if (types.has(ship.type)) return "Ship types must be unique.";
    types.add(ship.type);

    if (!Number.isInteger(ship.length) || ship.length < 1 || ship.length > maxLen) {
      return `Each ship's length must be between 1 and ${maxLen} on this grid size.`;
    }
    totalCells += ship.length;
  }

  if (totalCells > gridSize * gridSize * 0.6) {
    return "This fleet is too large to fit comfortably on this grid. Reduce ships or increase grid size.";
  }

  return null;
}

export function validateFleetPlacement(
  placements: ShipPlacement[],
  fleet: ShipSpec[],
  gridSize: number
): string | null {
  if (placements.length !== fleet.length) {
    return `Expected ${fleet.length} ships, got ${placements.length}.`;
  }

  const seenTypes = new Set<string>();
  const occupied = new Set<string>();

  for (const placement of placements) {
    const spec = fleet.find((f) => f.type === placement.type);
    if (!spec) return `Unknown ship type: ${placement.type}`;
    if (seenTypes.has(placement.type)) return `Duplicate ship type: ${placement.type}`;
    seenTypes.add(placement.type);

    const err = validateSingleShip(placement.cells, spec.length, gridSize);
    if (err) return `${spec.label}: ${err}`;

    for (const cell of placement.cells) {
      const key = `${cell.x},${cell.y}`;
      if (occupied.has(key)) return `${spec.label} overlaps another ship.`;
      occupied.add(key);
    }
  }

  return null;
}

function validateSingleShip(cells: Cell[], expectedLength: number, gridSize: number): string | null {
  if (cells.length !== expectedLength) {
    return `expected ${expectedLength} cells, got ${cells.length}.`;
  }

  for (const cell of cells) {
    if (
      !Number.isInteger(cell.x) ||
      !Number.isInteger(cell.y) ||
      cell.x < 0 ||
      cell.x >= gridSize ||
      cell.y < 0 ||
      cell.y >= gridSize
    ) {
      return "has a cell outside the grid.";
    }
  }

  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const sameRow = ys.every((y) => y === ys[0]);
  const sameCol = xs.every((x) => x === xs[0]);

  if (!sameRow && !sameCol) {
    return "must be in a straight line.";
  }

  const sorted = sameRow ? [...xs].sort((a, b) => a - b) : [...ys].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return "has gaps.";
  }

  return null;
}

export function validateAttackConfig(config: any): string | null {
  if (config == null) return null;
  const allowedKeys = ["nuclear", "cluster", "mortar"];
  for (const key of Object.keys(config)) {
    if (!allowedKeys.includes(key)) return `Unknown attack type: ${key}`;
    const entry = config[key];
    if (typeof entry?.enabled !== "boolean") return `Invalid config for ${key}.`;
    if (entry.enabled) {
      if (!Number.isInteger(entry.charges) || entry.charges < 0 || entry.charges > MAX_CHARGES_PER_TYPE) {
        return `${key} charges must be between 0 and ${MAX_CHARGES_PER_TYPE}.`;
      }
    }
  }
  return null;
}