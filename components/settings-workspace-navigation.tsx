import Link from "next/link";

export type SettingsWorkspaceView="general"|"account"|"privacy";

const items:{id:SettingsWorkspaceView;label:string;href:string}[]=[
  {id:"general",label:"General",href:"/profile"},
  {id:"account",label:"Account & security",href:"/profile?view=account"},
  {id:"privacy",label:"Privacy",href:"/profile?view=privacy"},
];

export function SettingsWorkspaceNavigation({active}:{active:SettingsWorkspaceView}){
  return <nav className="settings-workspace-nav" aria-label="Settings sections">
    {items.map(item=><Link key={item.id} href={item.href} className={active===item.id?"active":""} aria-current={active===item.id?"page":undefined}>{item.label}</Link>)}
  </nav>;
}
