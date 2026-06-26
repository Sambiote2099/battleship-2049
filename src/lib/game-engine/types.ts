export type Cell = { x: number; y: number };
export type ShipType = string;

export type ShipSpec = { type: ShipType; length: number; label: string };
export type ShipPlacement = { type: ShipType; cells: Cell[] };

export const MIN_GRID_SIZE = 6;
export const MAX_GRID_SIZE = 16;
export const MIN_SHIPS = 1;
export const MAX_SHIPS = 10;
export const MAX_SHIP_LENGTH_CAP = 8;
export const DEFAULT_GRID_SIZE = 10;

export const CLASSIC_FLEET: ShipSpec[] = [
  { type: "ship-1", length: 5, label: "Carrier" },
  { type: "ship-2", length: 4, label: "Battleship" },
  { type: "ship-3", length: 3, label: "Cruiser" },
  { type: "ship-4", length: 3, label: "Submarine" },
  { type: "ship-5", length: 2, label: "Patrol Boat" },
];

export const SHIP_COLORS = [
  "#A78BFA", "#FBBF24", "#34D399", "#F472B6",
  "#A3E635", "#38BDF8", "#FB7185", "#818CF8",
];

export function colorForShip(fleet: { type: string }[], type: string): string {
  const idx = fleet.findIndex((f) => f.type === type);
  if (idx === -1) return "#5FA8D3";
  return SHIP_COLORS[idx % SHIP_COLORS.length];
}

export type AttackType = "single" | "nuclear" | "cluster" | "mortar";

export type AttackConfigEntry = { enabled: boolean; charges: number };
export type AttackConfig = Record<"nuclear" | "cluster" | "mortar", AttackConfigEntry>;

export const MAX_CHARGES_PER_TYPE = 5;

export const DEFAULT_ATTACK_CONFIG: AttackConfig = {
  nuclear: { enabled: true, charges: 1 },
  cluster: { enabled: true, charges: 2 },
  mortar: { enabled: true, charges: 2 },
};

export const ATTACK_LABELS: Record<AttackType, string> = {
  single: "Single Shot",
  nuclear: "Nuclear Strike",
  cluster: "Cluster Bomb",
  mortar: "Mortar Barrage",
};

export const MIN_TURN_MINUTES = 3;
export const MAX_TURN_MINUTES = 5;

export function turnDurationMsForGrid(gridSize: number): number {
  const clamped = Math.min(MAX_GRID_SIZE, Math.max(MIN_GRID_SIZE, gridSize));
  const t = (clamped - MIN_GRID_SIZE) / (MAX_GRID_SIZE - MIN_GRID_SIZE);
  const minutes = MIN_TURN_MINUTES + t * (MAX_TURN_MINUTES - MIN_TURN_MINUTES);
  return Math.round(minutes * 60 * 1000);
}