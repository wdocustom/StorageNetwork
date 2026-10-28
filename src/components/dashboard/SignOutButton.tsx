"use client";

import { LogOut } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function SignOutButton({ className }: { className?: string }) {
  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    window.location.href = "/login";
  }
  return (
    <button type="button" onClick={signOut} className={className}>
      <LogOut className="h-5 w-5 text-stone-500" />
      <span className="flex-1 text-left text-sm font-semibold text-white">Sign out</span>
    </button>
  );
}
