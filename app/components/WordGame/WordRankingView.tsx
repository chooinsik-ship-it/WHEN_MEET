'use client';

import { useCallback, useEffect, useState } from 'react';
import { gameApi, type WordRankingResponse } from './api';

const PERIOD_LABEL: Record<string, string> = {
  today: '오늘',
  week: '이번 주',
  month: '이번 달',
  all: '전체',
};

const REASON_LABEL: Record<string, string> = {
  FIRST_ATTEMPT_FAILED: '최초 도전 실패 — 이 단어의 랭킹에는 오를 수 없어요',
  FIRST_ATTEMPT_ABANDONED: '최초 도전 포기 — 이 단어의 랭킹에는 오를 수 없어요',
  OUT_OF_PERIOD: '선택한 기간 밖의 기록이에요',
};

function fmtDuration(ms?: number | null): string {
  if (ms === null || ms === undefined) return '기록 없음';
  const sec = Math.round(ms / 1000);
  return `${Math.floor(sec / 60)}분 ${String(sec % 60).padStart(2, '0')}초`;
}

export function WordRankingView({ wordId, compact = false }: { wordId: string; compact?: boolean }) {
  const [period, setPeriod] = useState('all');
  const [data, setData] = useState<WordRankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await gameApi.wordRankings(wordId, period, 1, compact ? 10 : 20));
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [wordId, period, compact]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-gray-800">
          🏅 이 단어 랭킹
          {data && <span className="ml-1 text-gray-500">({data.word})</span>}
        </h4>
        <div className="flex gap-1">
          {Object.entries(PERIOD_LABEL).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`rounded-md px-2 py-1 text-xs font-semibold transition cursor-pointer ${
                period === key
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-brand-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="py-6 text-center text-sm text-gray-500">불러오는 중…</p>}
      {error && <p className="py-6 text-center text-sm text-red-500">{error}</p>}

      {data && !loading && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="최초 도전자" value={`${data.stats.participants}명`} />
            <Stat label="성공" value={`${data.stats.successCount}명`} />
            <Stat
              label="성공률"
              value={
                data.stats.successRate === null
                  ? '기록 없음'
                  : `${Math.round(data.stats.successRate * 100)}%`
              }
            />
            <Stat
              label="평균 시도"
              value={
                data.stats.avgAttempts === null ? '기록 없음' : `${data.stats.avgAttempts.toFixed(1)}회`
              }
            />
          </div>

          {data.items.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">아직 성공한 사람이 없어요.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.items.map((row) => (
                <li
                  key={row.userId}
                  className={`flex items-center gap-2 py-2 text-sm ${
                    row.isMe ? 'font-bold text-brand-700' : 'text-gray-700'
                  }`}
                >
                  <span className="w-8 shrink-0 text-center">{row.rank}</span>
                  <span className="shrink-0">{row.avatar ?? '🙂'}</span>
                  <span className="flex-1 truncate">
                    {row.nickname}
                    {row.isMe && <span className="ml-1 text-xs">(나)</span>}
                  </span>
                  <span className="shrink-0 tabular-nums">{row.attemptsUsed}회</span>
                  <span className="w-20 shrink-0 text-right tabular-nums text-gray-500">
                    {fmtDuration(row.durationMs)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* 내 순위 고정 표시 */}
          <div className="mt-3 rounded-lg bg-brand-50 p-3 text-sm">
            {data.me.rank ? (
              <p className="font-semibold text-brand-800">
                내 순위 {data.me.rank}위 · {data.me.attemptsUsed}회 · {fmtDuration(data.me.durationMs)}
              </p>
            ) : (
              <p className="text-brand-800">
                내 순위 없음 — {REASON_LABEL[data.me.reason ?? ''] ?? '기록이 없어요'}
              </p>
            )}
            <p className="mt-1 text-xs text-brand-700/80">{data.note}</p>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-sm font-bold text-gray-800">{value}</p>
    </div>
  );
}
