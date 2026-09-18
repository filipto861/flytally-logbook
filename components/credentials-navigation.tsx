import Link from "next/link";

export type CredentialsPrimarySection="overview"|"recency"|"records";
export type CredentialsRecordSection="licences"|"documents"|"training";

const primaryTabs:[CredentialsPrimarySection,string][]=[
  ["overview","Overview"],
  ["recency","Recency"],
  ["records","Records"],
];

const recordTabs:[CredentialsRecordSection,string][]=[
  ["licences","Licences & ratings"],
  ["documents","Medical & documents"],
  ["training","Aircraft training"],
];

const descriptions:Record<CredentialsPrimarySection,string>={
  overview:"Current status and anything that needs your attention.",
  recency:"Flying recency and the evidence behind it.",
  records:"Manage licences, ratings, medicals, documents and training evidence.",
};

export function CredentialsNavigation({active}:{active:CredentialsPrimarySection}){
  return <>
    <header className="page-header"><div><p className="eyebrow">PILOT PROFILE</p><h1>Licences & recency</h1><p className="muted">{descriptions[active]}</p></div></header>
    <nav className="credentials-tabs credentials-primary-tabs" aria-label="Licences and recency sections">
      {primaryTabs.map(([key,label])=><Link key={key} className={active===key?"active":""} href={key==="overview"?"/credentials":`/credentials?view=${key}`}>{label}</Link>)}
    </nav>
  </>;
}

export function CredentialsRecordsNav({active}:{active:CredentialsRecordSection}){
  return <nav className="credentials-subtabs" aria-label="Pilot record sections">
    {recordTabs.map(([key,label])=><Link key={key} className={active===key?"active":""} href={`/credentials?view=${key}`}>{label}</Link>)}
  </nav>;
}
