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
  error?: string;
}> {
  if (!token || token.length < 16) {
    return { rack: null, slots: [], linkedRacks: [], error: "Invalid access token" };
  }

  const { data: rack, error: rackErr } = await db()
    .from("inventory_racks")
    .select("*")
    .eq("access_token", token)
    .maybeSingle();

  if (rackErr || !rack) {
    return { rack: null, slots: [], linkedRacks: [], error: "Rack not found" };
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

  return { rack: rack as InventoryRack, slots: formattedSlots, linkedRacks };
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
