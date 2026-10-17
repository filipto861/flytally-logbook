/** D3 E1a synthetic-only Docker checks. No docker process, SQL, network or file I/O.
 * Functions accept an injected Docker command callback for deterministic adversarial tests.
 * Not a physical host attestation, production trust boundary, image authenticity proof
 * or real GPS permission mechanism.
 */
const ID_PATTERN=/^[a-f0-9]{64}$/;
const TMPFS=[
  ["/var/lib/postgresql/data",256,true],
  ["/var/run/postgresql",16,false],
  ["/tmp",16,false],
];
const MIB=1024*1024;

export function validContainerId(id){
  return typeof id==="string"&&ID_PATTERN.test(id);
}

function validTmpfsOptions(value,mib,noexec){
  if(typeof value!=="string")return false;
  const parts=value.toLowerCase().split(",").map(x=>x.trim());
  if(parts.some(x=>!x)||new Set(parts).size!==parts.length)return false;
  if(!parts.includes("rw")||!parts.includes("nosuid"))return false;
  if(noexec&&!parts.includes("noexec"))return false;
  // Contradictory rw+ro must never be accepted as an effective writable mount.
  // Other unknown Docker option tokens are not independently attested here.
  if(parts.includes("ro")||parts.includes("suid")||parts.includes("exec")||parts.includes("dev"))return false;
  const sizes=parts.filter(x=>x.startsWith("size="));
  if(sizes.length!==1)return false;
  const raw=sizes[0].slice(5);
  // Known host-config representations: original Docker run flag (256m) or
  // normalized positive bytes (268435456). Other formats fail closed.
  const actual=/^\d+m$/.test(raw)?Number(raw.slice(0,-1))*MIB:
    /^\d+$/.test(raw)?Number(raw):NaN;
  return Number.isSafeInteger(actual)&&actual===mib*MIB;
}

function exactMounts(mounts){
  const paths=TMPFS.map(x=>x[0]);
  if(Array.isArray(mounts)){
    if(mounts.length!==paths.length)return false;
    const destinations=new Set();
    for(const m of mounts){
      if(m===null||typeof m!=="object"||m.Type!=="tmpfs"||
          typeof m.Destination!=="string"||!paths.includes(m.Destination)||
          destinations.has(m.Destination))return false;
      destinations.add(m.Destination);
    }
    return paths.every(path=>destinations.has(path));
  }
  if(mounts===null||typeof mounts!=="object")return false;
  if(Object.keys(mounts).length!==paths.length)return false;
  return TMPFS.every(([path,mib,noexec])=>
    Object.hasOwn(mounts,path)&&
    (mounts[path]===""||validTmpfsOptions(mounts[path],mib,noexec)));
}

export function validateSyntheticContainer(cfg,{id,name,imageId}){
  if(!validContainerId(id)||typeof imageId!=="string"||
      !/^sha256:[a-f0-9]{64}$/.test(imageId)||
      typeof name!=="string"||!/^flytally-r21-synthetic-[a-f0-9]{12}$/.test(name)||
      !cfg||typeof cfg!=="object"||Array.isArray(cfg))return false;
  const host=cfg.HostConfig;
  if(!host||typeof host!=="object")return false;
  const tmpfs=host.Tmpfs;
  return cfg.Id===id&&cfg.Name==="/"+name&&cfg.Image===imageId&&
    cfg.State?.Running===true&&
    cfg.Config?.Labels?.["flytally.purpose"]==="synthetic-rls-research"&&
    host.NetworkMode==="none"&&host.PublishAllPorts===false&&
    host.Privileged===false&&
    (host.Binds==null||(Array.isArray(host.Binds)&&host.Binds.length===0))&&
    (host.Mounts==null||(Array.isArray(host.Mounts)&&host.Mounts.length===0))&&
    (host.VolumesFrom==null||(Array.isArray(host.VolumesFrom)&&host.VolumesFrom.length===0))&&
    (host.PortBindings==null||(typeof host.PortBindings==="object"&&
      !Array.isArray(host.PortBindings)&&Object.keys(host.PortBindings).length===0))&&
    tmpfs!==null&&typeof tmpfs==="object"&&!Array.isArray(tmpfs)&&
    Object.keys(tmpfs).length===TMPFS.length&&
    TMPFS.every(([path,mib,noexec])=>
      Object.hasOwn(tmpfs,path)&&validTmpfsOptions(tmpfs[path],mib,noexec))&&
    exactMounts(cfg.Mounts);
}

export function inspectSyntheticContainer(docker,{id,name,imageId}){
  if(!validContainerId(id)||typeof imageId!=="string"||
      !/^sha256:[a-f0-9]{64}$/.test(imageId))return false;
  const response=docker(["container","inspect","--format","{{json .}}",id]);
  if(!response.ok)return false;
  let cfg;
  try{cfg=JSON.parse(response.output);}catch{return false;}
  return validateSyntheticContainer(cfg,{id,name,imageId});
}

export function cleanupSyntheticContainer(docker,{id,name}){
  const hasId=validContainerId(id);
  // Never report ID-bound successful cleanup if Docker did not provide an ID.
  const removed=docker(["rm","-f",hasId?id:name]);
  if(!hasId)return {verified:false,removed:removed.ok};
  // Use the FULL created container ID, not Docker name matching or a regex.
  // An already auto-removed (--rm) container is acceptable ONLY if listing
  // succeeded and proves that this exact container ID is absent.
  const listing=docker(["ps","-aq","--no-trunc","--filter","id="+id]);
  return {verified:listing.ok&&listing.output==="",removed:removed.ok};
}
