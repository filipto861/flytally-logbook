"use client";

import { useEffect,useState } from "react";

type InstallState={available:boolean;standalone:boolean};
const INSTALL_REQUEST_EVENT="flytally:install-request";
const INSTALL_STATE_EVENT="flytally:install-state";
const INSTALL_STATE_REQUEST_EVENT="flytally:install-state-request";

export function InstallAppControl(){
  const[state,setState]=useState<InstallState>({available:false,standalone:false});
  useEffect(()=>{
    const onState=(event:Event)=>setState((event as CustomEvent<InstallState>).detail);
    window.addEventListener(INSTALL_STATE_EVENT,onState);
    window.dispatchEvent(new Event(INSTALL_STATE_REQUEST_EVENT));
    return()=>window.removeEventListener(INSTALL_STATE_EVENT,onState);
  },[]);
  if(state.standalone)return <div className="install-app-control"><span className="install-app-status">Installed on this device</span></div>;
  return <div className="install-app-control"><button type="button" className="secondary-button" disabled={!state.available} onClick={()=>window.dispatchEvent(new Event(INSTALL_REQUEST_EVENT))}>Install app</button><small>{state.available?"Ready to install on this device.":"If installation is not offered here, use your browser menu and choose Install app / Add to Home Screen."}</small></div>;
}
