from pathlib import Path
import json, re

ROOT=Path(__file__).resolve().parents[1]

def read(path): return (ROOT/path).read_text(encoding='utf-8')
def write(path,text):
    p=ROOT/path; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(text,encoding='utf-8')
def replace_once(path,old,new):
    text=read(path); count=text.count(old)
    if count!=1: raise RuntimeError(f'{path}: expected one occurrence, found {count}: {old[:120]!r}')
    write(path,text.replace(old,new,1))
def sub_once(path,pattern,repl,flags=0):
    text=read(path); out,n=re.subn(pattern,repl,text,count=1,flags=flags)
    if n!=1: raise RuntimeError(f'{path}: regex expected one occurrence: {pattern[:120]!r}')
    write(path,out)

# Schema: user-set aircraft-level Annex-I / Article 2(8) credit, with dates so historical credit is never silently back-applied.
write('lib/v151-schema.ts','''import "server-only";
import { sql } from "@/lib/db";

declare global{
  // eslint-disable-next-line no-var
  var __flytallyV151Schema:Promise<void>|undefined;
}

const MIGRATION_KEY="v1.51-regulatory-credit-profile";

async function applyV151Schema(){
  await sql`CREATE TABLE IF NOT EXISTS flytally_feature_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const done=await sql`SELECT 1 ok FROM flytally_feature_migrations WHERE migration_key=${MIGRATION_KEY} LIMIT 1` as Array<{ok:number}>;
  if(done[0])return;
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(151020260)`,
    sql`ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS part_fcl_credit_class TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS part_fcl_credit_basis TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS part_fcl_credit_from TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS part_fcl_training_authorised BOOLEAN NOT NULL DEFAULT FALSE`,
    sql`ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS part_fcl_training_authorised_from TEXT NOT NULL DEFAULT ''`,
    sql`INSERT INTO flytally_feature_migrations(migration_key) VALUES(${MIGRATION_KEY}) ON CONFLICT(migration_key) DO NOTHING`,
  ]);
}

export function ensureV151Schema(){
  if(!globalThis.__flytallyV151Schema){
    globalThis.__flytallyV151Schema=applyV151Schema().catch(error=>{globalThis.__flytallyV151Schema=undefined;throw error});
  }
  return globalThis.__flytallyV151Schema;
}
''')

replace_once('lib/runtime-schema.ts','import { ensureV148Schema } from "@/lib/v148-schema";','import { ensureV148Schema } from "@/lib/v148-schema";\nimport { ensureV151Schema } from "@/lib/v151-schema";')
replace_once('lib/runtime-schema.ts','await Promise.all([ensureV132Schema(),ensureV1353Schema(),ensureV144Schema(),ensureV145Schema(),ensureV148Schema()]);','await Promise.all([ensureV132Schema(),ensureV1353Schema(),ensureV144Schema(),ensureV145Schema(),ensureV148Schema(),ensureV151Schema()]);')

write('lib/regulatory-qualification.ts','''const compact=(value:unknown)=>String(value??"").trim().toUpperCase().replace(/\\s+/g,"");

/** Aeroplane IR only. Instructor certificates such as IRI(A) must never satisfy an IR privilege test. */
export function isAeroplaneIrQualification(value:unknown){
  const q=compact(value);
  if(q==="IR"||q==="IR(A)")return true;
  if(/^(?:SE|ME)[-\\/]?IR\\(A\\)$/.test(q))return true;
  if(/^IR\\(A\\)[-\\/]?(?:SE|ME)$/.test(q))return true;
  return false;
}
''')

# Aircraft profile data + persistence.
replace_once('lib/data/database.ts','a.active,a.note,COALESCE(current_rate.price_per_hour','a.active,a.note,a.part_fcl_credit_class,a.part_fcl_credit_basis,a.part_fcl_credit_from,a.part_fcl_training_authorised,a.part_fcl_training_authorised_from,COALESCE(current_rate.price_per_hour')
replace_once('app/(protected)/database/actions.ts',
'  const make=s(form,"aircraft_make"),model=s(form,"aircraft_model"),variant=s(form,"aircraft_variant"),displayType=s(form,"aircraft_type")||[model,variant].filter(Boolean).join(" ");',
'''  const make=s(form,"aircraft_make"),model=s(form,"aircraft_model"),variant=s(form,"aircraft_variant"),displayType=s(form,"aircraft_type")||[model,variant].filter(Boolean).join(" ");
  const creditRaw=s(form,"part_fcl_credit_class").toUpperCase(),creditClass=["SEP","TMG"].includes(creditRaw)?creditRaw:"",creditBasis=s(form,"part_fcl_credit_basis").slice(0,300),creditFrom=s(form,"part_fcl_credit_from"),trainingAuthorised=s(form,"part_fcl_training_authorised")==="yes",trainingFrom=s(form,"part_fcl_training_authorised_from");
  if(creditClass&&(!creditBasis||!validIsoDate(creditFrom)))return{ok:false,message:"Part-FCL credit needs a basis/reference and a valid-from date."};
  if(trainingAuthorised&&(!creditClass||!validIsoDate(trainingFrom)))return{ok:false,message:"Annex-I instructor-training credit needs a valid-from date."};''')
