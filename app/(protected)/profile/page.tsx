import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { getProfileData } from "@/lib/data/profile";
import { EASA_ROLES } from "@/lib/easa-logbook";
import { parsePilotPreferences } from "@/lib/logbook-print";
import { changePassword,deleteAccount,disconnectGoogle,logoutOtherDevices,revokeDevice,saveAccountSettings } from "./actions";
import { InstallAppControl } from "@/components/install-app-control";
import { sql } from "@/lib/db";

export const metadata={title:"Settings | FlyTally"};
const t=(v:unknown)=>String(v??"");

export default async function ProfilePage(){
  const session=await requireUser(),userId=session.userId;
  const[d,auth,sessions]=await Promise.all([
    getProfileData(userId),
    sql`SELECT EXISTS(SELECT 1 FROM auth_identities WHERE user_id=${userId} AND provider='google') google_linked,EXISTS(SELECT 1 FROM user_credentials WHERE user_id=${userId}) has_password` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT id,created_at,last_seen_at,expires_at,user_agent FROM auth_sessions WHERE user_id=${userId} AND revoked_at IS NULL AND expires_at>NOW() ORDER BY last_seen_at DESC` as Promise<Array<Record<string,unknown>>>,
  ]);
  const preferences=parsePilotPreferences(d.settings.preferences_json),googleLinked=Boolean(auth[0]?.google_linked),hasPassword=Boolean(auth[0]?.has_password);
  return <>
    <header className="page-header"><div><p className="eyebrow">ACCOUNT</p><h1>Settings</h1><p className="muted">Profile defaults, app installation and account security.</p></div><Link className="primary-link" href="/credentials">Open credentials</Link></header>
    <nav className="settings-nav" aria-label="Settings sections"><a href="#profile">Profile & defaults</a><a href="#app">App</a><a href="#security">Security</a></nav>

    <form action={saveAccountSettings} className="account-settings-form" id="profile">
      <div className="profile-grid">
        <section className="panel"><p className="eyebrow">PERSONAL</p><h2>Pilot details</h2><div className="stack-form"><label>Name<input name="display_name" defaultValue={t(d.user.display_name)} required/></label><label>Account email<input type="email" value={t(d.user.email)} readOnly/><small>Your sign-in identity. Email changes require verification.</small></label></div></section>
        <section className="panel"><p className="eyebrow">APPLICATION</p><h2>Logbook defaults</h2><div className="stack-form"><label>Home airport<input name="home_airport" defaultValue={t(d.settings.home_airport)} placeholder="LKLT"/></label><label>Default role<select name="default_role" defaultValue={t(d.settings.default_role)||'PIC'}>{EASA_ROLES.map(role=><option key={role} value={role}>{role}</option>)}</select></label><label>Default logbook<select name="default_evidence" defaultValue={t(preferences.default_evidence)||'ULL'}><option>ULL</option><option>EASA</option></select></label><label>Currency<select name="currency" defaultValue={t(d.settings.currency)||'CZK'}><option>CZK</option><option>EUR</option><option>USD</option><option>GBP</option></select></label><label>Time zone<input name="timezone" defaultValue={t(d.settings.timezone)||'Europe/Prague'}/><small>Screen dates use this zone. Official FCL.050 flight times remain UTC.</small></label></div></section>
      </div>
      <div className="settings-save"><span>Profile and defaults are saved together.</span><button className="primary-button">Save changes</button></div>
    </form>

    <section className="panel"><div className="section-heading"><div><p className="eyebrow">CREDENTIALS</p><h2>Licences, qualifications & documents</h2><p className="muted">Logbook identity, licence validity, signing credentials, medical, ICAO language proficiency and other documents now live in one dedicated section.</p></div><Link className="primary-button" href="/credentials">Manage credentials</Link></div></section>

    <section className="panel install-app-panel" id="app"><div><p className="eyebrow">APP</p><h2>Install FlyTally</h2><p className="muted">Install FlyTally as a standalone app on this device. Installation prompts will not cover other pages.</p></div><InstallAppControl/></section>
    <details className="panel security-panel" id="security" open><summary>Account security</summary><div className="security-grid"><section><p className="eyebrow">SIGN-IN METHODS</p><h3>Google account</h3><p className="muted">{googleLinked?"Connected. You can use Google to sign in.":"Connect Google after signing in once with your existing password."}</p>{googleLinked?<form action={disconnectGoogle}><button className="secondary-button" disabled={!hasPassword}>Disconnect Google</button>{!hasPassword?<small>Add a password before disconnecting your only sign-in method.</small>:null}</form>:<a className="google-button compact" href="/api/auth/google/start?intent=link"><span aria-hidden="true">G</span>Connect Google</a>}</section>{hasPassword?<section><p className="eyebrow">PASSWORD</p><h3>Change password</h3><form action={changePassword} className="stack-form narrow-form"><label>Current password<input type="password" name="current_password" autoComplete="current-password" required/></label><label>New password<input type="password" name="new_password" minLength={12} maxLength={128} autoComplete="new-password" required/><small>At least 12 characters.</small></label><label>Confirm new password<input type="password" name="confirm_password" minLength={12} maxLength={128} autoComplete="new-password" required/></label><button className="primary-button">Change password</button></form></section>:null}</div><section className="session-section"><div className="section-heading"><div><p className="eyebrow">DEVICES</p><h3>Active sessions</h3><p className="muted">Revoke access from a device you no longer use.</p></div>{sessions.length>1?<form action={logoutOtherDevices}><button className="secondary-button">Sign out other devices</button></form>:null}</div><div className="session-list">{sessions.map(item=><div key={t(item.id)}><span><strong>{t(item.id)===session.sessionId?"This device":"Signed-in device"}</strong><small>{t(item.user_agent)||"Unknown browser"}</small><small>Last active {new Date(t(item.last_seen_at)).toLocaleString("en-GB")}</small></span>{t(item.id)!==session.sessionId?<form action={revokeDevice}><input type="hidden" name="session_id" value={t(item.id)}/><button className="icon-danger">Sign out</button></form>:<span className="status-on">Current</span>}</div>)}</div></section></details>
    <details className="panel danger-zone"><summary>Delete account…</summary><form action={deleteAccount} className="stack-form"><p className="muted">Sign-in access and future sharing are revoked. Historical signed evidence remains under a deleted-pilot identity.</p><label>Type DELETE MY ACCOUNT<input name="confirm" required pattern="DELETE MY ACCOUNT"/></label><button className="icon-danger">Delete my account</button></form></details>
  </>;
}
