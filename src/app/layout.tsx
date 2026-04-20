import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { chanel } from "@/fonts/Chanel";
import "@/style/globals.scss";
import { Lenis } from "@/components";
import clsx from "clsx";
import { Grid } from "@/components/grid/Grid";
import Header from "@/components/header/Header";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Chanel Lookbook",
  description: "Next.js starter template",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={clsx(
          "font-normal bg-white text-black",
          inter.className,
          inter.variable,
          chanel.variable,
        )}
      >
        <Header />
        {children}
        <Grid />
        <Lenis key={`lenis${(children as React.ReactElement)?.key}`} />
      </body>
    </html>
  );
}
