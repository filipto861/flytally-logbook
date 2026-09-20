import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { clearReadNotifications,declineFlightInvitationFromNotification,deleteNotification,markAllNotificationsRead,markNotificationRead } from "./actions";
import styles from "./notifications.module.css";
import { PushNotificationInline } from "@/components/push-notification-controls";
import { NotificationMutationForm } from "@/components/notification-mutation-form";
import { PendingActionButton } from "@/components/pending-action-button";
import { formatLocalDateTime } from "@/lib/display-format";
import { getUserTimezone } from "@/lib/data/user-settings";

export const metadata={title:"Notifications | FlyTally"};
const t=(v:unknown)=>String(v??"");

export default async function NotificationsPage(){
  const{userId}=await requireUser();
  const[rows,timeZone]=await Promise.all([
    sql`SELECT n.id,n.kind,n.title,n.body,n.href,n.created_at,n.read_at,p.id participation_id,p.status request_status,p.participant_role,p.participant_flight_id,own.certified_at participant_certified_at
      FROM user_notifications n
      LEFT JOIN flight_participations p ON n.href=('/connections/shared/'||p.id::text) AND p.participant_user_id=${userId}
      LEFT JOIN flights own ON own.id=p.participant_flight_id AND own.user_id=${userId}
      WHERE n.user_id=${userId} ORDER BY n.created_at DESC LIMIT 100` as Promise<Array<Record<string,unknown>>>,
    getUserTimezone(userId),
  ]);
  const unread=rows.filter(row=>!row.read_at).length,read=rows.length-unread;
  return <div className={`${styles.inbox} ui-page-stack`}>
    <header className="page-header"><div><p className="eyebrow">INBOX</p><h1>Notifications</h1><p className="muted">Updates, completed decisions and reminders. Anything still waiting for your decision is collected in Actions.</p></div><div className="connection-actions"><Link className="secondary-button" href="/actions">Open actions</Link>{unread?<NotificationMutationForm action={markAllNotificationsRead}><PendingActionButton className="secondary-button" pendingLabel="Marking…">Mark all read</PendingActionButton></NotificationMutationForm>:null}{read?<NotificationMutationForm action={clearReadNotifications}><PendingActionButton className="secondary-button" pendingLabel="Clearing…">Clear read</PendingActionButton></NotificationMutationForm>:null}</div></header>
    <PushNotificationInline context="updates"/>
    <section className="panel"><div className="notification-list">{rows.map(row=>{
      const requestKind=["flight_request","flight_invite","signature_request"].includes(t(row.kind))&&Boolean(row.participation_id),status=t(row.request_status).toLowerCase(),pending=requestKind&&status==="pending",instructor=t(row.participant_role).toUpperCase()==="INSTRUCTOR";
      const workflowStatus=!requestKind?"":row.participant_flight_id?(row.participant_certified_at?"CERTIFIED":"ADDED"):status==="accepted"?"ACCEPTED":status==="declined"?"DECLINED":status==="cancelled"?"CANCELLED":"PENDING";
      return <article className={`notification-card${row.read_at?"":" unread"}`} key={t(row.id)}><div><span className="eyebrow">{t(row.kind).replaceAll("_"," ")}</span><strong>{t(row.title)}</strong>{row.body?<p className="muted">{t(row.body)}</p>:null}<small>{formatLocalDateTime(t(row.created_at),timeZone)}{workflowStatus?` · ${workflowStatus}`:""}</small></div><div className="connection-actions">{pending?<><Link className="primary-button" href={t(row.href)}>{instructor?"Review & sign":"Review & add"}</Link><NotificationMutationForm action={declineFlightInvitationFromNotification}><input type="hidden" name="id" value={t(row.id)}/><PendingActionButton className="secondary-button" pendingLabel="Declining…">Decline</PendingActionButton></NotificationMutationForm></>:row.href?<Link className="primary-button" href={t(row.href)}>Open</Link>:null}{!row.read_at&&!pending?<NotificationMutationForm action={markNotificationRead}><input type="hidden" name="id" value={t(row.id)}/><PendingActionButton className="secondary-button" pendingLabel="Marking…">Mark read</PendingActionButton></NotificationMutationForm>:null}<NotificationMutationForm action={deleteNotification}><input type="hidden" name="id" value={t(row.id)}/><PendingActionButton className="secondary-button" pendingLabel="Deleting…">Delete</PendingActionButton></NotificationMutationForm></div></article>})}{!rows.length?<p className="empty-state">No notifications yet.</p>:null}</div></section>
  </div>;
}
