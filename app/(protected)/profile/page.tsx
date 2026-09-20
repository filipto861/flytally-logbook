import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { EASA_ROLES } from "@/lib/easa-logbook";
import { parsePilotPreferences } from "@/lib/logbook-print";
import { changePassword,deleteAccount,disconnectGoogle,logoutOtherDevices,revokeAllPublicShares,revokeDevice,saveAccountSettings } from "./actions";
import { saveAppearance } from "./appearance-actions";
import { APPEARANCE_OPTIONS,normalizeAppearance } from "@/lib/ui-preferences";
import { InstallAppControl } from "@/components/install-app-control";
import { SettingsWorkspaceNavigation,type SettingsWorkspaceView } from "@/components/settings-workspace-navigation";
import { sql } from "@/lib/db";
import { getAccountPrivacySummary } from "@/lib/privacy-account";
import { resolveAccountEntitlementSnapshot } from "@/lib/entitlement-ledger";
import { PushNotificationSettings } from "@/components/push-notification-controls";
import { PendingActionButton } from "@/components/pending-action-button";

export const metadata={title:"Settings | FlyTally"};
const t=(v:unknown)=>String(v??"");
const resolveView=(value:unknown):SettingsWorkspaceView=>value==="account"||value==="privacy"?value:"general";

function Header({view}:{view:SettingsWorkspaceView}){
  const lead=view==="general"?"Personal details, logbook defaults and app preferences.":view==="account"?"Sign-in methods, devices and FlyTally account access.":"Public sharing, stored-data visibility and account deletion controls.";
  return <><header className="page-header"><div><p className="eyebrow">ACCOUNT</p><h1>Settings</h1><p className="muted page-lead">{lead}</p></div></header><SettingsWorkspaceNavigation active={view}/></>;
}

