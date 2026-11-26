import type { Metadata } from "next";
import "./globals.css";
import "./club-features.css";
import "./club-home.css";

const title = "Morris Club | Nine Men’s Morris";
const description = "เล่น Nine Men’s Morris กับเพื่อนด้วยรหัสห้องส่วนตัว";
const siteUrl = "https://morrisclub.online/";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    type: "website",
    locale: "th_TH",
    siteName: "Morris Club",
    url: siteUrl,
    title,
    description,
    images: [
      {
        url: "/morris-club-share-kai-momo.jpg",
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "ไคกับโมโมะกำลังดวลหมากบนกระดาน Morris Club",
      },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="th"><body>{children}</body></html>;
}
