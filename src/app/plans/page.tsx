import { redirect } from "next/navigation";

// DIY Plans page — temporarily disabled. Redirect to the design configurator.
export default function PlansPage() {
  redirect("/design");
}
