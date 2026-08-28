export function cronRequestAuthorized(configuredSecret:unknown,authorization:unknown){
  const secret=String(configuredSecret??"").trim();
  if(!secret)return false;
  return String(authorization??"")===`Bearer ${secret}`;
}
