import { permanentRedirect } from "next/navigation";

// The Holiday Full Refund Giveaway ended and its Official Rules page was
// removed. Old links (emails, the old footer) land on the plans page.
export default function RefundRulesGone() {
  permanentRedirect("/plans");
}
