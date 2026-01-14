import "./globals.css";

export const metadata = {
  title: "Nusantara Diorama AI",
  description: "Builder",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
