import type { PilotPreferences } from "@/lib/logbook-print";

export type DashboardWidgetSize="small"|"medium"|"wide"|"hero";
export type DashboardWidgetGroup="primary"|"quick"|"analysis";
export type DashboardWidgetId=
  |"total-time"|"ull-time"|"easa-time"|"pic-ull"|"pic-easa"
  |"last-flight"|"cost"|"aircraft"|"airports"|"gps-tracks"
  |"monthly-activity"|"statistics";

export type DashboardWidgetDefinition={
  id:DashboardWidgetId;label:string;group:DashboardWidgetGroup;defaultSize:DashboardWidgetSize;defaultEnabled:boolean;
};
export type DashboardLayoutItem={id:DashboardWidgetId;enabled:boolean;size:DashboardWidgetSize};

export const DASHBOARD_WIDGETS:readonly DashboardWidgetDefinition[]=[
  {id:"total-time",label:"Total time",group:"primary",defaultSize:"hero",defaultEnabled:true},
  {id:"ull-time",label:"ULL",group:"primary",defaultSize:"medium",defaultEnabled:true},
  {id:"easa-time",label:"EASA",group:"primary",defaultSize:"medium",defaultEnabled:true},
  {id:"pic-ull",label:"PIC ULL",group:"primary",defaultSize:"medium",defaultEnabled:true},
  {id:"pic-easa",label:"PIC EASA",group:"primary",defaultSize:"medium",defaultEnabled:true},
  {id:"last-flight",label:"Last flight",group:"quick",defaultSize:"medium",defaultEnabled:true},
  {id:"cost",label:"Cost",group:"quick",defaultSize:"small",defaultEnabled:true},
  {id:"aircraft",label:"Aircraft",group:"quick",defaultSize:"small",defaultEnabled:true},
  {id:"airports",label:"Airports",group:"quick",defaultSize:"small",defaultEnabled:true},
  {id:"gps-tracks",label:"GPS tracks",group:"quick",defaultSize:"small",defaultEnabled:true},
  {id:"monthly-activity",label:"Monthly activity",group:"analysis",defaultSize:"wide",defaultEnabled:true},
  {id:"statistics",label:"Statistics",group:"analysis",defaultSize:"wide",defaultEnabled:true},
] as const;

const sizes=new Set<DashboardWidgetSize>(["small","medium","wide","hero"]);
const definitions=new Map(DASHBOARD_WIDGETS.map(widget=>[widget.id,widget]));

export function defaultDashboardLayout():DashboardLayoutItem[]{
  return DASHBOARD_WIDGETS.map(widget=>({id:widget.id,enabled:widget.defaultEnabled,size:widget.defaultSize}));
}

export function dashboardLayoutFromPreferences(preferences:PilotPreferences):DashboardLayoutItem[]{
  const value=preferences.dashboard_widgets;
  if(!Array.isArray(value))return defaultDashboardLayout();
  const result:DashboardLayoutItem[]=[],seen=new Set<DashboardWidgetId>();
  for(const candidate of value){
    if(!candidate||typeof candidate!=="object"||Array.isArray(candidate))continue;
    const row=candidate as Record<string,unknown>,id=String(row.id??"") as DashboardWidgetId,definition=definitions.get(id);
    if(!definition||seen.has(id))continue;
    const requestedSize=String(row.size??"") as DashboardWidgetSize;
    result.push({id,enabled:row.enabled!==false,size:sizes.has(requestedSize)?requestedSize:definition.defaultSize});seen.add(id);
  }
  for(const widget of DASHBOARD_WIDGETS)if(!seen.has(widget.id))result.push({id:widget.id,enabled:widget.defaultEnabled,size:widget.defaultSize});
  return result;
}

export const DASHBOARD_PRESETS={
  general:["total-time","ull-time","easa-time","pic-ull","pic-easa","last-flight","cost","aircraft","airports","gps-tracks","monthly-activity","statistics"],
  instructor:["total-time","easa-time","pic-easa","last-flight","monthly-activity","statistics","cost","aircraft","airports","gps-tracks","ull-time","pic-ull"],
  ull:["total-time","ull-time","pic-ull","last-flight","cost","aircraft","airports","gps-tracks","monthly-activity","statistics","easa-time","pic-easa"],
} as const satisfies Record<string,readonly DashboardWidgetId[]>;
