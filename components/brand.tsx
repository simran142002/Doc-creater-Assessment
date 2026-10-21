import Link from "next/link";

export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M10 8h8.5l5 5v11a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" fill="var(--bg-elev)" />
      <path d="M18.5 8v5h5" fill="var(--marigold)" />
      <path d="M12.5 17h7M12.5 20.5h4.5" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="Ajaia Docs home">
      <BrandMark />
      <span className="brand-word">Ajaia <em>Docs</em></span>
    </Link>
  );
}
