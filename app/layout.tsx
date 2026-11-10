import type { Metadata, Viewport } from "next";
import "./tokens.css";
import "./globals.css";
import "./world.css";
import "./interaction.css";
import "./controls.css";
import "./registration.css";
import "./venue.css";
import "./navigation.css";
import "./mobile.css";
import "./player-select.css";
import "./handheld-menus.css";
import "./windows.css";
import "./footer.css";
export const viewport: Viewport = { viewportFit: "cover" };
export const metadata: Metadata = {
  title: "16-Bit Con — Never stopped playing",
  description:
    "A playable retro convention at the Javits Center. Make your player, explore the hall, and meet Vega at Booth 630.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/mondwest.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/geist-mono.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/geist.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
