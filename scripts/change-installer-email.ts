/**
 * One-off: change an installer's account email.
 *
 * Updates BOTH auth.users.email (via the Supabase Auth Admin API) and
 * profiles.email — these are not kept in sync by any trigger, so both
 * must be updated or the installer will see a stale email in the
 * dashboard while their login email has changed (or vice versa).
 *
 * Run:
 *   npx tsx scripts/change-installer-email.ts <current-email> <new-email>
 *
 * Example:
 *   npx tsx scripts/change-installer-email.ts old@example.com castledesignshop@gmail.com
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
  const [currentEmail, newEmail] = process.argv.slice(2);

  if (!currentEmail || !newEmail) {
    console.error("Usage: npx tsx scripts/change-installer-email.ts <current-email> <new-email>");
    process.exit(1);
  }

  console.log(`Looking up auth user for ${currentEmail}...`);
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Failed to list users:", listError.message);
    process.exit(1);
  }

  const user = users.users.find(
    (u) => u.email?.toLowerCase() === currentEmail.toLowerCase()
  );
  if (!user) {
    console.error(`No auth user found with email ${currentEmail}`);
    process.exit(1);
  }
  console.log("Found user:", user.id);

  const existingWithNewEmail = users.users.find(
    (u) => u.email?.toLowerCase() === newEmail.toLowerCase()
  );
  if (existingWithNewEmail) {
    console.error(`${newEmail} is already in use by another account (${existingWithNewEmail.id})`);
    process.exit(1);
  }

  console.log(`Updating auth.users.email -> ${newEmail} (no confirmation email sent)...`);
  const { error: authError } = await supabase.auth.admin.updateUserById(user.id, {
    email: newEmail,
    email_confirm: true, // skip Supabase's "confirm new email" flow
  });
  if (authError) {
    console.error("Auth update failed:", authError.message);
    process.exit(1);
  }

  console.log(`Updating profiles.email -> ${newEmail}...`);
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ email: newEmail })
    .eq("id", user.id);
  if (profileError) {
    console.error("Profile update failed:", profileError.message);
    console.error("auth.users.email was already updated — profiles.email is now out of sync, fix manually.");
    process.exit(1);
  }

  console.log("Done. Email changed:");
  console.log(`  ${currentEmail} -> ${newEmail}`);
  console.log(`  user id: ${user.id}`);
}

main().catch(console.error);
