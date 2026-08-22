import { flightAuditChanges,type FlightAuditEvent } from "@/lib/flight-audit";

const actionLabel=(action:FlightAuditEvent["action"])=>action==="created"?"Flight created":action==="deleted"?"Flight deleted":"Flight updated";
const timestamp=(value:string)=>{const date=new Date(value);return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Prague"}).format(date)};

export function FlightAuditPanel({events}:{events:FlightAuditEvent[]}){
  return <details className="panel flight-audit-panel"><summary><span>Change history</span><small>{events.length} recorded {events.length===1?"event":"events"}</small></summary>
    {events.length?<div className="flight-audit-list">{events.map(event=>{const changes=flightAuditChanges(event.oldData,event.newData);return <article key={event.id}><header><div><strong>{actionLabel(event.action)}</strong><small>{event.actor} · {timestamp(event.changedAt)}</small></div><span className={`audit-action ${event.action}`}>{event.action}</span></header>{changes.length?<div className="audit-changes">{changes.map(change=><div key={change.field}><b>{change.label}</b>{event.action!=="created"?<del>{change.before}</del>:null}{event.action!=="deleted"?<ins>{change.after}</ins>:null}</div>)}</div>:<p className="muted">The record state was saved without visible field changes.</p>}</article>})}</div>:<p className="empty-state">History begins after the audit upgrade. Existing flights are not modified.</p>}
  </details>;
}
