import Link from "next/link";
import { CredentialsNavigation } from "@/components/credentials-navigation";

const records=[
  {href:"/credentials?view=licences",eyebrow:"CREDENTIALS",title:"Licences & ratings",copy:"Licence identity, ratings, qualifications and their recorded validity."},
  {href:"/credentials?view=documents",eyebrow:"DOCUMENTS",title:"Medical & documents",copy:"Medical certificates and other date-based pilot documents."},
  {href:"/credentials?view=training",eyebrow:"TRAINING EVIDENCE",title:"Aircraft training",copy:"Differences, familiarisation and signed aircraft-training evidence."},
] as const;

export function RecordsHub(){
  return <>
    <CredentialsNavigation active="records"/>
    <main className="records-hub">
      <div className="records-hub-heading"><div><p className="eyebrow">RECORDS</p><h2>Manage pilot records</h2><p className="muted">Open an area only when you need to add, correct or review evidence.</p></div></div>
      <div className="records-hub-grid">
        {records.map(item=><Link className="records-hub-card" href={item.href} key={item.href}><span>{item.eyebrow}</span><strong>{item.title}</strong><p>{item.copy}</p><b>Open</b></Link>)}
      </div>
    </main>
  </>;
}
