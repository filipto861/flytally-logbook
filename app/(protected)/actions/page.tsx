import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { getPendingActions } from "@/lib/pending-actions";
import { acceptConnectionAction,declineConnectionAction,declineSharedFlightAction } from "./actions";

export const metadata={title:"Actions | FlyTally"};

export default async function ActionsPage(){
  const{userId}=await requireUser(),actions=await getPendingActions(userId);
  return <>
    <header className="page-header"><div><p className="eyebrow">ACTION CENTER</p><h1>Actions</h1><p className="muted page-lead">Only decisions that are still waiting for you. Data-quality problems stay in Needs attention; completed updates stay in Notifications.</p></div><Link className="secondary-link" href="/notifications">Notification history</Link></header>
    {actions.length?<section className="panel"><div className="section-heading"><div><p className="eyebrow">PENDING</p><h2>{actions.length===1?"1 action waiting":`${actions.length} actions waiting`}</h2><p className="muted">Items disappear automatically when their authoritative workflow is accepted, signed, declined, cancelled or superseded.</p></div><span className="status-warning">{actions.length}</span></div><div className="notification-list">
      {actions.map(action=><article className="notification-card unread" key={action.id}><div><span className="eyebrow">{action.kind.replaceAll("_"," ")}</span><strong>{action.title}</strong><p className="muted">{action.body}</p>{action.createdAt?<small>{new Date(action.createdAt).toLocaleString("en-GB")}</small>:null}</div><div className="connection-actions">
        {action.kind==="connection_request"?<><form action={acceptConnectionAction}><input type="hidden" name="connection_id" value={action.entityId}/><button className="primary-button">Accept</button></form><form action={declineConnectionAction}><input type="hidden" name="connection_id" value={action.entityId}/><button className="secondary-button">Decline</button></form></>:<><Link className="primary-button" href={action.href}>{action.primaryLabel}</Link>{action.kind==="shared_flight"?<form action={declineSharedFlightAction.bind(null,action.entityId)}><button className="secondary-button">Decline</button></form>:null}</>}
      </div></article>)}
    </div></section>:<section className="panel"><div className="empty-state"><strong>You’re all caught up</strong><p>No flight invitations, signatures, approvals or connection requests are waiting for you.</p><Link className="secondary-button" href="/notifications">View notifications</Link></div></section>}
  </>;
}