replace_once('app/(protected)/database/actions.ts',
'billing_basis=${billing},note=${s(form,"note")},updated_at=NOW()',
'billing_basis=${billing},part_fcl_credit_class=${creditClass},part_fcl_credit_basis=${creditBasis},part_fcl_credit_from=${creditFrom},part_fcl_training_authorised=${trainingAuthorised},part_fcl_training_authorised_from=${trainingAuthorised?trainingFrom:""},note=${s(form,"note")},updated_at=NOW()')
replace_once('app/(protected)/database/actions.ts',
'INSERT INTO aircraft(user_id,registration,aircraft_type,aircraft_make,aircraft_model,aircraft_variant,icao_type,aircraft_class,evidence,default_price_per_hour,default_role,billing_basis,active,note,created_at,updated_at) VALUES(${userId},${reg},${displayType},${make},${model},${variant},${s(form,"icao_type")},${s(form,"aircraft_class")},${s(form,"evidence")},${initialPrice},${s(form,"default_role")||"PIC"},${billing},1,${s(form,"note")},NOW(),NOW()) ON CONFLICT(user_id,registration) DO UPDATE SET aircraft_type=EXCLUDED.aircraft_type,aircraft_make=EXCLUDED.aircraft_make,aircraft_model=EXCLUDED.aircraft_model,aircraft_variant=EXCLUDED.aircraft_variant,icao_type=EXCLUDED.icao_type,aircraft_class=EXCLUDED.aircraft_class,evidence=EXCLUDED.evidence,default_role=EXCLUDED.default_role,billing_basis=EXCLUDED.billing_basis,note=EXCLUDED.note,active=1,updated_at=NOW()',
'INSERT INTO aircraft(user_id,registration,aircraft_type,aircraft_make,aircraft_model,aircraft_variant,icao_type,aircraft_class,evidence,default_price_per_hour,default_role,billing_basis,active,part_fcl_credit_class,part_fcl_credit_basis,part_fcl_credit_from,part_fcl_training_authorised,part_fcl_training_authorised_from,note,created_at,updated_at) VALUES(${userId},${reg},${displayType},${make},${model},${variant},${s(form,"icao_type")},${s(form,"aircraft_class")},${s(form,"evidence")},${initialPrice},${s(form,"default_role")||"PIC"},${billing},1,${creditClass},${creditBasis},${creditFrom},${trainingAuthorised},${trainingAuthorised?trainingFrom:""},${s(form,"note")},NOW(),NOW()) ON CONFLICT(user_id,registration) DO UPDATE SET aircraft_type=EXCLUDED.aircraft_type,aircraft_make=EXCLUDED.aircraft_make,aircraft_model=EXCLUDED.aircraft_model,aircraft_variant=EXCLUDED.aircraft_variant,icao_type=EXCLUDED.icao_type,aircraft_class=EXCLUDED.aircraft_class,evidence=EXCLUDED.evidence,default_role=EXCLUDED.default_role,billing_basis=EXCLUDED.billing_basis,part_fcl_credit_class=EXCLUDED.part_fcl_credit_class,part_fcl_credit_basis=EXCLUDED.part_fcl_credit_basis,part_fcl_credit_from=EXCLUDED.part_fcl_credit_from,part_fcl_training_authorised=EXCLUDED.part_fcl_training_authorised,part_fcl_training_authorised_from=EXCLUDED.part_fcl_training_authorised_from,note=EXCLUDED.note,active=1,updated_at=NOW()')

replace_once('components/aircraft-manager.tsx',
'  const billing=parseBilling(aircraft?.billing_basis),editing=Boolean(aircraft);',
'  const billing=parseBilling(aircraft?.billing_basis),editing=Boolean(aircraft),creditClass=t(aircraft?.part_fcl_credit_class).toUpperCase(),trainingAuthorised=aircraft?.part_fcl_training_authorised===true||Number(aircraft?.part_fcl_training_authorised)===1;')
replace_once('components/aircraft-manager.tsx',
'    <label>Default role<select name="default_role" defaultValue={t(aircraft?.default_role)||"PIC"}>{roles.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}</select></label>\n    <label>Billing time',
'''    <label>Default role<select name="default_role" defaultValue={t(aircraft?.default_role)||"PIC"}>{roles.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
    <details className="aircraft-credit-card">
      <summary>Part-FCL credit <small>optional · set once per aircraft</small></summary>
      <div className="aircraft-credit-grid">
        <label>Credit as<select name="part_fcl_credit_class" defaultValue={creditClass}><option value="">Do not count</option><option value="SEP">SEP</option><option value="TMG">TMG</option></select><small>For Annex-I / Article 2(8) aircraft only. Used for FCL.140.A and FCL.740.A, never FCL.060.</small></label>
        <label>Credit valid from<input name="part_fcl_credit_from" type="date" defaultValue={t(aircraft?.part_fcl_credit_from).slice(0,10)}/><small>Prevents historical flights being credited before the basis applied.</small></label>
        <label className="wide">Basis / reference<input name="part_fcl_credit_basis" defaultValue={t(aircraft?.part_fcl_credit_basis)} placeholder="e.g. Annex I aircraft matching SEP(land), authority/DTO reference"/><small>Required when credit is enabled. FlyTally never decides eligibility from ULL status alone.</small></label>
        <label className="wide aircraft-credit-check"><input type="checkbox" name="part_fcl_training_authorised" value="yes" defaultChecked={trainingAuthorised}/> This aircraft is authorised for instructor training used for Part-FCL credit</label>
        <label>Training credit from<input name="part_fcl_training_authorised_from" type="date" defaultValue={t(aircraft?.part_fcl_training_authorised_from).slice(0,10)}/><small>Required only when the training-authorisation box is checked.</small></label>
      </div>
    </details>
    <label>Billing time''')

# Flight form: one compact PF confirmation; detailed movement counts stay hidden unless needed.
replace_once('components/flight-form.tsx',
'  const[operationType,setOperationType]=useState(normalizeChoice(field("operation_type"),OPERATION_TYPES,"SP")),[engineType,setEngineType]=useState(normalizeChoice(field("engine_type"),ENGINE_TYPES,defaultEngineType(initialClass||profileClass))),[landingsDay,setLandingsDay]=useState(Number(field("landings_day",field("starts","1")))||0),[landingsNight,setLandingsNight]=useState(Number(field("landings_night","0"))||0);',
'''  const initialOperationType=normalizeChoice(field("operation_type"),OPERATION_TYPES,"SP"),initialLandingsDay=Number(field("landings_day",field("starts","1")))||0,initialLandingsNight=Number(field("landings_night","0"))||0,storedMovement=["1","true","yes"].includes(field("movement_evidence_recorded").toLowerCase()),autoMovement=(ev:string,rl:string,op:string)=>ev==="EASA"&&op==="SP"&&["PIC","SOLO"].includes(rl);
  const[operationType,setOperationType]=useState(initialOperationType),[engineType,setEngineType]=useState(normalizeChoice(field("engine_type"),ENGINE_TYPES,defaultEngineType(initialClass||profileClass))),[landingsDay,setLandingsDay]=useState(initialLandingsDay),[landingsNight,setLandingsNight]=useState(initialLandingsNight),[movementRecorded,setMovementRecorded]=useState(editing?storedMovement:autoMovement(initialEvidence,initialRole,initialOperationType)),[movementTouched,setMovementTouched]=useState(false),[movementCustom,setMovementCustom]=useState(editing&&storedMovement&&((Number(field("takeoffs_day"))||0)!==initialLandingsDay||(Number(field("approaches_day"))||0)!==initialLandingsDay||(Number(field("takeoffs_night"))||0)!==initialLandingsNight||(Number(field("approaches_night"))||0)!==initialLandingsNight)),[takeoffsDay,setTakeoffsDay]=useState(editing?Number(field("takeoffs_day"))||initialLandingsDay:initialLandingsDay),[takeoffsNight,setTakeoffsNight]=useState(editing?Number(field("takeoffs_night"))||initialLandingsNight:initialLandingsNight),[approachesDay,setApproachesDay]=useState(editing?Number(field("approaches_day"))||initialLandingsDay:initialLandingsDay),[approachesNight,setApproachesNight]=useState(editing?Number(field("approaches_night"))||initialLandingsNight:initialLandingsNight);''')
