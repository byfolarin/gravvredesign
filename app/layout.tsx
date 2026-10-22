import type { Metadata } from "next";
import Script from "next/script";
// Local font files from the `geist` package, so dev and builds never depend on reaching Google Fonts.
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gravv",
  description: "Hold, send and convert money across 100+ markets.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Apply the saved (or system) theme before first paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("gravv-theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full font-sans">
        {children}
        {/* Quality feedback widget, on every page. */}
        <Script
          src="https://embed.usequality.app/loader.js"
          data-site-id="qs_live_d3db91d0be7dfc050054f5d0"
          data-api-origin="https://server.usequality.app"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
