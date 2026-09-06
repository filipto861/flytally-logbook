import packageMetadata from "@/package.json";
import { Sidebar } from "@/components/sidebar";
import { PwaClient } from "@/components/pwa-client";
import { ThemeManager } from "@/components/theme-manager";
import { ThemeBootstrap } from "@/components/theme-bootstrap";
import type { AppearancePreference } from "@/lib/ui-preferences";

const appVersion=packageMetadata.version;
const feedbackHref=`mailto:support@fly-tally.com?subject=${encodeURIComponent(`FlyTally feedback · v${appVersion}`)}`;

export function AppShell({ children,role,unreadNotifications=0,attentionCount=0,appearance="system" }: { children: React.ReactNode;role:"admin"|"user";unreadNotifications?:number;attentionCount?:number;appearance?:AppearancePreference }) {
  return (
    <div className="app-grid" data-appearance={appearance}>
      <ThemeBootstrap preference={appearance}/>
      <ThemeManager preference={appearance}/>
      <Sidebar role={role} unreadNotifications={unreadNotifications} attentionCount={attentionCount}/>
      <main className="content" style={{display:"flex",minHeight:"100vh",flexDirection:"column"}}>
        <div>{children}</div>
        <footer style={{marginTop:"auto",paddingTop:"28px",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",fontSize:".68rem",color:"var(--muted)",opacity:.62}}>
          <span>FlyTally v{appVersion}</span>
          <span aria-hidden="true">·</span>
          <a href={feedbackHref} style={{textDecoration:"underline",textUnderlineOffset:"2px"}}>Feedback</a>
        </footer>
      </main>
      <PwaClient/>
    </div>
  );
}
