import "./globals.css";

export const metadata = {
  title: "Wonderwal",
  description: "Wonderwal Builder",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
