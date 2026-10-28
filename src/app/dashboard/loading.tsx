import { Loader2 } from "lucide-react";

// Shown the instant a dashboard link is tapped, while the next page loads.
export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
    </div>
  );
}
