from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def read(path): return (ROOT/path).read_text(encoding='utf-8')
def write(path,text): (ROOT/path).write_text(text,encoding='utf-8')
def replace_once(path,old,new):
    text=read(path); count=text.count(old)
    if count!=1: raise RuntimeError(f'{path}: expected one occurrence, found {count}: {old[:140]!r}')
    write(path,text.replace(old,new,1))
def sub_once(path,pattern,repl,flags=0):
    text=read(path); out,n=re.subn(pattern,repl,text,count=1,flags=flags)
    if n!=1: raise RuntimeError(f'{path}: regex expected one occurrence: {pattern[:160]!r}')
    write(path,out)

# Czech ULL / Annex-I credit under FCL.035(a)(4): eligible ULL hours and native
# take-off/landing counts may support FCL.140.A and FCL.740.A. ULL instructor
# flights must NOT satisfy the mandatory FI/CRI refresher element.

# The aircraft profile only stores eligibility, class, legal basis and effective date.
# Do not expose a misleading "instructor training authorised" switch for ULL.
text=read('lib/v151-schema.ts')
text=text.replace("    sql`ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS part_fcl_training_authorised BOOLEAN NOT NULL DEFAULT FALSE`,\n","")
text=text.replace("    sql`ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS part_fcl_training_authorised_from TEXT NOT NULL DEFAULT ''`,\n","")
write('lib/v151-schema.ts',text)

text=read('lib/data/database.ts')
text=text.replace(',a.part_fcl_training_authorised,a.part_fcl_training_authorised_from','')
write('lib/data/database.ts',text)

text=read('app/(protected)/database/actions.ts')
text=re.sub(r',trainingAuthorised=s\(form,"part_fcl_training_authorised"\)==="yes",trainingFrom=s\(form,"part_fcl_training_authorised_from"\)', '', text, count=1)
text=text.replace('  if(trainingAuthorised&&(!creditClass||!validIsoDate(trainingFrom)))return{ok:false,message:"Annex-I instructor-training credit needs a valid-from date."};\n','')
text=text.replace(',part_fcl_training_authorised=${trainingAuthorised},part_fcl_training_authorised_from=${trainingAuthorised?trainingFrom:""}','')
text=text.replace(',part_fcl_training_authorised,part_fcl_training_authorised_from','')
text=text.replace(',${trainingAuthorised},${trainingAuthorised?trainingFrom:""}','')
text=text.replace(',part_fcl_training_authorised=EXCLUDED.part_fcl_training_authorised,part_fcl_training_authorised_from=EXCLUDED.part_fcl_training_authorised_from','')
write('app/(protected)/database/actions.ts',text)

text=read('components/aircraft-manager.tsx')
text=re.sub(r',trainingAuthorised=aircraft\?\.part_fcl_training_authorised===true\|\|Number\(aircraft\?\.part_fcl_training_authorised\)===1', '', text, count=1)
text=re.sub(r'\s*<label className="wide aircraft-credit-check"><input type="checkbox" name="part_fcl_training_authorised".*?</label>\s*<label>Training credit from<input name="part_fcl_training_authorised_from".*?</label>', '', text, count=1, flags=re.S)
text=text.replace('For Annex-I / Article 2(8) aircraft only. Used for FCL.140.A and FCL.740.A, never FCL.060.','For Annex-I / Article 2(8) aircraft only. Eligible ULL hours and take-offs/landings can support FCL.140.A and FCL.740.A; never FCL.060. The mandatory FI/CRI refresher is not credited from ULL.')
write('components/aircraft-manager.tsx',text)

