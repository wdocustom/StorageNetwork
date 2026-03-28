"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Search,
  Package,
  Plus,
  X,
  ChevronRight,
  Loader2,
  Trash2,
  Tag,
  Camera,
  Link2,
  Pencil,
  Save,
  ArrowLeft,
  Share2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import {
  getRackByToken,
  getOrCreateSlot,
  addItem,
  updateItem,
  deleteItem,
  updateSlot,
  updateRackLabel,
  searchRackItems,
  type InventoryRack,
  type InventorySlot,
  type InventoryItem,
} from "@/app/actions/tote-inventory";

// ═══════════════════════════════════════════════════════════════════════════
// Customer Inventory Page — /rack/[token]
//
// Scanned via QR code on the physical shelf rack. No login required.
// Shows a visual grid of tote slots. Tap a slot to manage contents.
// ═══════════════════════════════════════════════════════════════════════════

const COLORS = [
  { value: "", label: "None", bg: "bg-slate-800" },
  { value: "red", label: "Red", bg: "bg-red-900/60" },
  { value: "blue", label: "Blue", bg: "bg-blue-900/60" },
  { value: "green", label: "Green", bg: "bg-green-900/60" },
  { value: "yellow", label: "Yellow", bg: "bg-yellow-900/60" },
  { value: "purple", label: "Purple", bg: "bg-purple-900/60" },
  { value: "orange", label: "Orange", bg: "bg-orange-900/60" },
];

const CATEGORIES = [
  "Holiday", "Tools", "Sports", "Kids", "Kitchen",
  "Clothing", "Electronics", "Documents", "Camping", "Crafts",
  "Garden", "Auto", "Office", "Medical", "Other",
];

const CATEGORY_EMOJI: Record<string, string> = {
  Holiday: "\u{1F384}", Tools: "\u{1F527}", Sports: "\u{26BD}", Kids: "\u{1F9F8}",
  Kitchen: "\u{1F373}", Clothing: "\u{1F455}", Electronics: "\u{1F50C}", Documents: "\u{1F4C4}",
  Camping: "\u{26FA}", Crafts: "\u{1F3A8}", Garden: "\u{1F33F}", Auto: "\u{1F697}",
  Office: "\u{1F4BC}", Medical: "\u{1FA7A}", Other: "\u{1F4E6}",
};

function getCategoryEmoji(category: string) {
  return CATEGORY_EMOJI[category] || "";
}

function getSlotColor(color: string) {
  return COLORS.find((c) => c.value === color)?.bg || "bg-slate-800";
}

// Organization score messaging
function getScoreMessage(pct: number): { text: string; subtext: string } {
  if (pct === 0) return { text: "Ready to organize!", subtext: "Scan your first tote to get started" };
  if (pct < 25) return { text: "Great start!", subtext: "Keep going \u2014 every tote cataloged saves time later" };
  if (pct < 50) return { text: "Making progress!", subtext: "You\u2019ll never lose track of anything again" };
  if (pct < 75) return { text: "Almost there!", subtext: "Your garage is becoming seriously organized" };
  if (pct < 100) return { text: "Nearly perfect!", subtext: "Just a few more totes to catalog" };
  return { text: "Fully organized!", subtext: "Every tote is cataloged \u2014 you\u2019re a storage pro" };
}

