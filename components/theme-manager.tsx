"use client";

import { useEffect } from "react";
import type { AppearancePreference } from "@/lib/ui-preferences";

const DARK_COLOR="#071018",LIGHT_COLOR="#f4f7fb";

function applyTheme(preference:AppearancePreference){
  const resolved=preference==="system"?(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):preference;
  const root=document.documentElement;
  root.dataset.theme=resolved;
  root.dataset.themePreference=preference;
  root.style.colorScheme=resolved;
  const themeMeta=document.querySelector('meta[name="theme-color"]');
  if(themeMeta)themeMeta.setAttribute("content",resolved==="light"?LIGHT_COLOR:DARK_COLOR);
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
