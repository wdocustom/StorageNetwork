// ═══════════════════════════════════════════════════════════════════════════
// Offline queue — native only. Photo uploads and mark-complete are queued
// with an Idempotency-Key and replayed when the network returns.
//
// Hard rule: nothing here ever reports a payout as sent. A queued completion
// is only "queued"; the server is the single source of truth for payment state.
// ═══════════════════════════════════════════════════════════════════════════

import { isNativeApp } from "@/lib/native/env";
import { uploadJobPhoto } from "@/app/actions/photo-upload";
import { completeJob, completeJobWithProof } from "@/app/actions/jobs";

export type QueuedAction =
  | { id: string; kind: "photo"; leadId: string; file: string; mime: string; createdAt: string }
  | {
      id: string;
      kind: "complete";
      leadId: string;
      photoUrl: string | null;
      customerEmail: string | null;
      customerName: string;
      amountDue: number;
      createdAt: string;
    };

const QUEUE_KEY = "offline_queue_v1";
const QUEUE_DIR = "offline-queue";

export function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function readQueue(): Promise<QueuedAction[]> {
  const { Preferences } = await import("@capacitor/preferences");
  const raw = (await Preferences.get({ key: QUEUE_KEY })).value;
  return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
}

async function writeQueue(q: QueuedAction[]) {
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(q) });
}

export async function pendingCount(leadId?: string): Promise<number> {
  if (!isNativeApp()) return 0;
  try {
    const q = await readQueue();
    return leadId ? q.filter((a) => a.leadId === leadId).length : q.length;
  } catch {
    return 0;
  }
}

export async function enqueuePhoto(leadId: string, photo: File): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const id = newIdempotencyKey();
    const data: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(String(r.result).split(",")[1] ?? "");
      r.onerror = () => reject(r.error);
      r.readAsDataURL(photo);
    });
    const file = `${QUEUE_DIR}/${id}.jpg`;
    await Filesystem.writeFile({ path: file, data, directory: Directory.Data, recursive: true });
    await writeQueue([
      ...(await readQueue()),
      { id, kind: "photo", leadId, file, mime: photo.type || "image/jpeg", createdAt: new Date().toISOString() },
    ]);
    return true;
  } catch (err) {
    console.warn("[native:queue] enqueuePhoto failed", err);
    return false;
  }
}

export async function enqueueComplete(
  a: Omit<Extract<QueuedAction, { kind: "complete" }>, "id" | "kind" | "createdAt">
): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    await writeQueue([
      ...(await readQueue()),
      { ...a, id: newIdempotencyKey(), kind: "complete", createdAt: new Date().toISOString() },
    ]);
    return true;
  } catch (err) {
    console.warn("[native:queue] enqueueComplete failed", err);
    return false;
  }
}

let flushing = false;

/** Replay queued actions in order. Stops at the first network failure. */
export async function flushQueue(): Promise<{ done: number; remaining: number }> {
  if (!isNativeApp() || flushing) return { done: 0, remaining: 0 };
  flushing = true;
  let done = 0;
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    let queue = await readQueue();
    // Photos first, so a queued completion can use the photo URL they produce.
    const photoUrlByLead: Record<string, string> = {};

    for (const action of [...queue]) {
      try {
        if (action.kind === "photo") {
          const f = await Filesystem.readFile({ path: action.file, directory: Directory.Data });
          const bytes = Uint8Array.from(atob(String(f.data)), (c) => c.charCodeAt(0));
          const fd = new FormData();
          fd.append("photo", new File([bytes], `${action.id}.jpg`, { type: action.mime }));
          fd.append("idempotencyKey", action.id);
          const res = await uploadJobPhoto(action.leadId, fd);
          if (!res.success) throw new Error(res.error || "upload failed");
          if (res.publicUrl) photoUrlByLead[action.leadId] = res.publicUrl;
          await Filesystem.deleteFile({ path: action.file, directory: Directory.Data }).catch(() => {});
        } else {
          const photoUrl = photoUrlByLead[action.leadId] ?? action.photoUrl;
          const res = photoUrl
            ? await completeJobWithProof(
                action.leadId, photoUrl, action.customerEmail, action.customerName, action.amountDue,
                undefined, action.id
              )
            : await completeJob(action.leadId, action.id);
          if (!res.success) throw new Error(("error" in res && res.error) || "complete failed");
        }
        queue = queue.filter((q) => q.id !== action.id);
        await writeQueue(queue);
        done++;
      } catch (err) {
        console.warn("[native:queue] replay stopped", err);
        break; // keep order; retry on next online event
      }
    }
    return { done, remaining: queue.length };
  } finally {
    flushing = false;
  }
}