# Recency flight carries the native ULL starts counter. Historically this is the
# take-off/start count in the ULL logbook and avoids adding another field to normal entry.
text=read('lib/recency-engine.ts')
text=text.replace('landingsDay:number;landingsNight:number;movementEvidenceRecorded?', 'landingsDay:number;landingsNight:number;starts?:number;movementEvidenceRecorded?',1)
text=text.replace(';partFclTrainingAuthorised?:boolean;partFclTrainingAuthorisedFrom?:string','')
replace_once('lib/recency-engine.ts',
'const annexCredit=(flight:RecencyFlight,target:string,training=false)=>upper(flight.evidence)==="ULL"&&upper(flight.partFclCreditClass)===target&&Boolean(String(flight.partFclCreditBasis??"").trim())&&Boolean(dateFrom(flight.partFclCreditFrom))&&flight.date>=dateFrom(flight.partFclCreditFrom)&&(!training||(Boolean(flight.partFclTrainingAuthorised)&&Boolean(dateFrom(flight.partFclTrainingAuthorisedFrom))&&flight.date>=dateFrom(flight.partFclTrainingAuthorisedFrom)));',
'const annexCredit=(flight:RecencyFlight,target:string)=>upper(flight.evidence)==="ULL"&&upper(flight.partFclCreditClass)===target&&Boolean(String(flight.partFclCreditBasis??"").trim())&&Boolean(dateFrom(flight.partFclCreditFrom))&&flight.date>=dateFrom(flight.partFclCreditFrom);')
replace_once('lib/recency-engine.ts',
'const laplExperienceEligible=(flight:RecencyFlight)=>Boolean(laplClass(flight))&&laplExperienceRole(flight)&&(!(upper(flight.evidence)==="ULL"&&["DUAL","SOLO"].includes(upper(flight.role)))||annexCredit(flight,laplClass(flight),true));',
'const laplExperienceEligible=(flight:RecencyFlight)=>Boolean(laplClass(flight))&&(upper(flight.evidence)==="ULL"?upper(flight.role)==="PIC":laplExperienceRole(flight));')
replace_once('lib/recency-engine.ts',
'const isLaplRefresher=(flight:RecencyFlight)=>Boolean(flight.instructorSigned)&&upper(flight.role)==="DUAL"&&Boolean(laplClass(flight))&&(upper(flight.evidence)!=="ULL"||annexCredit(flight,laplClass(flight),true))&&(upper(flight.purposeCode)==="LAPL_FCL140A_REFRESHER"||(!String(flight.purposeCode??"").trim()&&legacyRefresher(flight)));',
'const isLaplRefresher=(flight:RecencyFlight)=>Boolean(flight.instructorSigned)&&upper(flight.role)==="DUAL"&&upper(flight.evidence)!=="ULL"&&Boolean(laplClass(flight))&&(upper(flight.purposeCode)==="LAPL_FCL140A_REFRESHER"||(!String(flight.purposeCode??"").trim()&&legacyRefresher(flight)));')
replace_once('lib/recency-engine.ts',
'export const isClassRefresherFlight=(flight:RecencyFlight)=>Boolean(flight.instructorSigned)&&upper(flight.role)==="DUAL"&&["SEP","TMG"].some(value=>directClass(flight,value)||annexCredit(flight,value,true))&&(upper(flight.purposeCode)==="SEP_TMG_FCL740A_REFRESHER"||/(^|·\\s*)FCL[.]740[.]A refresher training(\\s*·|$)/i.test(String(flight.task??"")));',
'export const isClassRefresherFlight=(flight:RecencyFlight)=>Boolean(flight.instructorSigned)&&upper(flight.role)==="DUAL"&&upper(flight.evidence)!=="ULL"&&["SEP","TMG"].some(value=>directClass(flight,value))&&(upper(flight.purposeCode)==="SEP_TMG_FCL740A_REFRESHER"||/(^|·\\s*)FCL[.]740[.]A refresher training(\\s*·|$)/i.test(String(flight.task??"")));')