replace_once('components/flight-form.tsx',
'  const missing=[!date&&"date",!registration&&"aircraft",!role&&"role",!evidence&&"logbook",!aircraftClass&&"class",!billing&&"billing"].filter(Boolean);useEffect(()=>{if(state.error){markDirty();errorRef.current?.focus()}},[state.error,markDirty]);',
'''  useEffect(()=>{if(!editing&&!movementTouched)setMovementRecorded(autoMovement(evidence,role,operationType))},[editing,evidence,role,operationType,movementTouched]);
  const changeDayLandings=(value:number)=>{setLandingsDay(value);if(!movementCustom){setTakeoffsDay(value);setApproachesDay(value)}},changeNightLandings=(value:number)=>{setLandingsNight(value);if(!movementCustom){setTakeoffsNight(value);setApproachesNight(value)}};
  const missing=[!date&&"date",!registration&&"aircraft",!role&&"role",!evidence&&"logbook",!aircraftClass&&"class",!billing&&"billing"].filter(Boolean);useEffect(()=>{if(state.error){markDirty();errorRef.current?.focus()}},[state.error,markDirty]);''')
replace_once('components/flight-form.tsx','onChange={event=>setLandingsDay(Number(event.target.value)||0)}','onChange={event=>changeDayLandings(Number(event.target.value)||0)}')
replace_once('components/flight-form.tsx','onChange={event=>setLandingsNight(Number(event.target.value)||0)}','onChange={event=>changeNightLandings(Number(event.target.value)||0)}')
replace_once('components/flight-form.tsx',
'      {countersignatureRequired?<><label>Supervising PIC / FI',
'''      {evidence==="EASA"?<div className="regulatory-movement-card wide"><label className="regulatory-movement-check"><input type="checkbox" name="movementEvidenceRecorded" value="yes" checked={movementRecorded} onChange={event=>{setMovementTouched(true);setMovementRecorded(event.target.checked)}}/> I was pilot flying (PF) for the recorded take-offs, approaches and landings</label><small>Used for FCL.060 and recency calculations. For a normal single-pilot PIC/SOLO entry this is preselected; turn it off if another pilot was PF.</small>{movementRecorded?<details className="movement-adjust"><summary>Adjust movement counts</summary><div className="movement-adjust-grid"><label>Day take-offs<input name="takeoffsDay" type="number" min="0" max="99" value={takeoffsDay} onChange={event=>{setMovementCustom(true);setTakeoffsDay(Number(event.target.value)||0)}}/></label><label>Day approaches<input name="approachesDay" type="number" min="0" max="99" value={approachesDay} onChange={event=>{setMovementCustom(true);setApproachesDay(Number(event.target.value)||0)}}/></label><label>Night take-offs<input name="takeoffsNight" type="number" min="0" max="99" value={takeoffsNight} onChange={event=>{setMovementCustom(true);setTakeoffsNight(Number(event.target.value)||0)}}/></label><label>Night approaches<input name="approachesNight" type="number" min="0" max="99" value={approachesNight} onChange={event=>{setMovementCustom(true);setApproachesNight(Number(event.target.value)||0)}}/></label></div><small>Normally these match the landing counts. Change them only for an unusual flight such as a go-around or aborted take-off.</small></details>:null}</div>:null}
      {countersignatureRequired?<><label>Supervising PIC / FI''')

