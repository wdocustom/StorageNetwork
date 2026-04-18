"use client";

import { Star, Grid3X3, ArrowUpFromLine, Flower2, Hammer } from "lucide-react";
import type { InstallerPricing } from "@/types/viewModels";

export type DrawerType = "bestseller" | "custom" | "shelving" | "overhead" | "raisedBed";

interface ProductTileProps {
  icon: React.ReactNode;
  name: string;
  description: string;
  onTap: () => void;
  accent?: "yellow" | "blue" | "emerald" | "amber";
}

function ProductTile({ icon, name, description, onTap, accent = "yellow" }: ProductTileProps) {
  const accentClasses = {
    yellow: "border-yellow-400/30 hover:border-yellow-400 hover:bg-yellow-400/5",
    blue: "border-blue-400/30 hover:border-blue-400 hover:bg-blue-400/5",
    emerald: "border-emerald-400/30 hover:border-emerald-400 hover:bg-emerald-400/5",
    amber: "border-amber-400/30 hover:border-amber-400 hover:bg-amber-400/5",
  };
  const iconAccent = {
    yellow: "text-yellow-400",
    blue: "text-blue-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
  };
  return (
    <button
      onClick={onTap}
      className={`group flex flex-col items-start gap-2 rounded-xl border bg-slate-900 p-4 text-left transition-all active:scale-[0.98] ${accentClasses[accent]}`}
    >
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 ${iconAccent[accent]}`}>
        {icon}
      </div>
      <div className="min-h-[2.5rem]">
        <div className="text-sm font-bold text-white">{name}</div>
        <div className="mt-0.5 text-[10px] leading-tight text-stone-500">
          {description}
        </div>
      </div>
    </button>
  );
}

interface ProductTilesGridProps {
  installerPricing?: InstallerPricing;
  onTileTap: (product: DrawerType) => void;
}

export default function ProductTilesGrid({
  installerPricing,
  onTileTap,
}: ProductTilesGridProps) {
  const shelvingEnabled = installerPricing?.open_shelving_enabled === true;
  const overheadEnabled = installerPricing?.overhead_storage_enabled === true;
  const raisedBedEnabled = installerPricing?.raised_bed_enabled === true;

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
        <Hammer className="h-3.5 w-3.5 text-yellow-400" />
        Products
        <span className="ml-1 font-normal normal-case italic tracking-normal text-stone-600">
          — add more from your profile
        </span>
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ProductTile
          icon={<Star className="h-5 w-5" />}
          name="Bestsellers"
          description="Proven presets — fastest to quote"
          onTap={() => onTileTap("bestseller")}
          accent="yellow"
        />
        <ProductTile
          icon={<Grid3X3 className="h-5 w-5" />}
          name="Custom Unit"
          description="Wall-fit or custom grid build"
          onTap={() => onTileTap("custom")}
          accent="blue"
        />
        {shelvingEnabled && (
          <ProductTile
            icon={<Grid3X3 className="h-5 w-5" />}
            name="Open Shelving"
            description="Tall or short shelving units"
            onTap={() => onTileTap("shelving")}
            accent="emerald"
          />
        )}
        {overheadEnabled && (
          <ProductTile
            icon={<ArrowUpFromLine className="h-5 w-5" />}
            name="Overhead Storage"
            description="Ceiling-mounted tote grids"
            onTap={() => onTileTap("overhead")}
            accent="yellow"
          />
        )}
        {raisedBedEnabled && (
          <ProductTile
            icon={<Flower2 className="h-5 w-5" />}
            name="Raised Beds"
            description="Planters & garden boxes"
            onTap={() => onTileTap("raisedBed")}
            accent="amber"
          />
        )}
      </div>
    </section>
  );
}
