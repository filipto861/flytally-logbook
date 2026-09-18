export type PushPreferences={enabled:boolean;compliance:boolean;activity:boolean;security:boolean};
export type PushConfig={configured:boolean;publicKey:string;preferences:PushPreferences;devices:number};
export type PushDeviceState="loading"|"enabled"|"available"|"install-required"|"denied"|"unsupported"|"unavailable";

const b64ToBytes=(value:string)=>{
  const normalized=(value+"=".repeat((4-value.length%4)%4)).replace(/-/g,"+").replace(/_/g,"/");
  const raw=atob(normalized),bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i+=1)bytes[i]=raw.charCodeAt(i);
  return bytes;
};
export function pushStandalone(){return typeof window!=="undefined"&&(window.matchMedia("(display-mode: standalone)").matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone))}
export function pushIos(){return typeof navigator!=="undefined"&&/iPad|iPhone|iPod/.test(navigator.userAgent)}
export function pushSupported(){return typeof window!=="undefined"&&"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window}

export async function loadPushConfig():Promise<PushConfig|null>{
  try{const response=await fetch("/api/push/config",{cache:"no-store",headers:{accept:"application/json"}});if(!response.ok)return null;return await response.json() as PushConfig}catch{return null}
}
export async function currentPushSubscription(){
  if(!pushSupported())return null;
  const registration=await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}
export async function pushDeviceState():Promise<PushDeviceState>{
  if(pushIos()&&!pushStandalone())return"install-required";
  if(!pushSupported())return"unsupported";
  if(Notification.permission==="denied")return"denied";
  const subscription=await currentPushSubscription();
  return subscription?"enabled":"available";
}
export async function enablePush(publicKey:string){
  if(pushIos()&&!pushStandalone())throw new Error("Install FlyTally on your Home Screen first.");
  if(!pushSupported())throw new Error("Push notifications are not supported by this browser.");
  const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
  if(permission!=="granted")throw new Error(permission==="denied"?"Notifications are blocked in your browser.":"Notification permission was not granted.");
  const registration=await navigator.serviceWorker.ready;
  let subscription=await registration.pushManager.getSubscription();
  if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(publicKey)});
  const json=subscription.toJSON();
  const response=await fetch("/api/push/subscription",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({endpoint:subscription.endpoint,keys:json.keys??{}})});
  if(!response.ok){await subscription.unsubscribe().catch(()=>false);throw new Error("FlyTally could not register this device for push notifications.");}
  return subscription;
}
export async function disablePushOnDevice(){
  if(!pushSupported())return;
  const subscription=await currentPushSubscription();if(!subscription)return;
  await fetch("/api/push/subscription",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({endpoint:subscription.endpoint})}).catch(()=>undefined);
  await subscription.unsubscribe().catch(()=>false);
}
export async function updatePushPreferences(preferences:PushPreferences){
  const response=await fetch("/api/push/preferences",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(preferences)});
  if(!response.ok)throw new Error("Notification preferences could not be saved.");
  return (await response.json() as {preferences:PushPreferences}).preferences;
}
