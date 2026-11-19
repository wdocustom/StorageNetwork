import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════════════════════
// /plans/mini — short, shareable link to the Mini Tote Rack designer
// (HDX 6.5 qt): opens /plans/checkout on a 4×4 mini with a plywood top.
// Any query string is kept (e.g. /plans/mini?utm_source=instagram), and a
// ?design= on the link wins over the default.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

const MINI_DESIGNER_DEFAULT = "M4x4t";

export default async function MiniPlansLink({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, v);
  }
  if (!query.has("design")) query.set("design", MINI_DESIGNER_DEFAULT);
  if (!query.has("utm_source")) query.set("utm_source", "mini_link");
  redirect(`/plans/checkout?${query.toString()}`);
}
