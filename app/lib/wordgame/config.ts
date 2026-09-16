/**
 * 한글 단어 추리 게임 설정값
 *
 * 규칙이 바뀌면 RULE_VERSION 을 올린다.
 * RULE_ID 가 통계·랭킹의 분리 기준이므로, 규칙이 다른 기록은 절대 섞이지 않는다.
 */

export const RULE_VERSION = 1;

/** 자모 칸 수 */
export const JAMO_COUNT = 5;

/** 최대 시도 횟수 */
export const MAX_ATTEMPTS = 5;

/** 통계·랭킹 분리 키 */
export const RULE_ID = `v${RULE_VERSION}-j${JAMO_COUNT}-a${MAX_ATTEMPTS}`;

/** 이 시간이 지나도록 끝나지 않은 게임은 포기 처리 */
export const GAME_EXPIRY_MS = 24 * 60 * 60 * 1000;

/** 성공률 랭킹 최소 종료 게임 수 */
export const MIN_FINISHED_FOR_RATE_RANKING = 10;

/** 평균 시도/평균 시간 랭킹 최소 성공 게임 수 */
export const MIN_SUCCESS_FOR_AVG_RANKING = 10;

/** 목록 API 기본 페이지 크기 */
export const PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

/** 개인 기록 보관 개수 */
export const HISTORY_LIMIT = 300;

/** 직전 출제 단어 반복 방지 개수 */
export const RECENT_WORD_MEMORY = 5;

/** 요청 제한 (사용자·액션 단위) */
export const RATE_LIMITS = {
  start: { windowSec: 60, max: 30 },
  guess: { windowSec: 60, max: 120 },
  read: { windowSec: 60, max: 240 },
} as const;

/** 서비스 기준 시간대 (Asia/Seoul) */
export const TIMEZONE = 'Asia/Seoul';
export const TIMEZONE_OFFSET_MINUTES = 9 * 60;

export const RULE_SUMMARY = {
  ruleId: RULE_ID,
  ruleVersion: RULE_VERSION,
  jamoCount: JAMO_COUNT,
  maxAttempts: MAX_ATTEMPTS,
};

export type Period = 'today' | 'week' | 'month' | 'all';
export const PERIODS: Period[] = ['today', 'week', 'month', 'all'];

export type RankingType = 'success' | 'winRate' | 'avgAttempts' | 'avgTime' | 'maxStreak';
export const RANKING_TYPES: RankingType[] = ['success', 'winRate', 'avgAttempts', 'avgTime', 'maxStreak'];
