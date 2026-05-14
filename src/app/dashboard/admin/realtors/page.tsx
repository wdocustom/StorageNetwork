// ═══════════════════════════════════════════════════════════════════════════
// Admin → Realtors (list view)
//
// Sortable-on-load table of every realtor on the platform, with search and
// pagination. Mirrors the visual conventions of the partner-portal admin
// surface (slate-950 / yellow-400) but with realtor-flavored columns:
// brokerage, gifts sent, revenue, in-flight count, suspended state.
//
// Each row links to /dashboard/admin/realtors/[id] for the detail view
// where the lock toggle + destructive delete live.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldOff, Building2, Search } from "lucide-react";

import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { listRealtorsAdmin } from "@/app/actions/admin-realtor-management";
import { RealtorSearchInput } from "./RealtorSearchInput";

const PAGE_SIZE = 25;

export default async function RealtorAdminListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // Admin gate — same pattern as the partner portal page.
  const supabase = getServiceClient();
  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) redirect("/dashboard");

  const params = await searchParams;
  const search = (params.q ?? "").trim();
  const page = Math.max(1, parseInt(params.page ?? "1") || 1);

  const result = await listRealtorsAdmin(user.id, { search, page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
        <Link
          href="/dashboard/partner"
          className="mb-8 inline-flex items-center gap-2 text-sm text-stone-400 hover:text-yellow-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Partner portal
        </Link>

        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
              Admin · Realtors
            </p>
            <h1 className="text-3xl font-black sm:text-4xl">Realtor accounts</h1>
            <p className="mt-2 max-w-2xl text-sm text-stone-400">
              Every account flagged <code className="rounded bg-slate-900 px-1.5 py-0.5 text-[11px] text-yellow-400">is_realtor=true</code>.
              Click a row to view their gifts, suspend the account, or delete it.
            </p>
          </div>
          <div className="text-right text-xs text-stone-500">
            <p className="font-bold uppercase tracking-wider">{result.total}</p>
            <p>Total realtors</p>
          </div>
        </div>

        <div className="mb-6">
          <RealtorSearchInput initialValue={search} />
        </div>

        {!result.ok ? (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-300">
            {result.error || "Could not load realtors."}
          </div>
        ) : result.rows.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-800 bg-slate-900/60 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  <tr>
                    <th className="px-4 py-3">Realtor</th>
                    <th className="px-4 py-3">Brokerage</th>
                    <th className="px-4 py-3 text-right">Gifts</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">In flight</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {result.rows.map((r) => {
                    const displayName =
                      [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email;
                    return (
                      <tr key={r.id} className="hover:bg-slate-900/50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/admin/realtors/${r.id}`}
                            className="block"
                          >
                            <p className="font-semibold text-white hover:text-yellow-400">
                              {displayName}
                            </p>
                            <p className="text-[11px] text-stone-500">{r.email}</p>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-stone-300">
                          {r.realtor_brokerage || <span className="text-stone-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-stone-300">
                          {r.gifts_total}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-stone-300">
                          ${(r.gifts_revenue_cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {r.gifts_in_flight > 0 ? (
                            <span className="rounded-md bg-yellow-400/10 px-2 py-0.5 text-yellow-300">
                              {r.gifts_in_flight}
                            </span>
                          ) : (
                            <span className="text-stone-600">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-stone-400">
                          {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3">
                          {r.is_suspended ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-300">
                              <ShieldOff className="h-3 w-3" />
                              Suspended
                            </span>
                          ) : r.is_pro ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-yellow-400/30 bg-yellow-400/10 px-2 py-1 text-[10px] font-bold text-yellow-300">
                              <Building2 className="h-3 w-3" />
                              Dual-role
                            </span>
                          ) : (
                            <span className="text-[11px] text-stone-500">Active</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-5 flex items-center justify-between text-xs text-stone-400">
                <div>
                  Page {result.page} of {totalPages} · {result.total} realtors
                </div>
                <div className="flex gap-2">
                  <PaginationLink page={page - 1} disabled={page <= 1} search={search} label="← Prev" />
                  <PaginationLink page={page + 1} disabled={page >= totalPages} search={search} label="Next →" />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-6 py-16 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400/10 ring-1 ring-yellow-400/40">
        <Search className="h-7 w-7 text-yellow-400" />
      </div>
      <h2 className="mb-2 text-xl font-bold">
        {search ? "No matches" : "No realtors yet"}
      </h2>
      <p className="mx-auto max-w-md text-sm text-stone-400">
        {search
          ? `No realtor matched "${search}". Try fewer characters or clear the filter.`
          : "Once a realtor signs up at /realtors/join, they'll appear here."}
      </p>
    </div>
  );
}

function PaginationLink({
  page,
  disabled,
  search,
  label,
}: {
  page: number;
  disabled: boolean;
  search: string;
  label: string;
}) {
  const href = `/dashboard/admin/realtors?page=${page}${search ? `&q=${encodeURIComponent(search)}` : ""}`;
  if (disabled) {
    return (
      <span className="rounded-md border border-slate-800 px-3 py-1.5 text-[11px] font-semibold text-stone-600">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-stone-200 hover:border-yellow-400 hover:text-yellow-300"
    >
      {label}
    </Link>
  );
}
