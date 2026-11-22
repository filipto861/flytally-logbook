import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.0 U1.1 badge represents unread notifications, not all notifications",()=>{
  const layout=read("app/(protected)/layout.tsx");
  const notifications=read("lib/notifications.ts");
  assert.match(layout,/unreadNotificationCount\(session\.userId\)/);
  assert.match(layout,/notificationCount=\{notificationCount\}/);
  assert.match(notifications,/read_at IS NULL/);
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

test("completed connection decisions mark their source notification read",()=>{
  const source=read("app/(protected)/connections/actions.ts");
  assert.ok((source.match(/dedupe_key=/g)||[]).length>=2);
  assert.match(source,/connection:\$\{connection\}/);
  assert.match(source,/read_at=COALESCE\(read_at,NOW\(\)\)/);
});
