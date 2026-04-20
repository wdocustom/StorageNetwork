import Image from "next/image";

// ═══════════════════════════════════════════════════════════════════════════
// Phone Mockup — CSS-based smartphone frame with notch
// ═══════════════════════════════════════════════════════════════════════════

interface PhoneMockupProps {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
}

export default function PhoneMockup({
  src,
  alt,
  priority = false,
  className = "",
}: PhoneMockupProps) {
  return (
    <div
      className={`relative inline-block rounded-[2.5rem] border-[8px] border-slate-800 bg-slate-800 shadow-2xl ${className}`}
    >
      {/* Notch */}
      <div className="absolute left-1/2 top-0 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-slate-800" />

      {/* Screen */}
      <div className="relative overflow-hidden rounded-[2rem]">
        <Image
          src={src}
          alt={alt}
          width={320}
          height={693}
          priority={priority}
          className="block h-auto w-full"
        />
      </div>
    </div>
  );
}
