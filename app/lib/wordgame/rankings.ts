/**
 * 통계 · 종합 랭킹 · 단어별 랭킹 집계
 */
import {
  MIN_FINISHED_FOR_RATE_RANKING,
  MIN_SUCCESS_FOR_AVG_RANKING,
  type Period,
  type RankingType,
} from './config';
import { periodStartTs } from './time';
import type { UserAgg, WordResultEntry } from './types';

export interface RankRow {
  userId: number;
  nickname: string;
  avatar?: string;
  finished: number;
  success: number;
  /** 성공률 0~1, 종료 게임이 없으면 null */
  winRate: number | null;
  /** 성공 게임 평균 시도, 성공이 없으면 null */
  avgAttempts: number | null;
  /** 성공 게임 평균 시간(ms), 성공이 없으면 null */
  avgDurationMs: number | null;
  maxStreak: number;
  firstRecordedAt: number | null;
  /** 해당 랭킹의 정렬 대상 값 */
  metric: number | null;
}

export function toRow(userId: number, agg: UserAgg): Omit<RankRow, 'nickname' | 'avatar' | 'metric'> {
  return {
    userId,
    finished: agg.finished,
    success: agg.success,
    winRate: agg.finished > 0 ? agg.success / agg.finished : null,
    avgAttempts: agg.success > 0 ? agg.attemptsSum / agg.success : null,
    avgDurationMs: agg.success > 0 ? agg.durationSum / agg.success : null,
    maxStreak: agg.maxStreak,
    firstRecordedAt: agg.firstRecordedAt,
  };
}

/** 랭킹 유형별 최소 참여 조건 */
export function isEligible(type: RankingType, row: { finished: number; success: number }): boolean {
  switch (type) {
    case 'winRate':
      return row.finished >= MIN_FINISHED_FOR_RATE_RANKING;
    case 'avgAttempts':
    case 'avgTime':
      return row.success >= MIN_SUCCESS_FOR_AVG_RANKING;
    case 'success':
    case 'maxStreak':
    default:
      return row.finished > 0;
  }
}

/** 최소 참여 조건까지 남은 게임 수 */
export function missingForEligibility(
  type: RankingType,
  row: { finished: number; success: number }
): { need: number; kind: 'finished' | 'success' } | null {
  if (type === 'winRate') {
    const need = MIN_FINISHED_FOR_RATE_RANKING - row.finished;
    return need > 0 ? { need, kind: 'finished' } : null;
  }
  if (type === 'avgAttempts' || type === 'avgTime') {
    const need = MIN_SUCCESS_FOR_AVG_RANKING - row.success;
    return need > 0 ? { need, kind: 'success' } : null;
  }
  return row.finished > 0 ? null : { need: 1, kind: 'finished' };
}

function metricOf(type: RankingType, row: Omit<RankRow, 'nickname' | 'avatar' | 'metric'>): number | null {
  switch (type) {
    case 'success':
      return row.success;
    case 'winRate':
      return row.winRate;
    case 'avgAttempts':
      return row.avgAttempts;
    case 'avgTime':
      return row.avgDurationMs;
    case 'maxStreak':
      return row.maxStreak;
    default:
      return null;
  }
}

/** 값이 작을수록 좋은 랭킹인지 */
function isAscending(type: RankingType): boolean {
  return type === 'avgAttempts' || type === 'avgTime';
}

/**
 * 정렬 규칙
 * 1) 랭킹 유형의 기본 기준
 * 2) 동률이면 성공률 → 평균 시도 → 평균 시간 → 먼저 달성한 순
 *    (이미 1)에서 쓴 기준은 건너뛴다)
 * 3) 완전 동률이면 userId 로 안정 정렬 → 페이지네이션이 흔들리지 않는다
 */
