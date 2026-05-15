// ═══════════════════════════════════════════════════════════════════════════
// /contracts/sign/[token] — public signing page
//
// Token-gated; no auth required. The contractor receives the URL via the
// invite email (sent by /api/cron/send-contractor-agreements) and lands
// here to read + sign. Server component fetches the agreement, renders
// the body, and hands off to a small client form for the typed-name
// signature.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getContractorAgreementByToken } from "@/app/actions/contractor-agreements";
import { SimpleMarkdown } from "./SimpleMarkdown";
import { SignForm } from "./SignForm";

export default async function ContractSignPage({
  params,
}: {
  params: { token: string };
}) {
  const { success, agreement, error } = await getContractorAgreementByToken(
    params.token
  );

  if (!success || !agreement) {
    if (error === "Signing link not found." || error === "Signing link not found or expired.") {
      notFound();
    }
    return (
      <Shell>
        <ErrorCard message={error ?? "Could not load this agreement."} />
      </Shell>
    );
  }

  const alreadySigned = agreement.status === "signed" && !!agreement.contractorSignedAt;
  const revoked = agreement.status === "revoked";

  const effectiveDate = formatDate(agreement.effectiveDate);
  const companySignedOn = formatDate(agreement.companySignedAt);
  const contractorSignedOn = agreement.contractorSignedAt
    ? formatTimestamp(agreement.contractorSignedAt)
    : null;

  return (
    <Shell>
      <header className="mb-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
          Storage-Network · Agreement for Signature
        </p>
        <h1 className="text-2xl font-black sm:text-3xl">{agreement.title}</h1>
        <p className="mt-2 text-sm text-stone-400">
          Effective <span className="text-stone-200">{effectiveDate}</span>{" "}
          &middot; Between Storage-Network and{" "}
          <span className="text-stone-200">{agreement.contractorName}</span>
        </p>
      </header>

      <article className="mb-10 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8">
        <SimpleMarkdown source={agreement.bodyMd} />
      </article>

      {/* ── Signature blocks ─────────────────────────────────────────── */}
      <section className="mb-10 grid gap-6 sm:grid-cols-2">
        <SignatureCard
          role="Storage-Network"
          name={agreement.companySignerName}
          status={`Signed ${companySignedOn}`}
          tone="signed"
        />
        <SignatureCard
          role={agreement.contractorName}
          name={
            alreadySigned ? agreement.contractorTypedSignature ?? agreement.contractorName : null
          }
          status={
            alreadySigned
              ? `Signed ${contractorSignedOn}`
              : revoked
                ? "Agreement revoked"
                : "Awaiting signature"
          }
          tone={alreadySigned ? "signed" : revoked ? "revoked" : "pending"}
        />
      </section>

      {!alreadySigned && !revoked && (
        <SignForm
          token={params.token}
          expectedName={agreement.contractorName}
        />
      )}

      {alreadySigned && (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/5 p-4 text-sm text-emerald-200">
          This agreement was signed on{" "}
          <span className="font-bold">{contractorSignedOn}</span>. A copy of
          the signed terms was emailed for your records.
        </div>
      )}

      {revoked && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          This agreement has been revoked and is no longer signable. Contact
          Storage-Network if you believe this is in error.
        </div>
      )}
    </Shell>
  );
}

// ── UI primitives ─────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">{children}</div>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6">
      <p className="font-bold text-red-200">Could not load this agreement</p>
      <p className="mt-1 text-sm text-red-300">{message}</p>
    </div>
  );
}

function SignatureCard({
  role,
  name,
  status,
  tone,
}: {
  role: string;
  name: string | null;
  status: string;
  tone: "signed" | "pending" | "revoked";
}) {
  const tones = {
    signed: "border-emerald-400/40 bg-emerald-400/5",
    pending: "border-amber-400/40 bg-amber-400/5",
    revoked: "border-red-500/40 bg-red-500/10",
  } as const;
  const statusTones = {
    signed: "text-emerald-300",
    pending: "text-amber-200",
    revoked: "text-red-300",
  } as const;

  return (
    <div className={`rounded-xl border p-5 ${tones[tone]}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400">
        {role}
      </p>
      <p className="mt-2 min-h-[1.5rem] text-lg font-bold italic text-white">
        {name ?? "—"}
      </p>
      <p className={`mt-2 text-xs ${statusTones[tone]}`}>{status}</p>
    </div>
  );
}

function formatDate(value: string): string {
  try {
    // Handles both 'YYYY-MM-DD' and full ISO timestamps.
    const iso = value.includes("T") ? value : `${value}T00:00:00Z`;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return value;
  }
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
