import { serializeBilling } from "./billing.ts";
import { flightDateKey } from "./dashboard-math.ts";

export const EVIDENCE = ["ULL", "EASA"] as const;
export const CLASSES = ["ULL", "SEP", "TMG", "MEP", "SET", "OTHER", "GLIDER"] as const;
export const ROLES = ["PIC", "DUAL", "INSTRUKTOR", "SAFETY PILOT", "CO-PILOT", "PAX", "OBSERVER"] as const;
export const BILLING = ["BLOCK", "AIR"] as const;

export type FlightInput = {
  date: string; registration: string; aircraftType: string; aircraftClass: string;
  evidence: string; departure: string; arrival: string; offBlock: string;
  takeoff: string; landing: string; onBlock: string; starts: number;
  commander: string; instructor: string; role: string; task: string;
  billingBasis: string; note: string;
};

function text(form: FormData, name: string, max: number) {
  return String(form.get(name) ?? "").trim().slice(0, max);
}

function option<T extends readonly string[]>(value: string, values: T, fallback: T[number]) {
  return values.includes(value as T[number]) ? value : fallback;
}

export function parseFlightInput(form: FormData): { data?: FlightInput; error?: string } {
  const date = text(form, "date", 10);
  if (flightDateKey(date)!==date) return { error: "Enter a valid date." };
  const time = (name: string) => text(form, name, 5);
  const times = [time("offBlock"), time("takeoff"), time("landing"), time("onBlock")];
  if (times.some((value) => value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))) return { error: "Times must use HH:MM format." };
  const minute=(value:string)=>value?Number(value.slice(0,2))*60+Number(value.slice(3)):null;
  const delta=(a:string,b:string)=>{const start=minute(a),end=minute(b);return start===null||end===null?null:(end-start+1440)%1440};
  const block=delta(times[0],times[3]),air=delta(times[1],times[2]),taxiOut=delta(times[0],times[1]),taxiIn=delta(times[2],times[3]);
  if(block!==null&&block>18*60)return {error:"BLOCK time exceeds 18 hours. Check Off-block and On-block."};
  if(air!==null&&block!==null&&air>block+5)return {error:"AIR time cannot exceed BLOCK time. Check the time order."};
  if((taxiOut!==null&&taxiOut>180)||(taxiIn!==null&&taxiIn>180))return {error:"Taxi time exceeds 3 hours. Check Off-block, takeoff, landing and On-block."};
  const starts = Math.max(0, Math.min(99, Number.parseInt(text(form, "starts", 2) || "0", 10) || 0));
  const registration = text(form, "registration", 32).toUpperCase();
  if (!registration) return { error: "Select or enter an aircraft registration." };
  const instructor=text(form,"instructor",100);
  return { data: {
    date, registration, aircraftType: text(form, "aircraftType", 80),
    aircraftClass: option(text(form, "aircraftClass", 16).toUpperCase(), CLASSES, "ULL"),
    evidence: option(text(form, "evidence", 8).toUpperCase(), EVIDENCE, "ULL"),
    departure: text(form, "departure", 16).toUpperCase(), arrival: text(form, "arrival", 16).toUpperCase(),
    offBlock: times[0], takeoff: times[1], landing: times[2], onBlock: times[3], starts,
    commander: text(form, "commander", 100), instructor,
    role: instructor?"DUAL":option(text(form, "role", 24).toUpperCase(), ROLES, "PIC"), task: text(form, "task", 160),
    billingBasis: serializeBilling(option(text(form, "billingBasis", 8).toUpperCase(), BILLING, "BLOCK"),text(form,"billingShare",2)), note: text(form, "note", 2000),
  }};
}
