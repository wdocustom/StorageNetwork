"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { siteConfig } from "@/config/site";
import {
  Briefcase,
  HardHat,
  BookOpen,
  LogOut,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Settings,
  Copy,
  Check,
  Link2,
  DollarSign,
  Package,
  Trophy,
  Megaphone,
  CalendarOff,
} from "lucide-react";
import MissionBriefing from "@/components/dashboard/MissionBriefing";
import { getInstallerLink } from "@/lib/utils";
// 1. IMPORT THE BUTTON HERE
import TestPaymentButton from "@/components/TestPaymentButton";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  business_name: string | null;
  is_pro: boolean;
  subscription_tier?: string;
  stripe_account_id?: string | null;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard — Mobile-First Tile Grid
// ═══════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const supabase = getSupabaseBrowserClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [newLeadCount, setNewLeadCount] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const [profileRes, leadsRes, paidLeadsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("installer_id", user.id)
        .in("status", ["new", "pending_payment", "open"]),
      supabase
        .from("leads")
        .select("estimated_price, balance_due, payout_status")
        .eq("installer_id", user.id)
        .in("payout_status", ["paid"]),
    ]);

    if (profileRes.data) setProfile(profileRes.data as Profile);
    if (leadsRes.count !== null) setNewLeadCount(leadsRes.count);

    // Aggregate sales from paid jobs
    if (paidLeadsRes.data) {
      const sales = paidLeadsRes.data.reduce(
        (sum: number, l: { balance_due: number | null }) => sum + (l.balance_due || 0),
        0
      );
      setTotalSales(Math.round(sales));
      setCompletedCount(paidLeadsRes.data.length);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSign
