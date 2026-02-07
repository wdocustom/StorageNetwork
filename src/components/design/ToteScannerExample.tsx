"use client";

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION EXAMPLE — How to use ToteScannerModal
//
// This file demonstrates how to integrate the Tote Scanner into your app.
// Copy the relevant code snippets into your DesignConfigurator or page.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { ScanLine } from "lucide-react";
import ToteScannerModal from "./ToteScannerModal";
import { type ToteDefinition } from "@/lib/tote-data";

/**
 * Example: Standalone Scan Button Component
 *
 * Use this as a reference for adding the scanner to your configurator.
 * The scanner returns a ToteDefinition that includes the `configKey`
 * property which maps to your existing "HDX" | "GM" tote type.
 */
export function ScanToteButton() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedTote, setSelectedTote] = useState<ToteDefinition | null>(null);

  const handleToteSelected = (tote: ToteDefinition) => {
    setSelectedTote(tote);
    console.log("Selected tote:", tote);

    // Use tote.configKey to set your configurator's tote type:
    // setToteType(tote.configKey); // "HDX" or "GM"
  };

  return (
    <div>
      {/* Scanner Button */}
      <button
        onClick={() => setIsScannerOpen(true)}
        className="flex items-center gap-2 rounded-xl border-2 border-dashed border-yellow-400/50 bg-yellow-400/10 px-4 py-3 text-sm font-semibold text-yellow-400 transition-all hover:border-yellow-400 hover:bg-yellow-400/20"
      >
        <ScanLine className="h-5 w-5" />
        Scan Your Tote
      </button>

      {/* Display selected tote */}
      {selectedTote && (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-stone-400">Selected:</p>
          <p className="font-bold text-white">{selectedTote.brand} {selectedTote.capacity}</p>
          <p className="text-xs text-stone-500">
            Config Key: {selectedTote.configKey}
          </p>
        </div>
      )}

      {/* Scanner Modal */}
      <ToteScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onToteSelected={handleToteSelected}
      />
    </div>
  );
}

/**
 * Example: Integration into DesignConfigurator
 *
 * Add this code to your DesignConfigurator.tsx:
 *
 * 1. Import the scanner:
 *    import ToteScannerModal from "@/components/design/ToteScannerModal";
 *    import { type ToteDefinition } from "@/lib/tote-data";
 *
 * 2. Add state for the modal:
 *    const [isScannerOpen, setIsScannerOpen] = useState(false);
 *
 * 3. Add the handler:
 *    const handleToteScanned = (tote: ToteDefinition) => {
 *      setToteType(tote.configKey); // Sets "HDX" or "GM"
 *      // Optionally show a success message
 *    };
 *
 * 4. Add the button to your UI (e.g., next to the Tote Model selector):
 *    <button
 *      onClick={() => setIsScannerOpen(true)}
 *      className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-yellow-400 hover:bg-slate-700"
 *    >
 *      <ScanLine className="h-3.5 w-3.5" />
 *      Scan
 *    </button>
 *
 * 5. Add the modal at the end of your component (before closing div):
 *    <ToteScannerModal
 *      isOpen={isScannerOpen}
 *      onClose={() => setIsScannerOpen(false)}
 *      onToteSelected={handleToteScanned}
 *    />
 */

// ═══════════════════════════════════════════════════════════════════════════
// Full Page Example (for testing)
// ═══════════════════════════════════════════════════════════════════════════

export default function ToteScannerExamplePage() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedTote, setSelectedTote] = useState<ToteDefinition | null>(null);

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">Tote Scanner Demo</h1>
          <p className="mt-2 text-stone-400">
            Test the barcode scanner or manual selection
          </p>
        </div>

        {/* Scan Button */}
        <div className="flex justify-center">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-3 rounded-2xl bg-yellow-400 px-8 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-500 hover:shadow-lg hover:shadow-yellow-400/25"
          >
            <ScanLine className="h-6 w-6" />
            Identify Your Tote
          </button>
        </div>

        {/* Selected Tote Display */}
        {selectedTote && (
          <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-6">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-sm font-semibold text-emerald-400">
                Tote Identified
              </span>
            </div>
            <h3 className="text-xl font-bold text-white">
              {selectedTote.brand} {selectedTote.name}
            </h3>
            <p className="mt-1 text-stone-400">
              {selectedTote.retailer} • {selectedTote.capacity}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-slate-800/50 p-3 text-center">
                <p className="text-xs text-stone-500">Width</p>
                <p className="font-bold text-white">{selectedTote.dimensions.width}&quot;</p>
              </div>
              <div className="rounded-xl bg-slate-800/50 p-3 text-center">
                <p className="text-xs text-stone-500">Depth</p>
                <p className="font-bold text-white">{selectedTote.dimensions.depth}&quot;</p>
              </div>
              <div className="rounded-xl bg-slate-800/50 p-3 text-center">
                <p className="text-xs text-stone-500">Height</p>
                <p className="font-bold text-white">{selectedTote.dimensions.height}&quot;</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-slate-800 px-3 py-2">
              <span className="text-xs text-stone-400">Configurator Key: </span>
              <code className="text-sm font-mono text-yellow-400">
                {selectedTote.configKey}
              </code>
            </div>
          </div>
        )}

        {/* Scanner Modal */}
        <ToteScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onToteSelected={(tote) => {
            setSelectedTote(tote);
            console.log("Selected:", tote);
          }}
        />
      </div>
    </div>
  );
}
