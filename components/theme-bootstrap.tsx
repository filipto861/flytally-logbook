import type { AppearancePreference } from "@/lib/ui-preferences";

export function ThemeBootstrap({preference="system"}:{preference?:AppearancePreference}){
  const script=`(()=>{try{const p=${JSON.stringify(preference)};const light=window.matchMedia("(prefers-color-scheme: light)").matches;const t=p==="system"?(light?"light":"dark"):p;const r=document.documentElement;r.dataset.theme=t;r.dataset.themePreference=p;r.style.colorScheme=t}catch{}})();`;
  return <script data-flytally-theme-bootstrap={preference} dangerouslySetInnerHTML={{__html:script}}/>;
}
