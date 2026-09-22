'use client';

import { useCallback, useEffect, useState } from 'react';

/** VAPID 공개키(base64url) → 브라우저가 요구하는 ArrayBuffer */
function urlBase64ToBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);

  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

const isIos = () =>
  typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

type State = 'checking' | 'unsupported' | 'ios-needs-install' | 'off' | 'on' | 'denied';

/**
 * 웹 푸시 설정
 *
 * 앱을 닫아둔 상태에서도 친구 요청·약속 알림을 받으려면 필요하다.
 * iOS 는 "홈 화면에 추가"한 PWA 에서만 푸시를 허용하므로, 그 경우 설치 안내를 보여준다.
 */
export default function PushSetup() {
  const [state, setState] = useState<State>('checking');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 서비스 워커 등록 (캐시 + 푸시 수신)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      setState('unsupported');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');

        if (!('PushManager' in window)) {
          if (!cancelled) setState(isIos() && !isStandalone() ? 'ios-needs-install' : 'unsupported');
          return;
        }
        if (isIos() && !isStandalone()) {
          if (!cancelled) setState('ios-needs-install');
          return;
        }
        if (Notification.permission === 'denied') {
          if (!cancelled) setState('denied');
          return;
        }

        const existing = await registration.pushManager.getSubscription();
        if (!cancelled) setState(existing ? 'on' : 'off');
      } catch (error) {
        console.error('서비스 워커 등록 실패:', error);
        if (!cancelled) setState('unsupported');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }

      const keyRes = await fetch('/api/push/key');
      if (!keyRes.ok) throw new Error('푸시 설정을 불러오지 못했어요.');
      const { publicKey } = await keyRes.json();

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(publicKey),
      });

      const saved = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!saved.ok) {
        const data = await saved.json().catch(() => ({}));
        throw new Error(data.error ?? '구독 저장에 실패했어요.');
      }

      setState('on');
      setMessage('이제 앱을 닫아도 알림을 받을 수 있어요.');
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : '알림 켜기에 실패했어요.');
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState('off');
      setMessage('이 기기에서는 푸시 알림을 받지 않아요.');
    } catch (error) {
      console.error(error);
      setMessage('알림 끄기에 실패했어요.');
    } finally {
      setBusy(false);
    }
  }, []);

  if (state === 'checking' || state === 'unsupported') return null;

  return (
    <div className="border-t border-gray-100 px-3 py-2 text-xs">
      {state === 'ios-needs-install' ? (
        <p className="text-gray-600">
          📱 아이폰은 <strong>공유 → 홈 화면에 추가</strong> 후 앱으로 열면 푸시 알림을 켤 수 있어요.
        </p>
      ) : state === 'denied' ? (
        <p className="text-gray-600">
          🔕 브라우저에서 알림이 차단돼 있어요. 사이트 설정에서 알림을 허용해주세요.
        </p>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-600">
            {state === 'on' ? '🔔 푸시 알림 켜짐' : '🔕 앱을 닫으면 알림을 못 받아요'}
          </span>
          <button
            type="button"
            onClick={state === 'on' ? disable : enable}
            disabled={busy}
            className={`rounded-md px-2.5 py-1 font-semibold transition cursor-pointer disabled:opacity-50 ${
              state === 'on'
                ? 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                : 'bg-brand-500 text-white hover:bg-brand-600'
            }`}
          >
            {busy ? '처리 중…' : state === 'on' ? '끄기' : '알림 켜기'}
          </button>
        </div>
      )}

      {message && <p className="mt-1.5 text-gray-500">{message}</p>}
    </div>
  );
}
