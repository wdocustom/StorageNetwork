/**
 * Lead Tracker — Import and manage leads from manual sources
 *
 * This script provides utilities for:
 * 1. Importing leads from CSV (manually gathered from Google Maps, Yelp, etc.)
 * 2. Tracking outreach status and conversion
 * 3. Generating referral links for existing installers
 * 4. Exporting campaign performance reports
 *
 * Usage:
 *   npx ts-node scripts/acquisition/lead-tracker.ts import leads.csv
 *   npx ts-node scripts/acquisition/lead-tracker.ts status
 *   npx ts-node scripts/acquisition/lead-tracker.ts export report.csv
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  business_name?: string;
  zip_code: string;
  source: "google_maps" | "yelp" | "craigslist" | "facebook" | "reddit" | "referral" | "manual";
  status: "new" | "contacted" | "responded" | "signed_up" | "first_job" | "lost";
  notes?: string;
  contacted_at?: string;
  created_at: string;
  utm_source?: string;
  utm_campaign?: string;
}

interface CampaignReport {
  total_leads: number;
  by_source: Record<string, number>;
  by_status: Record<string, number>;
  conversion_rate: number;
  cost_per_signup: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Data Store (local JSON file — zero dependencies)
// ═══════════════════════════════════════════════════════════════════════════

const DATA_FILE = join(__dirname, "data", "leads.json");
const DATA_DIR = join(__dirname, "data");

function ensureDataDir() {
  const fs = require("fs");
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadLeads(): Lead[] {
  ensureDataDir();
  if (!existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveLeads(leads: Lead[]) {
  ensureDataDir();
  writeFileSync(DATA_FILE, JSON.stringify(leads, null, 2));
}

// ═══════════════════════════════════════════════════════════════════════════
// CSV Import — Parse manually-gathered lead data
// ═══════════════════════════════════════════════════════════════════════════

function importFromCSV(csvPath: string): Lead[] {
  if (!existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  const raw = readFileSync(csvPath, "utf-8");
  const lines = raw.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

  const leads = loadLeads();
  const newLeads: Lead[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });

    // Skip if email already exists
    const email = row.email?.toLowerCase();
    if (!email || leads.some((l) => l.email === email)) continue;

    const lead: Lead = {
      id: `lead_${Date.now()}_${i}`,
      name: row.name || row.business_name || "Unknown",
      email,
      phone: row.phone || undefined,
      business_name: row.business_name || row.business || undefined,
      zip_code: row.zip_code || row.zip || row.zipcode || "",
      source: (row.source as Lead["source"]) || "manual",
      status: "new",
      notes: row.notes || undefined,
      created_at: new Date().toISOString(),
    };

    newLeads.push(lead);
  }

  const all = [...leads, ...newLeads];
  saveLeads(all);

  console.log(`\nImported ${newLeads.length} new leads (${all.length} total)`);
  console.log(`Skipped ${lines.length - 1 - newLeads.length} duplicates\n`);

  return newLeads;
}

// ═══════════════════════════════════════════════════════════════════════════
// Status Report — Campaign performance overview
// ═══════════════════════════════════════════════════════════════════════════

function printStatus() {
  const leads = loadLeads();
  const report = generateReport(leads);

  console.log("\n══════════════════════════════════════════");
  console.log("  STORAGE NETWORK — ACQUISITION REPORT");
  console.log("══════════════════════════════════════════\n");

  console.log(`Total Leads: ${report.total_leads}`);
  console.log(`Conversion Rate: ${(report.conversion_rate * 100).toFixed(1)}%`);
  console.log();

  console.log("By Source:");
  for (const [source, count] of Object.entries(report.by_source)) {
    console.log(`  ${source.padEnd(15)} ${count}`);
  }
  console.log();

  console.log("By Status:");
  for (const [status, count] of Object.entries(report.by_status)) {
    const bar = "█".repeat(Math.min(count, 40));
    console.log(`  ${status.padEnd(15)} ${String(count).padStart(3)} ${bar}`);
  }
  console.log();
}

function generateReport(leads: Lead[]): CampaignReport {
  const by_source: Record<string, number> = {};
  const by_status: Record<string, number> = {};

  for (const lead of leads) {
    by_source[lead.source] = (by_source[lead.source] || 0) + 1;
    by_status[lead.status] = (by_status[lead.status] || 0) + 1;
  }

  const signups = (by_status["signed_up"] || 0) + (by_status["first_job"] || 0);

  return {
    total_leads: leads.length,
    by_source,
    by_status,
    conversion_rate: leads.length > 0 ? signups / leads.length : 0,
    cost_per_signup: signups > 0 ? 100 / signups : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CSV Export — Generate report for external tools
// ═══════════════════════════════════════════════════════════════════════════

function exportToCSV(outputPath: string) {
  const leads = loadLeads();
  const headers = ["id", "name", "email", "business_name", "zip_code", "source", "status", "contacted_at", "created_at", "notes"];
  const rows = leads.map((l) =>
    headers.map((h) => `"${(l as Record<string, unknown>)[h] || ""}"`).join(",")
  );

  writeFileSync(outputPath, [headers.join(","), ...rows].join("\n"));
  console.log(`\nExported ${leads.length} leads to ${outputPath}\n`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Update Lead Status
// ═══════════════════════════════════════════════════════════════════════════

function updateStatus(email: string, status: Lead["status"]) {
  const leads = loadLeads();
  const lead = leads.find((l) => l.email === email.toLowerCase());
  if (!lead) {
    console.error(`Lead not found: ${email}`);
    return;
  }

  lead.status = status;
  if (status === "contacted") lead.contacted_at = new Date().toISOString();
  saveLeads(leads);

  console.log(`Updated ${email} → ${status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Referral Link Generator — Create trackable invite URLs for installers
// ═══════════════════════════════════════════════════════════════════════════

function generateReferralLinks(installerSlugs: string[]) {
  const baseUrl = "https://storage-network.app/invite";

  console.log("\n══════════════════════════════════════════");
  console.log("  REFERRAL LINKS FOR INSTALLERS");
  console.log("══════════════════════════════════════════\n");

  for (const slug of installerSlugs) {
    const link = `${baseUrl}?ref=${slug}&utm_source=referral&utm_campaign=installer_referral`;
    console.log(`  ${slug}:`);
    console.log(`  ${link}\n`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTM Link Generator — Create campaign-tracked URLs
// ═══════════════════════════════════════════════════════════════════════════

function generateCampaignLinks() {
  const baseUrl = "https://storage-network.app/invite";

  const campaigns = [
    { name: "Facebook — Money Shot", params: "utm_source=facebook&utm_medium=cpc&utm_campaign=money_shot" },
    { name: "Facebook — Zero Selling", params: "utm_source=facebook&utm_medium=cpc&utm_campaign=zero_selling" },
    { name: "Facebook — Territory", params: "utm_source=facebook&utm_medium=cpc&utm_campaign=territory_fomo" },
    { name: "Reddit — Sidehustle", params: "utm_source=reddit&utm_medium=organic&utm_campaign=sidehustle_post" },
    { name: "Reddit — Handyman", params: "utm_source=reddit&utm_medium=organic&utm_campaign=handyman_post" },
    { name: "Reddit — Carpentry", params: "utm_source=reddit&utm_medium=organic&utm_campaign=carpentry_post" },
    { name: "Craigslist — Gigs", params: "utm_source=craigslist&utm_medium=post&utm_campaign=gig_listing" },
    { name: "YouTube — Comments", params: "utm_source=youtube&utm_medium=comment&utm_campaign=garage_videos" },
    { name: "Direct — QR Code", params: "utm_source=qr&utm_medium=print&utm_campaign=flyer" },
  ];

  console.log("\n══════════════════════════════════════════");
  console.log("  CAMPAIGN TRACKING LINKS");
  console.log("══════════════════════════════════════════\n");

  for (const c of campaigns) {
    console.log(`  ${c.name}:`);
    console.log(`  ${baseUrl}?${c.params}\n`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI Router
// ═══════════════════════════════════════════════════════════════════════════

const [, , command, ...args] = process.argv;

switch (command) {
  case "import":
    importFromCSV(args[0] || "leads.csv");
    break;
  case "status":
    printStatus();
    break;
  case "export":
    exportToCSV(args[0] || "report.csv");
    break;
  case "update":
    updateStatus(args[0], args[1] as Lead["status"]);
    break;
  case "links":
    generateCampaignLinks();
    break;
  case "referral":
    generateReferralLinks(args);
    break;
  default:
    console.log(`
Storage Network — Lead Tracker

Commands:
  import <file.csv>         Import leads from CSV
  status                    Show campaign status report
  export <output.csv>       Export leads to CSV
  update <email> <status>   Update lead status (new|contacted|responded|signed_up|first_job|lost)
  links                     Generate all campaign tracking URLs
  referral <slug1> <slug2>  Generate referral links for installers

Examples:
  npx ts-node scripts/acquisition/lead-tracker.ts import leads.csv
  npx ts-node scripts/acquisition/lead-tracker.ts status
  npx ts-node scripts/acquisition/lead-tracker.ts links
  npx ts-node scripts/acquisition/lead-tracker.ts referral skyler-builds john-handyman
    `);
}
