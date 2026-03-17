import { redirect } from "next/navigation";

// Individual plan pages — temporarily disabled. Redirect to the design configurator.
export default function PlanPage() {
  redirect("/design");
}
