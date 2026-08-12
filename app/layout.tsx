import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maine Aquaculture License Assistant | Public AI",
  description:
    "Conversational assistant for Maine aquaculture license triage and DMR regulatory Q&A.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
