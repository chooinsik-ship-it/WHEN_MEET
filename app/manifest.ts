import type { MetadataRoute } from 'next';

/**
 * PWA 매니페스트 (/manifest.webmanifest)
 *
 * 홈 화면에 추가하면 주소창 없이 앱처럼 실행된다.
 * iOS 는 홈 화면에 추가한 PWA 에서만 웹 푸시를 허용하므로, 알림 기능의 전제 조건이기도 하다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '언제만나 - 시간표 비교',
    short_name: '언제만나',
    description: '친구들과 시간표를 비교하고 만날 수 있는 시간을 찾아보세요',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f4f6fb',
    theme_color: '#6B80A5',
    lang: 'ko',
    icons: [
      { src: '/icons/icon-192.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
