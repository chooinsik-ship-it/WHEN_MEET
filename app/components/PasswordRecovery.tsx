'use client';

import { useCallback, useEffect, useState } from 'react';

const nicknameToId = (nickname: string) =>
  Math.abs(nickname.split('').reduce((acc, ch) => ((acc << 5) - acc) + ch.charCodeAt(0), 0));

/**
 * 비밀번호 재설정 (로그인 화면)
 *
 * 이 서비스에는 이메일이 없어 메일로 재설정 링크를 보낼 수 없다.
 * 미리 발급받아 둔 복구 코드로 본인을 확인한다.
 */
export function RecoveryResetForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (nickname: string) => void;
  onCancel: () => void;
}) {
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !code.trim() || !newPassword) {
      setError('모든 항목을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/auth/${nicknameToId(nickname.trim())}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), newPassword }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? '재설정에 실패했어요.');
        return;
      }
      onSuccess(nickname.trim());
    } catch {
      setError('네트워크 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-2 sm:w-80">
      <p className="text-xs text-gray-500">
        발급받아 둔 <strong>복구 코드</strong>로 비밀번호를 다시 정할 수 있어요.
      </p>
      <input
        type="text"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="닉네임"
        maxLength={20}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="복구 코드 (예: ABCD-EFGH-JKMN-PQRS)"
        maxLength={40}
        autoCapitalize="characters"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-black focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="새 비밀번호"
        maxLength={30}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 transition hover:bg-gray-100 cursor-pointer"
        >
          돌아가기
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-lg bg-brand-500 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60 cursor-pointer"
        >
          {loading ? '재설정 중…' : '비밀번호 재설정'}
        </button>
      </div>
    </form>
  );
}

/**
 * 복구 코드 발급 (프로필 설정)
 * 코드 평문은 발급 직후 한 번만 보여준다.
 */
export function RecoveryCodeIssuer({ userId }: { userId: number }) {
  const [hasCode, setHasCode] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [issued, setIssued] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/auth/${userId}/recovery`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setHasCode(Boolean(data.hasCode));
      } catch {
        /* 표시만 못 할 뿐이라 무시 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const issue = useCallback(async () => {
    if (!password) {
      setError('현재 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/auth/${userId}/recovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? '발급에 실패했어요.');
        return;
      }
      setIssued(data.code);
      setHasCode(true);
      setPassword('');
    } catch {
      setError('네트워크 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  }, [password, userId]);

  const copy = useCallback(async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('복사에 실패했어요. 코드를 직접 적어두세요.');
    }
  }, [issued]);

  return (
    <div className="mt-5 border-t border-gray-200 pt-4">
      <h4 className="text-sm font-bold text-gray-800">🔑 복구 코드</h4>
      <p className="mt-1 text-xs text-gray-500">
        비밀번호를 잊었을 때 계정을 되찾는 유일한 방법이에요. 발급 후 안전한 곳에 보관하세요.
        {hasCode === false && ' 아직 발급받지 않았어요.'}
        {hasCode === true && !issued && ' 이미 발급된 코드가 있어요(다시 발급하면 이전 코드는 무효).'}
      </p>

      {issued ? (
        <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
          <p className="text-xs font-semibold text-brand-800">
            이 코드는 지금만 보여요. 꼭 저장하세요!
          </p>
          <p className="mt-2 text-center font-mono text-lg font-bold tracking-wider text-gray-900">
            {issued}
          </p>
          <button
            type="button"
            onClick={copy}
            className="mt-2 w-full rounded-md border border-brand-300 bg-white py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 cursor-pointer"
          >
            {copied ? '복사됨!' : '코드 복사'}
          </button>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="현재 비밀번호"
            maxLength={30}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <button
            type="button"
            onClick={issue}
            disabled={loading}
            className="whitespace-nowrap rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60 cursor-pointer"
          >
            {loading ? '발급 중…' : hasCode ? '다시 발급' : '발급받기'}
          </button>
        </div>
      )}

      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
