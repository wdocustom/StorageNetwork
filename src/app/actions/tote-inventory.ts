"use server";

import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Tote Inventory — Customer-facing content tracking for storage racks
//
// SEPARATE from the installer material inventory system (inventory.ts).
// This tracks what CUSTOMERS store inside their totes after installation.
//
// Token-based access (no customer auth). Each rack has a unique access_token.
// Racks with the same customer_email are auto-linked for cross-rack search.
// ═══════════════════════════════════════════════════════════════════════════

const db = () => getServiceClient();

// ── Types ────────────────────────────────────────────────────────────────

export interface InventoryRack {
  id: string;
  access_token: string;
  label: string;
  cols: number;
  rows: number;
  has_wheels: boolean;
  top_type: string;
  layout: string;
  customer_name: string | null;
  customer_email: string | null;
  lead_id: string | null;
  installer_id: string | null;
  created_at: string;
}

export interface InventorySlot {
  id: string;
  rack_id: string;
  col: number;
  row: number;
  label: string;
  color: string;
  photo_url: string | null;
  notes: string;
  item_count?: number;
}

export interface InventoryItem {
  id: string;
  slot_id: string;
  name: string;
  quantity: number;
  category: string;
  photo_url: string | null;
  notes: string;
}

// ── Rack Operations ──────────────────────────────────────────────────────

