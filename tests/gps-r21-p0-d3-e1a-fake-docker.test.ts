import test from "node:test";
import assert from "node:assert/strict";
import {
  validateSyntheticContainer,inspectSyntheticContainer,cleanupSyntheticContainer,
  type DockerCall
} from "../research/gps-r21-p0-d3-synthetic-security/container-guards.mjs";

/** Dynamically falsifies real E1a guard functions using synthetic Docker replies.
 * No Docker executable, container, SQL, DB, credentials, network or GPS required.
 * This exercises parser/cleanup logic, not Docker daemon or RLS enforcement.
 */
const id="a".repeat(64);
const imageId="sha256:"+"b".repeat(64);
const name="flytally-r21-synthetic-012345abcdef";
const target={id,name,imageId};
const tmpfs={
  "/var/lib/postgresql/data":"rw,nosuid,noexec,size=256m",
  "/var/run/postgresql":"rw,nosuid,size=16m",
  "/tmp":"rw,nosuid,size=16m",
};
const paths=Object.keys(tmpfs);
const good=()=>({
  Id:id,Name:"/"+name,Image:imageId,
  State:{Running:true},
  Config:{Labels:{"flytally.purpose":"synthetic-rls-research"}},
  HostConfig:{
    NetworkMode:"none",PublishAllPorts:false,Privileged:false,
    Binds:null as string[] | null,PortBindings:null,Tmpfs:{...tmpfs},
    Mounts:null,VolumesFrom:null
  },
  Mounts:paths.map(Destination=>({Type:"tmpfs",Destination}))
});
const copy=<T>(x:T):T=>JSON.parse(JSON.stringify(x)) as T;
const inspect=(payload:unknown,ok=true):DockerCall=>args=>{
  assert.deepEqual(args,["container","inspect","--format","{{json .}}",id]);
  return{ok,output:JSON.stringify(payload)};
};

test("E1a mock-Docker: valid array and documented --tmpfs map both attest",()=>{
  const base=good();
  assert.equal(inspectSyntheticContainer(inspect(base),target),true);
  const mapped={...base,Mounts:Object.fromEntries(paths.map(p=>[p,""]))};
  assert.equal(inspectSyntheticContainer(inspect(mapped),target),true);
  assert.equal(validateSyntheticContainer({...mapped,
    HostConfig:{...mapped.HostConfig,
      Tmpfs:Object.fromEntries(Object.entries(tmpfs).map(([k,v])=>[k,v.replace("size=16m","size=16777216").replace("size=256m","size=268435456")]))
    }
  },target),true);
});

test("E1a mock-Docker: duplicate allowed mount paths cannot replace missing mounts",()=>{
  const cfg=good();
  cfg.Mounts=paths.map(()=>({Type:"tmpfs",Destination:"/tmp"}));
  assert.equal(inspectSyntheticContainer(inspect(cfg),target),false);
  const missing=good();missing.Mounts=missing.Mounts.slice(0,2);
  assert.equal(validateSyntheticContainer(missing,target),false);
  const extra=good();extra.Mounts.push({Type:"tmpfs",Destination:"/unexpected"});
  assert.equal(validateSyntheticContainer(extra,target),false);
  const bind=good();bind.Mounts[0]={Type:"bind",Destination:paths[0]};
  assert.equal(validateSyntheticContainer(bind,target),false);
});

test("E1a mock-Docker: tmpfs map cannot include extra or malicious values",()=>{
  const base=good();
  const cfg={...base,Mounts:Object.fromEntries(paths.map(p=>[p,""]))};
  assert.equal(validateSyntheticContainer(cfg,target),true);
  const injected={...cfg,Mounts:{...cfg.Mounts,"/unexpected":""}};
  assert.equal(validateSyntheticContainer(injected,target),false);
  const bad={...cfg,Mounts:{...cfg.Mounts,"/tmp":"rw,suid,exec,size=16m"}};
  assert.equal(validateSyntheticContainer(bad,target),false);
});

