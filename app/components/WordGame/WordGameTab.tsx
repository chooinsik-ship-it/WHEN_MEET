'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { decomposeJamo, isBasicJamo, marksToEmoji } from '../../lib/hangul';
import { ApiError, gameApi, type PublicGame, type RuleSummary } from './api';
import { Board, Keyboard, computeKeyStates } from './Board';
import { StatsView } from './StatsView';
import { RankingView } from './RankingView';
import { WordRankingView } from './WordRankingView';

/** 두벌식 자판 → 기본 자모 (IME 없이도 PC 키보드로 입력 가능) */
const QWERTY_TO_JAMO: Record<string, string> = {
  q: 'ㅂ', w: 'ㅈ', e: 'ㄷ', r: 'ㄱ', t: 'ㅅ', y: 'ㅛ', u: 'ㅕ', i: 'ㅑ',
  a: 'ㅁ', s: 'ㄴ', d: 'ㅇ', f: 'ㄹ', g: 'ㅎ', h: 'ㅗ', j: 'ㅓ', k: 'ㅏ', l: 'ㅣ',
  z: 'ㅋ', x: 'ㅌ', c: 'ㅊ', v: 'ㅍ', b: 'ㅠ', n: 'ㅜ', m: 'ㅡ',
};

const STATUS_TEXT: Record<string, string> = {
  SUCCESS: '성공',
  FAILED: '실패',
  ABANDONED: '포기',
};

function fmtDuration(ms: number | null): string {
  if (ms === null) return '-';
  const sec = Math.round(ms / 1000);
  return `${Math.floor(sec / 60)}분 ${String(sec % 60).padStart(2, '0')}초`;
}

