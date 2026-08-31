"use client";

import { useEffect,useState } from "react";

export type ResolvedTheme="light"|"dark";

export function readResolvedTheme():ResolvedTheme{
  if(typeof document!=="undefined"){
    const theme=document.documentElement.dataset.theme;
    if(theme==="light"||theme==="dark")return theme;
    const shell=document.querySelector<HTMLElement>(".app-grid[data-appearance]")?.dataset.appearance;
    if(shell==="light"||shell==="dark")return shell;
  }
  if(typeof window!=="undefined"&&window.matchMedia("(prefers-color-scheme: light)").matches)return "light";
  return "dark";
}

export function useResolvedTheme(){
  const[theme,setTheme]=useState<ResolvedTheme>("dark");
  useEffect(()=>{
    const update=()=>setTheme(readResolvedTheme());
    update();
    const root=document.documentElement,observer=new MutationObserver(update),media=window.matchMedia("(prefers-color-scheme: light)");
    observer.observe(root,{attributes:true,attributeFilter:["data-theme"]});
    media.addEventListener("change",update);
    window.addEventListener("flytally:themechange",update);
    return()=>{observer.disconnect();media.removeEventListener("change",update);window.removeEventListener("flytally:themechange",update)};
  },[]);
  return theme;
}

export function mapThemePalette(theme:ResolvedTheme){
  return theme==="light"
    ?{route:"#087fb8",routeAlt:"#0b946e",hover:"#08715b",airport:"#0b7f70",markerFill:"#ffffff",start:"#0b946e",end:"#be123c"}
    :{route:"#38bdf8",routeAlt:"#34d399",hover:"#6ee7b7",airport:"#5eead4",markerFill:"#03131d",start:"#34d399",end:"#fb7185"};
}
