'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'recovery_banner_dismissed_';

/**
 * 복구 코드 안내 배너
 *
 * 비밀번호를 잊으면 계정을 되찾을 방법이 복구 코드뿐인데,
 * 기존 사용자는 아무도 발급받지 않은 상태라 한 번 알려준다.
 */
export default function RecoveryBanner({ userId }: { userId: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (localStorage.getItem(DISMISS_KEY + userId) === '1') return;

        const res = await fetch(`/api/auth/${userId}/recovery`);
        if (!res.ok) return;

        const data = await res.json();
        if (!cancelled && data.hasCode === false) setShow(true);
      } catch {
        /* 안내 배너일 뿐이라 실패는 무시 */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!show) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 px-4 py-3">
      <span className="text-lg leading-none">🔑</span>
      <p className="flex-1 text-sm text-amber-900">
        <strong>복구 코드를 만들어두세요.</strong> 비밀번호를 잊으면 계정을 되찾을 방법이 이것뿐이에요.
        <span className="block text-xs text-amber-800/80">
          오른쪽 위 프로필(아바타) → 비밀번호 탭 → 복구 코드 발급
        </span>
      </p>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY + userId, '1');
          setShow(false);
        }}
        className="shrink-0 text-xs font-semibold text-amber-700 underline hover:text-amber-900 cursor-pointer"
      >
        닫기
      </button>
    </div>
  );
}
