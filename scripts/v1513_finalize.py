from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def replace_once(path:str,old:str,new:str):
    p=ROOT/path
    text=p.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"Expected source fragment not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old,new,1),encoding="utf-8")

def regex_once(path:str,pattern:str,replacement:str,marker:str):
    p=ROOT/path
    text=p.read_text(encoding="utf-8")
    if marker in text:
        return
    updated,count=re.subn(pattern,replacement,text,count=1,flags=re.S)
    if count!=1:
        raise SystemExit(f"Expected regex did not match exactly once in {path}: {pattern}")
    p.write_text(updated,encoding="utf-8")

# Patch version.
replace_once("package.json",'"version": "1.51.2"','"version": "1.51.3"')

# FCL.035(a)(4): ULL / Annex-I aeroplane PIC experience defaults to SEP credit.
# Explicit class remains an override (e.g. a genuine TMG); an optional valid-from date is still honoured.
replace_once(
    "lib/recency-engine.ts",
    'const annexCredit=(flight:RecencyFlight,target:string)=>upper(flight.evidence)==="ULL"&&upper(flight.partFclCreditClass)===target&&Boolean(String(flight.partFclCreditBasis??"").trim())&&Boolean(dateFrom(flight.partFclCreditFrom))&&flight.date>=dateFrom(flight.partFclCreditFrom);',
    'export const isAnnexCreditForClass=(flight:RecencyFlight,target:string)=>{if(upper(flight.evidence)!=="ULL")return false;const explicitClass=upper(flight.partFclCreditClass),automaticClass=classKey(flight.aircraftClass)==="ULL"?"SEP":"",creditClass=explicitClass||automaticClass;if(creditClass!==target)return false;const from=dateFrom(flight.partFclCreditFrom);return !from||flight.date>=from};\nconst annexCredit=isAnnexCreditForClass;'
)
replace_once(
    "lib/recency-engine.ts",
    'Eligible Czech ULL / Annex-I PIC hours and the native ULL start/landing counts may contribute when the aircraft profile contains an explicit FCL.035(a)(4) credit basis and valid-from date. ULL instructor flights never satisfy the mandatory 1-hour FI/CRI refresher element.',
    'Certified ULL / Annex-I aeroplane PIC experience is automatically credited as SEP for FCL.140.A under FCL.035(a)(4), including native ULL start/landing counts. An explicit aircraft credit class can override the default for a genuine TMG, and an optional valid-from date limits historical credit. ULL instructor flights never satisfy the mandatory 1-hour FI/CRI refresher element.'
)
replace_once(
    "lib/recency-engine.ts",
    'Annex-I / Article 2(8) aircraft contribute only when the aircraft profile contains an explicit FCL.035(a)(4) credit basis and valid-from date; eligible ULL native start/landing counts may support the experience route, but ULL flights never satisfy the FI/CRI refresher element.',
    'Certified ULL / Annex-I aeroplane PIC experience is automatically treated as SEP for the FCL.740.A experience route under FCL.035(a)(4), unless an explicit aircraft class override applies. Native ULL start/landing counts may support the experience route, but ULL flights never satisfy the FI/CRI refresher element.'
)

