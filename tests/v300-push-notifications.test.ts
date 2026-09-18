import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { reminderStage,reminderTitle } from "../lib/notification-reminders.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("web push persistence is session-bound and preference-aware",()=>{
  const schema=read("lib/push-schema.ts"),push=read("lib/push-notifications.ts");
  assert.match(schema,/CREATE TABLE IF NOT EXISTS push_preferences/);
  assert.match(schema,/CREATE TABLE IF NOT EXISTS push_subscriptions/);
  assert.match(schema,/session_id UUID NOT NULL REFERENCES auth_sessions\(id\) ON DELETE CASCADE/);
  assert.match(schema,/endpoint TEXT NOT NULL UNIQUE/);
  assert.match(push,/s\.revoked_at IS NULL AND s\.expires_at>NOW\(\)/);
  assert.match(push,/pushCategoryForKind/);
  assert.match(push,/preferences\[category\]/);
});

test("web push uses standards-based VAPID without an external notification provider",()=>{
  const push=read("lib/push-notifications.ts");
  assert.match(push,/createECDH\("prime256v1"\)/);
  assert.match(push,/SESSION_SECRET/);
  assert.match(push,/flytally:web-push:v1/);
  assert.match(push,/Authorization:vapidAuthorization/);
  assert.match(push,/TTL:"86400"/);
  assert.match(push,/push\.services\.mozilla\.com/);
  assert.match(push,/push\.apple\.com/);
  assert.match(push,/googleapis\.com/);
  assert.doesNotMatch(push,/firebase-admin|onesignal|pusher/i);
});

test("all FlyTally notification inserts can trigger push but deduped one-time notices push once",()=>{
  const source=read("lib/notifications.ts");
  assert.ok((source.match(/deliverPushNotification\(userId,input\.kind\)/g)||[]).length===2);
  assert.match(source,/ON CONFLICT\(user_id,dedupe_key\) DO NOTHING RETURNING id/);
  assert.match(source,/if\(rows\[0\]\)await deliverPushNotification/);
});

test("service worker presents push and deep-links notification clicks",()=>{
  const sw=read("public/sw.js");
  assert.match(sw,/addEventListener\("push"/);
  assert.match(sw,/\/api\/push\/latest/);
  assert.match(sw,/showNotification/);
  assert.match(sw,/addEventListener\("notificationclick"/);
  assert.match(sw,/client\.navigate\(target\)/);
  assert.match(sw,/clients\.openWindow\(target\)/);
  assert.doesNotMatch(sw,/fetch.*respondWith/s);
});

test("push is discoverable through onboarding, context and Settings",()=>{
  const shell=read("components/app-shell.tsx"),onboarding=read("components/push-notification-onboarding.tsx"),controls=read("components/push-notification-controls.tsx"),profile=read("app/(protected)/profile/page.tsx"),recency=read("components/recency-compliance-workspace.tsx"),inbox=read("app/(protected)/notifications/page.tsx");
  assert.match(shell,/PushNotificationOnboarding/);
  assert.match(onboarding,/Never miss an important flying deadline/);
  assert.match(onboarding,/Not now/);
  assert.match(onboarding,/14/);
  assert.match(controls,/Flying & compliance/);
  assert.match(controls,/Activity/);
  assert.match(controls,/Account security/);
  assert.match(controls,/INSTALL APP FIRST/);
  assert.match(profile,/PushNotificationSettings/);
  assert.match(recency,/PushNotificationInline context="recency"/);
  assert.match(inbox,/PushNotificationInline context="updates"/);
});

test("existing browser subscriptions are rebound to the current signed-in session",()=>{
  const pwa=read("components/pwa-client.tsx"),route=read("app/api/push/subscription/route.ts");
  assert.match(pwa,/pushManager\.getSubscription\(\)/);
  assert.match(pwa,/\/api\/push\/subscription/);
  assert.match(route,/sessionId:session\.sessionId/);
  assert.match(route,/ON CONFLICT\(user_id\) DO NOTHING/);
});

test("recency push reminders step through notification thresholds instead of repeating daily",()=>{
  assert.equal(reminderStage(30,30),"30");
  assert.equal(reminderStage(20,30),"30");
  assert.equal(reminderStage(7,30),"7");
  assert.equal(reminderStage(2,30),"7");
  assert.equal(reminderStage(1,30),"1");
  assert.equal(reminderStage(0,30),"0");
  assert.equal(reminderStage(-1,30),"expired");
  assert.equal(reminderStage(14,14),"14");
  assert.equal(reminderTitle("Medical",1),"Medical due tomorrow");
  const source=read("lib/recency-service.ts");
  assert.match(source,/reminderStage\(forecastDays,state\.notificationDays\)/);
  assert.match(source,/forecast:\$\{stage\}:/);
});
test("first push registration defaults compliance reminder window to 30 days without overwriting an existing choice",()=>{
  const route=read("app/api/push/subscription/route.ts");
  assert.match(route,/parseRecencyNotificationDays\(preferences\.recency_notification_days\)>0/);
  assert.match(route,/recency_notification_days:30/);
  assert.match(route,/ON CONFLICT\(user_id\) DO NOTHING/);
});

test("privacy erasure removes operational push data",()=>{
  const privacy=read("lib/privacy-account.ts");
  assert.match(privacy,/ensurePushSchema\(\)/);
  assert.match(privacy,/DELETE FROM push_subscriptions WHERE user_id=/);
  assert.match(privacy,/DELETE FROM push_preferences WHERE user_id=/);
});