export async function getRackByToken(token: string): Promise<{
  rack: InventoryRack | null;
  slots: InventorySlot[];
  linkedRacks: Array<{ id: string; access_token: string; label: string }>;
  installer: { name: string; slug: string | null; avatarUrl: string | null } | null;
  error?: string;
}> {
  if (!token || token.length < 16) {
    return { rack: null, slots: [], linkedRacks: [], installer: null, error: "Invalid access token" };
  }

  const { data: rack, error: rackErr } = await db()
    .from("inventory_racks")
    .select("*")
    .eq("access_token", token)
    .maybeSingle();

  if (rackErr || !rack) {
    return { rack: null, slots: [], linkedRacks: [], installer: null, error: "Rack not found" };
  }

  const { data: slots } = await db()
    .from("inventory_slots")
    .select("*, inventory_items(count)")
    .eq("rack_id", rack.id)
    .order("row", { ascending: true })
    .order("col", { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedSlots: InventorySlot[] = (slots || []).map((s: any) => ({
    id: s.id,
    rack_id: s.rack_id,
    col: s.col,
    row: s.row,
    label: s.label || "",
    color: s.color || "",
    photo_url: s.photo_url,
    notes: s.notes || "",
    item_count: s.inventory_items?.[0]?.count ?? 0,
  }));

  let linkedRacks: Array<{ id: string; access_token: string; label: string }> = [];
  if (rack.customer_email) {
    const { data: others } = await db()
      .from("inventory_racks")
      .select("id, access_token, label")
      .eq("customer_email", rack.customer_email)
      .neq("id", rack.id)
      .order("created_at", { ascending: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    linkedRacks = (others || []).map((r: any) => ({
      id: r.id,
      access_token: r.access_token,
      label: r.label,
    }));
  }

  // Fetch installer info for referral links
  let installer: { name: string; slug: string | null; avatarUrl: string | null } | null = null;
  if (rack.installer_id) {
    const { data: profile } = await db()
      .from("profiles")
      .select("business_name, first_name, last_name, slug, avatar_url")
      .eq("id", rack.installer_id)
      .maybeSingle();
    if (profile) {
      installer = {
        name: (profile.business_name as string) ||
          [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
          "Your Installer",
        slug: (profile.slug as string) || null,
        avatarUrl: (profile.avatar_url as string) || null,
      };
    }
  }

  return { rack: rack as InventoryRack, slots: formattedSlots, linkedRacks, installer };
}

export async function createRack(input: {
  leadId?: string;
  installerId?: string;
  customerName?: string;
  customerEmail?: string;
  label: string;
  cols: number;
  rows: number;
  hasWheels?: boolean;
  topType?: string;
  layout?: string;
}): Promise<{ rack: InventoryRack | null; error?: string }> {
  const { data, error } = await db()
    .from("inventory_racks")
    .insert({
      lead_id: input.leadId || null,
      installer_id: input.installerId || null,
      customer_name: input.customerName || null,
      customer_email: input.customerEmail?.toLowerCase().trim() || null,
      label: input.label,
      cols: input.cols,
      rows: input.rows,
      has_wheels: input.hasWheels || false,
      top_type: input.topType || "none",
      layout: input.layout || "standard",
    })
    .select("*")
    .single();

  if (error) {
    console.error("[ToteInventory] Create rack error:", error);
    return { rack: null, error: "Failed to create rack" };
  }

  return { rack: data as InventoryRack };
}

export async function updateRackLabel(token: string, label: string): Promise<{ success: boolean }> {
  const { error } = await db()
    .from("inventory_racks")
    .update({ label, updated_at: new Date().toISOString() })
    .eq("access_token", token);
  return { success: !error };
}

// ── Slot Operations ──────────────────────────────────────────────────────

export async function getOrCreateSlot(
  token: string,
  col: number,
  row: number
): Promise<{ slot: InventorySlot | null; items: InventoryItem[]; error?: string }> {
  const { data: rack } = await db()
    .from("inventory_racks")
    .select("id")
    .eq("access_token", token)
    .maybeSingle();

  if (!rack) return { slot: null, items: [], error: "Rack not found" };

  let { data: slot } = await db()
    .from("inventory_slots")
    .select("*")
    .eq("rack_id", rack.id)
    .eq("col", col)
    .eq("row", row)
    .maybeSingle();

  if (!slot) {
    const { data: newSlot, error } = await db()
      .from("inventory_slots")
      .insert({ rack_id: rack.id, col, row })
      .select("*")
      .single();
    if (error) return { slot: null, items: [], error: "Failed to create slot" };
    slot = newSlot;
  }

  const { data: items } = await db()
    .from("inventory_items")
    .select("*")
    .eq("slot_id", slot.id)
    .order("created_at", { ascending: true });

  return { slot: slot as InventorySlot, items: (items || []) as InventoryItem[] };
}

export async function updateSlot(
  slotId: string,
  token: string,
  updates: { label?: string; color?: string; notes?: string; photo_url?: string }
): Promise<{ success: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: slot } = await db()
    .from("inventory_slots")
    .select("rack_id, inventory_racks!inner(access_token)")
    .eq("id", slotId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!slot || (slot as any).inventory_racks?.access_token !== token) return { success: false };

  const { error } = await db()
    .from("inventory_slots")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", slotId);

  return { success: !error };
}

// ── Item Operations ──────────────────────────────────────────────────────

export async function addItem(
  slotId: string,
  token: string,
  item: { name: string; quantity?: number; category?: string; notes?: string; photo_url?: string }
): Promise<{ item: InventoryItem | null; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: slot } = await db()
    .from("inventory_slots")
    .select("id, rack_id, inventory_racks!inner(access_token)")
    .eq("id", slotId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!slot || (slot as any).inventory_racks?.access_token !== token) return { item: null, error: "Unauthorized" };

  const { data, error } = await db()
    .from("inventory_items")
    .insert({
      slot_id: slotId,
      name: item.name,
      quantity: item.quantity ?? 1,
      category: item.category || "",
      notes: item.notes || "",
      photo_url: item.photo_url || null,
    })
    .select("*")
    .single();

  if (error) return { item: null, error: "Failed to add item" };
  return { item: data as InventoryItem };
}

export async function updateItem(
  itemId: string,
  token: string,
  updates: { name?: string; quantity?: number; category?: string; notes?: string; photo_url?: string }
): Promise<{ success: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item } = await db()
    .from("inventory_items")
    .select("slot_id, inventory_slots!inner(rack_id, inventory_racks!inner(access_token))")
    .eq("id", itemId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!item || (item as any).inventory_slots?.inventory_racks?.access_token !== token) return { success: false };

  const { error } = await db()
    .from("inventory_items")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", itemId);

  return { success: !error };
}

export async function deleteItem(itemId: string, token: string): Promise<{ success: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item } = await db()
    .from("inventory_items")
    .select("slot_id, inventory_slots!inner(rack_id, inventory_racks!inner(access_token))")
    .eq("id", itemId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!item || (item as any).inventory_slots?.inventory_racks?.access_token !== token) return { success: false };

  const { error } = await db()
    .from("inventory_items")
    .delete()
    .eq("id", itemId);

  return { success: !error };
}

// ── Search ───────────────────────────────────────────────────────────────

/** Search items — single rack by default, or all linked racks if searchAll=true */
export async function searchRackItems(
  token: string,
  query: string,
  searchAll: boolean = false
): Promise<{
  results: Array<InventoryItem & { slot_label: string; slot_col: number; slot_row: number; rack_label: string; rack_token: string }>;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rack } = await db()
    .from("inventory_racks")
    .select("id, customer_email, label, access_token")
    .eq("access_token", token)
    .maybeSingle();

  if (!rack) return { results: [] };

  const searchTerm = query.trim().toLowerCase();
  if (!searchTerm) return { results: [] };

  let rackIds = [rack.id];
  let rackLabels: Record<string, { label: string; token: string }> = {
    [rack.id]: { label: rack.label, token: rack.access_token },
  };

  if (searchAll && rack.customer_email) {
    const { data: allRacks } = await db()
      .from("inventory_racks")
      .select("id, label, access_token")
      .eq("customer_email", rack.customer_email);

    if (allRacks) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rackIds = allRacks.map((r: any) => r.id);
      rackLabels = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allRacks.forEach((r: any) => { rackLabels[r.id] = { label: r.label, token: r.access_token }; });
    }
  }

  const { data: items } = await db()
    .from("inventory_items")
    .select("*, inventory_slots!inner(label, col, row, rack_id)")
    .in("inventory_slots.rack_id", rackIds)
    .or(`name.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = (items || []).map((i: any) => {
    const rackId = i.inventory_slots?.rack_id;
    const rackInfo = rackLabels[rackId] || { label: "Unknown", token: "" };
    return {
      id: i.id, slot_id: i.slot_id, name: i.name, quantity: i.quantity,
      category: i.category, photo_url: i.photo_url, notes: i.notes,
      slot_label: i.inventory_slots?.label || "",
      slot_col: i.inventory_slots?.col ?? 0,
      slot_row: i.inventory_slots?.row ?? 0,
      rack_label: rackInfo.label, rack_token: rackInfo.token,
    };
  });

  return { results };
}

// ── Cross-tote Consolidation Suggestions ─────────────────────────────────
//
// "Beast organizer mode" — gentle nudges, never authoritative. Looks at
// the items in a freshly-edited slot and finds *other* slots (across this
// customer's linked racks) where the same category already lives. Only
// surfaces a suggestion when the category overlap is obvious — see
// MIN_MATCH_COUNT and MIN_MATCH_RATIO below.

export interface ConsolidationSuggestion {
  /** Items in the source slot that match the target's dominant category. */
  itemIds: string[];
  category: string;
  matchedItemNames: string[];     // up to 4 names for the UI preview
  /** Where the suggestion points to. */
  targetSlotId: string;
  targetSlotLabel: string;        // e.g. "Christmas decor" — falls back to "Slot R3·C2"
  targetRackLabel: string;
  targetRackToken: string;
  targetExistingCount: number;    // items already in the target with this category
  sameRack: boolean;              // true when target is in the same rack as source
}

const MIN_MATCH_COUNT = 3;        // fewest items in source-slot to consider
const MIN_MATCH_RATIO = 0.8;      // ≥80% of source-slot items must share the category

export async function suggestConsolidations(
  token: string,
  slotId: string
): Promise<{ suggestions: ConsolidationSuggestion[]; error?: string }> {
  // Auth: token must belong to a rack that owns this slot.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: slotRow } = await db()
    .from("inventory_slots")
    .select("id, rack_id, label, col, row, inventory_racks!inner(id, access_token, customer_email, label)")
    .eq("id", slotId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slotRack = (slotRow as any)?.inventory_racks;
  if (!slotRow || !slotRack || slotRack.access_token !== token) {
    return { suggestions: [], error: "Unauthorized" };
  }

  // Items currently in the source slot.
  const { data: sourceItems } = await db()
    .from("inventory_items")
    .select("id, name, category")
    .eq("slot_id", slotId);

  const items = (sourceItems || []).filter((i) => i.category && i.category.trim());
  if (items.length < MIN_MATCH_COUNT) return { suggestions: [] };

  // Find the dominant category — must hit MIN_MATCH_RATIO of all categorized items.
  const counts = new Map<string, string[]>(); // category -> item ids
  for (const it of items) {
    const cat = it.category as string;
    if (!counts.has(cat)) counts.set(cat, []);
    counts.get(cat)!.push(it.id as string);
  }
  let dominantCategory: string | null = null;
  let dominantIds: string[] = [];
  // Array.from() avoids the downlevelIteration restriction on direct Map iteration.
  for (const [cat, ids] of Array.from(counts.entries())) {
    if (ids.length / items.length >= MIN_MATCH_RATIO && ids.length >= MIN_MATCH_COUNT) {
      if (ids.length > dominantIds.length) {
        dominantCategory = cat;
        dominantIds = ids;
      }
    }
  }
  if (!dominantCategory) return { suggestions: [] };

  // Collect this customer's racks (current rack + email-linked) so we know
  // which other slots to consider as merge targets.
  const customerEmail = slotRack.customer_email as string | null;
  let rackIds: string[] = [slotRack.id as string];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rackLabelById: Record<string, { label: string; token: string }> = {
    [slotRack.id]: { label: slotRack.label, token: slotRack.access_token },
  };
  if (customerEmail) {
    const { data: allRacks } = await db()
      .from("inventory_racks")
      .select("id, label, access_token")
      .eq("customer_email", customerEmail);
    if (allRacks && allRacks.length) {
      rackIds = allRacks.map((r) => r.id as string);
      for (const r of allRacks) {
        rackLabelById[r.id as string] = {
          label: (r.label as string) || "Storage Rack",
          token: r.access_token as string,
        };
      }
    }
  }

  // Tally items in the dominant category across all candidate slots, excluding
  // the source slot itself.
  const { data: targetCandidates } = await db()
    .from("inventory_items")
    .select("slot_id, inventory_slots!inner(id, label, col, row, rack_id)")
    .in("inventory_slots.rack_id", rackIds)
    .eq("category", dominantCategory)
    .neq("slot_id", slotId);

  if (!targetCandidates || targetCandidates.length === 0) return { suggestions: [] };

  // Group by target slot, count how many same-category items already live there.
  const bySlot = new Map<string, { count: number; slot: { id: string; label: string; col: number; row: number; rackId: string } }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of targetCandidates as any[]) {
    const s = row.inventory_slots;
    if (!s) continue;
    const key = s.id as string;
    if (!bySlot.has(key)) {
      bySlot.set(key, {
        count: 0,
        slot: { id: s.id, label: s.label || "", col: s.col, row: s.row, rackId: s.rack_id },
      });
    }
    bySlot.get(key)!.count++;
  }
  if (bySlot.size === 0) return { suggestions: [] };

  // Pick the target slot with the most existing matches; tiebreak: same-rack first.
  const ranked = Array.from(bySlot.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const aSame = a.slot.rackId === slotRack.id ? 1 : 0;
      const bSame = b.slot.rackId === slotRack.id ? 1 : 0;
      return bSame - aSame;
    });

  const top = ranked[0];
  const targetRackInfo = rackLabelById[top.slot.rackId] || { label: "Storage Rack", token: "" };

  const matchedItemNames = items
    .filter((i) => dominantIds.includes(i.id as string))
    .slice(0, 4)
    .map((i) => i.name as string);

  const suggestion: ConsolidationSuggestion = {
    itemIds: dominantIds,
    category: dominantCategory,
    matchedItemNames,
    targetSlotId: top.slot.id,
    targetSlotLabel: top.slot.label || `Slot R${top.slot.row + 1}·C${top.slot.col + 1}`,
    targetRackLabel: targetRackInfo.label,
    targetRackToken: targetRackInfo.token,
    targetExistingCount: top.count,
    sameRack: top.slot.rackId === slotRack.id,
  };

  return { suggestions: [suggestion] };
}

// ── Reassign items between slots (Phase 1.5 "Move to Tote X") ────────────
//
// Moves an array of inventory_items to a new slot, with auth scoped to the
// caller's rack token. The target slot must belong to a rack owned by the
// same customer_email as the token's rack (so reassigns can flow across
// linked racks but never to a stranger's). Returns count of items moved.

export async function reassignItems(
  itemIds: string[],
  targetSlotId: string,
  token: string
): Promise<{ moved: number; error?: string }> {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return { moved: 0, error: "No items to move" };
  }
  if (!targetSlotId || !token) {
    return { moved: 0, error: "Missing target slot or token" };
  }

  // 1. Resolve token → rack → customer_email.
  const { data: callerRack } = await db()
    .from("inventory_racks")
    .select("id, customer_email")
    .eq("access_token", token)
    .maybeSingle();
  if (!callerRack) return { moved: 0, error: "Unauthorized" };

  // 2. Verify target slot belongs to a rack owned by the same customer.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: targetSlot } = await db()
    .from("inventory_slots")
    .select("id, rack_id, inventory_racks!inner(id, customer_email)")
    .eq("id", targetSlotId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const targetRack = (targetSlot as any)?.inventory_racks;
  if (!targetSlot || !targetRack) return { moved: 0, error: "Target slot not found" };

  const callerEmail = (callerRack.customer_email as string | null)?.toLowerCase() ?? null;
  const targetEmail = (targetRack.customer_email as string | null)?.toLowerCase() ?? null;
  // Both must belong to the same customer. If either is null, only allow
  // when target rack id matches the caller's rack id (single-rack case).
  const sameOwner = callerEmail && targetEmail && callerEmail === targetEmail;
  const sameRack = (callerRack.id as string) === (targetRack.id as string);
  if (!sameOwner && !sameRack) return { moved: 0, error: "Unauthorized target" };

  // 3. Verify each item to be moved currently lives in a slot owned by the
  //    same customer (prevents a leaked token from rehoming arbitrary items).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: itemsToMove } = await db()
    .from("inventory_items")
    .select("id, slot_id, inventory_slots!inner(rack_id, inventory_racks!inner(id, customer_email))")
    .in("id", itemIds);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const safeIds = (itemsToMove || []).filter((it: any) => {
    const ownerEmail = (it.inventory_slots?.inventory_racks?.customer_email as string | null)?.toLowerCase() ?? null;
    const ownerRackId = it.inventory_slots?.inventory_racks?.id as string | undefined;
    if (sameRack) return ownerRackId === (callerRack.id as string);
    return ownerEmail && callerEmail && ownerEmail === callerEmail;
  }).map((it: { id: string }) => it.id);

  if (safeIds.length === 0) return { moved: 0, error: "No items eligible to move" };

  const { error } = await db()
    .from("inventory_items")
    .update({ slot_id: targetSlotId, updated_at: new Date().toISOString() })
    .in("id", safeIds);

  if (error) {
    console.error("[ToteInventory] reassignItems failed:", error);
    return { moved: 0, error: "Move failed" };
  }

  return { moved: safeIds.length };
}

// ── Phase 2: "Where does this go?" find-home for a single item ─────────
//
// Customer photographs ONE item (e.g. a screwdriver). The /api/inventory/scan
// endpoint with mode="single" identifies it as { name, category }. This action
// scans all of the customer's email-linked racks and returns the best
// destination tote(s) — ranked by:
//   1. Exact name match in the candidate slot   (strongest signal)
//   2. Same-category item count                  (next strongest)
//   3. Same-rack tiebreaker                      (proximity matters)

export interface ItemHomeCandidate {
  slotId: string;
  slotLabel: string;
  slotCol: number;
  slotRow: number;
  rackId: string;
  rackLabel: string;
  rackToken: string;
  sameRack: boolean;
  matchingItemCount: number;       // items in this slot with the same category
  hasExactNameMatch: boolean;      // a slot already holds an item with the same name
  sampleItemNames: string[];       // up to 3 item names from the slot (same category)
}

export async function findHomeForItem(
  token: string,
  item: { name: string; category: string }
): Promise<{ candidates: ItemHomeCandidate[]; error?: string }> {
  if (!token || !item || !item.category || !item.name) {
    return { candidates: [], error: "Missing token or item fields" };
  }

  // 1. Resolve token → caller rack → customer email.
  const { data: rack } = await db()
    .from("inventory_racks")
    .select("id, customer_email, label, access_token")
    .eq("access_token", token)
    .maybeSingle();
  if (!rack) return { candidates: [], error: "Rack not found" };

  // 2. Pull the candidate rack set (this rack + email-linked racks).
  let rackList: Array<{ id: string; label: string; token: string }> = [
    { id: rack.id as string, label: (rack.label as string) || "Storage Rack", token: rack.access_token as string },
  ];
  if (rack.customer_email) {
    const { data: linked } = await db()
      .from("inventory_racks")
      .select("id, label, access_token")
      .eq("customer_email", rack.customer_email);
    if (linked && linked.length) {
      rackList = linked.map((r) => ({
        id: r.id as string,
        label: (r.label as string) || "Storage Rack",
        token: r.access_token as string,
      }));
    }
  }
  const rackIds = rackList.map((r) => r.id);
  const rackById = new Map(rackList.map((r) => [r.id, r]));

  // 3. Pull all items in those racks that share the target category.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: matches } = await db()
    .from("inventory_items")
    .select("id, name, slot_id, category, inventory_slots!inner(id, label, col, row, rack_id)")
    .in("inventory_slots.rack_id", rackIds)
    .eq("category", item.category);

  if (!matches || matches.length === 0) return { candidates: [] };

  // 4. Aggregate by slot.
  const targetName = item.name.trim().toLowerCase();
  const bySlot = new Map<string, ItemHomeCandidate>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of matches as any[]) {
    const s = row.inventory_slots;
    if (!s) continue;
    const sId = s.id as string;
    const rId = s.rack_id as string;
    const rackInfo = rackById.get(rId);
    if (!rackInfo) continue;

    let entry = bySlot.get(sId);
    if (!entry) {
      entry = {
        slotId: sId,
        slotLabel: (s.label as string) || `Slot R${(s.row as number) + 1}·C${(s.col as number) + 1}`,
        slotCol: s.col as number,
        slotRow: s.row as number,
        rackId: rId,
        rackLabel: rackInfo.label,
        rackToken: rackInfo.token,
        sameRack: rId === (rack.id as string),
        matchingItemCount: 0,
        hasExactNameMatch: false,
        sampleItemNames: [],
      };
      bySlot.set(sId, entry);
    }
    entry.matchingItemCount++;
    const nm = ((row.name as string) || "").trim().toLowerCase();
    if (nm && nm === targetName) entry.hasExactNameMatch = true;
    if (entry.sampleItemNames.length < 3 && row.name) {
      entry.sampleItemNames.push(row.name as string);
    }
  }

  // 5. Rank: exact-name match > matching count > same-rack tiebreaker.
  const ranked = Array.from(bySlot.values()).sort((a, b) => {
    if (a.hasExactNameMatch !== b.hasExactNameMatch) return a.hasExactNameMatch ? -1 : 1;
    if (a.matchingItemCount !== b.matchingItemCount) return b.matchingItemCount - a.matchingItemCount;
    if (a.sameRack !== b.sameRack) return a.sameRack ? -1 : 1;
    return 0;
  });

  // Top 3 candidates is plenty — keeps the UI digestible.
  return { candidates: ranked.slice(0, 3) };
}

// ── Batch create racks from a job's shelf configs ────────────────────────

export async function createRacksForJob(input: {
  leadId: string;
  installerId: string;
  customerName: string;
  customerEmail: string;
  shelfConfigs: Array<{ cols: number; rows: number; hasWheels?: boolean; topType?: string; layout?: string }>;
}): Promise<{ racks: InventoryRack[]; error?: string }> {
  const racks: InventoryRack[] = [];

  for (let i = 0; i < input.shelfConfigs.length; i++) {
    const config = input.shelfConfigs[i];
    const label = input.shelfConfigs.length === 1
      ? "My Storage Rack"
      : `Rack ${i + 1}`;

    const result = await createRack({
      leadId: input.leadId,
      installerId: input.installerId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      label,
      cols: config.cols,
      rows: config.rows,
      hasWheels: config.hasWheels,
      topType: config.topType,
      layout: config.layout,
    });

    if (result.rack) {
      racks.push(result.rack);
    } else {
      return { racks, error: result.error || "Failed to create rack" };
    }
  }

  return { racks };
}

// ── Get racks for a job (installer-side) ─────────────────────────────────

export async function getRacksForJob(leadId: string): Promise<InventoryRack[]> {
  const { data } = await db()
    .from("inventory_racks")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });

  return (data || []) as InventoryRack[];
}

// ── Email rack link to customer ──────────────────────────────────────────

export async function emailRackLink(input: {
  rackId: string;
  customerEmail: string;
  customerName: string;
}): Promise<{ success: boolean; error?: string }> {
  const { data: rack } = await db()
    .from("inventory_racks")
    .select("access_token, label, cols, rows")
    .eq("id", input.rackId)
    .maybeSingle();

  if (!rack) return { success: false, error: "Rack not found" };

  const { getAppUrl } = await import("@/lib/url-helper");
  const { sendTransactionalEmail, emailShell } = await import("@/lib/email");

  const rackUrl = `${getAppUrl()}/rack/${rack.access_token}`;
  const safeName = input.customerName.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = emailShell(
    "Your Tote Inventory Is Ready",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${safeName},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
      Your storage rack <strong style="color:#facc15;">${rack.label}</strong> (${rack.cols}&times;${rack.rows}) now has a digital inventory tracker.
      Use it to catalog what&rsquo;s in each tote &mdash; snap a photo and our AI will identify the contents automatically.
    </p>

    <!-- Feature Highlights -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr>
          <td style="padding:8px 0;color:#facc15;font-weight:700;">&#128247; AI Photo Scan</td>
          <td style="padding:8px 0;color:#94a3b8;text-align:right;">Snap a photo, we identify contents</td>
        </tr>
        <tr style="border-top:1px solid #1e293b;">
          <td style="padding:8px 0;color:#facc15;font-weight:700;">&#128269; Search</td>
          <td style="padding:8px 0;color:#94a3b8;text-align:right;">Find any item across all your totes</td>
        </tr>
        <tr style="border-top:1px solid #1e293b;">
          <td style="padding:8px 0;color:#facc15;font-weight:700;">&#128274; Private</td>
          <td style="padding:8px 0;color:#94a3b8;text-align:right;">No login needed &mdash; access via your link</td>
        </tr>
      </table>
    </div>

    <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;text-align:center;">
      Bookmark this link or scan the QR code on your rack:
    </p>

    <div style="text-align:center;margin:24px 0;">
      <a href="${rackUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        Open My Inventory &rarr;
      </a>
    </div>

    <p style="margin:0;color:#475569;font-size:12px;text-align:center;font-style:italic;">
      This link is your private access key &mdash; no account required.
    </p>
    `
  );

  const result = await sendTransactionalEmail({
    to: input.customerEmail,
    toName: input.customerName,
    subject: `Your Storage Rack Inventory — ${rack.label}`,
    html,
  });

  return { success: result.success, error: result.error };
}