# Audit view must use the same eligibility model as the calculation.
replace_once(
    "lib/recency-audit.ts",
    'import { isClassRefresherFlight,rollingDaysStart,rollingYearsStart } from "./recency-engine.ts";',
    'import { isAnnexCreditForClass,isClassRefresherFlight,rollingDaysStart,rollingYearsStart } from "./recency-engine.ts";'
)
replace_once(
    "lib/recency-audit.ts",
    'const laplRole=(role:unknown)=>["PIC","DUAL","SOLO"].includes(upper(role));',
    'const laplRole=(role:unknown)=>["PIC","DUAL","SOLO"].includes(upper(role));\nconst laplExperienceRole=(flight:RecencyFlight)=>upper(flight.role)==="PIC"||(["DUAL","SOLO"].includes(upper(flight.role))&&Boolean(flight.instructorSigned));\nconst laplAuditEligible=(flight:RecencyFlight)=>upper(flight.evidence)==="ULL"?upper(flight.role)==="PIC"&&(isAnnexCreditForClass(flight,"SEP")||isAnnexCreditForClass(flight,"TMG")):["SEP","TMG"].includes(classKey(flight.aircraftClass))&&laplExperienceRole(flight);'
)
replace_once(
    "lib/recency-audit.ts",
    'const start=rollingYearsStart(today,2),eligible=flights.filter(f=>f.date>=start&&f.date<=today&&laplRole(f.role)&&(classKey(f.aircraftClass)==="SEP"||classKey(f.aircraftClass)==="TMG"||(upper(f.evidence)==="ULL"&&classKey(f.aircraftClass)==="ULL")));',
    'const start=rollingYearsStart(today,2),eligible=flights.filter(f=>f.date>=start&&f.date<=today&&laplRole(f.role)&&laplAuditEligible(f));'
)
replace_once(
    "lib/recency-audit.ts",
    'const start=addMonths(validUntil,-12),checkStart=addMonths(validUntil,-3),combineSepTmg=Boolean(evaluation.meta?.combineSepTmg),eligibleClasses=combineSepTmg?["SEP","TMG"]:[aircraftClass],window=flights.filter(f=>f.date>=start&&f.date<=today&&eligibleClasses.includes(classKey(f.aircraftClass))&&pilotFlyingRole(f.role)&&upper(f.evidence)!=="ULL"),rows:RecencyAuditRow[]=window.map(f=>{',
    'const start=addMonths(validUntil,-12),checkStart=addMonths(validUntil,-3),combineSepTmg=Boolean(evaluation.meta?.combineSepTmg),eligibleClasses=combineSepTmg?["SEP","TMG"]:[aircraftClass],window=flights.filter(f=>f.date>=start&&f.date<=today&&eligibleClasses.some(value=>upper(f.evidence)==="ULL"?isAnnexCreditForClass(f,value):classKey(f.aircraftClass)===value)&&pilotFlyingRole(f.role)&&(upper(f.evidence)!=="ULL"||upper(f.role)==="PIC")),rows:RecencyAuditRow[]=window.map(f=>{'
)
replace_once(
    "lib/recency-audit.ts",
    '${upper(f.role)}${picRole(f.role)?" · PIC credit":""}${legacy}${refresher?" · signed FI / CRI refresher":""}`',
    '${upper(f.role)} · ${upper(f.evidence)}${picRole(f.role)?" · PIC credit":""}${legacy}${refresher?" · signed FI / CRI refresher":""}`'
)

# Audit service needs aircraft credit overrides so audit and calculation stay identical for atypical ULL/TMG profiles.
replace_once(
    "lib/recency-audit-service.ts",
    'f.approaches_day,f.approaches_night,f.purpose_code,f.task,f.note,EXISTS(',
    'f.approaches_day,f.approaches_night,f.purpose_code,f.task,f.note,a.part_fcl_credit_class,a.part_fcl_credit_basis,a.part_fcl_credit_from,EXISTS('
)
replace_once(
    "lib/recency-audit-service.ts",
    'legacy_movement_candidate FROM flights f WHERE f.user_id=${userId}',
    'legacy_movement_candidate FROM flights f LEFT JOIN aircraft a ON a.user_id=f.user_id AND UPPER(TRIM(a.registration))=UPPER(TRIM(f.registration)) WHERE f.user_id=${userId}'
)
replace_once(
    "lib/recency-audit-service.ts",
    'note:text(row.note),instructorSigned:Boolean(row.instructor_signed)}});',
    'note:text(row.note),instructorSigned:Boolean(row.instructor_signed),partFclCreditClass:text(row.part_fcl_credit_class),partFclCreditBasis:text(row.part_fcl_credit_basis),partFclCreditFrom:text(row.part_fcl_credit_from).slice(0,10)}});'
)

