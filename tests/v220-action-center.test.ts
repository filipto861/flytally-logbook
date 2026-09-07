import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v2.2 separates authoritative pending actions from notification read state",()=>{
  const pending=read("lib/pending-actions.ts"),layout=read("app/(protected)/layout.tsx"),sidebar=read("components/sidebar.tsx");
  assert.match(pending,/flight_participations/);
  assert.match(pending,/pilot_connections/);
  assert.match(pending,/pilot_qualifications/);
  assert.match(pending,/instructor_flight_approvals/);
  assert.match(pending,/p[.]status='pending'/);
  assert.match(pending,/q[.]signature_status='pending'/);
  assert.doesNotMatch(pending,/user_notifications/);
  assert.match(layout,/getPendingActionCount/);
  assert.doesNotMatch(layout,/unreadNotificationCount/);
  assert.match(sidebar,/actionCount>0/);
  assert.match(sidebar,/href="\/actions"/);
  assert.match(sidebar,/pending actions/);
  assert.doesNotMatch(sidebar,/unreadNotifications/);
});

test("v2.2 Action Center reuses existing decision workflows and refreshes inline decisions",()=>{
  const page=read("app/(protected)/actions/page.tsx"),pending=read("lib/pending-actions.ts"),actions=read("app/(protected)/actions/actions.ts");
  assert.match(page,/getPendingActions/);
  assert.match(page,/acceptConnectionAction/);
  assert.match(page,/declineConnectionAction/);
  assert.match(page,/declineSharedFlightAction/);
  assert.match(page,/action[.]primaryLabel/);
  assert.match(pending,/primaryLabel:instructor\?"Review & sign":"Review & add"/);
  assert.match(pending,/primaryLabel:"Review & sign"/);
  assert.match(actions,/acceptConnection\(form\)/);
  assert.match(actions,/declineConnection\(form\)/);
  assert.match(actions,/declineSharedFlight\(participationId,form\)/);
  assert.match(actions,/revalidatePath\("\/actions"\)/);
  assert.match(page,/You’re all caught up/);
  assert.match(page,/Data-quality problems stay in Needs attention/);
});

test("v2.2 keeps Notifications as history and Dashboard surfaces Actions only when pending",()=>{
  const notifications=read("app/(protected)/notifications/page.tsx"),dashboard=read("app/(protected)/dashboard/page.tsx"),icons=read("components/nav-icon.tsx");
  assert.match(notifications,/Anything still waiting for your decision is collected in Actions/);
  assert.match(notifications,/href="\/actions"/);
  assert.match(dashboard,/getPendingActionCount/);
  assert.match(dashboard,/actionCount>0/);
  assert.match(dashboard,/href="\/actions"/);
  assert.match(icons,/actions:/);
});

test("v2.2 pending flight requests require current certified source revision",()=>{
  const pending=read("lib/pending-actions.ts");
  assert.match(pending,/f[.]certified_at IS NOT NULL/);
  assert.match(pending,/COALESCE\(f[.]record_revision,1\)=p[.]source_revision/);
  assert.match(pending,/COALESCE\(f[.]certification_hash,''\)=COALESCE\(p[.]source_hash,''\)/);
  assert.match(pending,/NOT EXISTS\(SELECT 1 FROM flight_participations p WHERE p[.]source_flight_id=a[.]flight_id/);
});
