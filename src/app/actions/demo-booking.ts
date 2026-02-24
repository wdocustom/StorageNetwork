"use server";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ═══════════════════════════════════════════════════════════════════════════
// Demo Booking — Stores booking + creates Google Calendar event
// ═══════════════════════════════════════════════════════════════════════════

interface BookDemoInput {
  name: string;
  email: string;
  phone?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (24h)
  timezone: string;
}

interface BookDemoResult {
  success: boolean;
  error?: string;
  calendarLink?: string;
}

// Available time slots (Central Time business hours)
export const DEMO_TIME_SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
];

// Working days (Mon-Fri)
const WORKING_DAYS = [1, 2, 3, 4, 5];

export async function getAvailableSlots(
  date: string
): Promise<{ slots: string[] }> {
  const dayOfWeek = new Date(date + "T12:00:00").getDay();
  if (!WORKING_DAYS.includes(dayOfWeek)) {
    return { slots: [] };
  }

  // Check which slots are already booked
  const { data: booked, error } = await supabase
    .from("demo_bookings")
    .select("time")
    .eq("date", date)
    .eq("status", "confirmed");

  // If table doesn't exist yet, just return all slots as available
  if (error) {
    console.error("[DemoBooking] getAvailableSlots error:", error);
    return { slots: DEMO_TIME_SLOTS };
  }

  const bookedTimes = new Set((booked || []).map((b) => b.time));
  const available = DEMO_TIME_SLOTS.filter((t) => !bookedTimes.has(t));

  return { slots: available };
}

export async function bookDemo(input: BookDemoInput): Promise<BookDemoResult> {
  const { name, email, phone, date, time, timezone } = input;

  if (!name?.trim() || !email?.trim() || !date || !time) {
    return { success: false, error: "All fields are required." };
  }

  // Check slot is still available
  const { slots } = await getAvailableSlots(date);
  if (!slots.includes(time)) {
    return { success: false, error: "This time slot is no longer available. Please choose another." };
  }

  // Store in database
  const { error: insertError } = await supabase
    .from("demo_bookings")
    .insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      date,
      time,
      timezone,
      status: "confirmed",
    });

  if (insertError) {
    console.error("[DemoBooking] Insert error:", insertError);
    return { success: false, error: "Failed to book demo. Please try again." };
  }

  // Build Google Calendar link for the prospect
  const startDateTime = `${date}T${time}:00`;
  const endDate = new Date(`${startDateTime}`);
  endDate.setMinutes(endDate.getMinutes() + 30);
  const endTime = endDate.toTimeString().slice(0, 5);
  const endDateTime = `${date}T${endTime}:00`;

  // Format for Google Calendar URL (YYYYMMDDTHHmmss)
  const gcalStart = startDateTime.replace(/[-:]/g, "");
  const gcalEnd = endDateTime.replace(/[-:]/g, "");

  const calendarLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    "Storage Network Platform Demo"
  )}&dates=${gcalStart}/${gcalEnd}&details=${encodeURIComponent(
    `Platform demo call with Storage Network.\n\nWe'll walk you through:\n- How pre-sold leads work\n- The 3D configurator customers use\n- Cut lists & material planning\n- Payment processing & payouts\n- Marketing tools included\n\nQuestions? Reply to this event or email us.`
  )}&location=${encodeURIComponent("Google Meet / Phone Call")}`;

  // Send confirmation email via Resend
  try {
    const { sendDemoConfirmationEmail } = await import("@/lib/email");
    await sendDemoConfirmationEmail({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      date,
      time,
      calendarLink,
    });
  } catch (err) {
    console.error("[DemoBooking] Email error:", err);
    // Don't fail the booking if email fails
  }

  return { success: true, calendarLink };
}
