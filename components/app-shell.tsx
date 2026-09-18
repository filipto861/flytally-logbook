import packageMetadata from "@/package.json";
import { Sidebar } from "@/components/sidebar";
import { PwaClient } from "@/components/pwa-client";
import { ThemeManager } from "@/components/theme-manager";
import { ThemeBootstrap } from "@/components/theme-bootstrap";
import { LegalFooter } from "@/components/legal-footer";
import type { AppearancePreference } from "@/lib/ui-preferences";

const appVersion=packageMetadata.version;
const feedbackHref=`mailto:support@fly-tally.com?subject=${encodeURIComponent(`FlyTally feedback · v${appVersion}`)}`;

export function AppShell({ children,role,actionCount=0,attentionCount=0,notificationCount=0,appearance="system" }: { children: React.ReactNode;role:"admin"|"user";actionCount?:number;attentionCount?:number;notificationCount?:number;appearance?:AppearancePreference }) {
  return (
    <div className="app-grid" data-appearance={appearance}>
      <ThemeBootstrap preference={appearance}/>
      <ThemeManager preference={appearance}/>
      <Sidebar role={role} actionCount={actionCount} attentionCount={attentionCount} notificationCount={notificationCount}/>
      <main className="content" style={{display:"flex",minHeight:"100vh",flexDirection:"column"}}>
        <div>{children}</div>
        <footer style={{marginTop:"auto",paddingTop:"28px",display:"grid",justifyItems:"center",gap:"8px",fontSize:".68rem",color:"var(--muted)",opacity:.72}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"10px"}}><span>FlyTally v{appVersion}</span><span aria-hidden="true">·</span><a href={feedbackHref} style={{textDecoration:"underline",textUnderlineOffset:"2px"}}>Feedback</a></div>
          <LegalFooter compact/>
        </footer>
      </main>
      <PwaClient/>
    </div>
  );
}
