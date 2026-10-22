"use client";

import { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Eye,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import type { PlatformUser } from "@/app/actions/partner";
import {
  generateOutreachDraft,
  sendOutreachEmails,
  type InstallerOutreachMeta,
  type OutreachSendResult,
} from "@/app/actions/admin-installer-outreach";
import {
  OUTREACH_MERGE_TAGS,
  applyMergeTags,
  outreachTextToHtml,
  unknownMergeTags,
} from "@/lib/installer-outreach";

// ═══════════════════════════════════════════════════════════════════════════
// Installer Outreach Modal — Partner Portal (admin)
//
// Lightbox email composer opened from an installer's row. Starts with that
// one installer; more can be added from the picker. Drafts are freehand or
// Gemini-generated, and use {{merge_tags}} so a single draft personalises
// for every recipient. Sends in chunks of 10 so progress is visible and no
// single server action runs long.
// ═══════════════════════════════════════════════════════════════════════════

const SEND_CHUNK = 10;
const INACTIVE_DAYS = 30;

type Filter = "all" | "trial_expired" | "free" | "inactive" | "never_emailed";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "trial_expired", label: "Trial expired" },
  { key: "free", label: "Free" },
  { key: "inactive", label: `Inactive ${INACTIVE_DAYS}d+` },
  { key: "never_emailed", label: "Never emailed" },
];

function displayName(u: PlatformUser): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || u.business_name || u.email || "No Name";
}

