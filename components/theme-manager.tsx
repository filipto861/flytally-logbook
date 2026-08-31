"use client";

import { useEffect } from "react";
import type { AppearancePreference } from "@/lib/ui-preferences";

export type ResolvedTheme="light"|"dark";

function resolve(preference:AppearancePreference):ResolvedTheme{
  if(preference!=="system")return preference;
  return window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";
}

function applyTheme(preference:AppearancePreference){
  const resolved=resolve(preference),root=document.documentElement;
  const changed=root.dataset.theme!==resolved||root.dataset.themePreference!==preference;
  root.dataset.theme=resolved;
  root.dataset.themePreference=preference;
  root.style.colorScheme=resolved;
  if(changed)window.dispatchEvent(new CustomEvent("flytally:themechange",{detail:{theme:resolved,preference}}));
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
