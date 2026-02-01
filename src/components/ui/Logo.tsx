// ═══════════════════════════════════════════════════════════════════════════
// Logo — Storage Network brand badge
// Usage: <Logo size={48} /> or <Logo className="h-12 w-12" />
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
      className={className || `h-${size / 4} w-${size / 4}`}
      style={!className ? { height: size, width: size } : undefined}
    />
  );
}
