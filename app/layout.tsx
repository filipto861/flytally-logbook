import type { Metadata, Viewport } from "next";
import { ThemeBootstrap } from "@/components/theme-bootstrap";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "./theme.css";
import "./dashboard-customization.css";
import "./light-interactions.css";
import "./v1342-ui-polish.css";
import "./v135-recency.css";
import "./v1352-recency.css";
import "./v1353-fcl060.css";
import "./v1354-recency-audit.css";
import "./v136-mobile.css";
import "./v137-shared-flights.css";
import "./v138-dashboard-insights.css";
import "./v140-flights.css";
import "./v141-gps-review.css";
import "./v142-gps-import.css";
import "./v145-credentials.css";
import "./v146-credentials.css";
import "./v147-everyday.css";
import "./v148-training.css";
import "./v149-linkage.css";
import "./v150-ui-system.css";
import "./v151-regulatory.css";
import "./v153-everyday-ux.css";
import "./v156-mobile-hardening.css";
import "./v157-flight-entry-workflow.css";
import "./v158-flight-entry-polish.css";
import "./v159-flight-entry-structure.css";
import "./v160-adaptive-pilot-workspace.css";
import "./v161-category-flight-entry.css";
import "./v162-sailplane.css";
import "./v250-recency-workspace.css";
import "./v300-u2-credentials.css";
import "./v300-u31-aircraft-airports.css";
import "./v300-aircraft-sharing.css";
import "./v300-u32-data.css";
import "./v300-u33-settings.css";
import "./v300-push.css";
import "./v300-u4-flight-workflow.css";
import "./v301-public-flight-viewer.css";
import "./v300-u6-acceptance.css";

export const metadata: Metadata = {
  title: "FlyTally",
  description: "Digital pilot logbook",
  applicationName:"FlyTally",
  manifest:"/manifest.webmanifest",
  icons:{icon:"/logbook_icon_32.png",shortcut:"/logbook_icon_32.png",apple:"/logbook_icon.png"},
  appleWebApp:{capable:true,statusBarStyle:"default",title:"FlyTally"},
  formatDetection:{telephone:false},
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit:"cover",
  colorScheme: "light dark",
  themeColor:[
    {media:"(prefers-color-scheme: dark)",color:"#071018"},
    {media:"(prefers-color-scheme: light)",color:"#f4f7fb"},
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
        <head><ThemeBootstrap preference="system" /></head>
      <body>{children}</body>
    </html>
  );
}