export function compareRows(type: RankingType, a: RankRow, b: RankRow): number {
  const dir = isAscending(type) ? 1 : -1;
  const am = a.metric;
  const bm = b.metric;

  if (am !== bm) {
    if (am === null) return 1;
    if (bm === null) return -1;
    return (am - bm) * dir;
  }

  const tiebreakers: { key: RankingType; asc: boolean }[] = [
    { key: 'winRate', asc: false },
    { key: 'avgAttempts', asc: true },
    { key: 'avgTime', asc: true },
  ];

  for (const tb of tiebreakers) {
    if (tb.key === type) continue; // 이미 사용한 기준은 생략
    const av = tb.key === 'winRate' ? a.winRate : tb.key === 'avgAttempts' ? a.avgAttempts : a.avgDurationMs;
    const bv = tb.key === 'winRate' ? b.winRate : tb.key === 'avgAttempts' ? b.avgAttempts : b.avgDurationMs;
    if (av === bv) continue;
    if (av === null) return 1;
    if (bv === null) return -1;
    return tb.asc ? av - bv : bv - av;
  }

  // 먼저 달성한 순
  const at = a.firstRecordedAt ?? Number.MAX_SAFE_INTEGER;
  const bt = b.firstRecordedAt ?? Number.MAX_SAFE_INTEGER;
  if (at !== bt) return at - bt;

  return a.userId - b.userId;
}

export function buildRanking(
  type: RankingType,
  rows: (Omit<RankRow, 'metric'> & { metric?: number | null })[]
): RankRow[] {
  const withMetric: RankRow[] = rows
    .map((row) => ({ ...row, metric: metricOf(type, row) }))
    .filter((row) => isEligible(type, row) && row.metric !== null);

  return withMetric.sort((a, b) => compareRows(type, a, b));
}

/* ------------------------------------------------------------ 단어별 랭킹 */

export interface WordRankRow {
  rank: number;
  userId: number;
  nickname: string;
  avatar?: string;
  attemptsUsed: number;
  durationMs: number;
  endedAt: number;
}

export interface WordRankingResult {
  rows: WordRankRow[];
  stats: {
    /** 최초 도전을 종료한 사람 수 (성공/실패/포기 모두 포함) */
    participants: number;
    successCount: number;
    /** 참여자가 없으면 null */
    successRate: number | null;
    avgAttempts: number | null;
    avgDurationMs: number | null;
  };
}

/**
 * 단어별 랭킹
 * - 성공 기록만 순위 부여
 * - 시도 횟수 적은 순 → 소요 시간 짧은 순 → 먼저 성공한 순
 * - 참여자 수·성공률은 최초 도전을 "종료"한 사용자만 대상으로 계산한다
 */
export function buildWordRanking(
  results: WordResultEntry[],
  period: Period,
  now: number = Date.now()
): WordRankingResult {
  const start = periodStartTs(period, now);
  const inPeriod = results.filter((r) => r.endedAt >= start);

  // 사용자당 1건만 (최초 도전 점유로 이미 보장되지만 방어적으로 한 번 더)
  const byUser = new Map<number, WordResultEntry>();
  for (const r of inPeriod) {
    const prev = byUser.get(r.userId);
    if (!prev || r.endedAt < prev.endedAt) byUser.set(r.userId, r);
  }
  const unique = [...byUser.values()];

  const successes = unique.filter((r) => r.status === 'SUCCESS');
  successes.sort((a, b) => {
    if (a.attemptsUsed !== b.attemptsUsed) return a.attemptsUsed - b.attemptsUsed;
    if (a.durationMs !== b.durationMs) return a.durationMs - b.durationMs;
    if (a.endedAt !== b.endedAt) return a.endedAt - b.endedAt;
    return a.userId - b.userId;
  });

  const rows: WordRankRow[] = successes.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    nickname: '',
    attemptsUsed: r.attemptsUsed,
    durationMs: r.durationMs,
    endedAt: r.endedAt,
  }));

  const participants = unique.length;
  const successCount = successes.length;

  return {
    rows,
    stats: {
      participants,
      successCount,
      successRate: participants > 0 ? successCount / participants : null,
      avgAttempts:
        successCount > 0 ? successes.reduce((s, r) => s + r.attemptsUsed, 0) / successCount : null,
      avgDurationMs:
        successCount > 0 ? successes.reduce((s, r) => s + r.durationMs, 0) / successCount : null,
    },
  };
}
