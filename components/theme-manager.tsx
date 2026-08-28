"use client";

import { useEffect } from "react";
import type { AppearancePreference } from "@/lib/ui-preferences";

const DARK_COLOR="#071018",LIGHT_COLOR="#f4f7fb";
type ResolvedTheme="light"|"dark";

function syncBrowserChrome(resolved:ResolvedTheme){
  const color=resolved==="light"?LIGHT_COLOR:DARK_COLOR;
  const metas=Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
  let primary=metas.shift();
  if(!primary){primary=document.createElement("meta");primary.name="theme-color";document.head.appendChild(primary)}
  primary.setAttribute("content",color);primary.removeAttribute("media");
  for(const extra of metas)extra.remove();
  const statusMeta=document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]');
  if(statusMeta)statusMeta.setAttribute("content",resolved==="light"?"default":"black-translucent");
  document.documentElement.style.backgroundColor=color;
}

function applyTheme(preference:AppearancePreference){
  const resolved:ResolvedTheme=preference==="system"?(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):preference;
  const root=document.documentElement;
  root.dataset.theme=resolved;
  root.dataset.themePreference=preference;
  root.style.colorScheme=resolved;
  syncBrowserChrome(resolved);
}

export function ThemeManager({preference}:{preference:AppearancePreference}){
  useEffect(()=>{
    applyTheme(preference);
    if(preference!=="system")return;
    const media=window.matchMedia("(prefers-color-scheme: light)"),listener=()=>applyTheme("system");
    media.addEventListener("change",listener);
    return()=>media.removeEventListener("change",listener);
  },[preference]);
  return null;
}
