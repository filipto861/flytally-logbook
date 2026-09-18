import Link from "next/link";

export type DatabaseWorkspaceView="aircraft"|"airports"|"health";

const items:{id:DatabaseWorkspaceView;label:string;href:string}[]=[
  {id:"aircraft",label:"Aircraft",href:"/database"},
  {id:"airports",label:"Airports",href:"/database?view=airports"},
  {id:"health",label:"Data health",href:"/database?view=health"},
];

export function DatabaseWorkspaceNavigation({active,issueCount=0}:{active:DatabaseWorkspaceView;issueCount?:number}){
  return <nav className="database-workspace-nav" aria-label="Aircraft and airport sections">
    {items.map(item=><Link key={item.id} className={active===item.id?"active":""} href={item.href} aria-current={active===item.id?"page":undefined}>
      <span>{item.label}</span>{item.id==="health"&&issueCount>0?<b aria-label={`${issueCount} data issues`}>{issueCount}</b>:null}
    </Link>)}
  </nav>;
}