sub_once('lib/recency-engine.ts',r'export function evaluateLaplA\(flights:RecencyFlight\[],today:string,evidence:RecencyEvidence\[]=\[]\):RecencyEvaluation\{.*?\n\}\n\nexport function evaluatePassengerCurrencyMode',r'''export function evaluateLaplA(flights:RecencyFlight[],today:string,evidence:RecencyEvidence[]=[]):RecencyEvaluation{
  const start=rollingYearsStart(today,2),window=flights.filter(f=>within(f,start,today)),eligible=window.filter(laplExperienceEligible),directMovements=eligible.filter(f=>upper(f.evidence)!=="ULL"&&Boolean(f.movementEvidenceRecorded)),annex=eligible.filter(f=>upper(f.evidence)==="ULL"),refresher=window.filter(isLaplRefresher);
  const annexTakeoffs=annex.reduce((sum,f)=>sum+Math.max(0,Number(f.starts)||0),0),annexLandings=annex.reduce((sum,f)=>sum+Math.max(0,f.landingsDay)+Math.max(0,f.landingsNight),0),takeoffs=directMovements.reduce((sum,f)=>sum+movementCount(f,"takeoff"),0)+annexTakeoffs,landings=directMovements.reduce((sum,f)=>sum+movementCount(f,"landing"),0)+annexLandings,incompleteMovements=eligible.filter(f=>upper(f.evidence)!=="ULL"&&!f.movementEvidenceRecorded).length;
  const base=evaluateLaplMetrics({flightMinutes:eligible.reduce((sum,f)=>sum+Math.max(0,f.minutes),0),takeoffs,landings,refresherMinutes:refresher.reduce((sum,f)=>sum+Math.max(0,f.minutes),0),ullMinutes:annex.reduce((sum,f)=>sum+Math.max(0,f.minutes),0),ullLandings:annexLandings});
  const takeoffContributions=[...movementContributions(directMovements,"takeoff"),...annex.flatMap(f=>Math.max(0,Number(f.starts)||0)?[{date:f.date,value:Math.max(0,Number(f.starts)||0)}]:[])],landingCredits=[...movementContributions(directMovements,"landing"),...landingContributions(annex)],limited=base.status!=="current"&&incompleteMovements>0,experienceForecast=base.status==="current"?[contributionForecast(minuteContributions(eligible),720,date=>addDays(addYears(date,2),1)),contributionForecast(takeoffContributions,12,date=>addDays(addYears(date,2),1)),contributionForecast(landingCredits,12,date=>addDays(addYears(date,2),1)),contributionForecast(minuteContributions(refresher),60,date=>addDays(addYears(date,2),1))].filter((value):value is string=>Boolean(value)).sort()[0]:undefined;
  const latestCheck=evidence.filter(item=>item.kind==="LAPL_PROFICIENCY_CHECK"&&item.date>=start&&item.date<=today).sort((a,b)=>b.date.localeCompare(a.date))[0],checkForecast=latestCheck?addDays(addYears(latestCheck.date,2),1):undefined;
  if(latestCheck){const forecasts=[experienceForecast,checkForecast].filter((value):value is string=>Boolean(value)).sort(),forecast=base.status==="current"?forecasts.at(-1):checkForecast;return{...base,status:"current",badge:"CURRENT",summary:`Current via LAPL(A) proficiency check passed ${latestCheck.date}`,forecastDate:forecast,note:`Examiner evidence: ${latestCheck.signer} · ${latestCheck.reference}. User-declared evidence; authority records remain controlling.`,meta:{...(base.meta??{}),proficiencyCheck:true,incompleteMovementFlights:incompleteMovements,annexTakeoffs}}}
  return{...base,status:limited?"attention":base.status,badge:limited?"LIMITED DATA":base.status==="current"?"CURRENT":base.badge,forecastDate:experienceForecast,note:`${base.note} Dual and supervised-solo Part-FCL experience is counted only with current instructor-signed evidence. Eligible Czech ULL / Annex-I PIC hours and the native ULL start/landing counts may contribute when the aircraft profile contains an explicit FCL.035(a)(4) credit basis and valid-from date. ULL instructor flights never satisfy the mandatory 1-hour FI/CRI refresher element.`,meta:{...(base.meta??{}),incompleteMovementFlights:incompleteMovements,annexTakeoffs}};
}

export function evaluatePassengerCurrencyMode''',flags=re.S)

# FCL.740.A uses the same qualified ULL native starts/landings for the experience route,
# while the refresher remains Part-FCL/external evidence only.
replace_once('lib/recency-engine.ts',
'const eligibleClasses=combineSepTmg?["SEP","TMG"]:[aircraftClass],classEligible=(f:RecencyFlight)=>eligibleClasses.some(value=>directClass(f,value)||annexCredit(f,value)),window=input.flights.filter(f=>f.date>=experienceStart&&f.date<=today&&classEligible(f)&&pilotFlyingRole(f.role)&&(!(upper(f.evidence)==="ULL"&&["DUAL","SOLO"].includes(upper(f.role)))||eligibleClasses.some(value=>annexCredit(f,value,true)))),pic=window.filter(f=>picRole(f.role)),movementFlights=window.filter(f=>upper(f.evidence)!=="ULL"&&Boolean(f.movementEvidenceRecorded)),flightRefreshers=window.filter(isClassRefresherFlight);',
'const eligibleClasses=combineSepTmg?["SEP","TMG"]:[aircraftClass],classEligible=(f:RecencyFlight)=>eligibleClasses.some(value=>directClass(f,value)||annexCredit(f,value)),window=input.flights.filter(f=>f.date>=experienceStart&&f.date<=today&&classEligible(f)&&pilotFlyingRole(f.role)&&(upper(f.evidence)!=="ULL"||upper(f.role)==="PIC")),pic=window.filter(f=>picRole(f.role)),directMovementFlights=window.filter(f=>upper(f.evidence)!=="ULL"&&Boolean(f.movementEvidenceRecorded)),annexMovementFlights=window.filter(f=>upper(f.evidence)==="ULL"),flightRefreshers=window.filter(isClassRefresherFlight);')
replace_once('lib/recency-engine.ts',
'exemption=evidence.find(item=>item.kind==="CLASS_REFRESHER_EXEMPTION"&&eligibleClasses.includes(item.aircraftClass)&&item.date>=experienceStart&&item.date<=today),takeoffs=movementFlights.reduce((sum,f)=>sum+movementCount(f,"takeoff"),0),landings=movementFlights.reduce((sum,f)=>sum+movementCount(f,"landing"),0),incompleteMovements=window.filter(f=>upper(f.evidence)!=="ULL"&&!f.movementEvidenceRecorded).length;',
'exemption=evidence.find(item=>item.kind==="CLASS_REFRESHER_EXEMPTION"&&eligibleClasses.includes(item.aircraftClass)&&item.date>=experienceStart&&item.date<=today),takeoffs=directMovementFlights.reduce((sum,f)=>sum+movementCount(f,"takeoff"),0)+annexMovementFlights.reduce((sum,f)=>sum+Math.max(0,Number(f.starts)||0),0),landings=directMovementFlights.reduce((sum,f)=>sum+movementCount(f,"landing"),0)+annexMovementFlights.reduce((sum,f)=>sum+Math.max(0,f.landingsDay)+Math.max(0,f.landingsNight),0),incompleteMovements=window.filter(f=>upper(f.evidence)!=="ULL"&&!f.movementEvidenceRecorded).length;')
text=read('lib/recency-engine.ts')
text=text.replace('instructor-training credit additionally requires the recorded training authorisation.','eligible ULL native start/landing counts may support the experience route, but ULL flights never satisfy the FI/CRI refresher element.')
write('lib/recency-engine.ts',text)

