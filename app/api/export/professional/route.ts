import { getSession } from "@/lib/auth/session";
import { getProfessionalExperienceForUser } from "@/lib/professional-experience-service";
import type { ProfessionalExperienceBreakdownRow } from "@/lib/professional-experience";

export const dynamic="force-dynamic";

const clean=(value:unknown)=>String(value??"").trim();
const esc=(value:unknown)=>`"${clean(value).replaceAll('"','""')}"`;
const xml=(value:unknown)=>clean(value).replace(/[<>&'\"]/g,char=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[char]!));
const hm=(value:unknown)=>{const total=Math.max(0,Math.round(Number(value)||0));return`${Math.floor(total/60)}:${String(total%60).padStart(2,"0")}`};
const sheet=(name:string,columns:string[],rows:Array<Record<string,unknown>>)=>`<Worksheet ss:Name="${xml(name)}"><Table><Row>${columns.map(column=>`<Cell><Data ss:Type="String">${xml(column)}</Data></Cell>`).join("")}</Row>${rows.map(row=>`<Row>${columns.map(column=>`<Cell><Data ss:Type="String">${xml(row[column])}</Data></Cell>`).join("")}</Row>`).join("")}</Table></Worksheet>`;

export async function GET(request:Request){
  const session=await getSession();if(!session)return new Response("Unauthorized",{status:401});
  const url=new URL(request.url),format=(url.searchParams.get("format")||"xls").toLowerCase(),category=clean(url.searchParams.get("category")).toUpperCase();
  if(!["csv","xls"].includes(format))return new Response("Unsupported export format.",{status:400,headers:{"content-type":"text/plain; charset=utf-8"}});
  const data=await getProfessionalExperienceForUser(session.userId,category);
  if(!data.scopeSupported)return new Response("Professional reporting is available only for Aeroplane, Helicopter or all-category scope.",{status:400,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"private, no-store"}});
  const stamp=new Date().toISOString().slice(0,10),scope=data.scope.toLowerCase();

  const breakdown=(rows:ProfessionalExperienceBreakdownRow[])=>rows.map(row=>({name:row.label,flights:row.flights,certified_time:hm(row.minutes),pic:hm(row.picMinutes),spic:hm(row.spicMinutes),picus:hm(row.picusMinutes),copilot:hm(row.copilotMinutes),cruise_relief:hm(row.cruiseReliefMinutes),instructor:hm(row.instructorMinutes),examiner:hm(row.examinerMinutes),multi_pilot:hm(row.multiPilotMinutes),ifr:hm(row.ifrMinutes),night:hm(row.nightMinutes),last_flown:row.lastDate}));
  const operatorRows=breakdown(data.operators),typeRows=breakdown(data.aircraftTypes);
  const roleRows=data.roles.map(row=>({role:row.role,flights:row.flights,creditable_time:hm(row.minutes),last_flown:row.lastDate}));
  const contextRows=data.operationContexts.map(row=>({context:row.label,recorded:row.recorded?"YES":"NO",flights:row.flights,creditable_time:hm(row.minutes),last_flown:row.lastDate}));
  const summaryRows=[
    {metric:"Scope",value:data.scope==="ALL"?"Aeroplane & Helicopter":data.scope},
    {metric:"Creditable flights",value:data.summary.flights},
    {metric:"Total certified",value:hm(data.summary.totalMinutes)},
    {metric:"PIC",value:hm(data.summary.picMinutes)},
    {metric:"SPIC",value:hm(data.summary.spicMinutes)},
    {metric:"PICUS",value:hm(data.summary.picusMinutes)},
    {metric:"Co-pilot",value:hm(data.summary.copilotMinutes)},
    {metric:"Cruise-relief co-pilot",value:hm(data.summary.cruiseReliefMinutes)},
    {metric:"Instructor",value:hm(data.summary.instructorMinutes)},
    {metric:"Examiner",value:hm(data.summary.examinerMinutes)},
    {metric:"Multi-pilot",value:hm(data.summary.multiPilotMinutes)},
    {metric:"IFR",value:hm(data.summary.ifrMinutes)},
    {metric:"Night",value:hm(data.summary.nightMinutes)},
    {metric:"Recorded operator flights",value:data.operatorCoverage.recordedFlights},
    {metric:"Flights without recorded operator",value:data.operatorCoverage.unrecordedFlights},
  ];

  if(format==="xls"){
    const breakdownColumns=["name","flights","certified_time","pic","spic","picus","copilot","cruise_relief","instructor","examiner","multi_pilot","ifr","night","last_flown"];
    const workbook=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheet("Summary",["metric","value"],summaryRows)}${sheet("Recorded operators",breakdownColumns,operatorRows)}${sheet("Aircraft types",breakdownColumns,typeRows)}${sheet("Roles",["role","flights","creditable_time","last_flown"],roleRows)}${sheet("Operation context",["context","recorded","flights","creditable_time","last_flown"],contextRows)}</Workbook>`;
    return new Response(workbook,{headers:{"content-type":"application/vnd.ms-excel; charset=utf-8","content-disposition":`attachment; filename=flytally-professional-experience-${scope}-${stamp}.xls`,"cache-control":"private, no-store"}});
  }

  const columns=["section","name","flights","certified_time","pic","spic","picus","copilot","cruise_relief","instructor","examiner","multi_pilot","ifr","night","last_flown","recorded"];
  const csvRows:Array<Record<string,unknown>>=[
    {section:"summary",name:"All professional experience",flights:data.summary.flights,certified_time:hm(data.summary.totalMinutes),pic:hm(data.summary.picMinutes),spic:hm(data.summary.spicMinutes),picus:hm(data.summary.picusMinutes),copilot:hm(data.summary.copilotMinutes),cruise_relief:hm(data.summary.cruiseReliefMinutes),instructor:hm(data.summary.instructorMinutes),examiner:hm(data.summary.examinerMinutes),multi_pilot:hm(data.summary.multiPilotMinutes),ifr:hm(data.summary.ifrMinutes),night:hm(data.summary.nightMinutes)},
    ...operatorRows.map(row=>({section:"recorded operator",...row})),
    ...typeRows.map(row=>({section:"aircraft type",...row})),
    ...roleRows.map(row=>({section:"role",name:row.role,flights:row.flights,certified_time:row.creditable_time,last_flown:row.last_flown})),
    ...contextRows.map(row=>({section:"operation context",name:row.context,flights:row.flights,certified_time:row.creditable_time,last_flown:row.last_flown,recorded:row.recorded})),
  ];
  const csv='\ufeff'+columns.join(';')+'\n'+csvRows.map(row=>columns.map(column=>esc(row[column])).join(';')).join('\n');
  return new Response(csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename=flytally-professional-experience-${scope}-${stamp}.csv`,"cache-control":"private, no-store"}});
}
