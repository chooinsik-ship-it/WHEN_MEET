import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Jua } from "next/font/google";
import Script from "next/script";
import ServiceWorkerRegistrar from "./components/ServiceWorkerRegistrar";
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
  // 홈 화면에 추가했을 때 쓰이는 아이콘들
  icons: {
    icon: [
      { url: "/icons/icon-32.png?v=5", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png?v=5", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png?v=5", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png?v=5", sizes: "180x180", type: "image/png" }],
  },
  // iOS 는 이 설정이 있어야 홈 화면 앱이 주소창 없이 실행된다 (웹 푸시의 전제 조건)
  appleWebApp: {
    capable: true,
    title: "언제만나",
    statusBarStyle: "default",
  },
  // iOS 16.4 미만에서도 홈 화면 앱이 전체화면으로 뜨도록 (구형 키)
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
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
        <ServiceWorkerRegistrar />
        <Script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_JS_KEY}&libraries=services&autoload=false`}
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
