export const metadata = {
  title: "Voice Reading",
  description: "Trening słuchowy z implantem ślimakowym",
  manifest: "/manifest.json",
};

export const viewport = { themeColor: "#1971c2" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
