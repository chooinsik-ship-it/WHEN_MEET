'use client';

import { useCallback, useEffect, useState } from 'react';
import { gameApi, type PeriodStats, type StatsResponse } from './api';

const PERIOD_LABEL: Record<string, string> = {
  today: '오늘',
  week: '이번 주',
  month: '이번 달',
  all: '전체',
};

const STATUS_LABEL: Record<string, string> = {
  SUCCESS: '성공',
  FAILED: '실패',
  ABANDONED: '포기',
};

const STATUS_STYLE: Record<string, string> = {
  SUCCESS: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-600',
  ABANDONED: 'bg-gray-200 text-gray-600',
};

function fmtDuration(ms: number | null): string {
  if (ms === null) return '기록 없음';
  const sec = Math.round(ms / 1000);
  return `${Math.floor(sec / 60)}분 ${String(sec % 60).padStart(2, '0')}초`;
}

export function StatsView({ maxAttempts }: { maxAttempts: number }) {
  const [period, setPeriod] = useState('all');
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await gameApi.stats());
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="py-10 text-center text-sm text-gray-500">불러오는 중…</p>;
  if (error) return <p className="py-10 text-center text-sm text-red-500">{error}</p>;
  if (!data) return null;

  const stats: PeriodStats = data.stats[period];
  const maxDist = Math.max(1, ...Object.values(stats.dist ?? {}));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {Object.entries(PERIOD_LABEL).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              period === key ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-brand-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card label="시작한 게임" value={`${stats.started}회`} />
        <Card label="종료한 게임" value={`${stats.finished}회`} />
        <Card label="진행 중" value={`${stats.playing}개`} />
        <Card
          label="성공률"
          value={stats.winRate === null ? '기록 없음' : `${Math.round(stats.winRate * 100)}%`}
          hint="진행 중인 게임은 분모에서 제외"
        />
        <Card label="성공" value={`${stats.success}회`} />
        <Card label="실패" value={`${stats.failed}회`} />
        <Card label="포기" value={`${stats.abandoned}회`} />
        <Card
          label="평균 시도"
          value={stats.avgAttempts === null ? '기록 없음' : `${stats.avgAttempts.toFixed(2)}회`}
          hint="성공한 게임 기준"
        />
        <Card
          label="평균 풀이 시간"
          value={fmtDuration(stats.avgDurationMs)}
          hint="성공한 게임 기준"
        />
        <Card label="최단 성공" value={fmtDuration(stats.bestDurationMs)} />
        <Card
          label="최소 시도 성공"
          value={
            stats.bestAttempts === null
              ? '기록 없음'
              : `${stats.bestAttempts}회 시도 (${stats.bestAttemptsCount}번)`
          }
        />
        <Card label="기간 내 최고 연속" value={`${stats.maxStreak}연승`} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Card label="현재 연속 성공" value={`${data.currentStreak}연승`} hint="전체 종료 기록 기준" />
        <Card label="최고 연속 성공" value={`${data.bestStreak}연승`} hint="전체 기간 기준" />
      </div>

      {/* 시도 횟수별 성공 분포 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h4 className="mb-3 text-sm font-bold text-gray-800">시도 횟수별 성공 분포</h4>
        {stats.success === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">기록 없음</p>
        ) : (
          <div className="space-y-1.5">
            {Array.from({ length: maxAttempts }, (_, i) => i + 1).map((attempt) => {
              const count = stats.dist?.[String(attempt)] ?? 0;
              return (
                <div key={attempt} className="flex items-center gap-2 text-sm">
                  <span className="w-6 shrink-0 text-gray-600">{attempt}회</span>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-gray-100">
                    <div
                      className="flex h-full items-center justify-end rounded bg-brand-500 px-2 text-[11px] font-bold text-white"
                      style={{ width: `${Math.max(count > 0 ? 12 : 0, (count / maxDist) * 100)}%` }}
                    >
                      {count > 0 ? count : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 최근 기록 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h4 className="mb-3 text-sm font-bold text-gray-800">최근 플레이</h4>
        {data.recent.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">아직 플레이 기록이 없어요.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.recent.map((item) => (
              <li key={item.gameId} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[item.status]}`}>
                  {STATUS_LABEL[item.status]}
                </span>
                <span className="font-semibold text-gray-800">{item.word}</span>
                <span className="text-gray-500">{item.attemptsUsed}회</span>
                <span className="text-gray-500">{fmtDuration(item.durationMs)}</span>
                {!item.isFirstAttempt && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">재도전</span>
                )}
                <span className="ml-auto text-xs text-gray-400">
                  {new Date(item.endedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">{data.note}</p>
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-base font-bold text-gray-800">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}
