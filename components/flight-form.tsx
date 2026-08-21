"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AircraftOption } from "@/lib/data/aircraft";
import type { FlightRow } from "@/lib/data/flights";
import type { FlightActionState } from "@/app/(protected)/flights/actions";
import { BILLING, CLASSES, EVIDENCE, ROLES } from "@/lib/flight-input";

type Action = (state: FlightActionState, data: FormData) => Promise<FlightActionState>;
type Initial = Partial<FlightRow> & Record<string, unknown>;

function Submit() { const { pending } = useFormStatus(); return <button className="primary-button" disabled={pending}>{pending ? "Ukládám…" : "Uložit let"}</button>; }

export function FlightForm({ action, aircraft, initial = {} }: { action: Action; aircraft: AircraftOption[]; initial?: Initial }) {
  const [state, formAction] = useActionState(action, {});
  const [registration, setRegistration] = useState(String(initial.registration ?? aircraft[0]?.registration ?? ""));
  const selected = useMemo(() => aircraft.find((item) => item.registration === registration), [aircraft, registration]);
  const field = (name: string, fallback = "") => String(initial[name] ?? fallback);
  return <form action={formAction} className="flight-form"><div className="form-grid">
    <label>Datum<input name="date" type="date" defaultValue={field("date", new Date().toISOString().slice(0,10))} required /></label>
    <label>Imatrikulace<select name="registration" value={registration} onChange={(e) => setRegistration(e.target.value)} required><option value="">Vyberte</option>{aircraft.map((a) => <option key={a.registration}>{a.registration}</option>)}</select></label>
    <label>Typ letadla<input name="aircraftType" defaultValue={field("aircraft_type", selected?.aircraft_type)} /></label>
    <label>Třída<select name="aircraftClass" defaultValue={field("aircraft_class", selected?.aircraft_class || "ULL")}>{CLASSES.map((x) => <option key={x}>{x}</option>)}</select></label>
    <label>Evidence<select name="evidence" defaultValue={field("evidence", selected?.evidence || "ULL")}>{EVIDENCE.map((x) => <option key={x}>{x}</option>)}</select></label>
    <label>Funkce<select name="role" defaultValue={field("role", selected?.default_role || "PIC")}>{ROLES.map((x) => <option key={x}>{x}</option>)}</select></label>
    <label>Odlet<input name="departure" defaultValue={field("departure")} placeholder="LKLT" /></label>
    <label>Přílet<input name="arrival" defaultValue={field("arrival")} placeholder="LKLT" /></label>
    <label>Off-block<input name="offBlock" type="time" defaultValue={field("off_block")} /></label>
    <label>Vzlet<input name="takeoff" type="time" defaultValue={field("takeoff")} /></label>
    <label>Přistání<input name="landing" type="time" defaultValue={field("landing")} /></label>
    <label>On-block<input name="onBlock" type="time" defaultValue={field("on_block")} /></label>
    <label>Počet přistání<input name="starts" type="number" min="0" max="99" defaultValue={field("starts", "1")} /></label>
    <label>Účtování<select name="billingBasis" defaultValue={field("billing_basis", selected?.billing_basis || "BLOCK")}>{BILLING.map((x) => <option key={x}>{x}</option>)}</select></label>
    <label>Velitel<input name="commander" defaultValue={field("commander")} /></label>
    <label>Instruktor<input name="instructor" defaultValue={field("instructor")} /></label>
    <label className="wide">Úloha<input name="task" defaultValue={field("task")} /></label>
    <label className="wide">Poznámka<textarea name="note" rows={4} defaultValue={field("note")} /></label>
  </div>{state.error ? <p className="form-error" role="alert">{state.error}</p> : null}<div className="form-actions"><Submit /></div></form>;
}