# Aircraft UI: manual profile is now an optional override, not a prerequisite for ordinary ULL -> SEP credit.
replace_once("components/aircraft-manager.tsx",'Part-FCL credit <small>optional · set once per aircraft</small>','Part-FCL credit override <small>optional · ULL defaults to SEP</small>')
replace_once("components/aircraft-manager.tsx",'<option value="">Do not count</option>','<option value="">Automatic · ULL as SEP</option>')
replace_once(
    "components/aircraft-manager.tsx",
    'For Annex-I / Article 2(8) aircraft only. Eligible ULL hours and take-offs/landings can support FCL.140.A and FCL.740.A; never FCL.060. The mandatory FI/CRI refresher is not credited from ULL.',
    'Certified ULL aeroplane PIC experience is automatically treated as SEP for FCL.140.A and the FCL.740.A experience route under FCL.035(a)(4). Use this override only for an atypical class mapping such as a genuine TMG. ULL is never imported into FCL.060, and ULL flights do not satisfy the mandatory FI/CRI refresher.'
)
replace_once(
    "components/aircraft-manager.tsx",
    'Prevents historical flights being credited before the basis applied.',
    'Optional boundary for an explicit override. Leave blank to credit the eligible ULL history.'
)
replace_once(
    "components/aircraft-manager.tsx",
    'Required when credit is enabled. FlyTally never decides eligibility from ULL status alone.',
    'Optional reference for an override or audit note. Ordinary ULL aeroplane PIC credit no longer depends on this field.'
)

# Retire the v1.51 test contract that required a manual ULL profile.
regex_once(
    "tests/v151-regulatory-correctness.test.ts",
    r'test\("ULL is never blanket LAPL credit; explicit aircraft profile credit affects hours only",\(\)=>\{.*?\n\}\);\n\n',
    'test("ULL aeroplane PIC experience is automatic LAPL credit while FCL.060 stays separate",()=>{\n  const ull=flight({evidence:"ULL",aircraftClass:"ULL",role:"PIC",minutes:720,starts:12,landingsDay:12,movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0});\n  const refresher=flight({role:"DUAL",minutes:60,purposeCode:"LAPL_FCL140A_REFRESHER",instructorSigned:true});\n  const credited=evaluateLaplA([ull,refresher],"2026-08-31");\n  assert.equal(credited.status,"current");assert.equal(credited.meta?.ullMinutes,720);\n  assert.notEqual(evaluatePassengerCurrencyMode([ull],"SEP",false,"2026-08-31","day").status,"current");\n});\n\n',
    'ULL aeroplane PIC experience is automatic LAPL credit while FCL.060 stays separate'
)
regex_once(
    "tests/v151-regulatory-correctness.test.ts",
    r'test\("FCL\.740\.A needs both take-offs and landings and does not use Annex-I movements",\(\)=>\{.*?\n\}\);\n\n',
    'test("FCL.740.A keeps movement integrity and automatically accepts eligible ULL experience",()=>{\n  const weak=[flight({minutes:660,landingsDay:12,takeoffsDay:11}),flight({role:"DUAL",minutes:60,landingsDay:0,movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0,purposeCode:"SEP_TMG_FCL740A_REFRESHER",instructorSigned:true})];const result=evaluateClassRevalidation({aircraftClass:"SEP",validUntil:"2026-09-30",today:"2026-08-31",flights:weak});assert.notEqual(result.badge,"READY");\n  const ull=flight({evidence:"ULL",aircraftClass:"ULL",role:"PIC",minutes:720,starts:12,landingsDay:12,movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0}),refresher=flight({role:"DUAL",minutes:60,landingsDay:0,movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0,purposeCode:"SEP_TMG_FCL740A_REFRESHER",instructorSigned:true});const ready=evaluateClassRevalidation({aircraftClass:"SEP",validUntil:"2026-09-30",today:"2026-08-31",flights:[ull,refresher]});assert.equal(ready.badge,"READY");assert.equal(ready.meta?.takeoffs,12);\n});\n\n',
    'FCL.740.A keeps movement integrity and automatically accepts eligible ULL experience'
)
replace_once(
    "tests/v151-regulatory-correctness.test.ts",
    'const ull=flight({evidence:"ULL",aircraftClass:"ULL",role:"PIC",minutes:720,starts:12,landingsDay:12,movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0,partFclCreditClass:"SEP",partFclCreditBasis:"CAA CZ / FCL.035(a)(4) eligible ULL matching SEP(land)",partFclCreditFrom:"2025-01-01"});',
    'const ull=flight({evidence:"ULL",aircraftClass:"ULL",role:"PIC",minutes:720,starts:12,landingsDay:12,movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0});'
)

print("v1.51.3 source migration applied")
