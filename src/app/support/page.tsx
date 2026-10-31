import { redirect } from "next/navigation";

// storage-network.app/support — customers guess this URL when they need
// help. Plan buyers mostly need their access link again, so send them to
// the "Already purchased?" resend form (which also lists the contact email).
export default function SupportPage() {
  redirect("/plans#resend");
}
