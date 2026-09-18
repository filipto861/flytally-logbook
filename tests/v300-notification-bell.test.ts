import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.0 U1.1 keeps notifications out of the navigation hierarchy",()=>{
  const sidebar=read("components/sidebar.tsx");
  assert.match(sidebar,/NotificationBell initialCount=\{notificationCount\}/);
  assert.doesNotMatch(sidebar,/<span>Notifications<\/span>/);
  assert.match(sidebar,/actionCount>0\?<Link/);\n  assert.match(sidebar,/styles\.actionLink/);\n  assert.doesNotMatch(sidebar,/>Activity<\/span>/);
});

test("v3.0 U1.1 badge represents unread notifications, not all notifications",()=>{
  const layout=read("app/(protected)/layout.tsx");
  const notifications=read("lib/notifications.ts");
  assert.match(layout,/unreadNotificationCount\(session\.userId\)/);
  assert.match(layout,/notificationCount=\{notificationCount\}/);
  assert.match(notifications,/read_at IS NULL/);
});

test("v3.0 U1.1 notification bell refreshes while the app remains open",()=>{
  const bell=read("components/notification-bell.tsx");
  assert.match(bell,/POLL_MS=30_000/);
  assert.match(bell,/fetch\("\/api\/notifications\/unread"/);
  assert.match(bell,/window\.addEventListener\("focus"/);
  assert.match(bell,/visibilitychange/);
  assert.match(bell,/count>99\?"99\+":count/);
});

test("v3.0 U1.1 unread endpoint is authenticated and private",()=>{
  const route=read("app/api/notifications/unread/route.ts");
  assert.match(route,/requireUser\(\)/);
  assert.match(route,/unreadNotificationCount\(userId\)/);
  assert.match(route,/private, no-store/);
});

test("v3.0 U1.1 notification mutations invalidate the protected notifications layout",()=>{
  const actions=read("app/(protected)/notifications/actions.ts");
  assert.match(actions,/revalidatePath\("\/notifications","layout"\)/);
});
