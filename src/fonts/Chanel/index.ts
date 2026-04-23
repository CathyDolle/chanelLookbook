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

export const abChanel = localFont({
  src: [
    {
      path: "./ABChanelCorpo2022-Regular.woff2",
      weight: "normal",
      style: "normal",
    },
    {
      path: "./ABChanelCorpo2022-Regular.woff",
      weight: "normal",
      style: "normal",
    },
  ],
  variable: "--font-abchanel",
  fallback: ["sans-serif"],
});