export default function WordGameTab() {
  const [tab, setTab] = useState<'play' | 'stats' | 'ranking'>('play');
  const [rule, setRule] = useState<RuleSummary | null>(null);
  const [game, setGame] = useState<PublicGame | null>(null);
  const [input, setInput] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shake, setShake] = useState(false);
  const [copied, setCopied] = useState(false);

  const jamoCount = game?.jamoCount ?? rule?.jamoCount ?? 5;
  const maxAttempts = game?.maxAttempts ?? rule?.maxAttempts ?? 5;
  const playing = game?.status === 'PLAYING';
  const finished = Boolean(game) && !playing;

  /* ------------------------------------------------------------ 초기 로드 */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await gameApi.current();
        if (cancelled) return;
        setRule(res.rule);
        setGame(res.game);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          setFatal('게임 기록을 저장하려면 다시 로그인해야 해요. 로그아웃 후 다시 로그인해주세요.');
        } else {
          setFatal(e instanceof Error ? e.message : '게임을 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* -------------------------------------------------------------- 액션 */

  const handleError = useCallback((e: unknown) => {
    if (e instanceof ApiError) {
      if (e.status === 401) {
        setFatal('세션이 만료됐어요. 로그아웃 후 다시 로그인해주세요.');
        return;
      }
      setNotice(e.message);
      setShake(true);
      setTimeout(() => setShake(false), 320);
      return;
    }
    setNotice(e instanceof Error ? e.message : '요청에 실패했습니다.');
  }, []);

  const startGame = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    setCopied(false);
    try {
      const res = await gameApi.start();
      setRule(res.rule);
      setGame(res.game);
      setInput([]);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }, [handleError]);

  const submit = useCallback(async () => {
    if (!game || !playing || busy) return;

    if (input.length !== jamoCount) {
      setNotice(`자모 ${jamoCount}칸을 모두 채워주세요. (시도 횟수는 차감되지 않아요)`);
      setShake(true);
      setTimeout(() => setShake(false), 320);
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      // 같은 제출이 네트워크 재시도로 두 번 처리되지 않도록 요청 식별자를 붙인다
      const requestId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random()}`;

      const res = await gameApi.guess(game.gameId, input, requestId);
      setGame(res.game);
      setInput([]);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }, [game, playing, busy, input, jamoCount, handleError]);

  const abandon = useCallback(async () => {
    if (!game || !playing || busy) return;
    setBusy(true);
    try {
      const res = await gameApi.abandon(game.gameId);
      setGame(res.game);
      setInput([]);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }, [game, playing, busy, handleError]);

  /* ------------------------------------------------------------ 입력 */

  const pushJamo = useCallback(
    (jamo: string) => {
      if (!playing || busy) return;
      setNotice(null);
      setInput((prev) => (prev.length >= jamoCount ? prev : [...prev, jamo]));
    },
    [playing, busy, jamoCount]
  );

  const backspace = useCallback(() => {
    if (!playing || busy) return;
    setInput((prev) => prev.slice(0, -1));
  }, [playing, busy]);

  const clearInput = useCallback(() => {
    if (!playing || busy) return;
    setInput([]);
  }, [playing, busy]);

  // PC 키보드
  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    if (tab !== 'play' || !playing) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Enter') {
        event.preventDefault();
        submitRef.current();
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        backspace();
        return;
      }

      // 한글 IME 로 자모가 그대로 들어오는 경우 (복합 자모는 기본 자모로 분해)
      const decomposed = decomposeJamo(event.key);
      if (decomposed.length > 0) {
        event.preventDefault();
        decomposed.forEach(pushJamo);
        return;
      }

      const mapped = QWERTY_TO_JAMO[event.key.toLowerCase()];
      if (mapped && isBasicJamo(mapped)) {
        event.preventDefault();
        pushJamo(mapped);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tab, playing, pushJamo, backspace]);

  const keyStates = useMemo(() => computeKeyStates(game?.guesses ?? []), [game]);

  /* ------------------------------------------------------------ 공유 */

  const shareText = useMemo(() => {
    if (!game || !finished) return '';
    const head = `언제만나 한글 단어 추리 ${game.status === 'SUCCESS' ? `${game.attemptsUsed}/${maxAttempts}` : 'X/' + maxAttempts}`;
    const grid = game.guesses.map((g) => marksToEmoji(g.marks)).join('\n');
    return `${head}\n${grid}`;
  }, [game, finished, maxAttempts]);

  const copyShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice('복사에 실패했어요. 결과를 길게 눌러 직접 복사해주세요.');
    }
  }, [shareText]);

  /* ------------------------------------------------------------ 렌더 */

  if (loading) {
    return <p className="py-16 text-center text-sm text-gray-500">게임을 불러오는 중…</p>;
  }

  if (fatal) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-sm font-semibold text-amber-800">{fatal}</p>
      </div>
    );
  }

  return (
    <div>
      {/* 하위 탭 */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
        {([
          ['play', '게임'],
          ['stats', '내 통계'],
          ['ranking', '랭킹'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition cursor-pointer ${
              tab === key ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600 hover:text-brand-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'stats' && <StatsView maxAttempts={maxAttempts} />}
      {tab === 'ranking' && <RankingView />}

      {tab === 'play' && (
        <div className="space-y-4">
          {!game && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <p className="mb-1 text-base font-bold text-gray-800">한글 단어 추리</p>
              <p className="mb-4 text-sm text-gray-600">
                자모 {jamoCount}칸을 {maxAttempts}번 안에 맞혀보세요. 횟수 제한 없이 계속 플레이할 수 있어요.
              </p>
              <button
                type="button"
                onClick={startGame}
                disabled={busy}
                className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 cursor-pointer disabled:opacity-60"
              >
                {busy ? '시작하는 중…' : '게임 시작'}
              </button>
            </div>
          )}

          {game && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-gray-100 px-2 py-1 font-semibold text-gray-700">
                    {game.attemptsUsed} / {maxAttempts} 시도
                  </span>
                  <span
                    className={`rounded-md px-2 py-1 font-semibold ${
                      game.isFirstAttempt
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {game.isFirstAttempt ? '최초 도전' : '재도전'}
                  </span>
                </div>
                {playing && (
                  <button
                    type="button"
                    onClick={abandon}
                    disabled={busy}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1 font-semibold text-gray-600 transition hover:bg-gray-50 cursor-pointer disabled:opacity-50"
                  >
                    포기하기
                  </button>
                )}
              </div>

              {!game.isFirstAttempt && playing && (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  이 단어는 재도전이에요. 개인 통계·종합 랭킹에는 반영되지만,{' '}
                  <strong>단어별 랭킹에는 반영되지 않아요.</strong>
                </p>
              )}

              <Board
                jamoCount={jamoCount}
                maxAttempts={maxAttempts}
                guesses={game.guesses}
                input={input}
                shake={shake}
              />

              {notice && (
                <p
                  role="status"
                  className="rounded-lg bg-amber-50 px-3 py-2 text-center text-sm font-semibold text-amber-800"
                >
                  {notice}
                </p>
              )}

              {playing && (
                <Keyboard
                  keyStates={keyStates}
                  disabled={busy}
                  onInput={pushJamo}
                  onBackspace={backspace}
                  onClear={clearInput}
                  onSubmit={submit}
                />
              )}

              {finished && (
                <div className="space-y-4">
                  <div
                    className={`rounded-xl border p-4 text-center ${
                      game.status === 'SUCCESS'
                        ? 'border-emerald-200 bg-emerald-50'
                        : game.status === 'FAILED'
                          ? 'border-red-200 bg-red-50'
                          : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <p className="text-lg font-bold text-gray-800">
                      {game.status === 'SUCCESS' ? '🎉 성공!' : game.status === 'FAILED' ? '아쉬워요' : '포기했어요'}
                    </p>
                    <p className="mt-1 text-sm text-gray-700">
                      정답은 <strong className="text-brand-700">{game.answer}</strong> 였어요
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                      {STATUS_TEXT[game.status]} · {game.attemptsUsed}회 시도 ·{' '}
                      {fmtDuration(game.durationMs)} ·{' '}
                      {game.isFirstAttempt ? '최초 도전' : '재도전(단어별 랭킹 미반영)'}
                    </p>

                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={startGame}
                        disabled={busy}
                        className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 cursor-pointer disabled:opacity-60"
                      >
                        새 게임
                      </button>
                      <button
                        type="button"
                        onClick={copyShare}
                        className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 cursor-pointer"
                      >
                        {copied ? '복사됨!' : '결과 공유'}
                      </button>
                    </div>

                    {shareText && (
                      <pre className="mt-3 whitespace-pre-wrap text-center text-base leading-tight">
                        {shareText}
                      </pre>
                    )}
                  </div>

                  {game.wordId && <WordRankingView wordId={game.wordId} compact />}
                </div>
              )}
            </>
          )}

          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            🟩 정확한 자리 · 🟨 자모는 있지만 다른 자리 · ⬜ 없음 (칸 우측 하단의 ● ▲ × 기호로도 구분할 수
            있어요) · 같은 단어를 다시 풀어도 개인 통계와 종합 랭킹에는 모두 집계됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