# Service joins only the aircraft eligibility data and carries native ULL starts into the engine.
text=read('lib/recency-service.ts')
text=text.replace('SELECT f.date,f.evidence,','SELECT f.date,f.starts,f.evidence,',1)
text=text.replace(',a.part_fcl_training_authorised,a.part_fcl_training_authorised_from','')
text=text.replace('date:t(row.date).slice(0,10),evidence:', 'date:t(row.date).slice(0,10),starts:Number(row.starts)||0,evidence:',1)
text=text.replace(',partFclTrainingAuthorised:Boolean(row.part_fcl_training_authorised),partFclTrainingAuthorisedFrom:t(row.part_fcl_training_authorised_from).slice(0,10)','')
write('lib/recency-service.ts',text)

# Documentation and regression coverage reflect the corrected Czech ULL boundary.
text=read('ROADMAP.md')
text=text.replace('instructor-training credit additionally requires an explicit authorisation and valid-from date','eligible ULL hours and native start/landing counts may contribute; ULL flights never satisfy the mandatory FI/CRI refresher element')
text=text.replace('conservatively do not infer Annex-I take-off/landing credits from flight hours','use the native ULL start and landing counters for qualified aircraft instead of manufacturing movements from flight hours')
write('ROADMAP.md',text)

text=read('REGULATORY_CORE_V151.md')
text=text.replace('Instructor-training credit additionally requires the aircraft to be explicitly marked as authorised for that training and a training-authorisation valid-from date.','Eligible Czech ULL PIC hours and native ULL start/landing counts may contribute when the aircraft is explicitly qualified in its profile. ULL flights do not satisfy the mandatory FI/CRI refresher element.')
text=text.replace('eligible Annex-I **hours** may contribute to FCL.140.A and FCL.740.A, while take-off/landing counts are not inferred from those hours.','eligible ULL **hours** and the native ULL **start/landing counters** may contribute to FCL.140.A and FCL.740.A. FlyTally does not manufacture movement counts from flight time.')
write('REGULATORY_CORE_V151.md',text)

p=Path(ROOT/'tests/v151-regulatory-correctness.test.ts')
s=p.read_text(encoding='utf-8')
extra=r'''

test("qualified Czech ULL counts LAPL hours and native starts/landings but never the FI refresher",()=>{
  const ull=flight({evidence:"ULL",aircraftClass:"ULL",role:"PIC",minutes:720,starts:12,landingsDay:12,movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0,partFclCreditClass:"SEP",partFclCreditBasis:"CAA CZ / FCL.035(a)(4) eligible ULL matching SEP(land)",partFclCreditFrom:"2025-01-01"});
  const noRefresher=evaluateLaplA([ull],"2026-08-31");
  assert.equal(noRefresher.requirements.find(item=>item.id==="flight-time")?.met,true);
  assert.equal(noRefresher.requirements.find(item=>item.id==="landings")?.met,true);
  assert.equal(noRefresher.requirements.find(item=>item.id==="refresher")?.met,false);
  const ullFakeRefresher=flight({...ull,role:"DUAL",instructorSigned:true,purposeCode:"LAPL_FCL140A_REFRESHER",minutes:60});
  assert.equal(evaluateLaplA([ull,ullFakeRefresher],"2026-08-31").requirements.find(item=>item.id==="refresher")?.met,false);
});
'''
if 'qualified Czech ULL counts LAPL hours and native starts/landings' not in s:
    s += extra
p.write_text(s,encoding='utf-8')
