import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/MsalProvider";

// Inter keeps the old --font-geist-sans variable name so every existing
// style that references it picks up the new body face automatically.
const interSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
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
  themeColor: "#080B11",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${interSans.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(!localStorage.getItem('gd-theme-v2')){localStorage.setItem('gd-theme','dark');localStorage.setItem('gd-theme-v2','1');}var t=localStorage.getItem('gd-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}`,
          }}
        />
        <AuthProvider>
          <div className="app-shell">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}