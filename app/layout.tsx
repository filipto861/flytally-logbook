import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./v082.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "Letový zápisník",
  description: "Elektronický letový zápisník",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
  themeColor: "#07111f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
