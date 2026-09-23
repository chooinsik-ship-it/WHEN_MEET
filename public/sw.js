/**
 * 언제만나 서비스 워커
 *
 * 1) 웹 푸시 수신 → 알림 표시
 * 2) 알림 클릭 → 앱 열기(이미 열려 있으면 그 탭으로)
 * 3) 정적 자원만 캐시 (API 응답과 HTML 은 캐시하지 않아 항상 최신을 받는다)
 */

const CACHE = 'whenmeet-static-v2';

self.addEventListener('install', (event) => {
  // 새 워커를 즉시 활성화
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 빌드 산출물(해시가 붙어 불변)만 캐시 우선.
  // 아이콘은 캐시하지 않는다 — 로고를 교체해도 옛 아이콘이 계속 표시되던 원인.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((hit) =>
        hit ||
        fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
      )
    );
  }
  // HTML·API 는 그대로 네트워크로 (오래된 화면/데이터를 보여주지 않기 위해)
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || '언제만나';
  const options = {
    body: payload.body || '새 알림이 도착했어요.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'whenmeet',
    data: { url: payload.url || '/' },
    // 같은 tag 의 알림이 와도 다시 알린다
    renotify: Boolean(payload.tag),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        if (client.url.includes(self.location.origin)) {
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
