import { Literata, Manrope } from "next/font/google";
import "./globals.css";

const literata = Literata({
  subsets: ["latin", "latin-ext"],
  variable: "--font-reading",
});

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-ui",
});

export const metadata = {
  title: "Voice Reading",
  description: "Trening słuchowy z implantem ślimakowym",
  manifest: "/manifest.json",
};

export const viewport = { themeColor: "#16655c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={`${literata.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
