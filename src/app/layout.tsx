import type { Metadata } from "next";
import "./globals.css";
import "./club-features.css";
import "./club-home.css";

export const metadata: Metadata = {
  title: "Morris Club | Nine Men’s Morris",
  description: "เล่น Nine Men’s Morris กับเพื่อนด้วยรหัสห้องส่วนตัว",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="th"><body>{children}</body></html>;
}
