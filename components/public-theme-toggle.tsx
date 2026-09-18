"use client";

import {useEffect,useState} from "react";

type Theme="light"|"dark";

export function PublicThemeToggle(){
  const[theme,setTheme]=useState<Theme|null>(null);

  useEffect(()=>{
    const current=document.documentElement.dataset.theme;
    setTheme(current==="light"?"light":"dark");
  },[]);

  const apply=(next:Theme)=>{
    const root=document.documentElement;
    root.dataset.theme=next;
    root.dataset.themePreference=next;
    root.style.colorScheme=next;
    localStorage.setItem("flytally-public-theme",next);
    setTheme(next);
    window.dispatchEvent(new CustomEvent("flytally:themechange",{detail:{theme:next,preference:next}}));
  };

  return <div className="public-flight-theme-toggle" role="group" aria-label="Viewer theme">
    <button type="button" aria-pressed={theme==="light"} className={theme==="light"?"active":""} onClick={()=>apply("light")}>Light</button>
    <button type="button" aria-pressed={theme==="dark"} className={theme==="dark"?"active":""} onClick={()=>apply("dark")}>Dark</button>
  </div>;
}
