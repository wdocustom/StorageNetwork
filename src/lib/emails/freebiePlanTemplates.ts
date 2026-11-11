// ═══════════════════════════════════════════════════════════════════════════
// Veterans Day freebie plan — the email a veteran sends to themselves
//
// Built only from the offer catalog and from places the server looked up and
// signed; nothing typed by a visitor or written by the AI is rendered, so the
// branded template can't be used to deliver someone else's message.
// ═══════════════════════════════════════════════════════════════════════════

import { getAppUrl } from "@/lib/url-helper";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { sendTransactionalEmail, type SendEmailResult } from "./core";
import {
  EXTRA_TYPE_LABEL,
  PROOF_OF_SERVICE,
  VETERANS_DAY,
  getOffer,
  type Offer,
} from "@/lib/freebies/offers";
import {
  directionsUrl,
  formatTime,
  placeLine,
  routeUrl,
  slotLabel,
  type Place,
  type TimedStop,
} from "@/lib/freebies/schedule";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const GOLD = "#facc15";

function button(href: string, label: string, primary: boolean): string {
  const style = primary
    ? `background:${GOLD};color:#000;border:1px solid ${GOLD};`
    : `background:#000;color:${GOLD};border:1px solid #57480a;`;
  return `<a href="${esc(href)}" style="display:inline-block;${style}font-weight:800;font-size:13px;text-decoration:none;padding:10px 16px;border-radius:8px;margin:0 6px 6px 0;">${label}</a>`;
}

function offerUrl(offer: Offer): string {
  return `${getAppUrl()}/veterans-day#offer-${offer.id}`;
}

function callLine(place: Place): string {
  if (!place.phone) return "";
  const tel = place.phone.replace(/\D/g, "");
  return `<p style="margin:8px 0 0;color:#888;font-size:12px;">Call ahead to confirm: <a href="tel:+1${tel}" style="color:${GOLD};text-decoration:none;font-weight:700;">${esc(place.phone)}</a></p>`;
}

function placeBlock(place: Place, offer: Offer): string {
  return `
      <p style="margin:0;color:#fff;font-size:17px;font-weight:800;">${esc(offer.brand)}</p>
      <p style="margin:2px 0 0;color:${GOLD};font-size:14px;font-weight:700;">${esc(offer.headline)}</p>
      <p style="margin:6px 0 0;color:#aaa;font-size:13px;">${esc(placeLine(place))}</p>
      <p style="margin:8px 0 0;color:#999;font-size:12px;line-height:1.5;">${esc(offer.details)}</p>
      <p style="margin:6px 0 0;color:#777;font-size:12px;">Who qualifies: ${esc(offer.eligibility)} · Offer hours: ${esc(offer.windowNote)}</p>
      ${offer.redeemLater ? `<p style="margin:6px 0 0;color:#999;font-size:12px;">${esc(offer.redeemLater)}</p>` : ""}
      ${callLine(place)}
      <div style="margin:12px 0 0;">
        ${button(directionsUrl(place), "Get directions", true)}
        ${button(offerUrl(offer), "Offer details", false)}
      </div>`;
}

