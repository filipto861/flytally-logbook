import Link from "next/link";

type FlightWorkspaceSection="flights"|"attention"|"fstd";

const links=[
  {key:"flights" as const,href:"/flights",label:"All flights"},
  {key:"attention" as const,href:"/flights/needs-attention",label:"Needs attention"},
  {key:"fstd" as const,href:"/fstd",label:"FSTD sessions"},
];

export function FlightWorkspaceNav({active}:{active:FlightWorkspaceSection}){
  return <nav className="flight-task-nav" aria-label="Flight records">
    {links.map(link=><Link key={link.key} className={active===link.key?"active":undefined} aria-current={active===link.key?"page":undefined} href={link.href}>{link.label}</Link>)}
  </nav>;
}
