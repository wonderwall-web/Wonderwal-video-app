import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "YosoApp",
  description: "YosoApp — AI Studio-style video builder",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
