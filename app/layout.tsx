import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "./theme.css";
import "./dashboard-customization.css";
import "./light-interactions.css";
import "./v1342-ui-polish.css";
import "./v135-recency.css";
import "./v1352-recency.css";

export const metadata: Metadata = {
  title: "FlyTally",
  description: "Digital pilot logbook",
  applicationName:"FlyTally",
  manifest:"/manifest.webmanifest",
  icons:{icon:"/logbook_icon_32.png",shortcut:"/logbook_icon_32.png",apple:"/logbook_icon.png"},
  appleWebApp:{capable:true,statusBarStyle:"black-translucent",title:"FlyTally"},
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
      <body>{children}</body>
    </html>
  );
}
