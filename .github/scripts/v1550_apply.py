from pathlib import Path

form_path = Path("components/flight-form.tsx")
text = form_path.read_text()
start_marker = '    <section className="entry-section entry-section-primary">'
end_marker = '    <details className="entry-section" open={pilotSectionOpen}>'
start = text.index(start_marker)
end = text.index(end_marker)
replacement = '''    <section className="entry-section entry-section-primary"><p className="section-kicker">Flight essentials</p><div className="form-grid essential-grid">
      <label>Date<input name="date" type="date" value={date} onChange={event=>setDate(event.target.value)} required/></label>
      <label>Registration<select name="registration" value={registration} onChange={e=>pickAircraft(e.target.value)} required><option value="">Select</option>{registrationOptions.map(a=><option key={a.registration} value={a.registration}>{a.registration}{a.aircraft_type?` · ${a.aircraft_type}`:""}</option>)}</select><small><Link href="/database">Manage aircraft</Link></small></label>
      <label>Departure<input name="departure" value={departure} onChange={e=>setDeparture(e.target.value.toUpperCase())} placeholder="LKLT" autoCapitalize="characters"/></label>
      <label>Arrival<input name="arrival" value={arrival} onChange={e=>setArrival(e.target.value.toUpperCase())} placeholder="LKLT" autoCapitalize="characters"/></label>
      <label>Off-block <span className="field-hint">UTC</span><input name="offBlock" type="time" value={off} onChange={e=>setOff(e.target.value)}/></label>
      <label>On-block <span className="field-hint">UTC</span><input name="onBlock" type="time" value={on} onChange={e=>setOn(e.target.value)}/></label>
      <label>Takeoff <span className="field-hint">UTC</span><input name="takeoff" type="time" value={takeoff} onChange={e=>setTakeoff(e.target.value)}/></label>
      <label>Landing <span className="field-hint">UTC</span><input name="landing" type="time" value={landing} onChange={e=>setLanding(e.target.value)}/></label>
      <label>Role<select name="role" value={role} onChange={e=>setRole(e.target.value)} required><option value="">Select role</option>{ROLES.map(x=><option key={x} value={x}>{roleOptionLabel(x)}</option>)}</select>{roleGuidance?<small className="role-guidance">{roleGuidance}</small>:<small>Choose what you did on this flight. Most private flights are PIC.</small>}</label>
      <label>Day landings<input name="landingsDay" type="number" min="0" max="99" value={landingsDay} onChange={event=>changeDayLandings(Number(event.target.value)||0)}/></label>
    </div></section>
'''
form_path.write_text(text[:start] + replacement + text[end:])

css_path = Path("app/globals.css")
css = css_path.read_text()
marker = "/* FlyTally v1.55 — aligned flight essentials */"
if marker not in css:
    css += '''

/* FlyTally v1.55 — aligned flight essentials */
.flight-form .essential-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 18px;align-items:start}
.flight-form .essential-grid>label{min-width:0;align-content:start;gap:7px}
.flight-form .essential-grid>label>input,.flight-form .essential-grid>label>select{width:100%;min-width:0;height:48px;min-height:48px}
.flight-form .essential-grid>label>small{line-height:1.35}
@media(max-width:700px){.flight-form .essential-grid{grid-template-columns:1fr!important;gap:13px}.flight-form .essential-grid>label{width:100%;min-width:0}.flight-form .essential-grid>label>input,.flight-form .essential-grid>label>select{width:100%;min-width:0;height:48px;min-height:48px}}
'''
css_path.write_text(css)

test_path = Path("tests/v155-flight-entry-layout.test.ts")
test_path.write_text('''import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const form=fs.readFileSync("components/flight-form.tsx","utf8");
const css=fs.readFileSync("app/globals.css","utf8");

test("v1.55 flight essentials keep route and timeline fields paired",()=>{
  const essentials=form.slice(form.indexOf('entry-section entry-section-primary'),form.indexOf('open={pilotSectionOpen}'));
  const order=[
    'name="date"','name="registration"',
    'name="departure"','name="arrival"',
    'name="offBlock"','name="onBlock"',
    'name="takeoff"','name="landing"',
    'name="role"','name="landingsDay"'
  ].map(token=>essentials.indexOf(token));
  assert.ok(order.every(index=>index>=0));
  assert.deepEqual([...order].sort((a,b)=>a-b),order);
});

test("v1.55 essentials are equal-width on desktop and single-column on mobile",()=>{
  assert.match(css,/FlyTally v1\.55 — aligned flight essentials/);
  assert.match(css,/\.flight-form \.essential-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:700px\)\{\.flight-form \.essential-grid\{grid-template-columns:1fr!important/);
  assert.match(css,/height:48px;min-height:48px/);
});
''')

roadmap_path = Path("ROADMAP.md")
roadmap = roadmap_path.read_text()
note = '''
## v1.55.0 — Flight Entry Layout & Responsive UX

- Align Flight essentials into predictable two-column pairs on desktop.
- Keep Departure/Arrival, Off-block/On-block and Takeoff/Landing on matching rows.
- Use consistent control sizing and spacing.
- Collapse to one logical single-column sequence on mobile without changing flight data semantics.

'''
if "## v1.55.0 — Flight Entry Layout & Responsive UX" not in roadmap:
    insert = roadmap.find("\n## ")
    roadmap = roadmap[:insert + 1] + note + roadmap[insert + 1:] if insert >= 0 else roadmap + note
    roadmap_path.write_text(roadmap)
