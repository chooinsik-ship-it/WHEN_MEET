import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Jua } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jua = Jua({
  weight: '400',
  variable: "--font-jua",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "언제만나 - 시간표 비교 서비스",
  description: "친구들과 시간표를 비교하고 만날 수 있는 시간을 찾아보세요",
};

/**
 * 모바일 뷰포트 설정
 * viewportFit: 'cover' → 아이폰의 다이내믹 아일랜드/홈 인디케이터 영역까지 화면을 쓰고,
 * 고정 요소는 env(safe-area-inset-*) 로 그 영역을 피한다.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#6B80A5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${jua.variable} antialiased`}
      >
        {children}
        <Script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_JS_KEY}&libraries=services&autoload=false`}
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