test("E1a mock-Docker: HostConfig.Tmpfs options and sizes are fail-closed",()=>{
  for(const badValue of [
    "", "rw,suid,size=16m", "rw,nosuid,exec,size=16m",
    "rw,nosuid,size=0", "rw,nosuid,size=128m",
    "rw,nosuid", "rw,nosuid,size=16m,size=16m"
  ]){
    const cfg=good();
    cfg.HostConfig.Tmpfs["/tmp"]=badValue;
    assert.equal(validateSyntheticContainer(cfg,target),false,badValue);
  }
  const exec=good();
  exec.HostConfig.Tmpfs["/var/lib/postgresql/data"]="rw,nosuid,size=256m";
  assert.equal(validateSyntheticContainer(exec,target),false);
});

test("E1a mock-Docker: wrong identity, label, network, ports, binds fail",()=>{
  const cases=[
    (x:ReturnType<typeof good>)=>{x.Id="c".repeat(64);},
    (x:ReturnType<typeof good>)=>{x.Name="/another-container";},
    (x:ReturnType<typeof good>)=>{x.Image="sha256:"+"d".repeat(64);},
    (x:ReturnType<typeof good>)=>{x.State.Running=false;},
    (x:ReturnType<typeof good>)=>{x.Config.Labels["flytally.purpose"]="other";},
    (x:ReturnType<typeof good>)=>{x.HostConfig.NetworkMode="bridge";},
    (x:ReturnType<typeof good>)=>{x.HostConfig.PublishAllPorts=true;},
    (x:ReturnType<typeof good>)=>{x.HostConfig.Privileged=true;},
    (x:ReturnType<typeof good>)=>{x.HostConfig.Binds=["/home:/data"];},
    (x:ReturnType<typeof good>)=>{x.HostConfig.PortBindings={"5432/tcp":[{"HostPort":"5432"}]} as never;},
    (x:ReturnType<typeof good>)=>{x.HostConfig.Mounts=[{Type:"bind"}] as never;},
    (x:ReturnType<typeof good>)=>{x.HostConfig.VolumesFrom=["unsafe"] as never;}
  ];
  for(const change of cases){const cfg=copy(good());change(cfg);assert.equal(validateSyntheticContainer(cfg,target),false);}
});

test("E1a mock-Docker: malformed or unavailable inspect never attests",()=>{
  const error: DockerCall=()=>({ok:false,output:""});
  const malformed:DockerCall=()=>({ok:true,output:"{invalid-json"});
  assert.equal(inspectSyntheticContainer(error,target),false);
  assert.equal(inspectSyntheticContainer(malformed,target),false);
  assert.equal(inspectSyntheticContainer(inspect({}),target),false);
  assert.equal(validateSyntheticContainer(null,target),false);
  assert.equal(validateSyntheticContainer(good(),{...target,imageId:"not-digest"}),false);
});

test("E1a mock-Docker: cleanup targets full ID and verifies successful empty ID filter",()=>{
  const calls:string[][]=[];
  const docker:DockerCall=args=>{
    calls.push(args);
    if(args[0]==="rm")return{ok:true,output:id};
    if(args[0]==="ps")return{ok:true,output:""};
    throw Error("unexpected fake Docker command");
  };
  assert.deepEqual(cleanupSyntheticContainer(docker,{id,name}),{verified:true,removed:true});
  assert.deepEqual(calls,[
    ["rm","-f",id],
    ["ps","-aq","--no-trunc","--filter","id="+id]
  ]);
});

test("E1a mock-Docker: auto-removed container can be acknowledged by ID only",()=>{
  const fake:DockerCall=args=>args[0]==="rm"?
    {ok:false,output:""}:{ok:true,output:""};
  assert.deepEqual(cleanupSyntheticContainer(fake,{id,name}),{verified:true,removed:false});
});

test("E1a mock-Docker: remaining ID or list/daemon failure MUST refuse cleanup",()=>{
  for(const ps of [{ok:true,output:id},{ok:false,output:""},{ok:true,output:"other"}]){
    const fake:DockerCall=args=>args[0]==="rm"?
      {ok:false,output:""}:ps;
    assert.deepEqual(cleanupSyntheticContainer(fake,{id,name}),{verified:false,removed:false});
  }
});

test("E1a mock-Docker: invalid start ID cannot produce a verified cleanup",()=>{
  const calls:string[][]=[];
  const fake:DockerCall=args=>{calls.push(args);return{ok:true,output:""};};
  assert.deepEqual(cleanupSyntheticContainer(fake,{id:null,name}),{verified:false,removed:true});
  assert.deepEqual(calls,[["rm","-f",name]]);
});
