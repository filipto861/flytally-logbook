import type { Metadata } from "next";
import LegacyCredentialsPage from "./legacy-page";
import { AdaptivePilotOverview } from "./adaptive-overview";
import { BalloonRecencyPanel } from "@/components/balloon-recency-panel";
import { AdvancedQualificationsPanel } from "@/components/advanced-qualifications-panel";

export const metadata:Metadata={title:"Licences | FlyTally"};
type PageProps={searchParams?:Promise<Record<string,string|string[]|undefined>>};

export default async function CredentialsPage(props:PageProps){
  const params=props.searchParams?await props.searchParams:{};
  const rawView=Array.isArray(params.view)?params.view[0]:params.view;
  if(!rawView||rawView==="overview")return <AdaptivePilotOverview/>;
  if(rawView==="recency")return <><LegacyCredentialsPage {...props}/><BalloonRecencyPanel/></>;
  if(rawView==="licences")return <><LegacyCredentialsPage {...props}/><AdvancedQualificationsPanel/></>;
  return <LegacyCredentialsPage {...props}/>;
}
