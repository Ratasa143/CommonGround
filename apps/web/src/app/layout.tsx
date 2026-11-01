import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "CommonGround",
  description: "Restore the service, support the student.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
