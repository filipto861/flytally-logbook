export type FlightIdentity={date:unknown;registration:unknown;offBlock:unknown;departure:unknown;arrival:unknown};

const clean=(value:unknown)=>String(value??"").trim().toUpperCase();

export function flightFingerprint(userId:number,flight:FlightIdentity):string{
  return [userId,clean(flight.date),clean(flight.registration),clean(flight.offBlock),clean(flight.departure),clean(flight.arrival)].join("|");
}
