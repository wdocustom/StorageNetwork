"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Tag,
  Plus,
  Trash2,
  Loader2,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
} from "lucide-react";
import {
  getInstallerDiscountCodes,
  createDiscountCode,
  toggleDiscountCode,
  deleteDiscountCode,
  type DiscountCode,
} from "@/app/actions/discount-codes";

interface DiscountCodesCardProps {
  userId: string;
}

export default function DiscountCodesCard({ userId }: DiscountCodesCardProps) {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // New code form state
  const [newCode, setNewCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [minUnits, setMinUnits] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const fetchCodes = useCallback(async () => {
    const result = await getInstallerDiscountCodes(userId);
    if (result.success) {
      setCodes(result.codes || []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  async function handleCreate() {
    if (!newCode.trim() || !discountValue) return;
    setError("");
    setCreating(true);

    const result = await createDiscountCode({
      installerId: userId,
      code: newCode.trim(),
      discountType,
      discountValue: Number(discountValue),
      maxUses: maxUses ? Number(maxUses) : null,
      expiresAt: expiresAt || null,
      minUnits: minUnits ? Number(minUnits) : null,
    });

    setCreating(false);

    if (result.success && result.code) {
      setCodes([result.code, ...codes]);
      setNewCode("");
      setDiscountValue("");
      setMaxUses("");
      setExpiresAt("");
      setMinUnits("");
      setShowForm(false);
    } else {
      setError(result.error || "Failed to create code.");
    }
  }

  async function handleToggle(code: DiscountCode) {
    const result = await toggleDiscountCode(code.id, userId, !code.active);
    if (result.success) {
      setCodes(codes.map((c) => (c.id === code.id ? { ...c, active: !c.active } : c)));
    }
  }

  async function handleDelete(code: DiscountCode) {
    const result = await deleteDiscountCode(code.id, userId);
    if (result.success) {
      setCodes(codes.filter((c) => c.id !== code.id));
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-yellow-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
            Discount Codes
          </h2>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-stone-500">
            {codes.filter((c) => c.active).length} active
          </span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 rounded-lg bg-yellow-400/10 px-3 py-1.5 text-[11px] font-bold text-yellow-400 transition-colors hover:bg-yellow-400/20"
        >
          <Plus className="h-3 w-3" />
          New Code
        </button>
      </div>

      <p className="mb-4 text-xs text-stone-500">
        Create discount codes to share with your customers. Codes only apply to orders placed through your booking link.
      </p>

      {/* ── Create Form ────────────────────────────────────────────── */}
      {showForm && (
        <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                Code *
              </label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                placeholder="SAVE10"
                maxLength={20}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-mono text-white placeholder-stone-600 focus:border-yellow-400/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                Type
              </label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-yellow-400/50 focus:outline-none"
              >
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed ($)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                {discountType === "percent" ? "Percent Off *" : "Amount Off *"}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === "percent" ? "10" : "25"}
                  min="1"
                  max={discountType === "percent" ? "100" : undefined}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 pr-8 text-sm text-white placeholder-stone-600 focus:border-yellow-400/50 focus:outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">
                  {discountType === "percent" ? "%" : "$"}
                </span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                Max Uses
              </label>
              <input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Unlimited"
                min="1"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-stone-600 focus:border-yellow-400/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                Expires
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-yellow-400/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                Min Units
              </label>
              <input
                type="number"
                value={minUnits}
                onChange={(e) => setMinUnits(e.target.value)}
                placeholder="Any"
                min="2"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-stone-600 focus:border-yellow-400/50 focus:outline-none"
              />
              {minUnits && Number(minUnits) >= 2 && (
                <p className="mt-1 text-[10px] text-stone-600">Requires {minUnits}+ units in order</p>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="h-3 w-3" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={creating || !newCode.trim() || !discountValue}
              className="flex items-center gap-1.5 rounded-lg bg-yellow-400 px-4 py-2 text-xs font-bold text-gray-950 transition-colors hover:bg-yellow-300 disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              {creating ? "Creating..." : "Create Code"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setError("");
              }}
              className="rounded-lg px-3 py-2 text-xs text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Codes List ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-stone-500" />
        </div>
      ) : codes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 py-8 text-center">
          <Tag className="mx-auto mb-2 h-6 w-6 text-stone-600" />
          <p className="text-sm text-stone-500">No discount codes yet</p>
          <p className="mt-1 text-[11px] text-stone-600">
            Create one to share with your customers.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {codes.map((code) => {
            const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
            const isMaxed = code.max_uses !== null && code.current_uses >= code.max_uses;

            return (
              <div
                key={code.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  code.active && !isExpired && !isMaxed
                    ? "border-slate-700 bg-slate-800/50"
                    : "border-slate-800 bg-slate-900/50 opacity-60"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white">
                      {code.code}
                    </span>
                    <span className="rounded bg-yellow-400/10 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400">
                      {code.discount_type === "percent"
                        ? `${code.discount_value}% OFF`
                        : `$${code.discount_value} OFF`}
                    </span>
                    {isExpired && (
                      <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                        EXPIRED
                      </span>
                    )}
                    {isMaxed && (
                      <span className="rounded bg-stone-700 px-1.5 py-0.5 text-[9px] font-bold text-stone-400">
                        MAXED
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-[10px] text-stone-500">
                    <span>{code.current_uses}{code.max_uses !== null ? `/${code.max_uses}` : ""} uses</span>
                    {code.min_units && (
                      <span>{code.min_units}+ units req.</span>
                    )}
                    {code.expires_at && (
                      <span>
                        Expires {new Date(code.expires_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleToggle(code)}
                  className="p-1 text-stone-500 transition-colors hover:text-white"
                  title={code.active ? "Deactivate" : "Activate"}
                >
                  {code.active ? (
                    <ToggleRight className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                </button>

                <button
                  onClick={() => handleDelete(code)}
                  className="p-1 text-stone-500 transition-colors hover:text-red-400"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
