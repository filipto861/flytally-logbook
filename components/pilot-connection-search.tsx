"use client";
import { useActionState } from "react";
import { requestConnection,searchPilot,type ConnectionRequestState,type PilotSearchState } from "@/app/(protected)/connections/actions";

function RequestForm({pilot}:{pilot:NonNullable<PilotSearchState["result"]>}){
  const[state,action,pending]=useActionState<ConnectionRequestState,FormData>(requestConnection,{});
  if(pilot.connected)return <p className="connection-notice">A connection or pending request already exists with this pilot.</p>;
  if(state.sent)return <p className="connection-success" role="status">Connection request sent.</p>;
  return <form action={action} className="connection-request-form"><input type="hidden" name="target_user_id" value={pilot.id}/><input type="hidden" name="target_email" value={pilot.email}/><label>Relationship<select name="relationship" defaultValue="pilot"><option value="pilot">Fellow pilot</option><option value="requester_instructor">I am their instructor</option><option value="recipient_instructor">They are my instructor</option></select></label>{state.error?<p className="form-error" role="alert">{state.error}</p>:null}<button className="primary-button" disabled={pending}>{pending?"Sending…":"Send request"}</button></form>;
}

export function PilotConnectionSearch(){
  const[state,action,pending]=useActionState<PilotSearchState,FormData>(searchPilot,{});
  return <div className="connection-search"><form action={action} className="stack-form"><label>Pilot email<input type="email" name="email" autoComplete="off" required placeholder="pilot@example.com"/></label><small>Search requires the complete email address. FlyTally does not publish a pilot directory.</small><button className="primary-button" disabled={pending}>{pending?"Searching…":"Find pilot"}</button></form>{state.error?<p className="form-error" role="alert">{state.error}</p>:null}{state.result?<div className="connection-search-result"><div className="pilot-avatar" aria-hidden="true">{state.result.name.trim().slice(0,1).toUpperCase()||"P"}</div><div><strong>{state.result.name}</strong><small>{state.result.homeAirport?`Home airport ${state.result.homeAirport}`:"Home airport not set"}</small></div><RequestForm pilot={state.result}/></div>:null}</div>;
}
