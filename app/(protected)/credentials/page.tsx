import type { Metadata } from "next";
import LegacyCredentialsPage from "./legacy-page";
import { AdaptivePilotOverview } from "./adaptive-overview";
import { SplRecencyPanel } from "@/components/spl-recency-panel";

export const metadata:Metadata={title:"Licences | FlyTally"};
type PageProps={searchParams?:Promise<Record<string,string|string[]|undefined>>};

export default async function CredentialsPage(props:PageProps){
  const params=props.searchParams?await props.searchParams:{};
  const rawView=Array.isArray(params.view)?params.view[0]:params.view;
  if(!rawView||rawView==="overview")return <AdaptivePilotOverview/>;
  if(rawView==="recency")return <><LegacyCredentialsPage {...props}/><SplRecencyPanel/></>;
  return <LegacyCredentialsPage {...props}/>;
}
