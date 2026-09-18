import Link from "next/link";

export type DataWorkspaceView="export"|"recovery"|"deleted";

const items:{id:DataWorkspaceView;label:string;href:string}[]=[
  {id:"export",label:"Print & export",href:"/data"},
  {id:"recovery",label:"Backup & restore",href:"/data?view=recovery"},
  {id:"deleted",label:"Deleted flights",href:"/data?view=deleted"},
];

export function DataWorkspaceNavigation({active}:{active:DataWorkspaceView}){
  return <nav className="data-workspace-nav" aria-label="Print and data sections">
    {items.map(item=><Link key={item.id} className={active===item.id?"active":""} href={item.href} aria-current={active===item.id?"page":undefined}>{item.label}</Link>)}
  </nav>;
}
