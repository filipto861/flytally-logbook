import { formatDuration } from "@/lib/data/dashboard";

const clockPattern=/^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const recordedClock=(value:unknown)=>typeof value==="string"&&clockPattern.test(value)?value:"—";
const completePair=(start:unknown,end:unknown)=>recordedClock(start)!=="—"&&recordedClock(end)!=="—";

type Props={
  blockMinutes:number;
  airMinutes:number;
  offBlock:unknown;
  onBlock:unknown;
  takeoff:unknown;
  landing:unknown;
  landings:number;
  gpsKm:number;
  trackCount:number;
  task:string;
  legacyGpsImportTask:boolean;
  costValue:string;
  costNote:string;
};

export function FlightDetailOverview({
  blockMinutes,airMinutes,offBlock,onBlock,takeoff,landing,landings,gpsKm,trackCount,
  task,legacyGpsImportTask,costValue,costNote,
}:Props){
  const blockKnown=completePair(offBlock,onBlock);
  const airKnown=completePair(takeoff,landing);
  const landingCount=Number.isSafeInteger(landings)&&landings>=0?String(landings):"—";
  const trackTotal=Number.isSafeInteger(trackCount)&&trackCount>=0?trackCount:0;
  const gpsValue=trackTotal>0&&Number.isFinite(gpsKm)&&gpsKm>=0?gpsKm.toFixed(1)+" km":"—";
  return <section className="flight-f3-overview" aria-label="Flight at a glance">
    <div className="flight-f3-time-grid" aria-label="Recorded flight times">
      <article className="flight-f3-time-card">
        <div className="flight-f3-time-heading"><h2>BLOCK</h2><small>Off-block to on-block</small></div>
        <strong>{blockKnown?formatDuration(blockMinutes):"—"}</strong>
        <dl className="flight-f3-clock-pair">
          <div><dt>OFF</dt><dd>{recordedClock(offBlock)}</dd></div>
          <div><dt>ON</dt><dd>{recordedClock(onBlock)}</dd></div>
        </dl>
        {!blockKnown?<small className="flight-f3-time-warning">Complete clock pair not recorded</small>:null}
      </article>
      <article className="flight-f3-time-card">
        <div className="flight-f3-time-heading"><h2>AIR</h2><small>Takeoff to landing</small></div>
        <strong>{airKnown?formatDuration(airMinutes):"—"}</strong>
        <dl className="flight-f3-clock-pair">
          <div><dt>TAKEOFF</dt><dd>{recordedClock(takeoff)}</dd></div>
          <div><dt>LANDING</dt><dd>{recordedClock(landing)}</dd></div>
        </dl>
        {!airKnown?<small className="flight-f3-time-warning">Complete clock pair not recorded</small>:null}
      </article>
    </div>
    <div className="flight-f3-facts" aria-label="Other flight information">
      <section className="flight-f3-fact"><h2>Landings</h2><strong>{landingCount}</strong><p>{task||"Task not recorded"}{legacyGpsImportTask?<span className="legacy-task-inline">LEGACY GPS IMPORT</span>:null}</p></section>
      <section className="flight-f3-fact"><h2>GPS</h2><strong>{gpsValue}</strong><p>{trackTotal===0?"No GPS track":trackTotal===1?"1 GPS track":trackTotal+" GPS tracks"}</p></section>
      <section className="flight-f3-fact flight-f3-cost"><h2>Costs</h2><strong>{costValue}</strong><p>{costNote}</p></section>
    </div>
  </section>;
}
