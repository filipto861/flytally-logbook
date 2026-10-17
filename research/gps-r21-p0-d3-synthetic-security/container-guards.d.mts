/** Testable synthetic-only Docker configuration assertions (no real daemon I/O). */
export type DockerReply={ok:boolean;output:string;error?:string};
export type DockerCall=(args:string[])=>DockerReply;
export type SyntheticTarget={id:string|null;name:string;imageId:string};
export declare function validContainerId(id:unknown):boolean;
export declare function validateSyntheticContainer(
  config:unknown,target:SyntheticTarget
):boolean;
export declare function inspectSyntheticContainer(
  docker:DockerCall,target:SyntheticTarget
):boolean;
export declare function cleanupSyntheticContainer(
  docker:DockerCall,target:Pick<SyntheticTarget,"id"|"name">
):{verified:boolean;removed:boolean};
