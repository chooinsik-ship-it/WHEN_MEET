import type { Mark } from '../hangul';

export type GameStatus = 'PLAYING' | 'SUCCESS' | 'FAILED' | 'ABANDONED';

export interface GuessRecord {
  /** 입력한 자모 */
  jamo: string[];
  /** 자모와 일치하는 사전 단어 (표시용) */
  word: string;
  marks: Mark[];
  at: number;
}

export interface GameRecord {
  gameId: string;
  userId: number;
  wordId: string;
  /** 정답. 진행 중에는 절대 클라이언트로 내보내지 않는다. */
  answer: string;
  answerJamo: string[];

  ruleId: string;
  ruleVersion: number;
  jamoCount: number;
  maxAttempts: number;

  status: GameStatus;
  attemptsUsed: number;
  guesses: GuessRecord[];

  startedAt: number;
  endedAt: number | null;
  durationMs: number | null;

  /** 이 사용자·단어·규칙 조합의 최초 도전인지 (서버가 게임 시작 시 확정) */
  isFirstAttempt: boolean;
  /** 단어별 랭킹 반영 대상 여부 */
  countsForWordRanking: boolean;
  /** 종료 집계가 반영되었는지 (중복 집계 방지) */
  aggregated: boolean;
}

/** 클라이언트로 내보내는 게임 뷰 */
export interface PublicGame {
  gameId: string;
  ruleId: string;
  ruleVersion: number;
  jamoCount: number;
  maxAttempts: number;
  status: GameStatus;
  attemptsUsed: number;
  guesses: { jamo: string[]; marks: Mark[]; word?: string }[];
  startedAt: number;
  endedAt: number | null;
  durationMs: number | null;
  isFirstAttempt: boolean;
  countsForWordRanking: boolean;
  /** 종료된 게임에서만 채워진다 */
  answer?: string;
  answerJamo?: string[];
  wordId?: string;
}

export interface UserAgg {
  started: number;
  finished: number;
  success: number;
  failed: number;
  abandoned: number;
  /** 성공 게임의 시도 횟수 합 */
  attemptsSum: number;
  /** 성공 게임의 소요 시간 합(ms) */
  durationSum: number;
  /** 가장 적은 시도로 성공한 시도 수 */
  bestAttempts: number | null;
  /** 그 시도 수로 성공한 횟수 */
  bestAttemptsCount: number;
  bestDurationMs: number | null;
  /** 시도 횟수별 성공 분포 */
  dist: Record<string, number>;
  curStreak: number;
  maxStreak: number;
  /** 이 버킷에서 첫 기록이 만들어진 시각 (동점 정렬용) */
  firstRecordedAt: number | null;
  lastEndedAt: number | null;
}

export interface WordResultEntry {
  userId: number;
  status: Exclude<GameStatus, 'PLAYING'>;
  attemptsUsed: number;
  durationMs: number;
  endedAt: number;
  gameId: string;
}

export interface HistoryEntry {
  gameId: string;
  wordId: string;
  word: string;
  status: Exclude<GameStatus, 'PLAYING'>;
  attemptsUsed: number;
  durationMs: number;
  endedAt: number;
  isFirstAttempt: boolean;
}

export interface UserWordEntry {
  wordId: string;
  word: string;
  status: Exclude<GameStatus, 'PLAYING'>;
  attemptsUsed: number;
  durationMs: number;
  endedAt: number;
}

export function emptyAgg(): UserAgg {
  return {
    started: 0,
    finished: 0,
    success: 0,
    failed: 0,
    abandoned: 0,
    attemptsSum: 0,
    durationSum: 0,
    bestAttempts: null,
    bestAttemptsCount: 0,
    bestDurationMs: null,
    dist: {},
    curStreak: 0,
    maxStreak: 0,
    firstRecordedAt: null,
    lastEndedAt: null,
  };
}
