import localFont from "next/font/local";

export const chanel = localFont({
  src: [
    {
      path: "./Chanel.woff2",
      weight: "normal",
      style: "normal",
    },
    {
      path: "./Chanel.woff",
      weight: "normal",
      style: "normal",
    },
  ],
  variable: "--font-chanel",
  fallback: ["serif"],
});