export default function RackPage() {
  const params = useParams();
  const token = params.token as string;

  const [rack, setRack] = useState<InventoryRack | null>(null);
  const [slots, setSlots] = useState<InventorySlot[]>([]);
  const [linkedRacks, setLinkedRacks] = useState<Array<{ id: string; access_token: string; label: string }>>([]);
  const [installer, setInstaller] = useState<{ name: string; slug: string | null; avatarUrl: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Slot detail view
  const [activeSlot, setActiveSlot] = useState<{ col: number; row: number } | null>(null);
  const [slotData, setSlotData] = useState<InventorySlot | null>(null);
  const [slotItems, setSlotItems] = useState<InventoryItem[]>([]);
  const [slotLoading, setSlotLoading] = useState(false);

  // Add item form
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemCategory, setNewItemCategory] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchAll, setSearchAll] = useState(false);

  // AI scan
  const [scanning, setScanning] = useState(false);
  const [scanPreview, setScanPreview] = useState<Array<{ name: string; quantity: number; category: string }>>([]);
  const [suggestedLabel, setSuggestedLabel] = useState("");

  // Edit rack label
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");

  // Grid highlight (from search)
  const [highlightSlot, setHighlightSlot] = useState<string | null>(null);

  // Share feedback
  const [shared, setShared] = useState(false);

  // Load rack data
  const loadRack = useCallback(async () => {
    setLoading(true);
    const result = await getRackByToken(token);
    if (result.error || !result.rack) {
      setError(result.error || "Rack not found");
    } else {
      setRack(result.rack);
      setSlots(result.slots);
      setLinkedRacks(result.linkedRacks);
      setInstaller(result.installer);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    loadRack();
  }, [loadRack]);

  // Open slot detail
  const openSlot = async (col: number, row: number) => {
    setActiveSlot({ col, row });
    setSlotLoading(true);
    setNewItemName("");
    setNewItemQty(1);
    setNewItemCategory("");
    const result = await getOrCreateSlot(token, col, row);
    if (result.slot) {
      setSlotData(result.slot);
      setSlotItems(result.items);
    }
    setSlotLoading(false);
  };

  // Close slot detail
  const closeSlot = () => {
    setActiveSlot(null);
    setSlotData(null);
    setSlotItems([]);
    loadRack(); // Refresh counts
  };

  // Add item
  const handleAddItem = async () => {
    if (!newItemName.trim() || !slotData) return;
    setAddingItem(true);
    const result = await addItem(slotData.id, token, {
      name: newItemName.trim(),
      quantity: newItemQty,
      category: newItemCategory,
    });
    if (result.item) {
      setSlotItems((prev) => [...prev, result.item!]);
      setNewItemName("");
      setNewItemQty(1);
      setNewItemCategory("");
    }
    setAddingItem(false);
  };

  // Delete item
  const handleDeleteItem = async (itemId: string) => {
    const result = await deleteItem(itemId, token);
    if (result.success) {
      setSlotItems((prev) => prev.filter((i) => i.id !== itemId));
    }
  };

  // Update slot label/color
  const handleSlotUpdate = async (field: string, value: string) => {
    if (!slotData) return;
    await updateSlot(slotData.id, token, { [field]: value });
    setSlotData({ ...slotData, [field]: value });
  };

  // Update rack label
  const handleSaveLabel = async () => {
    if (!labelDraft.trim()) return;
    await updateRackLabel(token, labelDraft.trim());
    setRack((prev) => prev ? { ...prev, label: labelDraft.trim() } : prev);
    setEditingLabel(false);
  };

  // AI photo scan
  const handlePhotoScan = async (file: File) => {
    setScanning(true);
    setScanPreview([]);
    setSuggestedLabel("");
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      // Strip the data:image/...;base64, prefix
      const imageBase64 = base64.split(",")[1];

      const res = await fetch("/api/inventory/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      });

      if (!res.ok) throw new Error("Scan failed");

      const data = await res.json();
      if (data.items && data.items.length > 0) {
        setScanPreview(data.items);
        if (data.toteDescription) setSuggestedLabel(data.toteDescription);
      }
    } catch (err) {
      console.error("[Scan]", err);
    } finally {
      setScanning(false);
    }
  };

  // Accept all scanned items
  const handleAcceptScan = async () => {
    if (!slotData || scanPreview.length === 0) return;
    setAddingItem(true);
    for (const item of scanPreview) {
      const result = await addItem(slotData.id, token, {
        name: item.name,
        quantity: item.quantity,
        category: item.category,
      });
      if (result.item) {
        setSlotItems((prev) => [...prev, result.item!]);
      }
    }
    // Auto-set tote label if empty and we have a suggestion
    if (!slotData.label && suggestedLabel) {
      await handleSlotUpdate("label", suggestedLabel);
    }
    setScanPreview([]);
    setSuggestedLabel("");
    setAddingItem(false);
  };

  // Search
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const result = await searchRackItems(token, searchQuery, searchAll);
    setSearchResults(result.results);
    setSearching(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) handleSearch();
      else setSearchResults([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchAll]);

  // Get slot data for grid position
  const getSlotAt = (col: number, row: number) =>
    slots.find((s) => s.col === col && s.row === row);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (error || !rack) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <Package className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Rack Not Found</h1>
          <p className="text-slate-400 text-sm">
            This QR code may be invalid or the rack has been removed.
          </p>
        </div>
      </div>
    );
  }

  // ── Slot Detail View ─────────────────────────────────────────────
  if (activeSlot && slotData) {
    const displayRow = rack.rows - activeSlot.row;
    const displayCol = activeSlot.col + 1;

    return (
      <div className="min-h-screen bg-slate-950 text-white">
        {/* Header */}
        <header className="border-b border-slate-800 px-4 py-3">
          <button
            onClick={closeSlot}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to rack
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">
                Tote {displayCol}-{displayRow}
              </h1>
              {slotData.label && (
                <p className="text-sm text-yellow-400">{slotData.label}</p>
              )}
            </div>
            <span className="text-xs text-slate-500">
              {slotItems.length} item{slotItems.length !== 1 ? "s" : ""}
            </span>
          </div>
        </header>

        <div className="p-4 space-y-4 max-w-lg mx-auto">
          {/* Slot Label */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider">
              Tote Label
            </label>
            <input
              type="text"
              value={slotData.label}
              onChange={(e) => handleSlotUpdate("label", e.target.value)}
              placeholder="e.g. Christmas Decorations"
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400"
            />
          </div>

          {/* Color Tag */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider">
              Color Tag
            </label>
            <div className="flex gap-2 mt-1">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => handleSlotUpdate("color", c.value)}
                  className={`w-8 h-8 rounded-full border-2 ${
                    slotData.color === c.value
                      ? "border-yellow-400"
                      : "border-slate-600"
                  } ${c.bg}`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Items List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400 uppercase tracking-wider">
                Contents
              </label>
            </div>

            {slotLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
              </div>
            ) : slotItems.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                No items yet. Add what&apos;s in this tote below.
              </p>
            ) : (
              <div className="space-y-2">
                {slotItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        {item.quantity > 1 && <span>Qty: {item.quantity}</span>}
                        {item.category && (
                          <span className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                            {item.category}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Photo Scan */}
          <div className="border-t border-slate-800 pt-4">
            <label className="text-xs text-slate-400 uppercase tracking-wider">
              Snap &amp; Scan
            </label>
            <p className="text-[11px] text-slate-500 mt-1 mb-2">
              Take a photo of the open tote — AI identifies everything inside
            </p>

            <label
              className={`flex items-center justify-center gap-2 w-full py-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                scanning
                  ? "border-yellow-400/50 bg-yellow-400/5"
                  : "border-slate-700 hover:border-yellow-400/50 hover:bg-slate-800/50"
              }`}
            >
              {scanning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-yellow-400" />
                  <span className="text-sm text-yellow-400 font-medium">
                    Analyzing photo...
                  </span>
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5 text-slate-400" />
                  <span className="text-sm text-slate-300 font-medium">
                    Take Photo or Choose Image
                  </span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={scanning}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoScan(file);
                  e.target.value = "";
                }}
              />
            </label>

            {/* Scan Results Preview */}
            {scanPreview.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-yellow-400 font-medium">
                    {scanPreview.length} items detected
                  </span>
                  <button
                    onClick={() => { setScanPreview([]); setSuggestedLabel(""); }}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    Dismiss
                  </button>
                </div>

                {suggestedLabel && !slotData?.label && (
                  <div className="text-xs text-slate-400 bg-slate-800/50 rounded px-2 py-1">
                    Suggested label: <span className="text-yellow-400">{suggestedLabel}</span>
                  </div>
                )}

                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {scanPreview.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-slate-800/70 border border-yellow-400/20 rounded px-2.5 py-1.5 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-white truncate">{item.name}</span>
                        {item.quantity > 1 && (
                          <span className="text-[10px] text-slate-400 shrink-0">x{item.quantity}</span>
                        )}
                      </div>
                      <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300 shrink-0">
                        {item.category}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleAcceptScan}
                  disabled={addingItem}
                  className="w-full bg-yellow-400 text-slate-900 font-bold text-sm py-2.5 rounded-lg hover:bg-yellow-300 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {addingItem ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Add All {scanPreview.length} Items
                </button>
              </div>
            )}
          </div>

          {/* Manual Add Item Form */}
          <div className="border-t border-slate-800 pt-4">
            <label className="text-xs text-slate-400 uppercase tracking-wider">
              Add Manually
            </label>
            <div className="mt-2 space-y-2">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                placeholder="Item name"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(parseInt(e.target.value) || 1)}
                  className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-yellow-400"
                />
                <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
                >
                  <option value="">Category (optional)</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddItem}
                disabled={!newItemName.trim() || addingItem}
                className="w-full bg-yellow-400 text-slate-900 font-bold text-sm py-2.5 rounded-lg hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {addingItem ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add Item
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Computed Stats ───────────────────────────────────────────────
  const totalSlots = rack.cols * rack.rows;
  const filledSlots = slots.filter((s) => (s.item_count ?? 0) > 0).length;
  const totalItems = slots.reduce((sum, s) => sum + (s.item_count ?? 0), 0);
  const utilizationPct = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
  const scoreMsg = getScoreMessage(utilizationPct);
  const designUrl = installer?.slug ? `/design?installer=${installer.slug}` : "/design";

  // Collect unique categories from slot labels
  const usedCategories = new Set<string>();
  for (const s of slots) {
    if (s.label) {
      for (const cat of CATEGORIES) {
        if (s.label.toLowerCase().includes(cat.toLowerCase())) usedCategories.add(cat);
      }
    }
  }

  // ── Main Rack Grid View ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-5 h-5 text-yellow-400" />
            <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">
              Storage Network Inventory
            </span>
          </div>
          <div className="flex items-center justify-between">
            {editingLabel ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveLabel()}
                  className="flex-1 bg-slate-800 border border-yellow-400 rounded px-2 py-1 text-lg font-bold focus:outline-none"
                  autoFocus
                />
                <button onClick={handleSaveLabel} className="text-yellow-400">
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingLabel(false)}
                  className="text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <h1
                className="text-xl font-bold cursor-pointer hover:text-yellow-400 transition-colors flex items-center gap-2"
                onClick={() => {
                  setLabelDraft(rack.label);
                  setEditingLabel(true);
                }}
              >
                {rack.label}
                <Pencil className="w-3 h-3 text-slate-500" />
              </h1>
            )}
            <span className="text-xs text-slate-500">
              {rack.cols}x{rack.rows}
            </span>
          </div>

          {/* Linked racks */}
          {linkedRacks.length > 0 && (
            <div className="mt-2 flex items-center gap-2 overflow-x-auto">
              <Link2 className="w-3 h-3 text-slate-500 shrink-0" />
              {linkedRacks.map((lr) => (
                <a
                  key={lr.id}
                  href={`/rack/${lr.access_token}`}
                  className="text-xs bg-slate-800 border border-slate-700 rounded-full px-2.5 py-1 text-slate-300 hover:border-yellow-400 hover:text-yellow-400 whitespace-nowrap transition-colors"
                >
                  {lr.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4">

        {/* ── Organization Score + Quick Stats ─────────────────────── */}
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50 p-5">
          <div className="flex items-center gap-5">
            {/* Progress Ring */}
            <div className="relative w-20 h-20 shrink-0">
              <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#1e293b" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.5" fill="none"
                  stroke={utilizationPct >= 100 ? "#22c55e" : "#facc15"}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${(utilizationPct / 100) * 97.4} 97.4`}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-black text-white leading-none">{utilizationPct}%</span>
                <span className="text-[8px] text-slate-500 uppercase font-bold">Organized</span>
              </div>
            </div>

            {/* Message + Stats */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white flex items-center gap-1.5">
                {utilizationPct >= 100 && <Sparkles className="w-4 h-4 text-emerald-400" />}
                {utilizationPct >= 100 && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {scoreMsg.text}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">{scoreMsg.subtext}</p>

              {/* Mini stat pills */}
              <div className="flex gap-2 mt-3">
                <div className="bg-slate-800 rounded-lg px-2.5 py-1.5 text-center flex-1">
                  <p className="text-sm font-black text-yellow-400">{totalItems}</p>
                  <p className="text-[8px] text-slate-500 uppercase font-bold">Items</p>
                </div>
                <div className="bg-slate-800 rounded-lg px-2.5 py-1.5 text-center flex-1">
                  <p className="text-sm font-black text-white">{filledSlots}<span className="text-slate-500 font-normal">/{totalSlots}</span></p>
                  <p className="text-[8px] text-slate-500 uppercase font-bold">Totes</p>
                </div>
                {usedCategories.size > 0 && (
                  <div className="bg-slate-800 rounded-lg px-2.5 py-1.5 text-center flex-1">
                    <p className="text-sm font-black text-white">{usedCategories.size}</p>
                    <p className="text-[8px] text-slate-500 uppercase font-bold">Categories</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Empty State Onboarding ──────────────────────────────── */}
        {totalItems === 0 && (
          <div className="rounded-2xl border border-dashed border-yellow-400/30 bg-yellow-400/5 p-5 text-center">
            <div className="text-3xl mb-2">{"\u{1F4E6}"}</div>
            <h2 className="text-base font-bold text-white mb-1">Let&apos;s catalog your totes!</h2>
            <p className="text-xs text-slate-400 mb-4">
              It only takes a minute per tote. Here&apos;s how:
            </p>
            <div className="space-y-3 text-left max-w-xs mx-auto">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-yellow-400 text-slate-900 flex items-center justify-center text-xs font-black shrink-0">1</div>
                <div>
                  <p className="text-xs font-semibold text-white">Tap a tote on the grid</p>
                  <p className="text-[10px] text-slate-500">Pick any tote to start with</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-yellow-400 text-slate-900 flex items-center justify-center text-xs font-black shrink-0">2</div>
                <div>
                  <p className="text-xs font-semibold text-white">Snap a photo</p>
                  <p className="text-[10px] text-slate-500">Our AI identifies everything inside</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-yellow-400 text-slate-900 flex items-center justify-center text-xs font-black shrink-0">3</div>
                <div>
                  <p className="text-xs font-semibold text-white">Never lose anything again</p>
                  <p className="text-[10px] text-slate-500">Search across all totes instantly</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={totalItems > 0 ? `Search ${totalItems} items across ${filledSlots} totes...` : "Search items across totes..."}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400"
          />
          {linkedRacks.length > 0 && (
            <label className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={searchAll}
                onChange={(e) => setSearchAll(e.target.checked)}
                className="accent-yellow-400"
              />
              All racks
            </label>
          )}
        </div>

        {/* Search Results */}
        {searchQuery.trim() && (
          <div className="space-y-2">
            {searching ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                No items found for &quot;{searchQuery}&quot;
              </p>
            ) : (
              <>
                <p className="text-xs text-slate-400">
                  {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} &mdash; tap to find on grid
                </p>
                {searchResults.map((r) => (
                  <div
                    key={r.id}
                    className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 cursor-pointer hover:border-yellow-400/50 transition-colors"
                    onClick={() => {
                      // Highlight the tote on grid, then open on second tap
                      const slotKey = `${r.slot_col}-${r.slot_row}`;
                      setSearchQuery("");
                      setSearchResults([]);
                      setHighlightSlot(slotKey);
                      setTimeout(() => setHighlightSlot(null), 3000);
                      // Scroll grid into view
                      document.getElementById("rack-grid")?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {r.category && <span className="mr-1.5">{getCategoryEmoji(r.category)}</span>}
                        {r.name}
                      </p>
                      {r.quantity > 1 && (
                        <span className="text-xs text-slate-400">
                          x{r.quantity}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>
                        Tote {r.slot_col + 1}-{rack.rows - r.slot_row}
                      </span>
                      {r.slot_label && <span>&middot; {r.slot_label}</span>}
                      {searchAll && r.rack_label !== rack.label && (
                        <span className="text-yellow-400">&middot; {r.rack_label}</span>
                      )}
                      {r.category && (
                        <span className="bg-slate-700 px-1.5 py-0.5 rounded">
                          {r.category}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── Rack Grid ───────────────────────────────────────────── */}
        {!searchQuery.trim() && (
          <div id="rack-grid">
            <p className="text-xs text-slate-400 mb-2">
              Tap a tote to view or add contents
            </p>
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${rack.cols}, 1fr)`,
              }}
            >
              {Array.from({ length: rack.rows }, (_, rowIdx) => {
                const displayRow = rack.rows - 1 - rowIdx;
                return Array.from({ length: rack.cols }, (_, col) => {
                  const slot = getSlotAt(col, displayRow);
                  const hasItems = slot && (slot.item_count ?? 0) > 0;
                  const colorClass = slot?.color
                    ? getSlotColor(slot.color)
                    : "bg-slate-800";
                  const isHighlighted = highlightSlot === `${col}-${displayRow}`;

                  // Determine category emoji from slot label
                  let slotEmoji = "";
                  if (slot?.label) {
                    for (const cat of CATEGORIES) {
                      if (slot.label.toLowerCase().includes(cat.toLowerCase())) {
                        slotEmoji = getCategoryEmoji(cat);
                        break;
                      }
                    }
                  }

                  return (
                    <button
                      key={`${col}-${displayRow}`}
                      onClick={() => openSlot(col, displayRow)}
                      className={`${colorClass} border rounded-xl p-2 aspect-square flex flex-col items-center justify-center gap-0.5 transition-all relative ${
                        isHighlighted
                          ? "border-yellow-400 ring-2 ring-yellow-400/50 animate-pulse scale-105 z-10"
                          : "border-slate-700 hover:border-yellow-400/50"
                      }`}
                    >
                      {/* Tote number */}
                      <span className="text-[9px] text-slate-600 absolute top-1 left-1.5 font-mono">
                        {col + 1}-{rack.rows - displayRow}
                      </span>

                      {slot?.label ? (
                        <>
                          {slotEmoji && (
                            <span className="text-base leading-none">{slotEmoji}</span>
                          )}
                          <span className="text-[10px] text-white font-medium text-center leading-tight line-clamp-2 px-0.5">
                            {slot.label}
                          </span>
                        </>
                      ) : hasItems ? (
                        <Package className="w-4 h-4 text-slate-500" />
                      ) : (
                        <Plus className="w-4 h-4 text-slate-700" />
                      )}

                      {hasItems && (
                        <span className="absolute bottom-1 right-1.5 text-[9px] bg-yellow-400 text-slate-900 font-bold px-1 rounded-full min-w-[16px] text-center">
                          {slot.item_count}
                        </span>
                      )}
                    </button>
                  );
                });
              }).flat()}
            </div>
          </div>
        )}

        {/* ── Growth Engine ──────────────────────────────────────── */}
        <div className="space-y-3 pt-2">
          {/* Running out of space — shows when 80%+ totes have items */}
          {utilizationPct >= 80 && (
            <a
              href={designUrl}
              className="block rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-4 hover:bg-yellow-400/10 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-400/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Running out of space?
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {utilizationPct}% of your totes are cataloged.
                    {installer ? ` ${installer.name} can` : " We can"} build
                    you another rack &mdash; same quality, professionally installed.
                  </p>
                  <span className="inline-block mt-2 text-xs font-bold text-yellow-400">
                    Design Another Rack &rarr;
                  </span>
                </div>
              </div>
            </a>
          )}

          {/* Share with household */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                <Share2 className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-300">Share with your household</p>
                <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
                  Send this link to your family so everyone can find what they need.
                </p>
                <button
                  onClick={() => {
                    const url = window.location.href;
                    if (navigator.share) {
                      navigator.share({ title: rack.label, text: `Access our tote inventory: ${rack.label}`, url }).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(url);
                    }
                    setShared(true);
                    setTimeout(() => setShared(false), 3000);
                  }}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-colors w-full justify-center ${
                    shared
                      ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                      : "bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
                  }`}
                >
                  {shared ? (
                    <><CheckCircle2 className="w-3 h-3" /> Link Copied!</>
                  ) : (
                    <><Share2 className="w-3 h-3" /> Share Inventory Link</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Recommend to a neighbor */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-xs font-semibold text-slate-300 mb-1">
              Know someone who needs garage storage?
            </p>
            <p className="text-[11px] text-slate-500 mb-3">
              Share with a friend and they&apos;ll get the same professional installation you did.
            </p>
            <button
              onClick={() => {
                const shareText = installer?.slug
                  ? `Check out this garage storage system I got — they build and install custom tote racks. ${window.location.origin}/p/${installer.slug}`
                  : `Check out this garage storage system — custom tote racks, professionally installed. ${window.location.origin}/design`;
                if (navigator.share) {
                  navigator.share({ text: shareText }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(shareText);
                }
              }}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-4 py-2 text-xs font-medium text-slate-300 transition-colors w-full justify-center"
            >
              <ChevronRight className="w-3 h-3" />
              Share with a Friend
            </button>
          </div>

          {/* Soft CTA — always visible */}
          <a
            href={designUrl}
            className="block rounded-2xl border border-slate-800 bg-slate-900/30 p-3 text-center hover:border-yellow-400/30 transition-colors group"
          >
            <p className="text-[11px] text-slate-500 group-hover:text-slate-400">
              Need more storage?{" "}
              <span className="text-yellow-400/70 group-hover:text-yellow-400 font-medium">
                Design a new rack &rarr;
              </span>
            </p>
          </a>
        </div>

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <p className="text-[10px] text-slate-600">
            Free forever &bull; Powered by{" "}
            <a href="/" className="text-slate-500 hover:text-yellow-400">
              Storage Network
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
