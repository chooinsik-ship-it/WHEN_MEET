'use client';

import { useEffect } from 'react';

/**
 * 서비스 워커 등록 (앱 로드 시 1회)
 *
 * 알림 패널을 열어야만 등록되면 푸시를 받을 준비가 늦어지므로,
 * 레이아웃에서 항상 마운트해 앱이 열리는 순간 등록한다.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('서비스 워커 등록 실패:', error);
    });
  }, []);

  return null;
}
