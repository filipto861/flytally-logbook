import { Sidebar } from "@/components/sidebar";
import { PwaClient } from "@/components/pwa-client";
import { ThemeManager } from "@/components/theme-manager";
import type { AppearancePreference } from "@/lib/ui-preferences";

const DARK_COLOR="#071018",LIGHT_COLOR="#f4f7fb";
function themeBootstrapScript(preference:AppearancePreference){
  const p=JSON.stringify(preference);
  return `(function(){var p=${p},r=p==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p,c=r==='light'?'${LIGHT_COLOR}':'${DARK_COLOR}',d=document.documentElement;d.dataset.theme=r;d.dataset.themePreference=p;d.style.colorScheme=r;d.style.backgroundColor=c;var m=document.querySelectorAll('meta[name="theme-color"]'),x=m[0];if(!x){x=document.createElement('meta');x.name='theme-color';document.head.appendChild(x)}x.content=c;x.removeAttribute('media');for(var i=1;i<m.length;i++)m[i].remove();var s=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');if(s)s.content=r==='light'?'default':'black-translucent';})();`;
}

export function AppShell({ children,role,unreadNotifications=0,appearance="system" }: { children: React.ReactNode;role:"admin"|"user";unreadNotifications?:number;appearance?:AppearancePreference }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{__html:themeBootstrapScript(appearance)}}/>
      <div className="app-grid">
        <ThemeManager preference={appearance}/>
        <Sidebar role={role} unreadNotifications={unreadNotifications}/>
        <main className="content">{children}</main>
        <PwaClient/>
      </div>
    </>
  );
}
