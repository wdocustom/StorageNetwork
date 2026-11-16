import { permanentRedirect } from "next/navigation";

// Gifting lives on /plans ("Give it as a gift"). This keeps /plans/gift
// links working by opening that section.
export default function GiftPlansRedirect() {
  permanentRedirect("/plans#gift");
}
