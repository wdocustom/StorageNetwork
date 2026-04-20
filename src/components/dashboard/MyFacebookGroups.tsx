"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Facebook,
  Plus,
  Trash2,
  ExternalLink,
  Check,
  Loader2,
  Copy,
  Users,
  X,
} from "lucide-react";
import {
  getSavedFacebookGroups,
  addFacebookGroup,
  removeFacebookGroup,
  type SavedFacebookGroup,
} from "@/app/actions/facebook-groups";

// ═══════════════════════════════════════════════════════════════════════════
// My Facebook Groups — Save groups, select, and blast-post to all of them
//
// Flow: user saves group URLs → selects groups → clicks "Post to Groups"
// → text is copied to clipboard → each group opens in a new tab
// → user pastes & posts in each tab
// ═══════════════════════════════════════════════════════════════════════════

interface MyFacebookGroupsProps {
  installerId: string;
  /** The post text to share — when provided, the group selection UI shows */
  postText?: string | null;
  /** The installer's booking link — used for OG card in Facebook sharer */
  bookingLink?: string;
  /** Callback after the user triggers "Post to Groups" */
  onPosted?: () => void;
}

export default function MyFacebookGroups({
  installerId,
  postText,
  bookingLink,
  onPosted,
}: MyFacebookGroupsProps) {
  const [groups, setGroups] = useState<SavedFacebookGroup[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [error, setError] = useState("");
  const [posted, setPosted] = useState(false);

  // Sequential posting flow — walks through groups one at a time
  const [postingGroups, setPostingGroups] = useState<SavedFacebookGroup[]>([]);
  const [postingStep, setPostingStep] = useState(-1); // -1 = not in flow

  // ── Load saved groups ──────────────────────────────────────────────
  const loadGroups = useCallback(async () => {
    try {
      const data = await getSavedFacebookGroups(installerId);
      setGroups(data);
      // Auto-select all by default
      setSelected(new Set(data.map((g) => g.id)));
    } catch {
      // Silently fail — empty list shown
    } finally {
      setLoading(false);
    }
  }, [installerId]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // ── Add group ──────────────────────────────────────────────────────
  async function handleAdd() {
    if (!newName.trim() || !newUrl.trim()) return;

    // Basic URL validation
    const url = newUrl.trim();
    if (!url.includes("facebook.com/groups/")) {
      setError("Please enter a Facebook group URL (e.g. https://www.facebook.com/groups/...)");
      return;
    }

    setAdding(true);
    setError("");
    try {
      const group = await addFacebookGroup(installerId, newName, url);
      setGroups((prev) => [...prev, group]);
      setSelected((prev) => { const next = new Set(prev); next.add(group.id); return next; });
      setNewName("");
      setNewUrl("");
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || "Failed to add group");
    } finally {
      setAdding(false);
    }
  }

  // ── Remove group ───────────────────────────────────────────────────
  async function handleRemove(groupId: string) {
    try {
      await removeFacebookGroup(installerId, groupId);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    } catch {
      // Silently fail
    }
  }

  // ── Toggle selection ───────────────────────────────────────────────
  function toggleGroup(groupId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(groups.map((g) => g.id)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  // ── Open a Facebook sharer dialog with pre-filled text + OG card ──
  function openSharer(text: string, link: string) {
    const sharerUrl =
      `https://www.facebook.com/sharer/sharer.php` +
      `?u=${encodeURIComponent(link)}` +
      `&quote=${encodeURIComponent(text)}`;
    window.open(sharerUrl, "_blank", "width=600,height=500");
  }

  // ── Post to selected groups — sequential sharer flow ─────────────
  function handlePostToGroups() {
    if (!postText || selected.size === 0) return;

    // Copy text to clipboard
    navigator.clipboard.writeText(postText);

    const ordered = groups.filter((g) => selected.has(g.id));

    // Desktop with booking link: use sequential sharer flow
    // so the text + OG card carry over automatically
    if (bookingLink) {
      setPostingGroups(ordered);
      setPostingStep(0);
      openSharer(postText, bookingLink);
      return;
    }

    // Fallback: open each group URL directly (old behavior)
    ordered.forEach((g, i) => {
      setTimeout(() => {
        window.open(g.group_url, "_blank");
      }, i * 300);
    });

    setPosted(true);
    setTimeout(() => setPosted(false), 4000);
    onPosted?.();
  }

  // ── Sequential flow: advance to next group ──────────────────────
  function handleNextGroup() {
    if (!postText || !bookingLink) return;

    const nextStep = postingStep + 1;
    if (nextStep >= postingGroups.length) {
      // All done
      setPostingStep(-1);
      setPostingGroups([]);
      setPosted(true);
      setTimeout(() => setPosted(false), 4000);
      onPosted?.();
      return;
    }

    setPostingStep(nextStep);
    // Re-copy text for convenience (user may have clipboard overwritten)
    navigator.clipboard.writeText(postText);
    openSharer(postText, bookingLink);
  }

  function handleCancelPosting() {
    setPostingStep(-1);
    setPostingGroups([]);
  }

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
        <span className="text-xs text-stone-500">Loading your groups...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15">
            <Users className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">My Facebook Groups</p>
            <p className="text-[10px] text-stone-500">
              {groups.length === 0
                ? "Add your groups to post to them quickly"
                : `${groups.length} group${groups.length === 1 ? "" : "s"} saved`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-[11px] font-bold text-blue-400 transition-colors hover:bg-blue-500/20"
        >
          {showForm ? (
            <>
              <X className="h-3 w-3" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="h-3 w-3" />
              Add Group
            </>
          )}
        </button>
      </div>

      {/* Add Group Form */}
      {showForm && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Group name (e.g. Dallas Buy Sell Trade)"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-stone-600 outline-none focus:border-blue-400"
          />
          <input
            type="url"
            value={newUrl}
            onChange={(e) => { setNewUrl(e.target.value); setError(""); }}
            placeholder="https://www.facebook.com/groups/..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-stone-600 outline-none focus:border-blue-400"
          />
          {error && (
            <p className="text-[11px] text-red-400">{error}</p>
          )}
          <button
            onClick={handleAdd}
            disabled={adding || !newName.trim() || !newUrl.trim()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-500 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-400 disabled:opacity-50"
          >
            {adding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Save Group
          </button>
          <p className="text-[10px] leading-relaxed text-stone-500">
            Go to the group on Facebook, copy the URL from the address bar, and paste it above.
          </p>
        </div>
      )}

      {/* Group List */}
      {groups.length > 0 && (
        <div className="space-y-1.5">
          {/* Select all/none */}
          {groups.length > 1 && (
            <div className="flex items-center gap-2 px-1">
              <button
                onClick={selectAll}
                className="text-[10px] font-bold text-blue-400 hover:text-blue-300"
              >
                Select All
              </button>
              <span className="text-stone-700">|</span>
              <button
                onClick={selectNone}
                className="text-[10px] font-bold text-stone-500 hover:text-stone-400"
              >
                None
              </button>
              <span className="ml-auto text-[10px] text-stone-600">
                {selected.size} selected
              </span>
            </div>
          )}

          {groups.map((group) => {
            const isSelected = selected.has(group.id);
            return (
              <div
                key={group.id}
                className={`flex items-center gap-3 rounded-lg border p-2.5 transition-all cursor-pointer ${
                  isSelected
                    ? "border-blue-500/30 bg-blue-500/[0.06]"
                    : "border-slate-800 bg-slate-900/80 hover:border-slate-700"
                }`}
                onClick={() => toggleGroup(group.id)}
              >
                {/* Checkbox */}
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all ${
                    isSelected
                      ? "border-blue-400 bg-blue-500"
                      : "border-slate-600 bg-slate-800"
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </div>

                {/* Group info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isSelected ? "text-blue-300" : "text-white"}`}>
                    {group.group_name}
                  </p>
                  <p className="text-[10px] text-stone-600 truncate">
                    {group.group_url}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={group.group_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="rounded p-1.5 text-stone-600 hover:bg-slate-800 hover:text-blue-400"
                    title="Open group"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(group.id);
                    }}
                    className="rounded p-1.5 text-stone-600 hover:bg-red-500/10 hover:text-red-400"
                    title="Remove group"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {groups.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center">
          <Facebook className="mx-auto mb-2 h-8 w-8 text-stone-700" />
          <p className="text-sm font-semibold text-stone-500">No groups saved yet</p>
          <p className="mt-1 text-xs text-stone-600">
            Add the Facebook groups you post in so you can blast your content to all of them at once.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-blue-500/15 px-4 py-2 text-xs font-bold text-blue-400 transition-colors hover:bg-blue-500/25"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Your First Group
          </button>
        </div>
      )}

      {/* Sequential posting progress — active when walking through groups */}
      {postingStep >= 0 && postingGroups.length > 0 && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/[0.06] p-4 space-y-3">
          {/* Progress header */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-blue-400">
              Group {postingStep + 1} of {postingGroups.length}
            </p>
            <button
              onClick={handleCancelPosting}
              className="flex items-center gap-1 text-[10px] font-semibold text-stone-500 hover:text-stone-400"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${((postingStep + 1) / postingGroups.length) * 100}%` }}
            />
          </div>

          {/* Current group */}
          <div className="flex items-center gap-2">
            <Facebook className="h-4 w-4 text-blue-400" />
            <p className="text-sm font-semibold text-white truncate">
              {postingGroups[postingStep].group_name}
            </p>
          </div>

          <p className="text-[11px] leading-relaxed text-stone-500">
            A Facebook share dialog opened with your post text and link card pre-filled.
            Post it, then come back here and click below for the next group.
          </p>

          {/* Next / Finish button */}
          <button
            onClick={handleNextGroup}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-400"
          >
            {postingStep + 1 < postingGroups.length ? (
              <>
                <Facebook className="h-3.5 w-3.5" />
                Next Group: {postingGroups[postingStep + 1].group_name}
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                All Done
              </>
            )}
          </button>
        </div>
      )}

      {/* Post to Groups button — only shows when there's post text, groups, and NOT in sequential flow */}
      {postText && groups.length > 0 && selected.size > 0 && postingStep < 0 && (
        <button
          onClick={handlePostToGroups}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 py-3.5 text-sm font-black uppercase tracking-wider text-white transition-all hover:from-blue-400 hover:to-indigo-500"
        >
          {posted ? (
            <>
              <Check className="h-4 w-4" />
              Posted to All Groups!
            </>
          ) : (
            <>
              <Facebook className="h-4 w-4" />
              Post to {selected.size} Group{selected.size === 1 ? "" : "s"}
            </>
          )}
        </button>
      )}

      {/* Tip when posting — context-aware for desktop vs mobile */}
      {postText && groups.length > 0 && selected.size > 0 && postingStep < 0 && !posted && (
        <div className="flex items-start gap-2 rounded-lg border border-slate-700/50 bg-slate-900/50 px-3 py-2.5">
          <Copy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
          <p className="text-[11px] leading-relaxed text-stone-500">
            <span className="font-bold text-stone-400">How it works:</span>{" "}
            Your post text and link card are pre-filled in a Facebook share dialog for each group.
            Just post it, come back, and click &quot;Next Group.&quot;
          </p>
        </div>
      )}
    </div>
  );
}
