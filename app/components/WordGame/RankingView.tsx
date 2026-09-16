'use client';

import { useCallback, useEffect, useState } from 'react';
import { gameApi, type MyWordsResponse, type RankingResponse, type RankingRow } from './api';
import { WordRankingView } from './WordRankingView';

const PERIOD_LABEL: Record<string, string> = {
  today: '오늘',
  week: '이번 주',
  month: '이번 달',
  all: '전체',
};

const TYPE_LABEL: Record<string, string> = {
  success: '총 성공',
  winRate: '성공률',
  avgAttempts: '평균 시도',
  avgTime: '평균 시간',
  maxStreak: '최고 연속',
};

const TYPE_HINT: Record<string, string> = {
  success: '성공 횟수가 많은 순',
  winRate: '성공률이 높은 순 · 기간 내 종료 게임 10회 이상',
  avgAttempts: '평균 시도가 적은 순 · 기간 내 성공 10회 이상',
  avgTime: '평균 풀이 시간이 짧은 순 · 기간 내 성공 10회 이상',
  maxStreak: '기간 내 최고 연속 성공이 많은 순',
};

function fmtDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '기록 없음';
  const sec = Math.round(ms / 1000);
  return `${Math.floor(sec / 60)}분 ${String(sec % 60).padStart(2, '0')}초`;
}

function metricText(type: string, row: RankingRow): string {
  switch (type) {
    case 'success':
      return `${row.success}회`;
    case 'winRate':
      return row.winRate === null ? '기록 없음' : `${Math.round(row.winRate * 100)}%`;
    case 'avgAttempts':
      return row.avgAttempts === null ? '기록 없음' : `${row.avgAttempts.toFixed(2)}회`;
    case 'avgTime':
      return fmtDuration(row.avgDurationMs);
    case 'maxStreak':
      return `${row.maxStreak}연승`;
    default:
      return '-';
  }
}

export function RankingView() {
  const [mode, setMode] = useState<'overall' | 'word'>('overall');

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setMode('overall')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition cursor-pointer ${
            mode === 'overall' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600 hover:text-brand-700'
          }`}
        >
          종합 랭킹
        </button>
        <button
          type="button"
          onClick={() => setMode('word')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition cursor-pointer ${
            mode === 'word' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600 hover:text-brand-700'
          }`}
        >
          출제 단어별 랭킹
        </button>
      </div>

      {mode === 'overall' ? <OverallRanking /> : <WordRankingPicker />}
    </div>
  );
}

function OverallRanking() {
  const [type, setType] = useState('success');
  const [period, setPeriod] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await gameApi.rankings(type, period, page));
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [type, period, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {Object.entries(TYPE_LABEL).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setType(key);
              setPage(1);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              type === key ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-brand-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {Object.entries(PERIOD_LABEL).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setPeriod(key);
              setPage(1);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              period === key ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-brand-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-500">{TYPE_HINT[type]}</p>

      {loading && <p className="py-10 text-center text-sm text-gray-500">불러오는 중…</p>}
      {error && <p className="py-10 text-center text-sm text-red-500">{error}</p>}

      {data && !loading && (
        <>
          {data.items.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              아직 이 조건을 만족하는 기록이 없어요.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white px-3">
              {data.items.map((row) => (
                <li
                  key={row.userId}
                  className={`flex items-center gap-2 py-2.5 text-sm ${
                    row.isMe ? 'font-bold text-brand-700' : 'text-gray-700'
                  }`}
                >
                  <span className="w-8 shrink-0 text-center tabular-nums">{row.rank}</span>
                  <span className="shrink-0">{row.avatar ?? '🙂'}</span>
                  <span className="flex-1 truncate">
                    {row.nickname}
                    {row.isMe && <span className="ml-1 text-xs">(나)</span>}
                  </span>
                  <span className="shrink-0 tabular-nums">{metricText(type, row)}</span>
                </li>
              ))}
            </ul>
          )}

          {/* 내 순위 고정 표시 */}
          <div className="rounded-xl bg-brand-50 px-3 py-2.5 text-sm">
            {data.me.rank ? (
              <p className="font-semibold text-brand-800">
                내 순위 {data.me.rank}위 · {metricText(type, data.me)}
              </p>
            ) : data.me.missing ? (
              <p className="text-brand-800">
                내 순위 없음 —{' '}
                {data.me.missing.kind === 'finished'
                  ? `${data.me.missing.need}게임 더 끝내면`
                  : `${data.me.missing.need}번 더 성공하면`}{' '}
                이 랭킹에 참여해요
              </p>
            ) : (
              <p className="text-brand-800">내 순위 없음 — 아직 종료한 게임이 없어요</p>
            )}
          </div>

          {(page > 1 || data.hasNext) && (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              >
                이전
              </button>
              <span className="text-xs text-gray-500">
                {page} / {Math.max(1, Math.ceil(data.total / data.size))}
              </span>
              <button
                type="button"
                disabled={!data.hasNext}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              >
                다음
              </button>
            </div>
          )}

          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            {data.note} · 규칙 {data.rule.jamoCount}칸 / {data.rule.maxAttempts}회 (v
            {data.rule.ruleVersion}) 기록만 집계돼요.
          </p>
        </>
      )}
    </div>
  );
}

function WordRankingPicker() {
  const [period, setPeriod] = useState('all');
  const [data, setData] = useState<MyWordsResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await gameApi.myWords(period);
      setData(res);
      setSelected((prev) => prev ?? res.items[0]?.wordId ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
        내가 <strong>최초 도전을 끝낸 단어</strong>만 볼 수 있어요. 각 단어의 랭킹에는 사용자별 최초 도전
        1회만 반영됩니다.
      </p>

      <div className="flex flex-wrap gap-1">
        {Object.entries(PERIOD_LABEL).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              period === key ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-brand-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="py-10 text-center text-sm text-gray-500">불러오는 중…</p>}
      {error && <p className="py-10 text-center text-sm text-red-500">{error}</p>}

      {data && !loading && (
        <>
          {data.items.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              아직 최초 도전을 끝낸 단어가 없어요. 게임을 한 판 끝내면 여기에 나타나요.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {data.items.map((item) => (
                <button
                  key={item.wordId}
                  type="button"
                  onClick={() => setSelected(item.wordId)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition cursor-pointer ${
                    selected === item.wordId
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {item.word}
                  <span className="ml-1 text-[11px] text-gray-400">
                    {item.status === 'SUCCESS' ? `${item.attemptsUsed}회` : item.status === 'FAILED' ? '실패' : '포기'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {selected && <WordRankingView wordId={selected} />}
        </>
      )}
    </div>
  );
}
