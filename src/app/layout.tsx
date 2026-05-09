import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Friends in the Children Ministry",
    template: "%s | Friends in the Children Ministry"
  },
  description: "Sunday School lessons, Bible studies, resources, and ministry events for Friends in the Children Ministry."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
