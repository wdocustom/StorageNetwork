export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";


import { getAuthenticatedUser } from "@/lib/auth";
import { getInstallerInventory, getInstallerUse2x4Rails } from "@/app/actions/inventory";
import { InventoryForm } from "./InventoryForm";
import PageHeader from "@/components/dashboard/PageHeader";

export default async function InventoryPage() {
  const user = await getAuthenticatedUser();
  if (!user) return redirect("/login");

  const userId = user.id;
  const [inventory, use2x4Rails] = await Promise.all([
    getInstallerInventory(userId),
    getInstallerUse2x4Rails(userId),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PageHeader title="Inventory" subtitle="Materials on hand" back="/dashboard/more" />
      <div className="mx-auto max-w-2xl px-4 py-5">
        <p className="mb-5 text-sm text-stone-400">
          Quantities are auto-updated after each build. Edit any value
          below to match what&apos;s actually in your shop, or use
          <span className="font-bold text-stone-300"> Clear All </span>
          to reset everything to zero.
        </p>

        <InventoryForm initial={inventory} use2x4Rails={use2x4Rails} />
      </div>
    </div>
  );
}
