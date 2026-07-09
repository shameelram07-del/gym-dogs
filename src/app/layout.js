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
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Gym Dogs",
  },
};

export const viewport = {
  themeColor: "#0A0714",
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