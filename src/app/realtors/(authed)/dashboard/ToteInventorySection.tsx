"use client";

import { useState } from "react";
import { Package, ShoppingCart, Sparkles } from "lucide-react";

import {
  type PackOption,
  type RealtorToteInventory,
} from "@/app/actions/realtor-tote-inventory";
import { BuyTotesModal } from "./BuyTotesModal";

// ═══════════════════════════════════════════════════════════════════════════
// Realtor tote inventory tile — current balance + Buy Totes CTA + recent
// purchase history. Sits on the realtor dashboard in the slot that previously
// held the "Realtor Pro" Coming Soon card.
//
// Read happens in the parent (server component) via getRealtorToteInventory()
// so this tile can stay a client component (modal state lives here).
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  inventory: RealtorToteInventory;
  packs: PackOption[];
  custom: { unitPriceCents: number; min: number; max: number };
}

export function ToteInventorySection({ inventory, packs, custom }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  const balance = inventory.balance;
  const hasHistory = inventory.recentPurchases.length > 0;

  return (
    <>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Package className="h-5 w-5 text-yellow-300" />
              <h3 className="text-lg font-bold">Tote inventory</h3>
            </div>
            <p className="text-xs text-stone-400">
              27-gallon totes available to send. Buy in bulk for bonus totes — your inventory never expires.
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-950 hover:bg-yellow-300"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Buy totes
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/60 p-5">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-stone-500">
            Available balance
          </p>
          <p className="text-4xl font-black text-white">
            {balance.toLocaleString()}{" "}
            <span className="text-sm font-medium text-stone-400">totes</span>
          </p>
          {balance === 0 ? (
            <p className="mt-2 text-xs text-stone-500">
              Buy your first pack to start sending inventory-mode gifts.
            </p>
          ) : (
            <p className="mt-2 text-xs text-stone-500">
              Ready to dispatch — minimum 10 totes, maximum 50 per gift.
            </p>
          )}
        </div>

        {hasHistory && (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-stone-500">
              Recent purchases
            </p>
            <ul className="space-y-1.5">
              {inventory.recentPurchases.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    {p.bonusCount > 0 ? (
                      <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                    ) : (
                      <Package className="h-3.5 w-3.5 text-stone-500" />
                    )}
                    <span className="text-stone-300">{p.label}</span>
                    {p.bonusCount > 0 && (
                      <span className="text-[10px] font-semibold text-emerald-300">
                        +{p.bonusCount} bonus
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-stone-500">
                    <span>{p.totalCredited} totes</span>
                    <span className="text-stone-700">·</span>
                    <span>${(p.amountCents / 100).toFixed(2)}</span>
                    <span className="text-stone-700">·</span>
                    <span>{formatDate(p.paidAt ?? p.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <BuyTotesModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        packs={packs}
        custom={custom}
      />
    </>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
