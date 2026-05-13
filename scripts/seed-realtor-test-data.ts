/**
 * Operational seed for the Realtor Portal.
 *
 * Populates a realtor account (default: camachoskyler@gmail.com) and a
 * paired test installer with fixture gifts spanning every lifecycle state
 * (paid → returned). Designed so the operator can walk every panel of the
 * portal — realtor list, recipient flow, installer dispatch surface — in
 * one sitting WITHOUT running a real Stripe transaction.
 *
 * Run:
 *   npx tsx scripts/seed-realtor-test-data.ts
 *   npx tsx scripts/seed-realtor-test-data.ts other-realtor@example.com
 *
 * Requires env vars (from .env or .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Re-runnable: every `test*` fixture is wiped + re-inserted on each run,
 * so editing this file and re-running gives a fresh, deterministic state.
 *
 * The auth users are created once (subsequent runs detect existing) and
 * never have their passwords reset. If you forget the realtor or installer
 * passwords below, change them here and delete the auth.users rows in
 * Supabase first — the script will recreate cleanly.
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// ── Tunables ──────────────────────────────────────────────────────────────

const DEFAULT_REALTOR_EMAIL = "camachoskyler@gmail.com";

const REALTOR_PASSWORD = "realtor-test-pass-2026";
const REALTOR_FIRST = "Skyler";
const REALTOR_LAST = "Camacho";
const REALTOR_BROKERAGE = "Camacho Real Estate";
const REALTOR_LICENSE = "TEST-LIC-12345";

const INSTALLER_PASSWORD = "installer-test-pass-2026";
const INSTALLER_FIRST = "Test";
const INSTALLER_LAST = "Installer";
const INSTALLER_BUSINESS = "Test Installer Co";
const INSTALLER_SLUG = "test-installer";
const INSTALLER_SERVICE_ZIP = "90210";
const INSTALLER_SERVICE_ZIPS = ["90210", "90211", "90212"];

// Seeded gift package (matches the 'standard' row seeded by migration 108).
const SEED_PACKAGE_ID = "standard";
const SEED_DURATION_DAYS = 14;
const SEED_TOTE_COUNT = 30;
const SEED_AMOUNT_CENTS = 23900; // $239.00

const RECIPIENT_NAME = "Jordan Buyer";
const PROPERTY_ADDRESS = "421 Maple Lane, Beverly Hills, CA";
const PROPERTY_ZIP = "90210";
const DELIVERY_ADDRESS = "421 Maple Lane, Beverly Hills, CA 90210";
const PERSONAL_MESSAGE =
  "Congrats on the new place — couldn't be happier for you!";

// Predictable 32-char hex tokens so the operator can bookmark each state.
const TOKENS = {
  paid: "test00000000000000000000000000a1",
  redeemed: "test00000000000000000000000000a2",
  scheduled: "test00000000000000000000000000a3",
  assigned: "test00000000000000000000000000a4",
  delivered: "test00000000000000000000000000a5",
  returned: "test00000000000000000000000000a6",
};

// ── Boot ──────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceKey);

const realtorEmail = (process.argv[2] || DEFAULT_REALTOR_EMAIL).trim().toLowerCase();
const installerEmail = realtorEmail.includes("+")
  ? realtorEmail
  : realtorEmail.replace("@", "+installer@");
const recipientEmail = realtorEmail.includes("+")
  ? realtorEmail
  : realtorEmail.replace("@", "+recipient@");

// ── Helpers ───────────────────────────────────────────────────────────────

async function findOrCreateAuthUser(
  email: string,
  password: string,
  label: string
): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!error) {
    console.log(`  ✓ Created ${label} auth user: ${data.user.id}`);
    return data.user.id;
  }

  if (!error.message?.includes("already been registered")) {
    throw error;
  }

  // Already exists — look it up. Supabase admin doesn't expose a get-by-
  // email, so paginate listUsers until we find a match. Test orgs rarely
  // have more than a few hundred users; one page (default 50) is fine.
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);
  if (!existing) {
    throw new Error(
      `${label} ${email} reports "already registered" but isn't in the first 1000 users. Bump the perPage cap or look it up manually.`
    );
  }
  console.log(`  ✓ Found existing ${label} auth user: ${existing.id}`);
  return existing.id;
}

function isoFromNow(days: number, hours = 0): string {
  return new Date(Date.now() + (days * 24 + hours) * 60 * 60 * 1000).toISOString();
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n→ Seeding realtor portal test data`);
  console.log(`  realtor:   ${realtorEmail}`);
  console.log(`  installer: ${installerEmail}`);
  console.log(`  recipient: ${recipientEmail}\n`);

  // 1. Realtor auth user + profile.
  console.log("[1/5] Realtor account");
  const realtorId = await findOrCreateAuthUser(
    realtorEmail,
    REALTOR_PASSWORD,
    "realtor"
  );
  {
    const { error } = await supabase.from("profiles").upsert({
      id: realtorId,
      first_name: REALTOR_FIRST,
      last_name: REALTOR_LAST,
      business_name: REALTOR_BROKERAGE,
      is_realtor: true,
      realtor_brokerage: REALTOR_BROKERAGE,
      realtor_license: REALTOR_LICENSE,
    });
    if (error) throw error;
    console.log(`  ✓ Profile flagged is_realtor=true (${REALTOR_BROKERAGE})`);
  }

  // 2. Test installer auth user + profile, opted into fulfillment.
  console.log("\n[2/5] Test installer account");
  const installerId = await findOrCreateAuthUser(
    installerEmail,
    INSTALLER_PASSWORD,
    "installer"
  );
  {
    const { error } = await supabase.from("profiles").upsert({
      id: installerId,
      first_name: INSTALLER_FIRST,
      last_name: INSTALLER_LAST,
      business_name: INSTALLER_BUSINESS,
      slug: INSTALLER_SLUG,
      service_zip: INSTALLER_SERVICE_ZIP,
      service_zips: INSTALLER_SERVICE_ZIPS,
      service_radius_miles: 25,
      subscription_tier: "pro",
      is_pro: true,
      completed_jobs: 12,
      tote_fulfillment_active: true,
      tote_fulfillment_stock: 100,
      tote_fulfillment_capacity: 10,
    });
    if (error) throw error;
    console.log(`  ✓ Profile opted into fulfillment (stock=100, capacity=10)`);
    console.log(`  ✓ Service area: ${INSTALLER_SERVICE_ZIPS.join(", ")}`);
  }

  // 3. Wipe prior test fixtures so the script is re-runnable.
  console.log("\n[3/5] Clearing prior test fixtures");
  {
    const tokens = Object.values(TOKENS);
    const { error } = await supabase
      .from("tote_rental_gifts")
      .delete()
      .in("gift_token", tokens);
    if (error) throw error;
    console.log(`  ✓ Removed any prior rows with token in TOKENS map`);
  }

  // 4. Insert one fixture gift per lifecycle state.
  console.log("\n[4/5] Seeding fixture gifts");

  const sharedBase = {
    realtor_id: realtorId,
    package_id: SEED_PACKAGE_ID,
    duration_days: SEED_DURATION_DAYS,
    tote_count: SEED_TOTE_COUNT,
    amount_cents: SEED_AMOUNT_CENTS,
    recipient_name: RECIPIENT_NAME,
    recipient_email: recipientEmail,
    property_address: PROPERTY_ADDRESS,
    property_zip: PROPERTY_ZIP,
    personal_message: PERSONAL_MESSAGE,
    paid_at: new Date().toISOString(),
  };

  // Scheduling-related fields used by the bottom four states.
  const scheduling = {
    delivery_address: DELIVERY_ADDRESS,
    delivery_zip: PROPERTY_ZIP,
    delivery_window_start: isoFromNow(2, 9), // 2 days out, 9 AM
    delivery_window_end: isoFromNow(2, 13), // 1 PM same day
    pickup_window_start: isoFromNow(16, 9), // 14 days after delivery
    pickup_window_end: isoFromNow(16, 13),
    scheduled_at: new Date().toISOString(),
  };

  const fixtures = [
    {
      ...sharedBase,
      gift_token: TOKENS.paid,
      status: "paid",
    },
    {
      ...sharedBase,
      gift_token: TOKENS.redeemed,
      status: "redeemed",
      redeemed_at: new Date().toISOString(),
    },
    {
      ...sharedBase,
      ...scheduling,
      gift_token: TOKENS.scheduled,
      status: "scheduled",
      redeemed_at: new Date().toISOString(),
    },
    {
      ...sharedBase,
      ...scheduling,
      gift_token: TOKENS.assigned,
      status: "assigned",
      redeemed_at: new Date().toISOString(),
      installer_id: installerId,
      installer_assigned_at: new Date().toISOString(),
    },
    {
      ...sharedBase,
      ...scheduling,
      gift_token: TOKENS.delivered,
      status: "delivered",
      redeemed_at: new Date().toISOString(),
      installer_id: installerId,
      installer_assigned_at: new Date().toISOString(),
      delivered_at: new Date().toISOString(),
    },
    {
      ...sharedBase,
      ...scheduling,
      gift_token: TOKENS.returned,
      status: "returned",
      redeemed_at: new Date().toISOString(),
      installer_id: installerId,
      installer_assigned_at: new Date().toISOString(),
      delivered_at: new Date().toISOString(),
      returned_at: new Date().toISOString(),
    },
  ];

  const { error: insertErr } = await supabase
    .from("tote_rental_gifts")
    .insert(fixtures);
  if (insertErr) throw insertErr;
  console.log(`  ✓ Inserted ${fixtures.length} fixture gifts`);

  // 5. Print the URL map.
  console.log("\n[5/5] Ready — URLs for testing");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://storage-network.app";

  console.log(`\n  REALTOR LOGIN`);
  console.log(`    URL:      ${appUrl}/login`);
  console.log(`    email:    ${realtorEmail}`);
  console.log(`    password: ${REALTOR_PASSWORD}`);
  console.log(`    dashboard: ${appUrl}/realtors/dashboard`);
  console.log(`    gifts:    ${appUrl}/realtors/dashboard/gifts`);

  console.log(`\n  TEST INSTALLER LOGIN`);
  console.log(`    URL:      ${appUrl}/login`);
  console.log(`    email:    ${installerEmail}`);
  console.log(`    password: ${INSTALLER_PASSWORD}`);
  console.log(`    fulfillment: ${appUrl}/dashboard/tote-rentals`);

  console.log(`\n  RECIPIENT GIFT LINKS (open in incognito to test the redemption flow)`);
  console.log(`    Paid (awaiting OTP):   ${appUrl}/gift/${TOKENS.paid}`);
  console.log(`    Redeemed (schedule):   ${appUrl}/gift/${TOKENS.redeemed}`);
  console.log(`    Scheduled (sourcing):  ${appUrl}/gift/${TOKENS.scheduled}`);
  console.log(`    Assigned (en route):   ${appUrl}/gift/${TOKENS.assigned}`);
  console.log(`    Delivered (cross-sell):${appUrl}/gift/${TOKENS.delivered}`);
  console.log(`    Returned (hard sell):  ${appUrl}/gift/${TOKENS.returned}`);

  console.log(`\n  All recipient emails route to ${recipientEmail}`);
  console.log(`  (Gmail "+aliases" share an inbox with the base address.)`);

  console.log(`\n  STRIPE LIVE-PURCHASE TEST CARD (for /realtors/dashboard/gifts/new)`);
  console.log(`    Number:    4242 4242 4242 4242`);
  console.log(`    Expiry:    Any future date (e.g. 12/30)`);
  console.log(`    CVC:       Any 3 digits`);
  console.log(`    ZIP:       Any 5 digits`);

  console.log(`\n✓ Done.\n`);
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err);
  process.exit(1);
});
