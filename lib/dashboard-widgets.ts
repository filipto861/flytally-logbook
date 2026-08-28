import type { PilotPreferences } from "@/lib/logbook-print";

export type DashboardWidgetSize="small"|"medium"|"wide"|"hero";
export type DashboardWidgetGroup="primary"|"quick"|"analysis";
export type DashboardWidgetId=
  |"total-time"|"ull-time"|"easa-time"|"pic-ull"|"pic-easa"
  |"last-flight"|"aircraft-costs"|"airports"|"gps-tracks"
  |"monthly-activity"|"statistics";

export type DashboardWidgetDefinition={
  id:DashboardWidgetId;label:string;group:DashboardWidgetGroup;defaultSize:DashboardWidgetSize;defaultEnabled:boolean;sizes:readonly DashboardWidgetSize[];
};
export type DashboardLayoutItem={id:DashboardWidgetId;enabled:boolean;size:DashboardWidgetSize};
export type DashboardPresetId="general"|"instructor"|"ull";

export const DASHBOARD_WIDGETS:readonly DashboardWidgetDefinition[]=[
  {id:"total-time",label:"Total time",group:"primary",defaultSize:"hero",defaultEnabled:true,sizes:["medium","wide","hero"]},
  {id:"ull-time",label:"ULL",group:"primary",defaultSize:"medium",defaultEnabled:true,sizes:["small","medium"]},
  {id:"easa-time",label:"EASA",group:"primary",defaultSize:"medium",defaultEnabled:true,sizes:["small","medium"]},
  {id:"pic-ull",label:"PIC ULL",group:"primary",defaultSize:"medium",defaultEnabled:true,sizes:["small","medium"]},
  {id:"pic-easa",label:"PIC EASA",group:"primary",defaultSize:"medium",defaultEnabled:true,sizes:["small","medium"]},
  {id:"last-flight",label:"Last flight",group:"quick",defaultSize:"medium",defaultEnabled:true,sizes:["medium","wide"]},
  {id:"airports",label:"Airports",group:"quick",defaultSize:"small",defaultEnabled:true,sizes:["small","medium"]},
  {id:"gps-tracks",label:"GPS tracks",group:"quick",defaultSize:"small",defaultEnabled:true,sizes:["small","medium"]},
  {id:"aircraft-costs",label:"Aircraft & costs",group:"quick",defaultSize:"wide",defaultEnabled:true,sizes:["medium","wide"]},
  {id:"monthly-activity",label:"Monthly activity",group:"analysis",defaultSize:"wide",defaultEnabled:true,sizes:["wide"]},
  {id:"statistics",label:"Statistics",group:"analysis",defaultSize:"wide",defaultEnabled:true,sizes:["wide"]},
] as const;

const definitions=new Map(DASHBOARD_WIDGETS.map(widget=>[widget.id,widget]));
export function dashboardWidgetDefinition(id:DashboardWidgetId){return definitions.get(id)!}

export function defaultDashboardLayout():DashboardLayoutItem[]{
  return DASHBOARD_WIDGETS.map(widget=>({id:widget.id,enabled:widget.defaultEnabled,size:widget.defaultSize}));
}

function objectRows(value:unknown):Record<string,unknown>[]{
  return Array.isArray(value)?value.filter(row=>row&&typeof row==="object"&&!Array.isArray(row)) as Record<string,unknown>[]:[];
}

function migrateLegacyAircraftCostWidgets(rows:Record<string,unknown>[]):Record<string,unknown>[] {
  if(rows.some(row=>String(row.id??"")==="aircraft-costs"))return rows;
  const legacy=rows.map((row,index)=>({row,index,id:String(row.id??"")})).filter(item=>item.id==="cost"||item.id==="aircraft");
  if(!legacy.length)return rows;
  const first=Math.min(...legacy.map(item=>item.index));
  const enabled=legacy.some(item=>item.row.enabled!==false);
  const requested=legacy.map(item=>String(item.row.size??"") as DashboardWidgetSize).find(size=>size==="medium"||size==="wide")??"wide";
  const result:Record<string,unknown>[]=[];
  rows.forEach((row,index)=>{
    const id=String(row.id??"");
    if(index===first)result.push({id:"aircraft-costs",enabled,size:requested});
    if(id!=="cost"&&id!=="aircraft")result.push(row);
  });
  return result;
}

export function dashboardLayoutFromValue(value:unknown):DashboardLayoutItem[]{
  const rows=migrateLegacyAircraftCostWidgets(objectRows(value));
  if(!rows.length)return defaultDashboardLayout();
  const result:DashboardLayoutItem[]=[],seen=new Set<DashboardWidgetId>();
  for(const row of rows){
    const id=String(row.id??"") as DashboardWidgetId,definition=definitions.get(id);
    if(!definition||seen.has(id))continue;
    const requestedSize=String(row.size??"") as DashboardWidgetSize;
    result.push({id,enabled:row.enabled!==false,size:definition.sizes.includes(requestedSize)?requestedSize:definition.defaultSize});seen.add(id);
  }
  for(const widget of DASHBOARD_WIDGETS)if(!seen.has(widget.id))result.push({id:widget.id,enabled:widget.defaultEnabled,size:widget.defaultSize});
  return result;
}

export function dashboardLayoutFromPreferences(preferences:PilotPreferences):DashboardLayoutItem[]{
  return dashboardLayoutFromValue(preferences.dashboard_widgets);
}

export const DASHBOARD_PRESETS={
  general:["total-time","ull-time","easa-time","pic-ull","pic-easa","last-flight","airports","gps-tracks","aircraft-costs","monthly-activity","statistics"],
  instructor:["total-time","easa-time","pic-easa","last-flight","airports","gps-tracks","aircraft-costs","monthly-activity","statistics","ull-time","pic-ull"],
  ull:["total-time","ull-time","pic-ull","last-flight","airports","gps-tracks","aircraft-costs","monthly-activity","statistics","easa-time","pic-easa"],
} as const satisfies Record<DashboardPresetId,readonly DashboardWidgetId[]>;

const DASHBOARD_PRESET_ENABLED:Record<DashboardPresetId,readonly DashboardWidgetId[]>={
  general:DASHBOARD_PRESETS.general,
  instructor:["total-time","easa-time","pic-easa","last-flight","airports","gps-tracks","aircraft-costs","monthly-activity","statistics"],
  ull:["total-time","ull-time","pic-ull","last-flight","airports","gps-tracks","aircraft-costs","monthly-activity","statistics"],
};

export function dashboardPresetLayout(preset:DashboardPresetId):DashboardLayoutItem[]{
  const enabled=new Set<DashboardWidgetId>(DASHBOARD_PRESET_ENABLED[preset]);
  const ordered=DASHBOARD_PRESETS[preset];
  return ordered.map(id=>{const definition=dashboardWidgetDefinition(id);return{id,enabled:enabled.has(id),size:definition.defaultSize}});
}