# Recency engine: strict structured movements, signed LAPL supervised training, and explicit Annex-I credit.
replace_once('lib/recency-engine.ts',
'export type RecencyFlight={date:string;evidence:string;aircraftClass:string;role:string;minutes:number;landingsDay:number;landingsNight:number;movementEvidenceRecorded?:boolean;takeoffsDay?:number;takeoffsNight?:number;approachesDay?:number;approachesNight?:number;purposeCode?:string;task?:string;note?:string;instructorSigned?:boolean};',
'export type RecencyFlight={date:string;evidence:string;aircraftClass:string;role:string;minutes:number;landingsDay:number;landingsNight:number;movementEvidenceRecorded?:boolean;takeoffsDay?:number;takeoffsNight?:number;approachesDay?:number;approachesNight?:number;purposeCode?:string;task?:string;note?:string;instructorSigned?:boolean;partFclCreditClass?:string;partFclCreditBasis?:string;partFclCreditFrom?:string;partFclTrainingAuthorised?:boolean;partFclTrainingAuthorisedFrom?:string};')
replace_once('lib/recency-engine.ts',
'''const pilotFlyingRole=(role:unknown)=>["PIC","DUAL","SOLO","CO-PILOT","COPILOT","SPIC","PICUS","INSTRUCTOR","EXAMINER"].includes(upper(role));
const picRole=(role:unknown)=>["PIC","SOLO","INSTRUCTOR","EXAMINER"].includes(upper(role));
const laplRole=(role:unknown)=>["PIC","DUAL","SOLO"].includes(upper(role));
const legacyRefresher=(flight:RecencyFlight)=>/(FCL[.]140[.]A|LAPL\\s+recency|recency\\s+training|refresher\\s+training)/i.test(`${flight.task??""} ${flight.note??""}`);
const isLaplRefresher=(flight:RecencyFlight)=>Boolean(flight.instructorSigned)&&upper(flight.role)==="DUAL"&&classKey(flight.aircraftClass)!=="ULL"&&(upper(flight.purposeCode)==="LAPL_FCL140A_REFRESHER"||(!String(flight.purposeCode??"").trim()&&legacyRefresher(flight)));
export const isClassRefresherFlight=(flight:RecencyFlight)=>Boolean(flight.instructorSigned)&&upper(flight.role)==="DUAL"&&["SEP","TMG"].includes(classKey(flight.aircraftClass))&&(upper(flight.purposeCode)==="SEP_TMG_FCL740A_REFRESHER"||/(^|·\\s*)FCL[.]740[.]A refresher training(\\s*·|$)/i.test(String(flight.task??"")));''',
'''const pilotFlyingRole=(role:unknown)=>["PIC","DUAL","SOLO","CO-PILOT","COPILOT","SPIC","PICUS","INSTRUCTOR","EXAMINER"].includes(upper(role));
const picRole=(role:unknown)=>["PIC","SOLO","INSTRUCTOR","EXAMINER"].includes(upper(role));
const legacyRefresher=(flight:RecencyFlight)=>/(FCL[.]140[.]A|LAPL\\s+recency|recency\\s+training|refresher\\s+training)/i.test(`${flight.task??""} ${flight.note??""}`);
const dateFrom=(value:unknown)=>/^\\d{4}-\\d{2}-\\d{2}$/.test(String(value??""))?String(value):"";
const annexCredit=(flight:RecencyFlight,target:string,training=false)=>upper(flight.evidence)==="ULL"&&upper(flight.partFclCreditClass)===target&&Boolean(String(flight.partFclCreditBasis??"").trim())&&Boolean(dateFrom(flight.partFclCreditFrom))&&flight.date>=dateFrom(flight.partFclCreditFrom)&&(!training||(Boolean(flight.partFclTrainingAuthorised)&&Boolean(dateFrom(flight.partFclTrainingAuthorisedFrom))&&flight.date>=dateFrom(flight.partFclTrainingAuthorisedFrom)));
const directClass=(flight:RecencyFlight,target:string)=>upper(flight.evidence)!=="ULL"&&classKey(flight.aircraftClass)===target;
const laplClass=(flight:RecencyFlight)=>["SEP","TMG"].find(value=>directClass(flight,value)||annexCredit(flight,value))||"";
const laplExperienceRole=(flight:RecencyFlight)=>upper(flight.role)==="PIC"||(["DUAL","SOLO"].includes(upper(flight.role))&&Boolean(flight.instructorSigned));
const laplExperienceEligible=(flight:RecencyFlight)=>Boolean(laplClass(flight))&&laplExperienceRole(flight)&&(!(upper(flight.evidence)==="ULL"&&["DUAL","SOLO"].includes(upper(flight.role)))||annexCredit(flight,laplClass(flight),true));
const isLaplRefresher=(flight:RecencyFlight)=>Boolean(flight.instructorSigned)&&upper(flight.role)==="DUAL"&&Boolean(laplClass(flight))&&(upper(flight.evidence)!=="ULL"||annexCredit(flight,laplClass(flight),true))&&(upper(flight.purposeCode)==="LAPL_FCL140A_REFRESHER"||(!String(flight.purposeCode??"").trim()&&legacyRefresher(flight)));
export const isClassRefresherFlight=(flight:RecencyFlight)=>Boolean(flight.instructorSigned)&&upper(flight.role)==="DUAL"&&["SEP","TMG"].some(value=>directClass(flight,value)||annexCredit(flight,value,true))&&(upper(flight.purposeCode)==="SEP_TMG_FCL740A_REFRESHER"||/(^|·\\s*)FCL[.]740[.]A refresher training(\\s*·|$)/i.test(String(flight.task??"")));''')
replace_once('lib/recency-engine.ts',
'''export function evaluateLaplMetrics(input:{flightMinutes:number;landings:number;refresherMinutes:number;ullMinutes?:number;ullLandings?:number}):RecencyEvaluation{
  const requirements=[requirement("flight-time","Flight time",input.flightMinutes/60,12,"hours"),requirement("landings","Take-offs / landings",input.landings,12,"count"),requirement("refresher","Instructor refresher",input.refresherMinutes/60,1,"hours")];
  const current=requirements.every(item=>item.met);
  return{id:"lapl-a-fcl140a",code:"FCL.140.A",title:"LAPL(A) flying privileges",status:current?"current":"not-current",summary:current?"Current on the rolling 2-year experience route":`Remaining — ${missingSummary(requirements)}`,windowLabel:"Rolling 2 years",requirements,note:"FlyTally uses certified logbook records. A passed LAPL(A) proficiency check with an examiner is an alternative route.",meta:{ullMinutes:input.ullMinutes??0,ullLandings:input.ullLandings??0}};
}''',
'''export function evaluateLaplMetrics(input:{flightMinutes:number;landings:number;takeoffs?:number;refresherMinutes:number;ullMinutes?:number;ullLandings?:number}):RecencyEvaluation{
  const takeoffs=input.takeoffs??input.landings,movements=Math.min(takeoffs,input.landings),requirements=[requirement("flight-time","Flight time",input.flightMinutes/60,12,"hours"),requirement("landings","Take-offs / landings",movements,12,"count"),requirement("refresher","Instructor refresher",input.refresherMinutes/60,1,"hours")];
  const current=requirements.every(item=>item.met);
  return{id:"lapl-a-fcl140a",code:"FCL.140.A",title:"LAPL(A) flying privileges",status:current?"current":"not-current",summary:current?"Current on the rolling 2-year experience route":`Remaining — ${missingSummary(requirements)}`,windowLabel:"Rolling 2 years",requirements,note:"FlyTally uses certified logbook records. A passed LAPL(A) proficiency check with an examiner is an alternative route.",meta:{takeoffs,landings:input.landings,ullMinutes:input.ullMinutes??0,ullLandings:input.ullLandings??0}};
}''')
sub_once('lib/recency-engine.ts',r'export function evaluateLaplA\(flights:RecencyFlight\[],today:string,evidence:RecencyEvidence\[]=\[]\):RecencyEvaluation\{.*?\n\}\n\nexport function evaluatePassengerCurrencyMode',r'''export function evaluateLaplA(flights:RecencyFlight[],today:string,evidence:RecencyEvidence[]=[]):RecencyEvaluation{
  const start=rollingYearsStart(today,2),window=flights.filter(f=>within(f,start,today)),eligible=window.filter(laplExperienceEligible),directMovements=eligible.filter(f=>upper(f.evidence)!=="ULL"&&Boolean(f.movementEvidenceRecorded)),annex=eligible.filter(f=>upper(f.evidence)==="ULL"),refresher=window.filter(isLaplRefresher);
  const takeoffs=directMovements.reduce((sum,f)=>sum+movementCount(f,"takeoff"),0),landings=directMovements.reduce((sum,f)=>sum+movementCount(f,"landing"),0),incompleteMovements=eligible.filter(f=>upper(f.evidence)!=="ULL"&&!f.movementEvidenceRecorded).length;
  const base=evaluateLaplMetrics({flightMinutes:eligible.reduce((sum,f)=>sum+Math.max(0,f.minutes),0),takeoffs,landings,refresherMinutes:refresher.reduce((sum,f)=>sum+Math.max(0,f.minutes),0),ullMinutes:annex.reduce((sum,f)=>sum+Math.max(0,f.minutes),0),ullLandings:0});
  const limited=base.status!=="current"&&incompleteMovements>0,experienceForecast=base.status==="current"?[contributionForecast(minuteContributions(eligible),720,date=>addDays(addYears(date,2),1)),contributionForecast(movementContributions(directMovements,"takeoff"),12,date=>addDays(addYears(date,2),1)),contributionForecast(movementContributions(directMovements,"landing"),12,date=>addDays(addYears(date,2),1)),contributionForecast(minuteContributions(refresher),60,date=>addDays(addYears(date,2),1))].filter((value):value is string=>Boolean(value)).sort()[0]:undefined;
  const latestCheck=evidence.filter(item=>item.kind==="LAPL_PROFICIENCY_CHECK"&&item.date>=start&&item.date<=today).sort((a,b)=>b.date.localeCompare(a.date))[0],checkForecast=latestCheck?addDays(addYears(latestCheck.date,2),1):undefined;
  if(latestCheck){const forecasts=[experienceForecast,checkForecast].filter((value):value is string=>Boolean(value)).sort(),forecast=base.status==="current"?forecasts.at(-1):checkForecast;return{...base,status:"current",badge:"CURRENT",summary:`Current via LAPL(A) proficiency check passed ${latestCheck.date}`,forecastDate:forecast,note:`Examiner evidence: ${latestCheck.signer} · ${latestCheck.reference}. User-declared evidence; authority records remain controlling.`,meta:{...(base.meta??{}),proficiencyCheck:true,incompleteMovementFlights:incompleteMovements}}}
  return{...base,status:limited?"attention":base.status,badge:limited?"LIMITED DATA":base.status==="current"?"CURRENT":base.badge,forecastDate:experienceForecast,note:`${base.note} Dual and supervised-solo experience is counted only with current instructor-signed evidence. Annex-I / Article 2(8) aircraft are never credited merely because they are logged as ULL: an aircraft profile basis and valid-from date are required. Under the conservative FCL.035(a)(4) implementation, Annex-I hours may contribute to FCL.140.A but their take-offs/landings are not inferred.`,meta:{...(base.meta??{}),incompleteMovementFlights:incompleteMovements}};
}

export function evaluatePassengerCurrencyMode''',flags=re.S)

