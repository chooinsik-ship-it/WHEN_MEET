/**
 * 기간 집계 기준 (Asia/Seoul)
 *
 * - 오늘: 당일 00:00 ~ 다음 날 00:00 직전
 * - 주간: 월요일 00:00 ~ 다음 월요일 00:00 직전
 * - 월간: 1일 00:00 ~ 다음 달 1일 00:00 직전
 *
 * 버킷 키는 KST 기준 날짜 문자열이므로 서버 로컬 시간대와 무관하게 동작한다.
 */
import { TIMEZONE_OFFSET_MINUTES, type Period } from './config';

const OFFSET_MS = TIMEZONE_OFFSET_MINUTES * 60 * 1000;

/** UTC 타임스탬프를 KST 기준 달력 값으로 변환 */
function toSeoulParts(ts: number) {
  const shifted = new Date(ts + OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    // 0=일 … 6=토
    weekday: shifted.getUTCDay(),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' (KST) */
export function seoulDateString(ts: number): string {
  const { year, month, day } = toSeoulParts(ts);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** 해당 시각이 속한 주의 월요일 'YYYY-MM-DD' (KST) */
export function seoulWeekStart(ts: number): string {
  const { weekday } = toSeoulParts(ts);
  // 일요일(0)은 직전 월요일까지 6일 전
  const daysFromMonday = (weekday + 6) % 7;
  return seoulDateString(ts - daysFromMonday * 24 * 60 * 60 * 1000);
}

/** 'YYYY-MM' (KST) */
export function seoulMonthString(ts: number): string {
  const { year, month } = toSeoulParts(ts);
  return `${year}-${pad(month)}`;
}

/** 해당 시각이 속한 모든 집계 버킷 */
export function bucketsFor(ts: number): string[] {
  return [
    'all',
    `d:${seoulDateString(ts)}`,
    `w:${seoulWeekStart(ts)}`,
    `m:${seoulMonthString(ts)}`,
  ];
}

/** 조회 기간 → 버킷 키 */
export function bucketForPeriod(period: Period, now: number = Date.now()): string {
  switch (period) {
    case 'today':
      return `d:${seoulDateString(now)}`;
    case 'week':
      return `w:${seoulWeekStart(now)}`;
    case 'month':
      return `m:${seoulMonthString(now)}`;
    case 'all':
    default:
      return 'all';
  }
}

/** 기간의 시작 타임스탬프 (단어별 랭킹처럼 원본 기록을 필터링할 때 사용) */
export function periodStartTs(period: Period, now: number = Date.now()): number {
  if (period === 'all') return 0;

  const { year, month, day } = toSeoulParts(now);
  const startOfDayUtc = Date.UTC(year, month - 1, day) - OFFSET_MS;

  if (period === 'today') return startOfDayUtc;
  if (period === 'month') return Date.UTC(year, month - 1, 1) - OFFSET_MS;

  // week: 이번 주 월요일 00:00 KST
  const { weekday } = toSeoulParts(now);
  const daysFromMonday = (weekday + 6) % 7;
  return startOfDayUtc - daysFromMonday * 24 * 60 * 60 * 1000;
}

/** 소요 시간 표시 (mm:ss) */
export function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${pad(sec)}`;
}
