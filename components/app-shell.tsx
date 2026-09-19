import packageMetadata from "@/package.json";
import { Sidebar } from "@/components/sidebar";
import { PwaClient } from "@/components/pwa-client";
import { ThemeManager } from "@/components/theme-manager";
import { ThemeBootstrap } from "@/components/theme-bootstrap";
import { LegalFooter } from "@/components/legal-footer";
import { PushNotificationOnboarding } from "@/components/push-notification-onboarding";
import type { AppearancePreference } from "@/lib/ui-preferences";

const appVersion=packageMetadata.version;
const feedbackHref=`mailto:support@fly-tally.com?subject=${encodeURIComponent(`FlyTally feedback · v${appVersion}`)}`;

export function AppShell({ children,role,attentionCount=0,notificationCount=0,appearance="system" }: { children: React.ReactNode;role:"admin"|"user";attentionCount?:number;notificationCount?:number;appearance?:AppearancePreference }) {
  return (
    <div className="app-grid" data-appearance={appearance}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <ThemeBootstrap preference={appearance}/>
      <ThemeManager preference={appearance}/>
      <Sidebar role={role} attentionCount={attentionCount} notificationCount={notificationCount}/>
      <main id="main-content" tabIndex={-1} className="content" style={{display:"flex",minHeight:"100vh",flexDirection:"column"}}>
        <div>{children}</div>
        <footer style={{marginTop:"auto",paddingTop:"28px",display:"grid",justifyItems:"center",gap:"8px",fontSize:".68rem",color:"var(--text-soft)",opacity:1}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"10px"}}><span>FlyTally v{appVersion}</span><span aria-hidden="true">·</span><a href={feedbackHref} style={{textDecoration:"underline",textUnderlineOffset:"2px"}}>Feedback</a></div>
          <LegalFooter compact/>
        </footer>
      </main>
      <PwaClient/>
      <PushNotificationOnboarding/>
    </div>
  );
}
