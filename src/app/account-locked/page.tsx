import { Lock, Mail } from "lucide-react";

export const metadata = {
  title: "Account Locked | WDO Custom",
};

export default function AccountLockedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
          <Lock className="h-8 w-8 text-red-400" />
        </div>

        <h1 className="mb-2 text-2xl font-bold text-white">
          Account Locked
        </h1>

        <p className="mb-6 text-sm text-stone-400 leading-relaxed">
          Your account has been temporarily locked by an administrator.
          If you believe this is a mistake, please contact support.
        </p>

        <a
          href="mailto:support@wdocustom.com"
          className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-6 py-3 text-sm font-bold uppercase tracking-wider text-slate-900 transition-colors hover:bg-yellow-300"
        >
          <Mail className="h-4 w-4" />
          Contact Support
        </a>

        <div className="mt-8 border-t border-slate-800 pt-6">
          <a
            href="/"
            className="text-xs text-stone-500 transition-colors hover:text-stone-300"
          >
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
