/**
 * One-time seed: Create Alex (The Shelf Dude) as a Founder account.
 *
 * Uses supabase.auth.admin.createUser with email_confirm: true
 * so NO confirmation email is sent from Supabase.
 *
 * Run:
 *   npx tsx scripts/seed-founder-alex.ts
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  const EMAIL = "theshelfdude@gmail.com";
  const PASSWORD = "theshelfdudealex";

  // 1. Create auth user — email_confirm: true skips the confirmation email
  console.log("Creating auth user (silent — no email sent)...");
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true, // <-- confirms email immediately, NO email sent
    });

  if (authError) {
    if (authError.message?.includes("already been registered")) {
      console.log("Auth user already exists — fetching ID...");
      const { data: users } = await supabase.auth.admin.listUsers();
      const existing = users?.users?.find(
        (u) => u.email === EMAIL
      );
      if (!existing) {
        console.error("Could not find existing user");
        process.exit(1);
      }
      await upsertProfile(existing.id);
      return;
    }
    console.error("Auth error:", authError.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log("Auth user created:", userId);

  await upsertProfile(userId);
}

async function upsertProfile(userId: string) {
  // 2. Create/update profile — Founder tier with 0% platform fee
  console.log("Upserting profile with Founder fee override...");

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    first_name: "Alex",
    last_name: "",
    business_name: "The Shelf Dude",
    subscription_tier: "pro",
    is_pro: true,
    platform_fee_override: 0, // $0 platform fee — Founder perk
    // Leave avatar_url, slug, service_zip, etc. for manual setup later
  });

  if (profileError) {
    console.error("Profile error:", profileError.message);
    process.exit(1);
  }

  console.log("Done! Alex's Founder account is ready.");
  console.log("  Email:    theshelfdude@gmail.com");
  console.log("  Tier:     Pro (Founder)");
  console.log("  Fee:      0% platform fee");
  console.log("");
  console.log("Next steps:");
  console.log("  - Set avatar_url, slug, and service_zip from the dashboard or DB");
  console.log("  - Share his /p/{slug} partner link once slug is set");
}

main().catch(console.error);
