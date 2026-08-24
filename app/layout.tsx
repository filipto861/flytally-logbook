import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./v082.css";
import "./v083.css";
import "./v107.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "FlyTally",
  description: "Digital pilot logbook",
  icons:{icon:"/logbook_icon_32.png",shortcut:"/logbook_icon_32.png",apple:"/logbook_icon.png"},
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
  themeColor: "#07111f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