# FCL.740.A: use strict structured movements and explicitly qualified Annex-I hours; never landing-only proxy.
sub_once('lib/recency-engine.ts',r'  const eligibleClasses=combineSepTmg\?\["SEP","TMG"\]:\[aircraftClass\],window=input\.flights\.filter\(f=>f\.date>=experienceStart.*?const requirements=\[requirement\("flight-time".*?\];',r'''  const eligibleClasses=combineSepTmg?["SEP","TMG"]:[aircraftClass],classEligible=(f:RecencyFlight)=>eligibleClasses.some(value=>directClass(f,value)||annexCredit(f,value)),window=input.flights.filter(f=>f.date>=experienceStart&&f.date<=today&&classEligible(f)&&pilotFlyingRole(f.role)&&(!(upper(f.evidence)==="ULL"&&["DUAL","SOLO"].includes(upper(f.role)))||eligibleClasses.some(value=>annexCredit(f,value,true)))),pic=window.filter(f=>picRole(f.role)),movementFlights=window.filter(f=>upper(f.evidence)!=="ULL"&&Boolean(f.movementEvidenceRecorded)),flightRefreshers=window.filter(isClassRefresherFlight);
  const externalRefreshers=evidence.filter(item=>item.kind==="CLASS_REFRESHER"&&eligibleClasses.includes(item.aircraftClass)&&item.date>=experienceStart&&item.date<=today),refresherMinutes=flightRefreshers.reduce((sum,item)=>sum+Math.max(0,item.minutes),0)+externalRefreshers.reduce((sum,item)=>sum+item.minutes,0),exemption=evidence.find(item=>item.kind==="CLASS_REFRESHER_EXEMPTION"&&eligibleClasses.includes(item.aircraftClass)&&item.date>=experienceStart&&item.date<=today),takeoffs=movementFlights.reduce((sum,f)=>sum+movementCount(f,"takeoff"),0),landings=movementFlights.reduce((sum,f)=>sum+movementCount(f,"landing"),0),incompleteMovements=window.filter(f=>upper(f.evidence)!=="ULL"&&!f.movementEvidenceRecorded).length;
  const requirements=[requirement("flight-time","Flight time",window.reduce((sum,f)=>sum+Math.max(0,f.minutes),0)/60,12,"hours"),requirement("pic-time","PIC time",pic.reduce((sum,f)=>sum+Math.max(0,f.minutes),0)/60,6,"hours"),requirement("landings","Take-offs / landings",Math.min(takeoffs,landings),12,"count"),requirement("refresher","Refresher / exemption",exemption?1:refresherMinutes/60,1,"hours")];''',flags=re.S)
replace_once('lib/recency-engine.ts',
'  const met=requirements.every(item=>item.met),sourceNote=flightRefreshers.length?',
'  const met=requirements.every(item=>item.met),limited=!met&&incompleteMovements>0,sourceNote=flightRefreshers.length?')
replace_once('lib/recency-engine.ts',
'  return{id,code:"FCL.740.A",title,status:met?"current":"attention",badge:met?"READY":"IN PROGRESS",summary:met?"Experience-route requirements recorded":`Remaining — ${missingSummary(requirements)}`,windowLabel:`Final 12 months · expiry ${validUntil}`,deadline:validUntil,requirements,note:`Planning indicator only. ${sourceNote} FlyTally uses recorded landings as the legacy take-off/landing planning proxy where separate take-off evidence is unavailable, and never changes the saved rating validity automatically.`,meta};',
'  return{id,code:"FCL.740.A",title,status:met?"current":"attention",badge:met?"READY":limited?"LIMITED DATA":"IN PROGRESS",summary:met?"Experience-route requirements recorded":limited?`Limited movement evidence · ${incompleteMovements} certified flight${incompleteMovements===1?"":"s"} need PF movement confirmation`:`Remaining — ${missingSummary(requirements)}`,windowLabel:`Final 12 months · expiry ${validUntil}`,deadline:validUntil,requirements,note:`Planning indicator only. ${sourceNote} FCL.740.A requires both 12 take-offs and 12 landings; FlyTally no longer substitutes landings for missing take-off evidence. Annex-I / Article 2(8) aircraft contribute only when the aircraft profile contains an explicit FCL.035(a)(4) credit basis and valid-from date; instructor-training credit additionally requires the recorded training authorisation. FlyTally never changes saved rating validity automatically.`,meta:{...meta,takeoffs,landings,incompleteMovementFlights:incompleteMovements}};')

