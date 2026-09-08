import { formatInsightDuration } from "@/lib/pilot-insights";
import type { ProfessionalExperienceBreakdownRow } from "@/lib/professional-experience";
import type { ProfessionalExperienceData } from "@/lib/professional-experience-service";

const duration=(minutes:number)=>formatInsightDuration(minutes);
const roleLabel=(role:string)=>({"FI":"Instructor","INSTRUCTOR":"Instructor","EXAMINER":"Examiner","CO-PILOT":"Co-pilot","CRUISE-RELIEF CO-PILOT":"Cruise-relief co-pilot","PICUS":"PICUS","SPIC":"SPIC","PIC":"PIC","SOLO":"Solo","DUAL":"Dual"} as Record<string,string>)[role]||role;
const combinedSupervised=(row:ProfessionalExperienceBreakdownRow)=>row.spicMinutes+row.picusMinutes;
const combinedCopilot=(row:ProfessionalExperienceBreakdownRow)=>row.copilotMinutes+row.cruiseReliefMinutes;
const combinedInstruction=(row:ProfessionalExperienceBreakdownRow)=>row.instructorMinutes+row.examinerMinutes;

function Table({headings,empty,children}:{headings:string[];empty:boolean;children:React.ReactNode}){
  if(empty)return <p className="empty-state">No recorded evidence in this breakdown.</p>;
  return <div className="table-scroll"><table><thead><tr>{headings.map((heading,index)=><th key={`${heading}-${index}`}>{heading}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

export function ProfessionalPilotWorkspace({data}:{data:ProfessionalExperienceData}){
  if(!data.visible)return null;
  const s=data.summary,scopeLabel=data.scope==="ALL"?"Aeroplane & helicopter":data.scope==="AEROPLANE"?"Aeroplane":"Helicopter";
  const query=data.scope==="ALL"?"":`&category=${encodeURIComponent(data.scope)}`;
  return <>
    <section className="panel">
      <div className="section-heading"><div><p className="eyebrow">PROFESSIONAL EXPERIENCE</p><h2>Professional pilot workspace</h2><p className="muted">Certified Part-FCL {scopeLabel.toLowerCase()} records only. PICUS, SPIC, co-pilot and instructor/examiner evidence remain separate from ordinary PIC.</p></div><span className="dashboard-route-actions"><a className="secondary-link" href={`/api/export/professional?format=csv${query}`}>CSV</a><a className="primary-link" href={`/api/export/professional?format=xls${query}`}>Export report</a></span></div>
      <div className="mini-metrics">
        <div><span>Total certified</span><b>{duration(s.totalMinutes)}</b><small>{s.flights} creditable flight{s.flights===1?"":"s"}</small></div>
        <div><span>PIC</span><b>{duration(s.picMinutes)}</b><small>Unsupervised command allocation</small></div>
        <div><span>Supervised command</span><b>{duration(s.spicMinutes+s.picusMinutes)}</b><small>SPIC {duration(s.spicMinutes)} · PICUS {duration(s.picusMinutes)}</small></div>
        <div><span>Co-pilot</span><b>{duration(s.copilotMinutes+s.cruiseReliefMinutes)}</b><small>Including cruise relief {duration(s.cruiseReliefMinutes)}</small></div>
        <div><span>Instructor / examiner</span><b>{duration(s.instructorMinutes+s.examinerMinutes)}</b><small>Instructor {duration(s.instructorMinutes)} · Examiner {duration(s.examinerMinutes)}</small></div>
        <div><span>Multi-pilot</span><b>{duration(s.multiPilotMinutes)}</b><small>Explicit MP records only</small></div>
        <div><span>IFR / Night</span><b>{duration(s.ifrMinutes)} / {duration(s.nightMinutes)}</b><small>Within creditable professional time</small></div>
      </div>
      <p className="muted">{data.operatorCoverage.unrecordedFlights?`${data.operatorCoverage.unrecordedFlights} creditable flight${data.operatorCoverage.unrecordedFlights===1?" has":"s have"} no recorded operator. `:""}Recorded operator labels and CAT/NCC/SPO context are pilot-entered evidence; FlyTally does not treat them as employment or operator-qualification verification.</p>
    </section>

    <section className="panel">
      <div className="section-heading"><div><p className="eyebrow">RECORDED OPERATOR</p><h2>Operator experience</h2><p className="muted">Grouped only by the operator name saved on certified flights. Blank operator fields are not inferred.</p></div><span>{data.operators.length}</span></div>
      <Table empty={!data.operators.length} headings={["Recorded operator","Flights","Certified time","PIC","SPIC / PICUS","Co-pilot","Instructor / examiner","MP","Last flown"]}>{data.operators.map(row=><tr key={row.key}><td><strong>{row.label}</strong></td><td>{row.flights}</td><td>{duration(row.minutes)}</td><td>{duration(row.picMinutes)}</td><td>{duration(combinedSupervised(row))}</td><td>{duration(combinedCopilot(row))}</td><td>{duration(combinedInstruction(row))}</td><td>{duration(row.multiPilotMinutes)}</td><td>{row.lastDate||"—"}</td></tr>)}</Table>
    </section>

    <section className="panel">
      <div className="section-heading"><div><p className="eyebrow">AIRCRAFT TYPE</p><h2>Professional experience by type</h2><p className="muted">Uses the aircraft type snapshot stored on each certified flight.</p></div><span>{data.aircraftTypes.length}</span></div>
      <Table empty={!data.aircraftTypes.length} headings={["Aircraft type","Flights","Certified time","PIC","SPIC","PICUS","Co-pilot","MP","IFR","Last flown"]}>{data.aircraftTypes.map(row=><tr key={row.key}><td><strong>{row.label}</strong></td><td>{row.flights}</td><td>{duration(row.minutes)}</td><td>{duration(row.picMinutes)}</td><td>{duration(row.spicMinutes)}</td><td>{duration(row.picusMinutes)}</td><td>{duration(combinedCopilot(row))}</td><td>{duration(row.multiPilotMinutes)}</td><td>{duration(row.ifrMinutes)}</td><td>{row.lastDate||"—"}</td></tr>)}</Table>
    </section>

    <details className="panel">
      <summary><span><strong>Roles & operation context</strong><small>Explicit recorded evidence behind the professional totals</small></span></summary>
      <div className="entry-section-body">
        <div className="section-heading"><div><h3>Pilot function</h3></div></div>
        <Table empty={!data.roles.length} headings={["Recorded role","Flights","Creditable time","Last flown"]}>{data.roles.map(row=><tr key={row.role}><td><strong>{roleLabel(row.role)}</strong></td><td>{row.flights}</td><td>{duration(row.minutes)}</td><td>{row.lastDate||"—"}</td></tr>)}</Table>
        <div className="section-heading"><div><h3>Operation context</h3><p className="muted">CAT, NCC, SPO and other contexts appear only when explicitly saved on the flight.</p></div></div>
        <Table empty={!data.operationContexts.length} headings={["Recorded context","Flights","Creditable time","Last flown"]}>{data.operationContexts.map(row=><tr key={row.context||"unrecorded"}><td><strong>{row.label}</strong>{!row.recorded?<small>Evidence incomplete</small>:null}</td><td>{row.flights}</td><td>{duration(row.minutes)}</td><td>{row.lastDate||"—"}</td></tr>)}</Table>
      </div>
    </details>
  </>;
}
