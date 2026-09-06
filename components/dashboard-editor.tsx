"use client";

import { useActionState,useEffect,useMemo,useState } from "react";
import { saveDashboardLayout,type DashboardSaveState } from "@/app/(protected)/dashboard/actions";
import { DASHBOARD_OVERVIEW_WIDGET_IDS,dashboardPresetLayout,dashboardWidgetDefinition,defaultDashboardOverviewLayout,type DashboardLayoutItem,type DashboardPresetId,type DashboardWidgetSize } from "@/lib/dashboard-widgets";

const initialState:DashboardSaveState={ok:false,message:""};
const sizeLabels:Record<DashboardWidgetSize,string>={small:"Small",medium:"Medium",wide:"Wide",hero:"Hero"};
const groupLabels={primary:"Flying summary",quick:"At a glance",analysis:"Analysis"} as const;
const overviewIds=new Set(DASHBOARD_OVERVIEW_WIDGET_IDS);

export function DashboardEditor({layout}:{layout:DashboardLayoutItem[]}){
  const[items,setItems]=useState<DashboardLayoutItem[]>(()=>layout.map(item=>({...item}))),[state,formAction,pending]=useActionState(saveDashboardLayout,initialState);
  useEffect(()=>setItems(layout.map(item=>({...item}))),[layout]);
  const dirty=useMemo(()=>JSON.stringify(items)!==JSON.stringify(layout),[items,layout]),enabledCount=items.filter(item=>item.enabled).length;
  const update=(id:DashboardLayoutItem["id"],patch:Partial<DashboardLayoutItem>)=>setItems(current=>current.map(item=>item.id===id?{...item,...patch}:item));
  const move=(index:number,direction:-1|1)=>setItems(current=>{const target=index+direction;if(target<0||target>=current.length)return current;const next=[...current];[next[index],next[target]]=[next[target],next[index]];return next});
  const applyPreset=(preset:DashboardPresetId)=>setItems(dashboardPresetLayout(preset).filter(item=>overviewIds.has(item.id)));
  return <details className="dashboard-editor">
    <summary>Customize dashboard</summary>
    <form action={formAction} className="dashboard-editor-form">
      <input type="hidden" name="layout" value={JSON.stringify(items)}/>
      <p className="muted">Choose the at-a-glance cards you want here. Detailed analytics stay in Statistics.</p>
      <div className="dashboard-preset-row" aria-label="Dashboard presets"><span>Preset</span><button type="button" onClick={()=>applyPreset("general")}>General</button><button type="button" onClick={()=>applyPreset("ull")}>ULL</button><button type="button" onClick={()=>applyPreset("instructor")}>Instructor</button></div>
      <div className="dashboard-editor-list">
        {items.map((item,index)=>{const definition=dashboardWidgetDefinition(item.id);return <div className={`dashboard-editor-row${item.enabled?"":" disabled"}`} key={item.id}>
          <label className="dashboard-widget-toggle"><input type="checkbox" checked={item.enabled} onChange={event=>update(item.id,{enabled:event.target.checked})}/><span><strong>{definition.label}</strong><small>{groupLabels[definition.group]}</small></span></label>
          <label className="dashboard-size-control"><span>Size</span><select value={item.size} disabled={definition.sizes.length===1} onChange={event=>update(item.id,{size:event.target.value as DashboardWidgetSize})}>{definition.sizes.map(size=><option value={size} key={size}>{sizeLabels[size]}</option>)}</select></label>
          <div className="dashboard-move-controls"><button type="button" disabled={index===0} onClick={()=>move(index,-1)} aria-label={`Move ${definition.label} up`}>↑</button><button type="button" disabled={index===items.length-1} onClick={()=>move(index,1)} aria-label={`Move ${definition.label} down`}>↓</button></div>
        </div>})}
      </div>
      <div className="dashboard-editor-actions"><button type="button" className="secondary-button" onClick={()=>setItems(defaultDashboardOverviewLayout())}>Reset to default</button><span className={state.ok&&!dirty?"form-success":"muted"}>{enabledCount?state.ok&&!dirty?state.message:dirty?"Unsaved changes":"":"Keep at least one widget visible."}</span><button className="primary-button" disabled={pending||!dirty||!enabledCount}>{pending?"Saving…":"Save dashboard"}</button></div>
    </form>
  </details>;
}