# Service switches authoritative monitors to strict evaluator and exact IR detection; aircraft credit is joined centrally.
replace_once('lib/recency-service.ts','import { ensureV1353Schema } from "@/lib/v1353-schema";','import { ensureV1353Schema } from "@/lib/v1353-schema";\nimport { ensureV151Schema } from "@/lib/v151-schema";')
replace_once('lib/recency-service.ts','import { daysBetween,evaluateClassRevalidation,evaluateCustomRule,evaluateLaplA,flightMinutes,parseCustomRecencyRules,parseRecencyEvidence,type RecencyEvaluation,type RecencyFlight } from "@/lib/recency-engine";\nimport { evaluatePassengerLandingIndicator } from "@/lib/recency-landing-indicator";','import { daysBetween,evaluateClassRevalidation,evaluateCustomRule,evaluateLaplA,evaluatePassengerCurrencyMode,flightMinutes,parseCustomRecencyRules,parseRecencyEvidence,type RecencyEvaluation,type RecencyFlight } from "@/lib/recency-engine";\nimport { isAeroplaneIrQualification } from "@/lib/regulatory-qualification";')
replace_once('lib/recency-service.ts','  await ensureDatabaseOptimizations();await ensureV1353Schema();','  await ensureDatabaseOptimizations();await Promise.all([ensureV1353Schema(),ensureV151Schema()]);')
replace_once('lib/recency-service.ts',
'const rows=await sql`SELECT f.date,f.evidence,f.aircraft_class,f.role,f.off_block,f.on_block,f.landings_day,f.landings_night,f.movement_evidence_recorded,f.takeoffs_day,f.takeoffs_night,f.approaches_day,f.approaches_night,f.purpose_code,f.task,f.note,EXISTS(',
'const rows=await sql`SELECT f.date,f.evidence,f.aircraft_class,f.role,f.off_block,f.on_block,f.landings_day,f.landings_night,f.movement_evidence_recorded,f.takeoffs_day,f.takeoffs_night,f.approaches_day,f.approaches_night,f.purpose_code,f.task,f.note,a.part_fcl_credit_class,a.part_fcl_credit_basis,a.part_fcl_credit_from,a.part_fcl_training_authorised,a.part_fcl_training_authorised_from,EXISTS(')
replace_once('lib/recency-service.ts',' FROM flights f WHERE f.user_id=${userId}',' FROM flights f LEFT JOIN aircraft a ON a.user_id=f.user_id AND UPPER(TRIM(a.registration))=UPPER(TRIM(f.registration)) WHERE f.user_id=${userId}')
replace_once('lib/recency-service.ts','instructorSigned:Boolean(row.instructor_signed)}));','instructorSigned:Boolean(row.instructor_signed),partFclCreditClass:t(row.part_fcl_credit_class),partFclCreditBasis:t(row.part_fcl_credit_basis),partFclCreditFrom:t(row.part_fcl_credit_from).slice(0,10),partFclTrainingAuthorised:Boolean(row.part_fcl_training_authorised),partFclTrainingAuthorisedFrom:t(row.part_fcl_training_authorised_from).slice(0,10)}));')
replace_once('lib/recency-service.ts','const hasIr=qualifications.some(row=>t(row.qualification_type).toUpperCase().startsWith("IR")&&currentCredential(row,today))','const hasIr=qualifications.some(row=>isAeroplaneIrQualification(row.qualification_type)&&currentCredential(row,today))')
replace_once('lib/recency-service.ts','detail:"Landing-based 90-day planning indicator"','detail:"FCL.060 · 3 take-offs, approaches and landings as PF"')
# occurs for SEP and TMG twice
text=read('lib/recency-service.ts'); text=text.replace('detail:"Landing-based 90-day planning indicator"','detail:"FCL.060 · 3 take-offs, approaches and landings as PF"'); text=text.replace('detail:hasIr?"Landing-based indicator + current IR":"Landing-based indicator + recorded night landing"','detail:hasIr?"FCL.060 · PF movements + current IR":"FCL.060 · PF movements including one at night"'); write('lib/recency-service.ts',text)
text=read('lib/recency-service.ts'); text=text.replace('evaluatePassengerLandingIndicator(flights,"SEP",hasIr,today,"day")','evaluatePassengerCurrencyMode(flights,"SEP",hasIr,today,"day")').replace('evaluatePassengerLandingIndicator(flights,"SEP",hasIr,today,"night")','evaluatePassengerCurrencyMode(flights,"SEP",hasIr,today,"night")').replace('evaluatePassengerLandingIndicator(flights,"TMG",hasIr,today,"day")','evaluatePassengerCurrencyMode(flights,"TMG",hasIr,today,"day")').replace('evaluatePassengerLandingIndicator(flights,"TMG",hasIr,today,"night")','evaluatePassengerCurrencyMode(flights,"TMG",hasIr,today,"night")'); write('lib/recency-service.ts',text)

# Credentials: stop using its legacy independent LAPL calculation as the displayed legal conclusion.
replace_once('app/(protected)/credentials/page.tsx','import { RecencyPanel } from "@/components/recency-panel";','import { RecencyPanel } from "@/components/recency-panel";\nimport { getRecencyStateForUser } from "@/lib/recency-service";')
replace_once('app/(protected)/credentials/page.tsx','laplMet=laplMinutes>=720&&laplLandings>=12&&laplRefresher>=60;','legacyLaplMet=laplMinutes>=720&&laplLandings>=12&&laplRefresher>=60;\n  void legacyLaplMet;\n  const laplPresent=licences.some(item=>t(item.licence_type).toUpperCase()==="LAPL(A)"),authoritativeLapl=laplPresent?await getRecencyStateForUser(userId,{...preferences,recency_monitors:["lapl-fcl140a"]}):null,laplEvaluation=authoritativeLapl?.evaluations.find(item=>item.id==="lapl-a-fcl140a"),laplMet=laplEvaluation?.status==="current";')

