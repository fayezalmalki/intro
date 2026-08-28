import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Space_Grotesk } from "next/font/google";
import "./globals.css";

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-arabic",
});

/**
 * Latin only, and deliberately not on `body`.
 *
 * Space Grotesk is the handoff's typeface and has no Arabic glyphs, so setting
 * it on the document would silently fall back for every Arabic string — the
 * whole app. It is applied through `.lat` to Latin runs: names, the wordmark,
 * the EN toggle. Arabic keeps IBM Plex Sans Arabic.
 *
 * Loaded through next/font rather than a stylesheet link, like the Arabic face
 * beside it, so it self-hosts instead of blocking render on a third party.
 */
const latin = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-latin",
});

export const metadata: Metadata = {
  title: "intro",
  description: "من ودك تعرف؟",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${arabic.variable} ${latin.variable}`}>
      <body style={{ fontFamily: "var(--font-arabic), system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
