import localFont from "next/font/local";
import "./globals.css";
import AppProvider from "@/components/AppProvider";

// Fonts ship with the app (src/app/fonts, OFL licences alongside) instead of
// being fetched from Google at build time. That fetch failed the Azure
// deploy at random ("next/font/google queries have exactly one entry").

// Inter keeps the old --font-geist-sans variable name so every existing
// style that references it picks up the new body face automatically.
const interSans = localFont({
  variable: "--font-geist-sans",
  src: [{ path: "./fonts/inter-var.woff2", weight: "100 900", style: "normal" }],
  display: "swap",
});

const spaceGrotesk = localFont({
  variable: "--font-display",
  src: [
    { path: "./fonts/space-grotesk-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/space-grotesk-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/space-grotesk-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
});

// The one big word per screen (.gd-mega): heavy condensed italic, so it reads
// as speed rather than as a heading.
const barlowCondensed = localFont({
  variable: "--font-mega",
  src: [
    { path: "./fonts/barlow-condensed-700-italic.woff2", weight: "700", style: "italic" },
    { path: "./fonts/barlow-condensed-900-italic.woff2", weight: "900", style: "italic" },
  ],
  display: "swap",
});

export const metadata = {
  title: "Gym Dogs",
  description: "Train smart. Recover smarter.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Gym Dogs",
  },
};

export const viewport = {
  // SLATE's --bg. This was still #0A0714 — the IGNITE ink-violet — so on a
  // phone the browser chrome and the iOS status bar were painting the old
  // palette right above a slate app. Same class of leftover as the magenta.
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  // Without this, iOS reports every safe-area inset as 0, so the Dynamic
  // Island covered the top of each screen and the home bar sat on the nav.
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${interSans.variable} ${spaceGrotesk.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{
            // Must match src/lib/theme.js: localStorage, else the cookie
            // backup, else dark. Copies a cookie-only choice back into
            // localStorage so the two stay in step. The old gd-theme-v2
            // migration forced dark over any choice once storage was
            // wiped; it is gone.
            __html: `(function(){var t=null;try{t=localStorage.getItem('gd-theme');}catch(e){}if(t!=='dark'&&t!=='light'){var m=document.cookie.match(/(?:^|;\\s*)gd-theme=(dark|light)/);t=m?m[1]:'dark';try{localStorage.setItem('gd-theme',t);}catch(e){}}document.documentElement.setAttribute('data-theme',t);})();`,
          }}
        />
        <AppProvider>
          <div className="app-shell">{children}</div>
        </AppProvider>
      </body>
    </html>
  );
}