# Recency cron explicitly initializes the new schema too.
replace_once('app/api/cron/recency/route.ts','import { ensureV1353Schema } from "@/lib/v1353-schema";','import { ensureV1353Schema } from "@/lib/v1353-schema";\nimport { ensureV151Schema } from "@/lib/v151-schema";')
replace_once('app/api/cron/recency/route.ts','  await ensureV1353Schema();','  await Promise.all([ensureV1353Schema(),ensureV151Schema()]);')

# Release styling and layout.
write('app/v151-regulatory.css','''/* FlyTally v1.51 — regulatory correctness without turning flight entry into a compliance form. */
.regulatory-movement-card,.aircraft-credit-card{border:1px solid var(--line);border-radius:12px;background:var(--surface-raised);padding:12px 14px}.regulatory-movement-card{display:grid;gap:6px}.regulatory-movement-check,.aircraft-credit-check{display:flex!important;align-items:flex-start;gap:9px;font-weight:650}.regulatory-movement-check input,.aircraft-credit-check input{width:auto;margin-top:2px}.movement-adjust{margin-top:4px}.movement-adjust>summary,.aircraft-credit-card>summary{cursor:pointer;color:var(--text);font-weight:650}.movement-adjust-grid,.aircraft-credit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px}.aircraft-credit-card{grid-column:1/-1}.aircraft-credit-card>summary{display:flex;gap:8px;align-items:baseline}.aircraft-credit-card>summary small{color:var(--muted);font-weight:500}.aircraft-credit-grid .wide{grid-column:1/-1}@media(max-width:720px){.movement-adjust-grid,.aircraft-credit-grid{grid-template-columns:1fr}}
''')
replace_once('app/layout.tsx','import "./v150-ui-system.css";','import "./v150-ui-system.css";\nimport "./v151-regulatory.css";')

# Version and roadmap.
pkg=json.loads(read('package.json')); pkg['version']='1.51.0'; write('package.json',json.dumps(pkg,indent=2)+"\n")
road=read('ROADMAP.md'); marker='## Current release — v1.50.0 · UI system & theme convergence';
if marker not in road: raise RuntimeError('ROADMAP current release marker missing')
road=road.replace(marker,'''## Current release — v1.51.0 · Regulatory correctness core

Focus:
- replace landing-only FCL.060 planning with explicit certified take-off, approach and landing evidence recorded as pilot flying (PF); historical records without that evidence show **LIMITED DATA** rather than a false CURRENT
- keep everyday entry light: normal new SP PIC/SOLO EASA entries preselect one compact PF confirmation and mirror movement counts from landings; unusual counts stay behind **Adjust movement counts**
- make FCL.140.A require signed DUAL / supervised-SOLO evidence and actual recorded take-off + landing evidence; no blanket ULL credit
- model FCL.035(a)(4) Annex-I / Article 2(8) credit once on the aircraft profile, with target class, basis/reference and valid-from date; instructor-training credit additionally requires an explicit authorisation and valid-from date
- use Annex-I credit only for FCL.140.A / FCL.740.A planning, never for FCL.060 passenger currency, and conservatively do not infer Annex-I take-off/landing credits from flight hours
- make FCL.740.A require both take-offs and landings instead of a landing proxy while preserving the rule that FlyTally never extends a saved rating validity automatically
- recognise aeroplane IR precisely so instructor certificates such as IRI(A) cannot trigger an IR-based night recency exemption
- make the Licences overview consume the same authoritative LAPL recency result as the Recency page rather than a second independent legal calculation
- preserve certification fingerprints, revision history, instructor signatures, shared-flight ownership, print/export, GPS evidence and backup/restore behavior

## v1.50.0 · UI system & theme convergence''',1); write('ROADMAP.md',road)

write('REGULATORY_CORE_V151.md','''# FlyTally v1.51 — Regulatory correctness core

Baseline: EASA Aircrew rules current at 31 August 2026.

## Implemented legal boundaries
- **FCL.050** remains the logbook record layer. Certified flight revisions and signed verification evidence are not silently mutated by the recency engine.
- **FCL.060(b)** is evaluated only from structured take-off, approach and landing evidence explicitly recorded as pilot flying. ULL / Annex-I credit is not used for this 90-day passenger-currency rule.
- **FCL.140.A** uses certified aeroplane/TMG experience in the rolling two-year window. DUAL and supervised-SOLO experience is accepted only when the current certified revision has instructor-signed evidence.
- **FCL.035(a)(4)** credit for Annex-I / Article 2(8) aeroplanes is opt-in per aircraft, never inferred from `ULL`. The aircraft profile stores target SEP/TMG class, a human-readable basis/reference and a valid-from date. Instructor-training credit additionally requires the aircraft to be explicitly marked as authorised for that training and a training-authorisation valid-from date.
- The FCL.035(a)(4) implementation is deliberately conservative: eligible Annex-I **hours** may contribute to FCL.140.A and FCL.740.A, while take-off/landing counts are not inferred from those hours.
- **FCL.740.A(b)(1)(ii)** requires 12 h, 6 h PIC, 12 take-offs, 12 landings and the refresher/exemption element. FlyTally may show READY but never changes the recorded rating expiry automatically.
- Aeroplane **IR(A)** detection is exact enough to reject instructor certificates such as **IRI(A)**.

## Product principle
The regulatory engine may downgrade confidence when evidence is incomplete, but it must not manufacture missing evidence to produce a green status. `LIMITED DATA` is preferred to a false `CURRENT`.
''')

