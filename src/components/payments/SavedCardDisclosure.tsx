// ═══════════════════════════════════════════════════════════════════════════
// SavedCardDisclosure — saved-card / off-session balance notice
//
// Card networks require this notice to be VISIBLE AT THE MOMENT OF CARD
// CAPTURE for a later merchant-initiated balance charge to be valid. Both
// deposit surfaces pass `setup_future_usage: "off_session"`, so both save the
// customer's card, so both must show this.
//
// It lives here rather than inline because it didn't: the booking modal had
// it and the /pay link page didn't, so every customer who paid through a
// texted payment link had their card saved without ever seeing the notice —
// which is exactly the evidence you need when one of those balance charges is
// disputed as unauthorized. One component, both surfaces, no drift.
//
// Render it inside the payment form, adjacent to the PaymentElement — not in
// a footer or a collapsed section. "Visible at capture" is the requirement.
// ═══════════════════════════════════════════════════════════════════════════

export function SavedCardDisclosure({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-lg border border-white/10 bg-white/5 p-3 ${className}`}>
      <p className="text-[11px] leading-relaxed text-stone-300">
        <span className="font-semibold text-white">Heads up:</span> this card will be securely
        saved (via Stripe) so your installer can collect the remaining balance after install
        without you re-entering it. The balance is only charged when the installer affirmatively
        elects to collect it — never automatically. You can pay the balance in cash, check, or any
        other method instead, or revoke the saved card by emailing{" "}
        <a href="mailto:support@storage-network.app" className="underline hover:text-stone-200">
          support@storage-network.app
        </a>
        . Full terms in{" "}
        <a
          href="/legal/terms#payment-method-on-file"
          target="_blank"
          className="underline hover:text-stone-200"
        >
          § 3c
        </a>
        .
      </p>
    </div>
  );
}
