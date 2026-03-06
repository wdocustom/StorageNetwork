import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getFullProfileBySlug } from "@/app/actions/profile";
import PortfolioGallery from "./PortfolioGallery";
import PortfolioContact from "./PortfolioContact";
import CleanOutBooking from "./CleanOutBooking";

// ═══════════════════════════════════════════════════════════════════════════
// Installer Portfolio Page — /p/[slug]
//
// Public-facing profile page for each installer. QR codes and shared links
// bring customers here first, where they see the installer's portfolio,
// credentials, and social links before being directed to the configurator.
// ═══════════════════════════════════════════════════════════════════════════

// ISR: serve cached page, revalidate in background every 60s.
// Slashes DB load during viral spikes while keeping data reasonably fresh.
// Installer profile updates trigger on-demand revalidation via revalidatePath().
export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface PortfolioPhoto {
  url: string;
  caption?: string;
}

export default async function InstallerPortfolioPage({ params }: PageProps) {
  const { slug } = await params;
  const profile = await getFullProfileBySlug(slug);
  if (!profile) notFound();

  const isActive = profile.is_pro !== false;

  const displayName =
    profile.business_name ||
    profile.trade_name ||
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    "Storage Network Installer";

  const location = [profile.city, profile.state].filter(Boolean).join(", ");
  const rawPhotos = Array.isArray(profile.portfolio_photos)
    ? (profile.portfolio_photos as PortfolioPhoto[])
    : [];
  const photos = rawPhotos.filter((p) => p && p.url);
  const configuratorUrl = `/design?installer=${slug}`;
  const hasPhone = !!profile.phone;
  const hasInstagram = !!profile.instagram_url;
  const hasFacebook = !!profile.facebook_url;
  const hasBio = !!profile.bio?.trim();

  // ── Suspended installer — show inactive overlay ──────────────────────
  if (!isActive) {
    return (
      <div className="min-h-screen bg-[#080c16]">
        {/* Top bar */}
        <div className="border-b border-slate-800/60 bg-[#0a0e1a]">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 opacity-70 transition-opacity hover:opacity-100">
              <Image
                src="/landing_page_logo.png"
                alt="Storage Network"
                width={80}
                height={24}
                className="h-6 w-auto"
              />
              <span className="text-xs font-semibold tracking-wide text-stone-400">
                Storage Network
              </span>
            </Link>
            <Link
              href="/design"
              className="rounded-full bg-yellow-400/10 px-3 py-1 text-[11px] font-bold text-yellow-400 transition-colors hover:bg-yellow-400/20"
            >
              Find an Installer
            </Link>
          </div>
        </div>

        {/* Blurred content with overlay */}
        <div className="relative">
          {/* Blurred background — the avatar and name are visible but blurred */}
          <div className="pointer-events-none select-none blur-md opacity-40">
            <div className="mx-auto max-w-3xl px-4 py-16 text-center">
              <div className="mx-auto mb-4 h-28 w-28 rounded-full bg-slate-800 sm:h-32 sm:w-32" />
              <div className="mx-auto mb-3 h-7 w-48 rounded bg-slate-800" />
              <div className="mx-auto mb-6 h-4 w-32 rounded bg-slate-800/60" />
              <div className="mx-auto grid max-w-lg grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="aspect-square rounded-xl bg-slate-800/50" />
                ))}
              </div>
            </div>
          </div>

          {/* Overlay message */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="mx-4 max-w-md rounded-2xl border border-slate-700 bg-slate-900/95 p-8 text-center shadow-2xl backdrop-blur-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-800">
                <svg className="h-8 w-8 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <h2 className="mb-2 text-lg font-black uppercase tracking-tight text-white">
                Installer Not Active
              </h2>
              <p className="mb-6 text-sm leading-relaxed text-stone-400">
                This Storage-Network.app Installer is not currently active.
                Use the link below to find an available installer in your area.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-6 py-3 text-sm font-black uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300"
              >
                Find an Active Installer
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── JSON-LD: LocalBusiness schema for GEO / AI search visibility ────
  const localBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `https://storage-network.app/p/${slug}#business`,
    name: displayName,
    url: `https://storage-network.app/p/${slug}`,
    ...(profile.avatar_url ? { image: profile.avatar_url } : {}),
    ...(profile.phone ? { telephone: profile.phone } : {}),
    ...(hasBio ? { description: profile.bio } : {}),
    ...(profile.city || profile.state
      ? {
          address: {
            "@type": "PostalAddress",
            ...(profile.city ? { addressLocality: profile.city } : {}),
            ...(profile.state ? { addressRegion: profile.state } : {}),
            addressCountry: "US",
          },
        }
      : {}),
    parentOrganization: {
      "@type": "Organization",
      "@id": "https://storage-network.app/#organization",
      name: "Storage Network",
    },
    makesOffer: {
      "@type": "Offer",
      name: "Custom Tote Storage Installation",
      description: `Professional tote rack installation by ${displayName}${location ? ` in ${location}` : ""}. Design in 3D, get instant pricing.`,
      url: `https://storage-network.app${configuratorUrl}`,
    },
    ...(photos.length > 0
      ? {
          photo: photos.slice(0, 6).map((p) => ({
            "@type": "ImageObject",
            url: p.url,
            ...(p.caption ? { caption: p.caption } : {}),
          })),
        }
      : {}),
    priceRange: "$$",
    currenciesAccepted: "USD",
    additionalType: "https://schema.org/HomeAndConstructionBusiness",
  };

  return (
    <div className="min-h-screen bg-[#080c16]">
      {/* JSON-LD structured data for AI/GEO crawlers */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />

      {/* ── Subtle top bar ──────────────────────────────────────────────── */}
      <div className="border-b border-slate-800/60 bg-[#0a0e1a]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 opacity-70 transition-opacity hover:opacity-100">
            <Image
              src="/landing_page_logo.png"
              alt="Storage Network"
              width={80}
              height={24}
              className="h-6 w-auto"
            />
            <span className="text-xs font-semibold tracking-wide text-stone-400">
              Storage Network
            </span>
          </Link>
          <Link
            href={configuratorUrl}
            className="rounded-full bg-yellow-400/10 px-3 py-1 text-[11px] font-bold text-yellow-400 transition-colors hover:bg-yellow-400/20"
          >
            Design Your Unit
          </Link>
        </div>
      </div>

      {/* ── Hero Section ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-yellow-400/[0.03] via-[#0a0e1a] to-[#080c16]" />

        <div className="relative mx-auto max-w-3xl px-4 pb-8 pt-10 sm:pt-14">
          {/* Two-column layout: identity left, bio + CTA right */}
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:gap-10">
            {/* ── Left Column: Avatar, Name, Location, Badges ──────── */}
            <div className="flex shrink-0 flex-col items-center text-center sm:w-48">
              {/* Avatar */}
              <div className="relative mb-4">
                <div className="h-28 w-28 overflow-hidden rounded-full border-[3px] border-yellow-400/30 bg-slate-800 shadow-xl shadow-yellow-400/5 sm:h-32 sm:w-32">
                  {profile.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt={displayName}
                      width={128}
                      height={128}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
                      <span className="text-3xl font-black text-slate-500">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                {/* Verified badge dot */}
                <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-[#0a0e1a] bg-emerald-500">
                  <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>

              {/* Name */}
              <h1 className="mb-1 text-xl font-black tracking-tight text-white sm:text-2xl">
                {displayName}
              </h1>
              {location && (
                <p className="mb-3 flex items-center gap-1.5 text-sm text-stone-400">
                  <svg className="h-3.5 w-3.5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {location}
                </p>
              )}

              {/* Badges */}
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Verified
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-2.5 py-1 text-[11px] font-bold text-yellow-400">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Highly Rated
                </span>
              </div>
            </div>

            {/* ── Right Column: Bio + CTA ─────────────────────────── */}
            <div className="flex min-w-0 flex-1 flex-col items-center sm:items-start sm:pt-2">
              {hasBio && (
                <div className="mb-5 w-full rounded-xl border border-slate-800/60 bg-[#0d1220] p-4 sm:p-5">
                  <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-500">
                    About
                  </h2>
                  <div className="whitespace-pre-line text-sm leading-relaxed text-stone-300">
                    {profile.bio}
                  </div>
                </div>
              )}

              {/* Primary CTA — highest-contrast element */}
              <Link
                href={configuratorUrl}
                className="group mb-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-6 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:shadow-yellow-400/30 sm:w-auto"
              >
                Design &amp; Price Your System
                <svg
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>

              {/* Secondary: Phone, Email & Social Links */}
              <div className="flex flex-wrap items-center gap-2">
                {hasPhone && (
                  <a
                    href={`tel:${profile.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-white transition-all hover:border-yellow-400/40 hover:bg-slate-800"
                  >
                    <svg className="h-3.5 w-3.5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {profile.phone}
                  </a>
                )}
                <PortfolioContact installerId={profile.id} businessName={displayName} />
                {hasInstagram && (
                  <a
                    href={
                      profile.instagram_url!.startsWith("http")
                        ? profile.instagram_url!
                        : `https://instagram.com/${profile.instagram_url!.replace(/^@/, "")}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-white transition-all hover:border-pink-400/40 hover:bg-slate-800"
                  >
                    <svg className="h-3.5 w-3.5 text-pink-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                    </svg>
                    Instagram
                  </a>
                )}
                {hasFacebook && (
                  <a
                    href={
                      profile.facebook_url!.startsWith("http")
                        ? profile.facebook_url!
                        : `https://facebook.com/${profile.facebook_url!}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-white transition-all hover:border-blue-400/40 hover:bg-slate-800"
                  >
                    <svg className="h-3.5 w-3.5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Facebook
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Services ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 pb-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-stone-500">
            Services
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
        </div>
        <div className="space-y-3">
          {/* Design Your Unit — existing CTA as a service card */}
          <Link
            href={configuratorUrl}
            className="group flex w-full flex-col items-center gap-3 rounded-2xl border border-slate-700/60 bg-[#0d1220] p-5 transition-all hover:border-yellow-400/30 hover:bg-[#111827] sm:flex-row sm:items-start"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10">
              <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
              </svg>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-sm font-black uppercase tracking-wide text-white">
                Custom Tote Storage
              </h3>
              <p className="mt-1 text-xs text-stone-400">
                Design in 3D, get instant pricing, book installation.
              </p>
            </div>
            <svg className="h-5 w-5 shrink-0 text-stone-600 transition-transform group-hover:translate-x-0.5 group-hover:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* Garage / Basement Clean Out */}
          <CleanOutBooking
            installerId={profile.id}
            installerSlug={slug}
            installerLeadTime={profile.lead_time_days ?? 5}
            installerWorkingDays={profile.working_days as string[] ?? ["Mon", "Tue", "Wed", "Thu", "Fri"]}
          />
        </div>
      </section>

      {/* ── Portfolio Gallery ───────────────────────────────────────────── */}
      {photos.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 pb-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-stone-500">
              Our Work
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
          </div>
          <PortfolioGallery photos={photos} businessName={displayName} />
        </section>
      )}

      {/* ── CTA Section ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 pb-12 pt-4">
        <div className="relative overflow-hidden rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/[0.08] via-[#0d1220] to-[#0d1220]">
          {/* Decorative corner glow */}
          <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-yellow-400/[0.06] blur-3xl" />

          <div className="relative p-6 sm:p-8">
            <div className="mx-auto max-w-md text-center">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-yellow-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-yellow-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Free 3D Designer
              </div>

              <h2 className="mb-2 text-xl font-black tracking-tight text-white sm:text-2xl">
                Design Your Custom Storage System
              </h2>
              <p className="mb-6 text-sm text-stone-400">
                Use {displayName}&apos;s 3D configurator to design your perfect tote storage system.
                Get instant pricing, view it in 3D, and secure your installation date.
              </p>

              <Link
                href={configuratorUrl}
                className="group inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-8 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:shadow-yellow-400/30"
              >
                Start Designing
                <svg
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>

              <p className="mt-4 text-xs text-stone-600">
                Design takes 30 seconds. No account required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/40 bg-[#070a13]">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <Link href="/" className="flex items-center gap-2 opacity-50 transition-opacity hover:opacity-80">
              <Image
                src="/landing_page_logo.png"
                alt="Storage Network"
                width={68}
                height={20}
                className="h-5 w-auto"
              />
              <span className="text-xs text-stone-500">
                Powered by Storage-Network.app
              </span>
            </Link>
            <p className="text-[10px] text-stone-600">
              &copy; {new Date().getFullYear()} Storage-Network.app
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── SEO Metadata ─────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getFullProfileBySlug(slug);

  if (!profile) {
    return { title: "Installer Not Found | Storage Network" };
  }

  const businessName = profile.business_name || profile.trade_name || "Storage Network Installer";
  const location = [profile.city, profile.state].filter(Boolean).join(", ");
  const locationStr = location ? ` in ${location}` : "";

  return {
    title: `${businessName} | Verified Storage Network Installer`,
    description: `${businessName}${locationStr} — Verified Storage Network installer. Design your custom tote storage system with their free 3D configurator. Professional installation, instant pricing.`,
    keywords: [
      businessName,
      "tote storage installer",
      "garage organization",
      "custom shelving",
      "professional installation",
      "Storage Network",
      ...(location ? [location] : []),
    ],
    openGraph: {
      title: `${businessName} — Verified Storage Network Installer`,
      description: `Design your custom tote storage system with ${businessName}. Free 3D configurator, instant pricing, and professional installation.`,
      type: "profile",
      // OG image is auto-generated by opengraph-image.tsx (1200×630 branded card)
    },
    twitter: {
      card: "summary_large_image",
      title: `${businessName} — Verified Storage Network Installer`,
      description: `Design your custom tote storage system with ${businessName}. Free 3D configurator, instant pricing, and professional installation.`,
    },
  };
}
