import type { Metadata } from "next";
import type { ReactNode } from "react";
import LegacyCredentialsPage from "./legacy-page";
import { AdaptivePilotOverview } from "./adaptive-overview";
import { AdvancedQualificationsPanel } from "@/components/advanced-qualifications-panel";
import { RecordsHub } from "./records-hub";
import { RecencyComplianceWorkspace } from "@/components/recency-compliance-workspace";

export const metadata:Metadata={title:"Licences | FlyTally"};
type PageProps={searchParams?:Promise<Record<string,string|string[]|undefined>>};

export default async function CredentialsPage(props:PageProps){
  const params=props.searchParams?await props.searchParams:{};
  const rawView=Array.isArray(params.view)?params.view[0]:params.view;
  const rawDetail=Array.isArray(params.detail)?params.detail[0]:params.detail;
  let content:ReactNode;
  if(!rawView||rawView==="overview")content=<AdaptivePilotOverview/>;
  else if(rawView==="recency")content=<RecencyComplianceWorkspace detailed={rawDetail==="1"||rawDetail==="details"}/>;
  else if(rawView==="records")content=<RecordsHub/>;
  else if(rawView==="licences")content=<><LegacyCredentialsPage {...props}/><AdvancedQualificationsPanel/></>;
  else content=<LegacyCredentialsPage {...props}/>;
  return <div className="ui-page-stack">{content}</div>;
}