# Regression tests: old landing-only expectations are intentionally retired.
write('tests/v151-regulatory-correctness.test.ts','''import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { evaluateClassRevalidation,evaluateLaplA,evaluatePassengerCurrencyMode,type RecencyFlight } from "../lib/recency-engine.ts";
import { isAeroplaneIrQualification } from "../lib/regulatory-qualification.ts";
import { releaseAtLeast } from "./release-version.ts";
const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const flight=(o:Partial<RecencyFlight>={}):RecencyFlight=>({date:"2026-08-20",evidence:"EASA",aircraftClass:"SEP",role:"PIC",minutes:60,landingsDay:1,landingsNight:0,movementEvidenceRecorded:true,takeoffsDay:1,takeoffsNight:0,approachesDay:1,approachesNight:0,...o});

test("v1.51 release wires aircraft credit, runtime migration and compact movement UI",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,51,0));
  assert.match(read("lib/runtime-schema.ts"),/ensureV151Schema/);assert.match(read("lib/v151-schema.ts"),/part_fcl_credit_class/);assert.match(read("components/aircraft-manager.tsx"),/Part-FCL credit/);assert.match(read("components/flight-form.tsx"),/pilot flying \(PF\)/i);
});

test("FCL.060 never treats landing-only historical data as CURRENT",()=>{
  const old=[flight({movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0,landingsDay:3})],result=evaluatePassengerCurrencyMode(old,"SEP",false,"2026-08-31","day");
  assert.equal(result.status,"attention");assert.equal(result.badge,"LIMITED DATA");
  const exact=[flight({takeoffsDay:3,approachesDay:3,landingsDay:3})],ok=evaluatePassengerCurrencyMode(exact,"SEP",false,"2026-08-31","day");assert.equal(ok.status,"current");
});

test("LAPL dual and supervised solo need instructor evidence and real movement evidence",()=>{
  const unsigned=evaluateLaplA([flight({role:"DUAL",minutes:720,takeoffsDay:12,landingsDay:12,purposeCode:"LAPL_FCL140A_REFRESHER",instructorSigned:false})],"2026-08-31");assert.notEqual(unsigned.status,"current");
  const signed=evaluateLaplA([flight({role:"DUAL",minutes:720,takeoffsDay:12,landingsDay:12,purposeCode:"LAPL_FCL140A_REFRESHER",instructorSigned:true})],"2026-08-31");assert.equal(signed.status,"current");
  const missingMovements=evaluateLaplA([flight({role:"PIC",minutes:720,landingsDay:12,movementEvidenceRecorded:false,takeoffsDay:0}) ,flight({role:"DUAL",minutes:60,purposeCode:"LAPL_FCL140A_REFRESHER",instructorSigned:true})],"2026-08-31");assert.equal(missingMovements.badge,"LIMITED DATA");
});

test("ULL is never blanket LAPL credit; explicit aircraft profile credit affects hours only",()=>{
  const plain=evaluateLaplA([flight({evidence:"ULL",aircraftClass:"ULL",minutes:720,landingsDay:12,takeoffsDay:12})],"2026-08-31");assert.notEqual(plain.status,"current");
  const credited=evaluateLaplA([flight({evidence:"ULL",aircraftClass:"ULL",minutes:720,landingsDay:12,takeoffsDay:12,partFclCreditClass:"SEP",partFclCreditBasis:"Annex I same class",partFclCreditFrom:"2026-01-01"}),flight({minutes:60,takeoffsDay:12,landingsDay:12}),flight({role:"DUAL",minutes:60,purposeCode:"LAPL_FCL140A_REFRESHER",instructorSigned:true})],"2026-08-31");assert.equal(credited.status,"current");assert.equal(credited.meta?.ullMinutes,720);
});

test("FCL.740.A needs both take-offs and landings and does not use Annex-I movements",()=>{
  const weak=[flight({minutes:660,landingsDay:12,takeoffsDay:11}),flight({role:"DUAL",minutes:60,purposeCode:"SEP_TMG_FCL740A_REFRESHER",instructorSigned:true})];const result=evaluateClassRevalidation({aircraftClass:"SEP",validUntil:"2026-09-30",today:"2026-08-31",flights:weak});assert.notEqual(result.badge,"READY");
  const annex=[flight({evidence:"ULL",aircraftClass:"ULL",minutes:720,landingsDay:30,takeoffsDay:30,partFclCreditClass:"SEP",partFclCreditBasis:"Annex I",partFclCreditFrom:"2026-01-01"}),flight({minutes:60,takeoffsDay:12,landingsDay:12}),flight({role:"DUAL",minutes:60,purposeCode:"SEP_TMG_FCL740A_REFRESHER",instructorSigned:true})];const ready=evaluateClassRevalidation({aircraftClass:"SEP",validUntil:"2026-09-30",today:"2026-08-31",flights:annex});assert.equal(ready.badge,"READY");assert.equal(ready.meta?.takeoffs,12);
});

test("IR detection cannot confuse IRI instructor certificate with IR(A)",()=>{assert.equal(isAeroplaneIrQualification("IR(A)"),true);assert.equal(isAeroplaneIrQualification("SE-IR(A)"),true);assert.equal(isAeroplaneIrQualification("IRI(A)"),false);assert.equal(isAeroplaneIrQualification("FI(A)"),false)});

test("licence overview consumes the central recency service instead of trusting its legacy LAPL SQL result",()=>{const page=read("app/(protected)/credentials/page.tsx");assert.match(page,/getRecencyStateForUser/);assert.match(page,/laplEvaluation/)});
''')

# Update historical tests whose old behavior is exactly what the regulatory audit retires.
text=read('tests/v1355-recency-simplification.test.ts');
text=text.replace('test("v1.35.5 keeps passenger currency simple and landing based",()=>{','test("v1.35.5 historical landing helper remains isolated while current service is strict",()=>{')
text=text.replace('assert.match(service,/evaluatePassengerLandingIndicator/);assert.match(service,/Landing-based 90-day planning indicator/);','assert.doesNotMatch(service,/evaluatePassengerLandingIndicator/);assert.match(service,/evaluatePassengerCurrencyMode/);')
write('tests/v1355-recency-simplification.test.ts',text)
text=read('tests/v1353-fcl060-evidence.test.ts'); text=text.replace('assert.doesNotMatch(ui,/FCL[.]060 movement evidence/);assert.doesNotMatch(ui,/Day take-offs/);assert.doesNotMatch(ui,/Day approaches/);','assert.match(ui,/pilot flying \\(PF\\)/i);assert.match(ui,/Day take-offs/);assert.match(ui,/Day approaches/);'); write('tests/v1353-fcl060-evidence.test.ts',text)
text=read('tests/v1352-recency-evidence.test.ts'); text=text.replace('minutes:720,landingsDay:12,role:"PIC"','minutes:720,landingsDay:12,takeoffsDay:12,approachesDay:12,role:"PIC"'); write('tests/v1352-recency-evidence.test.ts',text)
text=read('tests/v149-training-linkage.test.ts');
text=text.replace('minutes:660,landingsDay:11,landingsNight:0,...overrides','minutes:660,landingsDay:11,landingsNight:0,movementEvidenceRecorded:true,takeoffsDay:11,takeoffsNight:0,approachesDay:11,approachesNight:0,...overrides')
text=text.replace('minutes:60,landingsDay:1,purposeCode:', 'minutes:60,landingsDay:1,takeoffsDay:1,approachesDay:1,purposeCode:')
text=text.replace('minutes:720,landingsDay:12})','minutes:720,landingsDay:12,takeoffsDay:12,approachesDay:12})')
write('tests/v149-training-linkage.test.ts',text)

print('v1.51 transform applied')
