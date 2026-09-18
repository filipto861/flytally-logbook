import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { clearReadNotifications,declineFlightInvitationFromNotification,deleteNotification,markAllNotificationsRead,markNotificationRead } from "./actions";
import styles from "./notifications.module.css";

export const metadata={title:"Notifications | FlyTally"};
const t=(v:unknown)=>String(v??"");

export default async function NotificationsPage(){
  const{userId}=await requireUser();
  const rows=await sql`SELECT n.id,n.kind,n.title,n.body,n.href,n.created_at,n.read_at,p.id participation_id,p.status request_status,p.participant_role,p.participant_flight_id,own.certified_at participant_certified_at
    FROM user_notifications n
    LEFT JOIN flight_participations p ON n.href=('/connections/shared/'||p.id::text) AND p.participant_user_id=${userId}
    LEFT JOIN flights own ON own.id=p.participant_flight_id AND own.user_id=${userId}
    WHERE n.user_id=${userId} ORDER BY n.created_at DESC LIMIT 100` as Array<Record<string,unknown>>;
  const unread=rows.filter(row=>!row.read_at).length,read=rows.length-unread;
  return <div className={styles.inbox}>
    <header className="page-header"><div><p className="eyebrow">INBOX</p><h1>Notifications</h1><p className="muted">Updates, completed decisions and reminders. Anything still waiting for your decision is collected in Actions.</p></div><div className="connection-actions"><Link className="secondary-button" href="/actions">Open actions</Link>{unread?<form action={markAllNotificationsRead}><button className="secondary-button">Mark all read</button></form>:null}{read?<form action={clearReadNotifications}><button className="secondary-button">Clear read</button></form>:null}</div></header>
    <section className="panel"><div className="notification-list">{rows.map(row=>{
      const requestKind=["flight_request","flight_invite","signature_request"].includes(t(row.kind))&&Boolean(row.participation_id),status=t(row.request_status).toLowerCase(),pending=requestKind&&status==="pending",instructor=t(row.participant_role).toUpperCase()==="INSTRUCTOR";
      const workflowStatus=!requestKind?"":row.participant_flight_id?(row.participant_certified_at?"CERTIFIED":"ADDED"):status==="accepted"?"ACCEPTED":status==="declined"?"DECLINED":status==="cancelled"?"CANCELLED":"PENDING";
      return <article className={`notification-card${row.read_at?"":" unread"}`} key={t(row.id)}><div><span className="eyebrow">{t(row.kind).replaceAll("_"," ")}</span><strong>{t(row.title)}</strong>{row.body?<p className="muted">{t(row.body)}</p>:null}<small>{new Date(t(row.created_at)).toLocaleString("en-GB")}{workflowStatus?` · ${workflowStatus}`:""}</small></div><div className="connection-actions">{pending?<><Link className="primary-button" href={t(row.href)}>{instructor?"Review & sign":"Review & add"}</Link><form action={declineFlightInvitationFromNotification}><input type="hidden" name="id" value={t(row.id)}/><button className="secondary-button">Decline</button></form></>:row.href?<Link className="primary-button" href={t(row.href)}>Open</Link>:null}{!row.read_at&&!pending?<form action={markNotificationRead}><input type="hidden" name="id" value={t(row.id)}/><button className="secondary-button">Mark read</button></form>:null}<form action={deleteNotification}><input type="hidden" name="id" value={t(row.id)}/><button className="secondary-button">Delete</button></form></div></article>})}{!rows.length?<p className="empty-state">No notifications yet.</p>:null}</div></section>
  </div>;
}
