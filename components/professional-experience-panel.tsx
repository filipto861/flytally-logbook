import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { getProfessionalExperienceForUser } from "@/lib/professional-experience-service";

const hm=(minutes:number)=>minutes?`${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,"0")}`:"—";

export async function ProfessionalExperiencePanel(){
  const{userId}=await requireUser();const{summary,visible}=await getProfessionalExperienceForUser(userId);if(!visible)return null;
  return <section className="panel" style={{marginTop:"16px"}}>
    <div className="section-heading"><div><p className="eyebrow">PROFESSIONAL EXPERIENCE</p><h2>Career summary</h2><p className="muted">Certified Part-FCL aeroplane & helicopter evidence.</p></div><Link className="secondary-link" href="/statistics?section=career">Open career report</Link></div>
    <div className="mini-metrics">
      <div><span>Total certified</span><b>{hm(summary.totalMinutes)}</b><small>{summary.flights} flight{summary.flights===1?"":"s"}</small></div>
      <div><span>PIC</span><b>{hm(summary.picMinutes)}</b><small>Ordinary PIC only</small></div>
      <div><span>Supervised command</span><b>{hm(summary.spicMinutes+summary.picusMinutes)}</b><small>SPIC {hm(summary.spicMinutes)} · PICUS {hm(summary.picusMinutes)}</small></div>
      <div><span>Co-pilot / MP</span><b>{hm(summary.copilotMinutes+summary.cruiseReliefMinutes)} / {hm(summary.multiPilotMinutes)}</b><small>Detailed role, operator and type reporting in Career</small></div>
    </div>
    <p className="muted">This compact view is evidence only. It does not validate employment, operator qualifications, licences or duty-time compliance.</p>
  </section>;
}
