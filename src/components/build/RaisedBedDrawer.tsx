"use client";

import { Flower2 } from "lucide-react";
import BottomDrawer from "./BottomDrawer";
import RaisedBedDropdown from "@/components/design/RaisedBedDropdown";
import type { InstallerPricing } from "@/types/viewModels";
import type { RaisedBedConfig } from "@/lib/raised-beds";

interface RaisedBedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  installerPricing?: InstallerPricing;
  onAddRaisedBed: (config: RaisedBedConfig, price: number, desc: string) => void;
}

export default function RaisedBedDrawer({
  isOpen,
  onClose,
  installerPricing,
  onAddRaisedBed,
}: RaisedBedDrawerProps) {
  return (
    <BottomDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Raised Beds"
      subtitle="Planters & garden boxes"
      icon={<Flower2 className="h-4 w-4 text-amber-400" />}
    >
      <RaisedBedDropdown
        onAddRaisedBed={onAddRaisedBed}
        installerPricing={installerPricing}
        defaultExpanded
      />
    </BottomDrawer>
  );
}