export default async function ProfilePage({searchParams}:{searchParams:Promise<{view?:string;privacyError?:string}>}){
  const[params,session]=await Promise.all([searchParams,requireUser()]),userId=session.userId,view=resolveView(params.view);

  if(view==="general"){
    const[userRows,settingsRows]=await Promise.all([
      sql`SELECT display_name,email FROM users WHERE id=${userId} LIMIT 1` as Promise<Array<Record<string,unknown>>>,
      sql`SELECT timezone,currency,home_airport,default_role,preferences_json FROM user_settings WHERE user_id=${userId} LIMIT 1` as Promise<Array<Record<string,unknown>>>,
    ]);
    const user=userRows[0]??{},settings=settingsRows[0]??{},preferences=parsePilotPreferences(settings.preferences_json),appearance=normalizeAppearance(preferences.appearance);
    return <div className="ui-page-stack">
      <Header view={view}/>
      <main className="u33-settings-workspace">
        <section className="u33-workspace-heading"><div><p className="eyebrow">GENERAL</p><h2>Personal & logbook defaults</h2><p className="muted">These are everyday defaults for your own logbook. Licence identity and regulatory records stay in Licences & recency.</p></div><Link className="secondary-button" href="/credentials">Open licences</Link></section>
        <form action={saveAccountSettings} className="account-settings-form u33-general-form">
          <div className="profile-grid">
            <section className="panel"><p className="eyebrow">PERSONAL</p><h2>Pilot details</h2><div className="stack-form"><label><span>Name <span className="field-hint" aria-hidden="true">Required</span></span><input name="display_name" defaultValue={t(user.display_name)} required/></label><label>Account email<input type="email" value={t(user.email)} readOnly/><small>Your sign-in identity. Email changes require verification.</small></label></div></section>
            <section className="panel"><p className="eyebrow">LOGBOOK</p><h2>Flight defaults</h2><div className="stack-form"><label>Home airport<input name="home_airport" defaultValue={t(settings.home_airport)} placeholder="LKLT"/></label><label>Default role<select name="default_role" defaultValue={t(settings.default_role)||"PIC"}>{EASA_ROLES.map(role=><option key={role} value={role}>{role}</option>)}</select></label><label>Default logbook<select name="default_evidence" defaultValue={t(preferences.default_evidence)||"ULL"}><option>ULL</option><option>EASA</option></select></label><label>Currency<select name="currency" defaultValue={t(settings.currency)||"CZK"}><option>CZK</option><option>EUR</option><option>USD</option><option>GBP</option></select></label><label>Time zone<input name="timezone" defaultValue={t(settings.timezone)||"Europe/Prague"}/><small>Screen dates use this zone. Official FCL.050 flight times remain UTC.</small></label></div></section>
          </div>
          <div className="settings-save"><span>Personal details and flight defaults are saved together.</span><PendingActionButton className="primary-button" pendingLabel="Saving…">Save changes</PendingActionButton></div>
        </form>

        <section className="u33-preference-grid">
          <section className="panel u33-preference-card"><div><p className="eyebrow">APPEARANCE</p><h2>Theme</h2><p className="muted">Choose how FlyTally follows your device or a fixed light/dark appearance.</p></div><form action={saveAppearance} className="appearance-form"><label>Appearance<select name="appearance" defaultValue={appearance}>{APPEARANCE_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label><PendingActionButton className="primary-button" pendingLabel="Saving…">Save appearance</PendingActionButton></form></section>
          <section className="panel install-app-panel u33-preference-card"><div><p className="eyebrow">APP</p><h2>Install FlyTally</h2><p className="muted">Install FlyTally as a standalone app on this device.</p></div><InstallAppControl/></section>
          <PushNotificationSettings/>
        </section>
      </main>
    </div>;
  }

  if(view==="account"){
    const[auth,sessions,access]=await Promise.all([
      sql`SELECT EXISTS(SELECT 1 FROM auth_identities WHERE user_id=${userId} AND provider='google') google_linked,EXISTS(SELECT 1 FROM user_credentials WHERE user_id=${userId}) has_password` as Promise<Array<Record<string,unknown>>>,
      sql`SELECT id,created_at,last_seen_at,expires_at,user_agent FROM auth_sessions WHERE user_id=${userId} AND revoked_at IS NULL AND expires_at>NOW() ORDER BY last_seen_at DESC` as Promise<Array<Record<string,unknown>>>,
      resolveAccountEntitlementSnapshot(userId,session.role),
    ]);
    const googleLinked=Boolean(auth[0]?.google_linked),hasPassword=Boolean(auth[0]?.has_password),stageLabel=access.stage==="external-validation"?"External commercial validation":access.stage==="commercial"?"Commercial":"Private beta",logbookAccess=access.grants.find(item=>item.key==="logbook.access"),trainingAccess=access.grants.find(item=>item.key==="training.access");
    return <div className="ui-page-stack">
      <Header view={view}/>
      <main className="u33-settings-workspace">
        <section className="u33-workspace-heading"><div><p className="eyebrow">ACCOUNT & SECURITY</p><h2>Sign-in and devices</h2><p className="muted">Manage how you sign in and revoke sessions you no longer use.</p></div></section>
        <section className="panel u33-security-panel">
          <div className="security-grid">
            <section><p className="eyebrow">SIGN-IN METHOD</p><h3>Google account</h3><p className="muted">{googleLinked?"Connected. You can use Google to sign in.":"Connect Google after signing in once with your existing password."}</p>{googleLinked?<form action={disconnectGoogle}><PendingActionButton className="secondary-button" disabled={!hasPassword} pendingLabel="Disconnecting…">Disconnect Google</PendingActionButton>{!hasPassword?<small>Add a password before disconnecting your only sign-in method.</small>:null}</form>:<a className="google-button compact" href="/api/auth/google/start?intent=link"><span aria-hidden="true">G</span>Connect Google</a>}</section>
            {hasPassword?<section><p className="eyebrow">PASSWORD</p><h3>Change password</h3><form action={changePassword} className="stack-form narrow-form"><label>Current password<input type="password" name="current_password" autoComplete="current-password" required/></label><label>New password<input type="password" name="new_password" minLength={12} maxLength={128} autoComplete="new-password" required/><small>At least 12 characters.</small></label><label>Confirm new password<input type="password" name="confirm_password" minLength={12} maxLength={128} autoComplete="new-password" required/></label><PendingActionButton className="primary-button" pendingLabel="Updating…">Change password</PendingActionButton></form></section>:null}
          </div>
        </section>

        <section className="panel session-section u33-session-panel"><div className="section-heading"><div><p className="eyebrow">DEVICES</p><h2>Active sessions</h2><p className="muted">Sign out devices you no longer use.</p></div>{sessions.length>1?<form action={logoutOtherDevices}><PendingActionButton className="secondary-button" pendingLabel="Signing out…">Sign out other devices</PendingActionButton></form>:null}</div><div className="session-list">{sessions.map(item=><div key={t(item.id)}><span><strong>{t(item.id)===session.sessionId?"This device":"Signed-in device"}</strong><small>{t(item.user_agent)||"Unknown browser"}</small><small>Last active {new Date(t(item.last_seen_at)).toLocaleString("en-GB")}</small></span>{t(item.id)!==session.sessionId?<form action={revokeDevice}><input type="hidden" name="session_id" value={t(item.id)}/><PendingActionButton className="icon-danger" pendingLabel="Signing out…">Sign out</PendingActionButton></form>:<span className="status-on">Current</span>}</div>)}</div></section>

        <details className="panel u33-access-details"><summary><span><strong>FlyTally access</strong><small>Entitlements and current commercial release stage</small></span><span aria-hidden="true">⌄</span></summary><div className="u33-access-body"><div className="security-grid"><section><h3>Logbook</h3><p className="muted">{logbookAccess?`Access enabled · ${logbookAccess.source}`:"No active entitlement."}</p></section><section><h3>Training</h3><p className="muted">{trainingAccess?`Access enabled · ${trainingAccess.source}`:"No active entitlement."}</p></section></div><p className="muted"><strong>Release stage:</strong> {stageLabel}. <strong>Billing provider:</strong> not configured. FlyTally does not currently store a payment method or charge this account.</p><Link className="secondary-button" href="/legal/commercial">Commercial launch info</Link></div></details>
      </main>
    </div>;
  }

  const privacy=await getAccountPrivacySummary(userId);
  return <div className="ui-page-stack">
    <Header view={view}/>
    <main className="u33-settings-workspace">
      <section className="u33-workspace-heading"><div><p className="eyebrow">PRIVACY</p><h2>Your data controls</h2><p className="muted">Control public sharing, review what FlyTally stores and manage account deletion.</p></div><Link className="secondary-button" href="/legal/privacy">Privacy notice</Link></section>
      {params.privacyError==="training-erasure"?<p className="u33-privacy-error" role="alert">Account deletion was not completed because Training-progress erasure could not be confirmed. Your FlyTally account remains active; try again or use the privacy contact in the Privacy notice.</p>:null}

      <section className="u33-privacy-grid">
        <section className="panel"><p className="eyebrow">PUBLIC SHARING</p><h2>Flight links</h2><p className="muted">{privacy.activePublicShares?`${privacy.activePublicShares} active public flight ${privacy.activePublicShares===1?"link":"links"}.`:"No active public flight links."} Revoked share metadata is automatically removed after 30 days.</p>{privacy.activePublicShares?<form action={revokeAllPublicShares}><PendingActionButton className="secondary-button" pendingLabel="Revoking…">Revoke all public links</PendingActionButton></form>:<span className="status-on">No public links</span>}</section>
        <section className="panel"><p className="eyebrow">BACKUP & RECOVERY</p><h2>Portable copy & recovery</h2><p className="muted">Download complete account backups, create recovery points or restore deleted data from the dedicated Print & data workspace.</p><Link className="primary-button" href="/data?view=recovery">Open Backup & restore</Link></section>
      </section>

      <details className="panel u33-data-footprint"><summary><span><strong>Stored data summary</strong><small>See the account data currently retained by FlyTally</small></span><span aria-hidden="true">⌄</span></summary><div className="u33-footprint-body"><div className="u33-footprint-grid"><div><span>Stored backups</span><b>{privacy.storedBackups}</b></div><div><span>GPS tracks</span><b>{privacy.gpsTracks}</b></div><div><span>Expenses</span><b>{privacy.expenses}</b></div><div><span>Deleted-flight copies</span><b>{privacy.deletedFlightCopies}</b></div><div><span>Flight records</span><b>{privacy.coreFlightRecords}</b></div><div><span>FSTD records</span><b>{privacy.fstdRecords}</b></div><div><span>Signed evidence</span><b>{privacy.signedEvidence}</b></div></div><p className="muted">Historical flight/FSTD records and signed integrity evidence have separate retention rules because they can form part of aviation evidence.</p></div></details>

      <details className="panel danger-zone u33-delete-account"><summary>Delete account…</summary><form action={deleteAccount} className="stack-form"><p className="muted">Deletion first erases your FlyTally Training learner progress. Only after Training confirms that erasure does FlyTally remove sign-in access, public links and their metadata, stored backups, GPS tracks, expenses, live licences/documents, recency evidence, aircraft/rates/settings and recovery trash. If the Training erasure cannot be confirmed, account deletion does not proceed. Historical flight/FSTD records plus signed or approved integrity evidence remain attached to a pseudonymised “Deleted pilot” identity so existing aviation evidence and other pilots’ signed records are not silently destroyed.</p><p className="muted">For a broader erasure request, including review of retained aviation evidence, use the privacy contact in the Privacy notice.</p><label>Type DELETE MY ACCOUNT<input name="confirm" required pattern="DELETE MY ACCOUNT"/></label><PendingActionButton className="icon-danger" pendingLabel="Deleting…">Delete my account</PendingActionButton></form></details>
    </main>
  </div>;
}
