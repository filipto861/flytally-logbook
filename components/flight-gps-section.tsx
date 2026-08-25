import { AirportDetectionControl } from "@/components/airport-detection-control";
import { FlightTrackPlayer } from "@/components/flight-track-player";
import { TrackManager } from "@/components/track-manager";
import { getFlightTracks } from "@/lib/data/tracks";
import { measureServerTask } from "@/lib/performance";
import { attachKmlTrack,applyGpsTimes,deleteTrack,redetectFlightAirports } from "@/app/(protected)/flights/actions";

export async function FlightGpsSection({userId,flightId,locked,departure,arrival}:{userId:number;flightId:number;locked:boolean;departure:string;arrival:string}){
  const tracks=await measureServerTask("flight-gps-tracks",()=>getFlightTracks(userId,flightId),450);
  const attach=attachKmlTrack.bind(null,flightId),apply=applyGpsTimes.bind(null,flightId),dropTrack=deleteTrack.bind(null,flightId);
  if(!tracks.length)return <section className="panel no-track"><p className="eyebrow">GPS</p><h2>No GPS track</h2>{!locked?<TrackManager flightId={flightId} tracks={[]} attachAction={attach} applyAction={apply} deleteAction={dropTrack}/>:null}</section>;
  const detect=redetectFlightAirports.bind(null,flightId);
  return <>{!locked?<AirportDetectionControl action={detect} departure={departure} arrival={arrival}/>:null}<FlightTrackPlayer tracks={tracks}/>{!locked?<TrackManager flightId={flightId} tracks={tracks} attachAction={attach} applyAction={apply} deleteAction={dropTrack}/>:null}</>;
}

export function FlightGpsFallback(){return <section className="panel no-track" aria-busy="true"><p className="eyebrow">GPS</p><h2>Loading track…</h2><p className="muted">Flight details are ready while GPS data loads.</p></section>}
