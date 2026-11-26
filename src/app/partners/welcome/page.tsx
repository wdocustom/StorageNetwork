import Link from "next/link";
import { checkPartnerPasswordToken } from "@/app/actions/partner-portal";
import PartnerShell from "../PartnerShell";
import SetPasswordForm from "./SetPasswordForm";

export const dynamic = "force-dynamic";

// One-time "set your password" link from a partner invite or reset email.
export default async function PartnerWelcomePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const check = await checkPartnerPasswordToken(token).catch(() => ({ valid: false as const }));
  if (!check.valid || !("email" in check) || !check.email) {
    return (
      <PartnerShell title="This link has expired" subtitle="Set-password links work once and expire after a while.">
        <Link href="/partners/login" className="block w-full rounded-lg bg-yellow-400 py-3 text-center text-sm font-black uppercase tracking-wider text-slate-950">
          Get a new link
        </Link>
        <p className="mt-3 text-center text-xs text-stone-500">On the login page, enter your email and tap &ldquo;Forgot your password?&rdquo;</p>
      </PartnerShell>
    );
  }
  return (
    <PartnerShell title="Set your password" subtitle={`Your partner account for ${check.email} is ready.`}>
      <SetPasswordForm token={token} email={check.email} />
    </PartnerShell>
  );
}
