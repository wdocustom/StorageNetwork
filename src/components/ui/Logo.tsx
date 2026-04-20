// ═══════════════════════════════════════════════════════════════════════════
// Logo — Storage Network round badge
// Uses height-based sizing with w-auto to prevent distortion.
// Usage: <Logo size={48} /> or <Logo className="h-12" />
// ═══════════════════════════════════════════════════════════════════════════

import Image from "next/image";

interface LogoProps {
  size?: number;
  className?: string;
  alt?: string;
}

export default function Logo({ size = 48, className, alt = "Storage Network" }: LogoProps) {
  return (
    <Image
      src="/Header_avatar_logo.png"
      alt={alt}
      width={size}
      height={size}
      className={className ? `${className} object-contain` : "object-contain"}
      style={{ height: size, width: "auto" }}
    />
  );
}
