import { requireUser } from "@/lib/auth/require-user";
import { getProfessionalExperienceForUser } from "@/lib/professional-experience-service";

const hm=(minutes:number)=>minutes?`${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,"0")}`:"—";

export async function ProfessionalExperiencePanel(){
  const{userId}=await requireUser();const{summary,visible}=await getProfessionalExperienceForUser(userId);if(!visible)return null;
  return <details className="panel" style={{marginTop:"16px"}}>
    <summary><span><strong>Professional experience</strong><small>Certified Part-FCL aeroplane & helicopter records</small></span></summary>
    <div className="entry-section-body">
      <div className="credentials-overview-grid">
        <article className="credentials-overview-card"><span>Total certified</span><strong>{hm(summary.totalMinutes)}</strong><small>{summary.flights} flight{summary.flights===1?"":"s"}</small></article>
        <article className="credentials-overview-card"><span>PIC</span><strong>{hm(summary.picMinutes)}</strong><small>Excludes SPIC / PICUS</small></article>
        <article className="credentials-overview-card"><span>Supervised command</span><strong>{hm(summary.spicMinutes+summary.picusMinutes)}</strong><small>SPIC {hm(summary.spicMinutes)} · PICUS {hm(summary.picusMinutes)}</small></article>
        <article className="credentials-overview-card"><span>Co-pilot</span><strong>{hm(summary.copilotMinutes+summary.cruiseReliefMinutes)}</strong><small>Co-pilot {hm(summary.copilotMinutes)} · Cruise relief {hm(summary.cruiseReliefMinutes)}</small></article>
        <article className="credentials-overview-card"><span>Multi-pilot</span><strong>{hm(summary.multiPilotMinutes)}</strong><small>Explicit MP records only</small></article>
        <article className="credentials-overview-card"><span>IFR / Night</span><strong>{hm(summary.ifrMinutes)} / {hm(summary.nightMinutes)}</strong><small>Within certified creditable flight time</small></article>
      </div>
      {summary.catMinutes>0?<p className="muted">Self-recorded CAT context: <strong>{hm(summary.catMinutes)}</strong>. Operation context is pilot-entered and is not inferred by FlyTally.</p>:null}
      <p className="muted">This is an experience summary only. It does not revalidate licences, ratings, operator qualifications or duty-time compliance.</p>
    </div>
  </details>;
}
