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

function getSlotColor(color: string) {
  return COLORS.find((c) => c.value === color)?.bg || "bg-slate-800";
}

export default function RackPage() {
  const params = useParams();
  const token = params.token as string;

  const [rack, setRack] = useState<InventoryRack | null>(null);
  const [slots, setSlots] = useState<InventorySlot[]>([]);
  const [linkedRacks, setLinkedRacks] = useState<Array<{ id: string; access_token: string; label: string }>>([]);
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

  // Edit rack label
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");

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

          {/* Add Item Form */}
          <div className="border-t border-slate-800 pt-4">
            <label className="text-xs text-slate-400 uppercase tracking-wider">
              Add Item
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

  // ── Main Rack Grid View ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-5 h-5 text-yellow-400" />
            <span className="text-xs text-slate-400 uppercase tracking-wider">
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
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items across totes..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400"
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
                  {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                </p>
                {searchResults.map((r) => (
                  <div
                    key={r.id}
                    className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 cursor-pointer hover:border-yellow-400/50 transition-colors"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                      openSlot(r.slot_col, r.slot_row);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{r.name}</p>
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
                      {r.slot_label && <span>· {r.slot_label}</span>}
                      {searchAll && r.rack_label !== rack.label && (
                        <span className="text-yellow-400">· {r.rack_label}</span>
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

        {/* Rack Grid */}
        {!searchQuery.trim() && (
          <div>
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
                const displayRow = rack.rows - 1 - rowIdx; // Top row = highest number
                return Array.from({ length: rack.cols }, (_, col) => {
                  const slot = getSlotAt(col, displayRow);
                  const hasItems = slot && (slot.item_count ?? 0) > 0;
                  const colorClass = slot?.color
                    ? getSlotColor(slot.color)
                    : "bg-slate-800";

                  return (
                    <button
                      key={`${col}-${displayRow}`}
                      onClick={() => openSlot(col, displayRow)}
                      className={`${colorClass} border border-slate-700 rounded-lg p-2 aspect-square flex flex-col items-center justify-center gap-1 hover:border-yellow-400/50 transition-colors relative`}
                    >
                      {/* Tote number */}
                      <span className="text-[10px] text-slate-500 absolute top-1 left-1.5">
                        {col + 1}-{rack.rows - displayRow}
                      </span>

                      {slot?.label ? (
                        <span className="text-[11px] text-white font-medium text-center leading-tight line-clamp-2 px-1">
                          {slot.label}
                        </span>
                      ) : (
                        <Package className="w-4 h-4 text-slate-600" />
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

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <p className="text-[10px] text-slate-600">
            Powered by{" "}
            <a href="/" className="text-slate-500 hover:text-yellow-400">
              Storage Network
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