function isInactive(u: PlatformUser): boolean {
  if (!u.last_login_at) return true;
  return Date.now() - new Date(u.last_login_at).getTime() > INACTIVE_DAYS * 86_400_000;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function InstallerOutreachModal({
  users,
  meta,
  initialRecipientIds,
  onClose,
  onSent,
}: {
  users: PlatformUser[];
  meta: Record<string, InstallerOutreachMeta>;
  initialRecipientIds: string[];
  onClose: () => void;
  onSent: (results: OutreachSendResult[], grantedPro: boolean) => void;
}) {
  const [recipientIds, setRecipientIds] = useState<string[]>(initialRecipientIds);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [instructions, setInstructions] = useState("");
  const [includeDashboardButton, setIncludeDashboardButton] = useState(true);
  const [grantPro, setGrantPro] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<OutreachSendResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const lastFocused = useRef<"subject" | "body">("body");

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const recipients = recipientIds.map((id) => userById.get(id)).filter((u): u is PlatformUser => !!u);
  const selected = new Set(recipientIds);
  const isMulti = recipients.length > 1;

  const pickerUsers = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (!u.email) return false;
      if (filter === "trial_expired" && !u.trial_expired) return false;
      if (filter === "free" && u.is_pro) return false;
      if (filter === "inactive" && !isInactive(u)) return false;
      if (filter === "never_emailed" && meta[u.id]?.last_outreach_at) return false;
      if (!q) return true;
      return [u.first_name, u.last_name, u.business_name, u.email, u.city]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [users, meta, pickerSearch, filter]);

  const previewRecipient = (previewId && userById.get(previewId)) || recipients[0] || null;
  const badTags = unknownMergeTags(`${subject}\n${body}`);
  const dirty = !!(subject.trim() || body.trim());

  function requestClose() {
    if (sending) return;
    if (dirty && !results && !window.confirm("Discard this email draft?")) return;
    onClose();
  }

  function toggleRecipient(id: string) {
    setRecipientIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setResults(null);
  }

  function selectAllShown() {
    setRecipientIds((prev) => [...new Set([...prev, ...pickerUsers.map((u) => u.id)])]);
    setResults(null);
  }

  function insertTag(tag: string) {
    const token = `{{${tag}}}`;
    const target = lastFocused.current === "subject" ? subjectRef.current : bodyRef.current;
    const value = lastFocused.current === "subject" ? subject : body;
    const setValue = lastFocused.current === "subject" ? setSubject : setBody;
    const start = target?.selectionStart ?? value.length;
    const end = target?.selectionEnd ?? value.length;
    setValue(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      target?.focus();
      target?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    const res = await generateOutreachDraft({
      instructions,
      recipientIds,
      currentSubject: subject,
      currentBody: body,
    });
    if (res.success) {
      if (res.subject) setSubject(res.subject);
      setBody(res.body);
      setMode("edit");
    } else {
      setError(res.error);
    }
    setGenerating(false);
  }

  async function handleSend() {
    if (recipients.length === 0) return setError("Add at least one recipient.");
    if (!subject.trim() || !body.trim()) return setError("Add a subject and body first.");
    if (badTags.length) return setError(`Unknown merge tag(s): ${badTags.map((t) => `{{${t}}}`).join(", ")}`);
    const confirmMsg = `Send this email to ${recipients.length} installer${recipients.length === 1 ? "" : "s"}${
      grantPro ? " and give them free Pro" : ""
    }?`;
    if (!window.confirm(confirmMsg)) return;

    setSending(true);
    setError(null);
    setResults(null);
    const ids = recipients.map((u) => u.id);
    const all: OutreachSendResult[] = [];
    setProgress({ done: 0, total: ids.length });

    for (let i = 0; i < ids.length; i += SEND_CHUNK) {
      const chunk = ids.slice(i, i + SEND_CHUNK);
      const res = await sendOutreachEmails({
        recipientIds: chunk,
        subject,
        body,
        includeDashboardButton,
        grantComplimentaryPro: grantPro,
      });
      if (res.success) {
        all.push(...res.results);
      } else {
        all.push(...chunk.map((installerId) => ({ installerId, ok: false, error: res.error })));
      }
      setProgress({ done: Math.min(i + SEND_CHUNK, ids.length), total: ids.length });
    }

    setResults(all);
    setSending(false);
    setProgress(null);
    onSent(all, grantPro);
  }

  const sentCount = results?.filter((r) => r.ok).length ?? 0;
  const failures = results?.filter((r) => !r.ok || r.error) ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center sm:p-4"
      onClick={requestClose}
    >
      <div
        className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-yellow-400/30 bg-slate-900 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-yellow-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Email {isMulti ? `${recipients.length} installers` : "installer"}
            </h3>
          </div>
          <button
            onClick={requestClose}
            disabled={sending}
            className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Recipients */}
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-500">To</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {recipients.map((u) => (
              <span
                key={u.id}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-700 bg-slate-800 py-1 pl-3 pr-1 text-xs text-stone-200"
                title={u.email ?? ""}
              >
                <span className="truncate">{displayName(u)}</span>
                <button
                  onClick={() => toggleRecipient(u.id)}
                  disabled={sending}
                  className="rounded-full p-0.5 text-stone-500 hover:bg-slate-700 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              onClick={() => setPickerOpen((v) => !v)}
              disabled={sending}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-yellow-400/40 px-3 py-1 text-xs font-semibold text-yellow-300 hover:bg-yellow-400/10"
            >
              <Plus className="h-3 w-3" />
              {pickerOpen ? "Done adding" : "Add installers"}
            </button>
          </div>

          {/* Recipient picker */}
          {pickerOpen && (
            <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-500" />
                <input
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search installers..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-9 pr-3 text-xs text-white placeholder-stone-500 focus:border-yellow-400/50 focus:outline-none"
                />
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      filter === f.key
                        ? "bg-yellow-400 text-gray-950"
                        : "bg-slate-800 text-stone-400 hover:text-white"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
                <button
                  onClick={selectAllShown}
                  className="ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold text-yellow-300 hover:bg-yellow-400/10"
                >
                  Select all {pickerUsers.length}
                </button>
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {pickerUsers.map((u) => {
                  const m = meta[u.id];
                  return (
                    <label
                      key={u.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-800"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(u.id)}
                        onChange={() => toggleRecipient(u.id)}
                        className="h-3.5 w-3.5 accent-yellow-400"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-white">{displayName(u)}</p>
                        <p className="truncate text-[10px] text-stone-500">{u.business_name || u.email}</p>
                      </div>
                      <div className="flex flex-shrink-0 flex-wrap justify-end gap-1">
                        {u.trial_expired && (
                          <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">EXPIRED</span>
                        )}
                        {m?.pro_comped ? (
                          <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">FREE PRO</span>
                        ) : !u.is_pro && (
                          <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[9px] font-bold text-stone-400">FREE</span>
                        )}
                        {m?.last_outreach_at && (
                          <span className="rounded bg-blue-400/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-300">
                            EMAILED {shortDate(m.last_outreach_at).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
                {pickerUsers.length === 0 && (
                  <p className="py-4 text-center text-xs text-stone-500">No installers match.</p>
                )}
              </div>
            </div>
          )}

          {/* Gemini generator */}
          <div className="mt-4 rounded-xl border border-violet-400/25 bg-violet-500/5 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-violet-300" />
              <p className="text-xs font-semibold text-violet-200">Generate with Gemini</p>
            </div>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              placeholder={
                body.trim()
                  ? "How should Gemini change the draft? e.g. shorter, mention the 3D designer"
                  : "What should it say? e.g. offer 3 months of Pro free, ask what stopped them from getting started"
              }
              className="w-full resize-y rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-stone-600 focus:border-violet-400/60 focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[10px] text-stone-500">
                Uses merge tags so it works for {isMulti ? "every recipient" : "one or many recipients"}.
              </p>
              <button
                onClick={handleGenerate}
                disabled={generating || sending}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-violet-400 disabled:opacity-40"
              >
                {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {body.trim() ? "Rewrite" : "Generate"}
              </button>
            </div>
          </div>

          {/* Edit / Preview toggle */}
          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="flex flex-shrink-0 rounded-lg bg-slate-800 p-0.5">
              {(["edit", "preview"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex items-center gap-1 rounded-md px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                    mode === m ? "bg-slate-950 text-white" : "text-stone-500"
                  }`}
                >
                  {m === "edit" ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {m}
                </button>
              ))}
            </div>
            {mode === "preview" && recipients.length > 1 && (
              <select
                value={previewRecipient?.id ?? ""}
                onChange={(e) => setPreviewId(e.target.value)}
                className="min-w-0 max-w-[60%] flex-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white"
              >
                {recipients.map((u) => (
                  <option key={u.id} value={u.id}>
                    As {displayName(u)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {mode === "edit" ? (
            <div className="mt-2">
              <input
                ref={subjectRef}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                onFocus={() => (lastFocused.current = "subject")}
                placeholder="Subject"
                className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:border-yellow-400/50 focus:outline-none"
              />
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onFocus={() => (lastFocused.current = "body")}
                rows={10}
                placeholder={"Hi {{first_name}},\n\nType freely, or generate a draft with Gemini above."}
                className="w-full resize-y rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm leading-relaxed text-white placeholder:text-stone-600 focus:border-yellow-400/50 focus:outline-none"
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Insert</span>
                {OUTREACH_MERGE_TAGS.map((t) => (
                  <button
                    key={t.tag}
                    onMouseDown={(e) => e.preventDefault()} // keep the caret in the field
                    onClick={() => insertTag(t.tag)}
                    className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-yellow-300 hover:border-yellow-400/50"
                  >
                    {`{{${t.tag}}}`}
                  </button>
                ))}
              </div>
              {badTags.length > 0 && (
                <p className="mt-1.5 text-[10px] font-semibold text-red-400">
                  Unknown tag: {badTags.map((t) => `{{${t}}}`).join(", ")}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-2 rounded-lg border border-slate-700 bg-black px-4 py-4">
              {previewRecipient ? (
                <>
                  <p className="mb-1 text-[10px] text-stone-500">To: {previewRecipient.email}</p>
                  <p className="mb-4 text-sm font-bold text-yellow-400">
                    {applyMergeTags(subject, previewRecipient) || "(no subject)"}
                  </p>
                  <div
                    dangerouslySetInnerHTML={{ __html: outreachTextToHtml(applyMergeTags(body, previewRecipient)) }}
                  />
                  {includeDashboardButton && (
                    <div className="my-4 text-center">
                      <span className="inline-block rounded-lg bg-yellow-400 px-6 py-2.5 text-sm font-bold text-black">
                        Open my dashboard
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-center text-xs text-stone-500">Add a recipient to preview.</p>
              )}
            </div>
          )}

          {/* Options */}
          <div className="mt-4 space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-stone-300">
              <input
                type="checkbox"
                checked={includeDashboardButton}
                onChange={(e) => setIncludeDashboardButton(e.target.checked)}
                className="h-3.5 w-3.5 accent-yellow-400"
              />
              Include an &ldquo;Open my dashboard&rdquo; button
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-xs text-stone-300">
              <input
                type="checkbox"
                checked={grantPro}
                onChange={(e) => setGrantPro(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-emerald-400"
              />
              <span>
                Give {isMulti ? "each recipient" : "them"} free Pro when sent
                <span className="block text-[10px] text-stone-500">
                  No billing, no expiry — stays on until you switch it off on their row. Skips paying subscribers.
                </span>
              </span>
            </label>
          </div>

          {error && <p className="mt-3 text-xs font-semibold text-red-400">{error}</p>}

          {results && (
            <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Sent {sentCount} of {results.length}
              </p>
              {failures.map((f) => (
                <p key={f.installerId} className="mt-1 text-[10px] text-amber-300">
                  {userById.get(f.installerId) ? displayName(userById.get(f.installerId)!) : f.installerId}: {f.error}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-5 py-3">
          <p className="text-[10px] text-stone-500">Replies go to your admin email.</p>
          <button
            onClick={results ? onClose : handleSend}
            disabled={sending || generating || (!results && recipients.length === 0)}
            className="flex items-center gap-1.5 rounded-lg bg-yellow-400 px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300 disabled:opacity-40"
          >
            {sending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Sending {progress?.done ?? 0}/{progress?.total ?? recipients.length}
              </>
            ) : results ? (
              "Done"
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Send{recipients.length > 1 ? ` to ${recipients.length}` : ""}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
