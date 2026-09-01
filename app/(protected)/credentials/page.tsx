import type { Metadata } from "next";
import LegacyCredentialsPage from "./legacy-page";
import { AdaptivePilotOverview } from "./adaptive-overview";

export const metadata:Metadata={title:"Licences | FlyTally"};
type PageProps={searchParams?:Promise<Record<string,string|string[]|undefined>>};

export default async function CredentialsPage(props:PageProps){
  const params=props.searchParams?await props.searchParams:{};
  const rawView=Array.isArray(params.view)?params.view[0]:params.view;
  if(!rawView||rawView==="overview")return <AdaptivePilotOverview/>;
  return <LegacyCredentialsPage {...props}/>;
}
