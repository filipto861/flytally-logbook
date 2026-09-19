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
    <nav aria-label="Legal" style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:compact?"6px 10px":"8px 14px",fontSize:compact?".67rem":".72rem",color:"var(--text-soft)",opacity:1}}>
      {links.map(([label,href])=><Link key={href} href={href} style={{textDecoration:"underline",textUnderlineOffset:"2px"}}>{label}</Link>)}
    </nav>
  );
}
