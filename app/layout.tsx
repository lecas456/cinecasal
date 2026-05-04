import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CineCasal",
  description: "O app de filmes do casal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} dark h-full antialiased`}>
      <body className="bg-background text-foreground min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
