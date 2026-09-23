'use client';

import { useCallback, useEffect, useState } from 'react';

const PENDING_KEY = 'pending_invite_code';

/**
 * 초대 링크 만들기 (친구 추가 화면)
 * 상대 닉네임을 몰라도 링크만 보내면 친구가 될 수 있다.
 */
export function InviteLinkButton() {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/invites', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? '링크를 만들지 못했어요.');

      setUrl(data.url);
      try {
        await navigator.clipboard.writeText(data.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        /* 복사 실패해도 링크는 보여준다 */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '링크를 만들지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, []);

  const share = useCallback(async () => {
    if (!url) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: '언제만나', text: '같이 시간표 맞춰보자!', url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      /* 사용자가 취소한 경우 포함 — 무시 */
    }
  }, [url]);

  return (
    <div className="mt-2">
      {!url ? (
        <button
          type="button"
          onClick={create}
          disabled={loading}
          className="text-xs font-semibold text-brand-600 underline hover:text-brand-700 disabled:opacity-60 cursor-pointer"
        >
          {loading ? '만드는 중…' : '🔗 초대 링크로 친구 추가하기'}
        </button>
      ) : (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-2.5">
          <p className="text-xs font-semibold text-brand-800">
            {copied ? '링크를 복사했어요!' : '이 링크를 친구에게 보내세요 (7일간 유효)'}
          </p>
          <p className="mt-1 break-all font-mono text-[11px] text-gray-600">{url}</p>
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              onClick={share}
              className="rounded-md bg-brand-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-brand-600 cursor-pointer"
            >
              공유하기
            </button>
            <button
              type="button"
              onClick={() => setUrl(null)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

/**
 * 초대 링크로 들어온 사람에게 보여주는 배너
 * 로그인 전에 열었다면 코드를 보관해두고, 로그인 후 수락할 수 있게 한다.
 */
export function InviteBanner({
  isLoggedIn,
  onAccepted,
}: {
  isLoggedIn: boolean;
  onAccepted: (inviterNickname: string) => void;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [inviter, setInviter] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'working' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  // URL 의 초대 코드를 읽어 보관 (로그인 과정에서 사라지지 않도록)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('invite');

    if (fromUrl) {
      localStorage.setItem(PENDING_KEY, fromUrl);
      // 주소창을 깔끔하게
      window.history.replaceState({}, '', window.location.pathname);
    }

    const saved = fromUrl ?? localStorage.getItem(PENDING_KEY);
    if (saved) setCode(saved);
  }, []);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/invites/${code}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok) {
          localStorage.removeItem(PENDING_KEY);
          setCode(null);
          return;
        }
        setInviter(data.nickname);
      } catch {
        /* 무시 */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  const accept = useCallback(async () => {
    if (!code) return;
    setStatus('working');
    setError(null);
    try {
      const res = await fetch(`/api/invites/${code}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? '수락에 실패했어요.');

      localStorage.removeItem(PENDING_KEY);
      setStatus('done');
      onAccepted(data.nickname);
    } catch (e) {
      setError(e instanceof Error ? e.message : '수락에 실패했어요.');
      setStatus('idle');
    }
  }, [code, onAccepted]);

  const dismiss = useCallback(() => {
    localStorage.removeItem(PENDING_KEY);
    setCode(null);
  }, []);

  if (!code || !inviter || status === 'done') return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border-l-4 border-brand-400 bg-brand-50 px-4 py-3">
      <span className="text-lg leading-none">🎈</span>
      <p className="flex-1 text-sm text-brand-900">
        <strong>{inviter}</strong>님이 초대했어요.
        {!isLoggedIn && <span className="block text-xs text-brand-800/80">로그인하면 친구로 추가할 수 있어요.</span>}
        {error && <span className="block text-xs text-red-500">{error}</span>}
      </p>
      {isLoggedIn && (
        <button
          type="button"
          onClick={accept}
          disabled={status === 'working'}
          className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60 cursor-pointer"
        >
          {status === 'working' ? '수락 중…' : '친구 되기'}
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        className="text-xs font-semibold text-brand-700 underline hover:text-brand-900 cursor-pointer"
      >
        닫기
      </button>
    </div>
  );
}
