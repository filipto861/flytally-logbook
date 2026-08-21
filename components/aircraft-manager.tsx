import { BILLING_SHARES,parseBilling } from "@/lib/billing";

type AircraftRecord=Record<string,unknown>;
type Action=(form:FormData)=>Promise<void>;

const t=(value:unknown)=>String(value??"");
const classes=["ULL","SEP","TMG","MEP","SET","OTHER","GLIDER"];
const evidence=["ULL","EASA"];
const roles=["PIC","DUAL","INSTRUKTOR","SAFETY PILOT","CO-PILOT","PAX","OBSERVER"];

function AircraftFields({aircraft}:{aircraft?:AircraftRecord}){
  const billing=parseBilling(aircraft?.billing_basis);
  return <div className="aircraft-form-grid">
    {aircraft?<input type="hidden" name="id" value={t(aircraft.id)}/>:null}
    <label>Imatrikulace<input name="registration" defaultValue={t(aircraft?.registration)} placeholder="OK-ABC" required readOnly={Boolean(aircraft)}/>{aircraft?<small>Registraci nelze při editaci změnit, aby zůstaly zachované vazby na lety.</small>:null}</label>
    <label>Typ letadla<input name="aircraft_type" defaultValue={t(aircraft?.aircraft_type)} placeholder="P92 Echo"/></label>
    <label>ICAO typ<input name="icao_type" defaultValue={t(aircraft?.icao_type)} placeholder="P92"/></label>
    <label>Třída<select name="aircraft_class" defaultValue={t(aircraft?.aircraft_class)||"ULL"}>{classes.map(value=><option key={value}>{value}</option>)}</select></label>
    <label>Evidence<select name="evidence" defaultValue={t(aircraft?.evidence)||"ULL"}>{evidence.map(value=><option key={value}>{value}</option>)}</select></label>
    <label>Výchozí cena za hodinu<input name="default_price_per_hour" type="number" min="0" step="0.01" defaultValue={t(aircraft?.default_price_per_hour)} placeholder="0"/></label>
    <label>Výchozí funkce<select name="default_role" defaultValue={t(aircraft?.default_role)||"PIC"}>{roles.map(value=><option key={value}>{value}</option>)}</select></label>
    <label>Účtovaný čas<select name="billing_basis" defaultValue={billing.basis}><option>BLOCK</option><option>AIR</option></select></label>
    <label>Výchozí podíl<select name="billing_share" defaultValue={billing.share}>{BILLING_SHARES.map(value=><option key={value} value={value}>{value===1?"1/1 · celá cena":`1/${value}`}</option>)}</select></label>
    <label className="aircraft-note">Poznámka<textarea name="note" rows={2} defaultValue={t(aircraft?.note)} placeholder="Vlastník, provozovatel, zvláštní nastavení…"/></label>
  </div>;
}

export function AircraftManager({aircraft,saveAction,toggleAction}:{aircraft:AircraftRecord[];saveAction:Action;toggleAction:Action}){
  return <div className="aircraft-manager">
    <details className="add-aircraft-card"><summary>＋ Přidat nové letadlo</summary><form action={saveAction}><AircraftFields/><div className="form-actions"><button className="primary-button">Přidat letadlo</button></div></form></details>
    <div className="aircraft-card-list">{aircraft.map(item=>{const billing=parseBilling(item.billing_basis),active=Boolean(Number(item.active));return <article className={`aircraft-card${active?"":" inactive"}`} key={t(item.id)}>
      <header><div><strong>{t(item.registration)}</strong><span>{t(item.aircraft_type)||"Typ neuveden"} · {t(item.aircraft_class)||"—"} · {t(item.evidence)||"—"}</span></div><form action={toggleAction}><input type="hidden" name="id" value={t(item.id)}/><button className={active?"status-on":"status-off"}>{active?"Aktivní":"Neaktivní"}</button></form></header>
      <div className="aircraft-card-metrics"><span><small>ICAO</small><b>{t(item.icao_type)||"—"}</b></span><span><small>Cena</small><b>{Number(item.default_price_per_hour||0).toLocaleString("cs-CZ")} Kč/h</b></span><span><small>Účtování</small><b>{billing.basis} · 1/{billing.share}</b></span><span><small>Funkce</small><b>{t(item.default_role)||"PIC"}</b></span></div>
      <details className="aircraft-edit"><summary>Upravit profil letadla</summary><form action={saveAction}><AircraftFields aircraft={item}/><div className="form-actions"><button className="primary-button">Uložit změny</button></div></form></details>
    </article>})}{!aircraft.length?<p className="empty-state">Zatím není uložené žádné letadlo.</p>:null}</div>
  </div>;
}