function stopCard(stop: TimedStop): string {
  const offer = getOffer(stop.place.offerId);
  if (!offer) return "";
  const kind =
    stop.slot === "extra" && offer.extraType ? EXTRA_TYPE_LABEL[offer.extraType] : slotLabel(stop.slot);
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
      <tr>
        <td width="84" valign="top" style="padding:16px 0 0;">
          <p style="margin:0;color:${GOLD};font-size:16px;font-weight:800;white-space:nowrap;">${formatTime(stop.arrive)}</p>
          <p style="margin:2px 0 0;color:#777;font-size:11px;">~${stop.driveMin} min drive</p>
        </td>
        <td valign="top" style="background:#0d0d0d;border:1px solid #222;border-left:3px solid ${GOLD};border-radius:10px;padding:16px;">
          <p style="margin:0 0 6px;color:#888;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${esc(kind)}</p>
          ${placeBlock(stop.place, offer)}
        </td>
      </tr>
    </table>`;
}

function extraCard(place: Place): string {
  const offer = getOffer(place.offerId);
  if (!offer) return "";
  const kind = offer.extraType ? EXTRA_TYPE_LABEL[offer.extraType] : "Offer";
  return `
    <div style="background:#0d0d0d;border:1px solid #222;border-radius:10px;padding:16px;margin:0 0 12px;">
      <p style="margin:0 0 6px;color:#888;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${esc(kind)}</p>
      ${placeBlock(place, offer)}
    </div>`;
}

export interface FreebiePlanEmail {
  /** "Austin, TX" — derived server-side from the starting point. */
  originLabel: string;
  stops: TimedStop[];
  /** Non-food offers nearby that aren't on the timeline. */
  extras: Place[];
}

export function freebiePlanSubject(): string {
  return `Your Veterans Day freebie plan — ${VETERANS_DAY.label}`;
}

export function freebiePlanEmailHtml({ originLabel, stops, extras }: FreebiePlanEmail): string {
  const appUrl = getAppUrl();
  const route = routeUrl(stops);
  const proof = PROOF_OF_SERVICE.map(
    (p) => `<li style="margin:0 0 4px;">${esc(p)}</li>`
  ).join("");

  const body = `
    <p style="margin:0 0 6px;color:#fff;font-size:16px;font-weight:700;text-align:center;">Thank you for your service.</p>
    <p style="margin:0 0 24px;color:#aaa;font-size:14px;text-align:center;">
      Here is your plan for ${esc(VETERANS_DAY.label)}, starting near ${esc(originLabel)}.
      ${stops.length} ${stops.length === 1 ? "stop" : "stops"}, in order, with directions to each.
    </p>

    <div style="background:#141204;border:1px solid #57480a;border-radius:10px;padding:16px;margin:0 0 24px;">
      <p style="margin:0 0 8px;color:${GOLD};font-size:13px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;">Bring proof of service</p>
      <ul style="margin:0;padding:0 0 0 18px;color:#ccc;font-size:13px;line-height:1.5;">${proof}</ul>
      <p style="margin:10px 0 0;color:#999;font-size:12px;">Any one of these is usually enough. Offers are for the veteran or service member; guests pay regular price.</p>
    </div>

    <p style="margin:0 0 12px;color:#fff;font-size:15px;font-weight:800;">Your day</p>
    ${stops.map(stopCard).join("")}

    ${
      route
        ? `<div style="text-align:center;margin:8px 0 28px;">
      <a href="${esc(route)}" style="display:inline-block;background:${GOLD};color:#000;font-weight:800;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:10px;">Open the whole route in Maps</a>
    </div>`
        : ""
    }

    ${
      extras.length
        ? `<p style="margin:0 0 4px;color:#fff;font-size:15px;font-weight:800;">More near you — not food</p>
    <p style="margin:0 0 12px;color:#888;font-size:13px;">Fit these in wherever you have a gap.</p>
    ${extras.map(extraCard).join("")}`
        : ""
    }

    <div style="border-top:1px solid #222;margin:24px 0 0;padding:20px 0 24px;">
      <p style="margin:0 0 8px;color:#999;font-size:12px;line-height:1.6;">
        <strong style="color:#ccc;">Before you go:</strong> offers are at participating locations and can change or run out.
        A quick call to the store is the surest way to confirm. Times are estimates based on typical drive
        times; expect lines at popular restaurants, especially around noon and after 5 p.m.
      </p>
      <p style="margin:0;color:#999;font-size:12px;">
        Want a different stop? <a href="${appUrl}/veterans-day" style="color:${GOLD};text-decoration:none;font-weight:700;">Change your plan</a>
      </p>
    </div>`;

  return masterEmailLayout("Your Veterans Day Freebie Plan", body);
}

export async function sendFreebiePlanEmail(to: string, plan: FreebiePlanEmail): Promise<SendEmailResult> {
  return sendTransactionalEmail({
    to,
    subject: freebiePlanSubject(),
    html: freebiePlanEmailHtml(plan),
  });
}
