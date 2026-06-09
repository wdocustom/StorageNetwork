export type ChairFinish = "natural" | "white" | "black";

export interface ChairConfig {
  finish: ChairFinish;
  quantity: number;
}

export interface ChairFinishOption {
  id: ChairFinish;
  label: string;
  hex: string; // for 3D rendering color
}

export const CHAIR_FINISHES: ChairFinishOption[] = [
  { id: "natural", label: "Clear / Natural", hex: "#c87533" },
  { id: "white", label: "White", hex: "#f5f5f0" },
  { id: "black", label: "Black", hex: "#1c1c1c" },
];

// Physical dimensions in inches (for 3D rendering)
export const CHAIR_DIMS = {
  seatW: 23.25,      // slat width
  seatD: 20,         // seat depth (from front to back support)
  seatH: 12,         // seat height from ground
  backH: 22,         // back height above seat
  armW: 4,           // arm rest width
  armL: 24.25,       // arm rest length
  baseL: 38,         // base runner length
  totalW: 30,        // overall width including arms
  totalD: 38,        // overall depth
  totalH: 34,        // overall height
  legH: 20.25,       // front leg height
} as const;

export function getChairDescription(config: ChairConfig): string {
  const finish = CHAIR_FINISHES.find(f => f.id === config.finish);
  const finishLabel = finish?.label ?? "Natural";
  const qty = config.quantity > 1 ? ` ×${config.quantity}` : "";
  return `Low Boy Adirondack Chair — ${finishLabel}${qty}`;
}

export function getChairDimensions(): { widthIn: number; depthIn: number; heightIn: number } {
  return {
    widthIn: CHAIR_DIMS.totalW,
    depthIn: CHAIR_DIMS.totalD,
    heightIn: CHAIR_DIMS.totalH,
  };
}
