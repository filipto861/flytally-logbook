import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { clearReadNotifications,declineFlightInvitationFromNotification,deleteNotification,markAllNotificationsRead,markNotificationRead } from "./actions";

export const metadata={title:"Notifications | FlyTally"};
const t=(v:unknown)=>String(v??"");

export default async function NotificationsPage(){
  const{userId}=await requireUser();
  const rows=await sql`SELECT id,kind,title,body,href,created_at,read_at FROM user_notifications WHERE user_id=${userId} ORDER BY created_at DESC LIMIT 100` as Array<Record<string,unknown>>;
  const unread=rows.filter(row=>!row.read_at).length,read=rows.length-unread;
  return <>
    <header className="page-header"><div><p className="eyebrow">INBOX</p><h1>Notifications</h1><p className="muted">Requests, decisions and reminders that need your attention.</p></div><div className="connection-actions">{unread?<form action={markAllNotificationsRead}><button className="secondary-button">Mark all read</button></form>:null}{read?<form action={clearReadNotifications}><button className="secondary-button">Clear read</button></form>:null}</div></header>
    <section className="panel"><div className="notification-list">{rows.map(row=>{const flightInvite=t(row.kind)==="flight_invite"&&/^\/connections\/shared\/\d+$/.test(t(row.href));return <article className={`notification-card${row.read_at?"":" unread"}`} key={t(row.id)}><div><span className="eyebrow">{t(row.kind).replaceAll("_"," ")}</span><strong>{t(row.title)}</strong>{row.body?<p className="muted">{t(row.body)}</p>:null}<small>{new Date(t(row.created_at)).toLocaleString("en-GB")}</small></div><div className="connection-actions">{flightInvite?<><Link className="primary-button" href={t(row.href)}>Review &amp; add</Link><form action={declineFlightInvitationFromNotification}><input type="hidden" name="id" value={t(row.id)}/><button className="secondary-button">Decline</button></form></>:row.href?<Link className="primary-button" href={t(row.href)}>Open</Link>:null}{!row.read_at&&!flightInvite?<form action={markNotificationRead}><input type="hidden" name="id" value={t(row.id)}/><button className="secondary-button">Mark read</button></form>:null}<form action={deleteNotification}><input type="hidden" name="id" value={t(row.id)}/><button className="secondary-button">Delete</button></form></div></article>})}{!rows.length?<p className="empty-state">No notifications yet.</p>:null}</div></section>
  </>;
}
