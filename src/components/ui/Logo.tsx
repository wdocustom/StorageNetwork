// ═══════════════════════════════════════════════════════════════════════════
// Logo — Storage Network round badge
// Uses height-based sizing with w-auto to prevent distortion.
// Usage: <Logo size={48} /> or <Logo className="h-12" />
// ═══════════════════════════════════════════════════════════════════════════

interface LogoProps {
  size?: number;
  className?: string;
  alt?: string;
}

export default function Logo({ size = 48, className, alt = "Storage Network" }: LogoProps) {
  return (
    <img
      src="/logo-storage-network.png"
      alt={alt}
      width={size}
      height={size}
      className={className ? `${className} object-contain` : "object-contain"}
      style={{ height: size, width: "auto" }}
    />
  );
}
