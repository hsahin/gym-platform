import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeAwareToaster } from "@/components/theme/ThemeAwareToaster";
import { ThemeModeProvider } from "@/components/theme/ThemeModeProvider";
import { getThemeInitializationScript } from "@/lib/theme-mode";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "GymOS | Premium gym platform",
  description:
    "Premium sportschoolplatform voor meerdere gyms: reserveringen, leden, contracten, betalingen, smart access en operations in één product.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: getThemeInitializationScript() }}
          id="theme-init"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        <ThemeModeProvider>
          {children}
          <ThemeAwareToaster />
        </ThemeModeProvider>
      </body>
    </html>
  );
}
