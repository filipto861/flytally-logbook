import Link from "next/link";

const links = [
  ["Privacy", "/legal/privacy"],
  ["Terms", "/legal/terms"],
  ["Cookies", "/legal/cookies"],
  ["Aviation safety", "/legal/aviation-safety"],
  ["Providers", "/legal/subprocessors"],
  ["Report", "/legal/report"],
] as const;

export function LegalFooter({ compact=false }: { compact?: boolean }) {
  return (
    <nav aria-label="Legal" className={`legal-footer${compact?" compact":""}`}>
      {links.map(([label,href])=><Link key={href} href={href} className="legal-footer-link">{label}</Link>)}
    </nav>
  );
}
