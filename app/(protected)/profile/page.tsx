import { requireUser } from "@/lib/auth/require-user";
import { getProfileData } from "@/lib/data/profile";
import { EASA_ROLES } from "@/lib/easa-logbook";
import { licenceProfileMap,parsePilotPreferences } from "@/lib/logbook-print";
import { addExpiry,addLicence,changePassword,deleteExpiry,saveAccountSettings,saveLicence,toggleExpiry } from "./actions";
import { LicenceSaveForm } from "@/components/licence-save-form";
import { InstallAppControl } from "@/components/install-app-control";

export const metadata={title:"Settings | FlyTally"};
const t=(v:unknown)=>String(v??"");
const cleanText=(v:unknown)=>{const value=t(v).trim();return /^(nan|null|undefined)$/i.test(value)?"":value;};
function expiryState(value:unknown,warning:unknown){const days=Math.ceil((new Date(t(value)).getTime()-Date.now())/86400000);return {days,label:days<0?`Expired ${Math.abs(days)} days ago`:days===0?'Expires today':days<=Number(warning||30)?`Expires in ${days} days`:`Valid · ${days} days`,className:days<0?'expired':days<=Number(warning||30)?'warning':'valid'};}

export default async function ProfilePage(){
  const {userId}=await requireUser();
  const d=await getProfileData(userId),preferences=parsePilotPreferences(d.settings.preferences_json),profiles=licenceProfileMap(preferences);
  const licences=d.expiries.filter(e=>t(e.category).toUpperCase()==="LICENCE"),otherExpiries=d.expiries.filter(e=>t(e.category).toUpperCase()!=="LICENCE");
  return <>
    <header className="page-header"><div><p className="eyebrow">ACCOUNT</p><h1>Settings</h1><p className="muted">Manage your profile, logbook defaults, licences and account security.</p></div></header>
    <nav className="settings-nav" aria-label="Settings sections"><a href="#profile">Profile & defaults</a><a href="#licences">Licences & validity</a><a href="#app">App</a><a href="#security">Security</a></nav>

    <form action={saveAccountSettings} className="account-settings-form" id="profile">
      <div className="profile-grid">
        <section className="panel"><p className="eyebrow">PERSONAL</p><h2>Pilot details</h2><div className="stack-form"><label>Name<input name="display_name" defaultValue={t(d.user.display_name)} required/></label><label>Account email<input name="email" type="email" defaultValue={t(d.user.email)} required/><small>This is the email associated with your FlyTally account.</small></label></div></section>
        <section className="panel"><p className="eyebrow">APPLICATION</p><h2>Logbook defaults</h2><div className="stack-form"><label>Home airport<input name="home_airport" defaultValue={t(d.settings.home_airport)} placeholder="LKLT"/></label><label>Default role<select name="default_role" defaultValue={t(d.settings.default_role)||'PIC'}>{EASA_ROLES.map(role=><option key={role} value={role}>{role}</option>)}</select></label><label>Default logbook<select name="default_evidence" defaultValue={t(preferences.default_evidence)||'ULL'}><option>ULL</option><option>EASA</option></select></label><label>Currency<select name="currency" defaultValue={t(d.settings.currency)||'CZK'}><option>CZK</option><option>EUR</option><option>USD</option><option>GBP</option></select></label><label>Time zone<input name="timezone" defaultValue={t(d.settings.timezone)||'Europe/Prague'}/><small>Screen dates use this zone. Official FCL.050 flight times remain UTC.</small></label></div></section>
      </div>
      <div className="settings-save"><span>Profile and defaults are saved together.</span><button className="primary-button">Save changes</button></div>
    </form>

    <section className="panel expiry-panel" id="licences">
      <div className="section-heading"><div><p className="eyebrow">LICENCES</p><h2>Licences & logbook identity</h2><p className="muted">Licence identity and validity used by the matching printable logbook.</p></div></div>
      <div className="credential-list">{licences.map(e=>{
        const state=expiryState(e.expiry_date,e.warning_days),meta=profiles[t(e.id)]??{},scope=t(meta.scope)||"EASA",legacyNumber=scope==="ULL"?t(preferences.ull_licence_number):t(preferences.easa_licence_number)||t(preferences.licence_number),legacyAddress=scope==="ULL"?t(preferences.ull_address):t(preferences.easa_address)||t(preferences.pilot_address),licenceNumber=t(meta.number)||legacyNumber;
        return <details key={t(e.id)} className={`credential-card ${state.className}${Number(e.active)?'':' inactive'}`}>
          <summary className="credential-summary"><div className="credential-main"><span>{scope} licence</span><strong>{t(e.label)}</strong><small>{licenceNumber||'Licence number missing'}</small></div><div className="credential-validity"><b>{new Date(`${t(e.expiry_date)}T00:00:00`).toLocaleDateString('en-GB')}</b><small>{state.label}</small></div><span className="credential-chevron" aria-hidden="true">⌄</span></summary>
          <div className="credential-editor"><LicenceSaveForm action={saveLicence} className="form-grid settings-grid"><input type="hidden" name="id" value={t(e.id)}/><label>Licence / certificate<input name="label" defaultValue={t(e.label)} required/></label><label>Logbook<select name="logbook_scope" defaultValue={scope}><option>EASA</option><option>ULL</option><option value="OTHER">Other / not used in header</option></select></label><label>Licence number<input name="licence_number" defaultValue={licenceNumber} required/></label><label>Valid until<input type="date" name="expiry_date" defaultValue={t(e.expiry_date).slice(0,10)} required/></label><label>Warning<input type="number" name="warning_days" defaultValue={t(e.warning_days)||"30"} min="1" max="365"/></label><label className="wide">Holder address<textarea name="holder_address" rows={2} defaultValue={t(meta.address)||legacyAddress}/></label><label className="wide">Notes<input name="note" defaultValue={cleanText(e.note)}/></label><div className="form-actions wide"><button className="primary-button">Save licence</button></div></LicenceSaveForm><div className="credential-record-actions"><form action={toggleExpiry}><input type="hidden" name="id" value={t(e.id)}/><button className="secondary-link">{Number(e.active)?'Archive licence':'Activate licence'}</button></form><details className="confirm-action"><summary>Delete…</summary><div><p>This permanently removes the licence and its printable-logbook identity.</p><form action={deleteExpiry}><input type="hidden" name="id" value={t(e.id)}/><button className="icon-danger">Delete permanently</button></form></div></details></div></div>
        </details>;
      })}{!licences.length?<p className="empty-state">No licences yet.</p>:null}</div>
      <details className="credential-create"><summary>Add licence</summary><form action={addLicence} className="form-grid settings-grid"><label>Licence / certificate<input name="label" placeholder="e.g. LAPL(A), PPL(A), ULL pilot licence" required/></label><label>Logbook<select name="logbook_scope" defaultValue="EASA"><option>EASA</option><option>ULL</option><option value="OTHER">Other / not used in logbook header</option></select></label><label>Licence number<input name="licence_number" required placeholder="Licence / certificate number"/></label><label>Valid until<input type="date" name="expiry_date" required/></label><label>Warning<input type="number" name="warning_days" defaultValue="30" min="1" max="365"/><small>Days before expiry.</small></label><label className="wide">Holder address<textarea name="holder_address" rows={2} placeholder="Address printed with this licence"/></label><label className="wide">Notes<input name="note" placeholder="Optional notes"/></label><div className="form-actions wide"><button className="primary-button">Add licence</button></div></form></details>
    </section>

    <section className="panel expiry-panel">
      <div className="section-heading"><div><p className="eyebrow">EXPIRIES</p><h2>Other documents and qualifications</h2><p className="muted">Medical, ratings, language proficiency and other validity items.</p></div></div>
      <div className="credential-list">{otherExpiries.map(e=>{
        const state=expiryState(e.expiry_date,e.warning_days),note=cleanText(e.note);
        return <details key={t(e.id)} className={`credential-card ${state.className}${Number(e.active)?'':' inactive'}`}>
          <summary className="credential-summary"><div className="credential-main"><span>{cleanText(e.category)||'Document'}</span><strong>{cleanText(e.label)||'Untitled record'}</strong><small>{note||'\u00A0'}</small></div><div className="credential-validity"><b>{new Date(`${t(e.expiry_date)}T00:00:00`).toLocaleDateString('en-GB')}</b><small>{state.label}</small></div><span className="credential-chevron" aria-hidden="true">⌄</span></summary>
          <div className="credential-editor credential-action-editor"><div><p className="eyebrow">RECORD ACTIONS</p><p className="muted">Archive this item when it is no longer current. Permanent deletion requires a second step.</p></div><div className="credential-record-actions"><form action={toggleExpiry}><input type="hidden" name="id" value={t(e.id)}/><button className="secondary-link">{Number(e.active)?'Archive record':'Activate record'}</button></form><details className="confirm-action"><summary>Delete…</summary><div><p>This permanently removes this validity record.</p><form action={deleteExpiry}><input type="hidden" name="id" value={t(e.id)}/><button className="icon-danger">Delete permanently</button></form></div></details></div></div>
        </details>;
      })}{!otherExpiries.length?<p className="empty-state">No other expiry records.</p>:null}</div>
      <details className="credential-create"><summary>Add document or qualification</summary><form action={addExpiry} className="inline-editor"><select name="category"><option>Document</option><option>Medical</option><option>Qualification</option><option>Insurance</option></select><input name="label" placeholder="Name" required/><label>Valid until<input type="date" name="expiry_date" required/></label><input type="number" name="warning_days" defaultValue="30" placeholder="Warning days"/><input name="note" placeholder="Notes"/><button className="primary-button">Add</button></form></details>
    </section>

    <section className="panel install-app-panel" id="app"><div><p className="eyebrow">APP</p><h2>Install FlyTally</h2><p className="muted">Install FlyTally as a standalone app on this device. Installation prompts will not cover other pages.</p></div><InstallAppControl/></section>
    <details className="panel security-panel" id="security"><summary>Account security</summary><form action={changePassword} className="stack-form narrow-form"><label>Current password<input type="password" name="current_password" autoComplete="current-password" required/></label><label>New password<input type="password" name="new_password" minLength={10} autoComplete="new-password" required/></label><label>Confirm new password<input type="password" name="confirm_password" minLength={10} autoComplete="new-password" required/></label><button className="primary-button">Change password</button></form></details>
  </>;
}
